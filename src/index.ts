import { exec } from '@actions/exec';
import { execFileSync, execSync } from 'child_process';
import {
  checkoutBranch,
  commitAndPushChanges,
  createOrCheckoutBranch,
  doesTagExistOnRemote,
  hasUnstagedChanges,
  setupGitConfig,
} from './api/git';
import { DEFAULT_BRANCH, GITHUB_TOKEN, SNAPSHOTS_ENABLED } from './constants';
import {
  appendReleaseIdToMarkdown,
  Changelog,
  CONVENTIONAL_COMMITS_PATTERN,
  createChangelogFromChangelogItem,
  generateChangelogContent,
  generateMarkdown,
  getChangelogFromCommits,
  getChangelogFromMarkdown,
  getDirectoryNameFromPath,
  getGitHubReleaseName,
  getPackageNameWithoutScope,
  getTagName,
  getVersionPrefix,
  increaseHeadingLevel,
  isPRTitleValid,
  parseReleasePRBody,
  RELEASE_ID,
  ReleasePackageInfo,
  SemverBump,
  toDirectoryPath,
  updateChangelog,
} from './utils';
import { globSync } from 'tinyglobby';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { inc } from 'semver';
import * as githubApi from './api/github';
import { join } from 'path';
import { detect } from 'package-manager-detector/detect';
import { resolveCommand } from 'package-manager-detector/commands';
import { setOutput } from '@actions/core';
import { context } from '@actions/github';

const RELEASE_BRANCH = 'lazy-release/main';
const PR_COMMENT_STATUS_ID = 'b3da20ce-59b6-4bbd-a6e3-6d625f45d008';
const RELEASE_PR_TITLE = 'Version Packages';

function preRun() {
  // print git version
  const version = execSync('git --version')?.toString().trim();
  console.log(`git: ${version.replace('git version ', '')}`);

  // print node version
  const nodeVersion = execSync('node --version')?.toString().trim();
  console.log(`node: ${nodeVersion}`);

  setupGitConfig();

  if (GITHUB_TOKEN) {
    execSync(
      `npm config set //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`,
      {
        stdio: 'inherit',
      }
    );
  }

  // checkout git branch
  checkoutBranch(DEFAULT_BRANCH);
}

async function isLastCommitAReleaseCommit(): Promise<boolean> {
  // check if last commit has the release id in the message
  let lastCommit = '';
  await exec('git', ['log', '-1', '--pretty=format:%B'], {
    listeners: {
      stdout: (data: Buffer) => {
        lastCommit = data.toString().trim();
      },
    },
    silent: true,
  });

  console.log(`lastCommit=${lastCommit}`);
  return lastCommit.includes(RELEASE_ID);
}

(async () => {
  preRun();

  if (context.payload.pull_request?.merged) {
    console.log(
      `Pull request #${context.payload.pull_request.number} has been merged.`
    );

    // check if the release PR has been merged
    const isRelease = await isLastCommitAReleaseCommit();
    if (isRelease) {
      await publish();
      return;
    }

    // the regular PR has been merged, so we need to create a release PR
    // create or update release PR
    await createOrUpdateReleasePR();
  } else if (!context.payload.pull_request?.merged) {
    console.log(
      `Pull request #${context.payload.pull_request?.number} is not merged yet.`
    );

    if (
      !isPRTitleValid(githubApi.PR_TITLE) &&
      githubApi.PR_TITLE !== RELEASE_PR_TITLE
    ) {
      await createOrUpdatePRStatusComment(false);
      throw new Error(`Invalid pull request title: ${githubApi.PR_TITLE}`);
    }
  
    await createOrUpdatePRStatusComment(true);
  }
})();

async function createSnapshot(changedPkgInfos: PackageInfo[]): Promise<SnapshotResult[]> {
  if (!SNAPSHOTS_ENABLED) {
    console.log('Snapshots are disabled, skipping snapshot creation.');
    return [];
  }

  const allPkgInfos = getPackageInfos(getPackagePaths());

  const snapshotResults: SnapshotResult[] = [];
  for (const pkgInfo of changedPkgInfos) {
    // create a snapshot for each changed package
    const snapshotResult = await createPackageSnapshot(pkgInfo, allPkgInfos);
    if (snapshotResult) {
      snapshotResults.push(snapshotResult);
    }
  }
  return snapshotResults;
}

interface SnapshotResult {
  packageName: string;
  newVersion: string;
}

async function createPackageSnapshot(pkgInfo: PackageInfo, allPkgInfos: PackageInfo[]): Promise<SnapshotResult | undefined> {
  console.log(`Creating snapshot for package: ${pkgInfo.name}`);

  const dirPath = toDirectoryPath(pkgInfo.path);
  if (!pkgInfo.isRoot && !existsSync(dirPath)) {
    console.warn(`Directory ${dirPath} does not exist, skipping snapshot.`);
    return;
  }

  const pm = await detect();
  if (!pm) {
    throw new Error('No package manager detected');
  }

  // rewrite the package.json version to a snapshot version
  const packageJsonPath = join(dirPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    console.warn(`Package.json file not found in ${dirPath}, skipping snapshot.`);
    return;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (packageJson.private) {
    console.warn(`Package ${pkgInfo.name} is private, skipping snapshot.`);
    return;
  }

  if (!packageJson.version) {
    console.warn(`No version found in package.json for ${pkgInfo.name}, skipping snapshot.`);
    return;
  }

  const newVersion = `${packageJson.version}-snapshot-${new Date().getTime()}`;
  pkgInfo.newVersion = newVersion;
  updateIndirectPackageJsonFile(pkgInfo, allPkgInfos);

  // update the package locks
  await updatePackageLockFiles(dirPath);

  // publish the package with npm publish --tag snapshot
  const fullPublishCommand = [pm.agent, 'publish', '--tag', 'snapshot'].join(' ');
  execSync(fullPublishCommand, { cwd: dirPath ? dirPath : undefined, stdio: 'inherit' });
  console.log(`Snapshot created for package: ${pkgInfo.name}`);

  return {
    packageName: pkgInfo.name,
    newVersion: newVersion,
  };
}

async function createOrUpdatePRStatusComment(shouldCreateSnapshot = false) {
  console.log('Creating or updating PR status comment...');

  let markdown = '## 🚀 Lazy Release Action\n';
  const prBody = context.payload.pull_request?.body;
  console.log('Pull request body');
  console.log(prBody);

  let changelogs: Changelog[] = [];

  // get all package infos
  const packagePaths = getPackagePaths();
  if (packagePaths.length === 0) {
    console.log('No package.json files found, skipping...');
    return;
  }

  console.log(`Found ${packagePaths.length} package.json files.`);

  const pkgInfos = getPackageInfos(packagePaths);
  if (pkgInfos.length === 0) {
    console.log('No packages found, skipping...');
    return;
  }

  console.log(`Found ${pkgInfos.length} packages.`);

  const rootPackageName = pkgInfos.find((pkg) => pkg.isRoot)?.name;

  if (prBody) {
    changelogs = getChangelogFromMarkdown(prBody, rootPackageName);
  } else if (githubApi.PR_TITLE) {
    const changelog = createChangelogFromChangelogItem(githubApi.PR_TITLE, rootPackageName);
    if (changelog) {
      changelogs.push(changelog);
    }
  }

  console.log(`Found ${changelogs.length} changelog entries.`);
  console.log(changelogs);

  if (changelogs.length) {
    markdown += '✅ Changelogs found.\n';
  } else if (changelogs.length === 0) {
    markdown += '⚠️ No changelogs found.\n';
  }

  const { changedPackageInfos, indirectPackageInfos } = getChangedPackageInfos(
    changelogs,
    pkgInfos
  );

  const pkgUpdateCount = changedPackageInfos.length + indirectPackageInfos.length;
  if (pkgUpdateCount) {
    markdown += `📦 ${pkgUpdateCount} ${
      pkgUpdateCount ? "package's" : 'package'
    } will be updated.\n`;
  } else {
    markdown += '⚠️ No packages changed.\n';
  }

  const lastCommitHash = execSync('git rev-parse HEAD').toString().trim();
  markdown += `Latest commit: ${lastCommitHash}\n\n`;

  if (changedPackageInfos.length) {
    console.log(`Found ${changedPackageInfos.length} changed packages.`);

    // update changed packages based on the changelogs
    changedPackageInfos.forEach((pkgInfo) => {
      updatePackageInfo(pkgInfo, changelogs);

      // update the package.json files with the new versions
      updatePackageJsonFile(pkgInfo);
    });

    // update indirect packages based on the changed packages
    indirectPackageInfos.forEach((pkgInfo) => {
      bumpIndirectPackageVersion(pkgInfo);

      updateIndirectPackageJsonFile(pkgInfo, pkgInfos);
    });

    // generate markdown from changelogs
    const content = generateMarkdown(
      changedPackageInfos,
      indirectPackageInfos,
      changelogs
    );

    markdown += increaseHeadingLevel(content.trim());
  }

  if (shouldCreateSnapshot) {
    const pm = await detect();
    if (!pm) {
      throw new Error('No package manager detected');
    }

    const rc = resolveCommand(pm.agent, 'install', []);
    if (!rc) {
      throw new Error(`Could not resolve command for ${pm.agent}`);
    }

    const allChangedPkgs = [...changedPackageInfos, ...indirectPackageInfos];
    const snapshotResults = await createSnapshot(allChangedPkgs);

    if (snapshotResults.length) {
      markdown += `\n\n## 📸 Snapshots\n`;

      snapshotResults.forEach((result, index) => {
        markdown += `\`\`\`\n`;
        markdown += `${rc.command} ${rc.args.join(' ')} ${result.packageName}${result.newVersion}\n`;
        markdown += `\`\`\``;

        if (index < snapshotResults.length - 1) {
          markdown += '\n\n';
        } 
      });
    }
  }

  markdown += `\n\n<!-- ${PR_COMMENT_STATUS_ID} -->`;

  const prComments = await githubApi.getPRComments();
  const existingComment = prComments.find((comment) =>
    comment.body?.includes(PR_COMMENT_STATUS_ID)
  );

  console.log('markdown');
  console.log(markdown);

  if (existingComment) {
    console.log('Updating existing PR status comment with ID');
    await githubApi.updatePRComment(existingComment.id, markdown);
  } else {
    console.log('Creating new PR status comment');
    await githubApi.createPRComment(markdown);
  }
}

async function publish(): Promise<void> {
  console.log('Publishing...');

  const prBody = context.payload.pull_request?.body;
  if (!prBody) {
    console.log('No pull request body found, skipping release creation.');
    return;
  }

  const changelogEntries = parseReleasePRBody(prBody);
  if (changelogEntries.length === 0) {
    console.log('No changelog data found, skipping release creation.');
    return;
  }

  console.log(`Found ${changelogEntries.length} changelog entries.`);
  console.log(changelogEntries);

  // get all package infos
  const packagePaths = getPackagePaths();
  if (packagePaths.length === 0) {
    console.log('No package.json files found, skipping release creation.');
    return;
  }

  console.log(`Found ${packagePaths.length} package.json files.`);

  const pkgInfos = getPackageInfos(packagePaths);
  if (pkgInfos.length === 0) {
    console.log('No packages found, skipping release creation.');
    return;
  }

  console.log(`Found ${pkgInfos.length} packages.`);

  const changedPkgInfos = pkgInfos.filter((pkg) =>
    changelogEntries.some(
      (data) =>
        data.heading.packageName === pkg.name ||
        data.heading.packageName === getPackageNameWithoutScope(pkg.name) ||
        (pkg.isRoot && data.heading.isRoot)
    )
  );

  console.log(`Found ${changedPkgInfos.length} changed packages.`);

  if (changedPkgInfos.length === 0) {
    console.log('No changed packages found, skipping release creation.');
    return;
  }

  const releasePkgInfos = changedPkgInfos
    .map((pkgInfo) => {
      const changelogEntry = changelogEntries.find(
        (entry) =>
          entry.heading.packageName === pkgInfo.name ||
          entry.heading.packageName ===
            getPackageNameWithoutScope(pkgInfo.name) ||
          (pkgInfo.isRoot && entry.heading.isRoot)
      );

      if (!changelogEntry) {
        console.warn(
          `No changelog entry found for package ${pkgInfo.name}, skipping.`
        );
        return null;
      }

      return {
        pkgInfo,
        changelogEntry,
      } as ReleasePackageInfo;
    })
    .filter((entry): entry is ReleasePackageInfo => entry !== null);

  createTags(changedPkgInfos);
  await publishPackages(changedPkgInfos);
  await createGitHubRelease(releasePkgInfos);
}

async function publishPackages(changedPkgInfos: PackageInfo[]): Promise<void> {
  console.log('Publishing packages...');

  let hasPublished: boolean = false;
  changedPkgInfos.forEach(async (pkgInfo) => {
    if (pkgInfo.isPrivate) {
      console.warn(`Package ${pkgInfo.name} is private, skipping publish.`);
      return;
    }

    if (!pkgInfo.version) {
      console.warn(`No version for package ${pkgInfo.name}, skipping publish.`);
      return;
    }

    console.log(
      `Publishing package ${pkgInfo.name} version ${pkgInfo.version}...`
    );

    const dirPath = toDirectoryPath(pkgInfo.path);

    const pm = await detect();
    if (!pm) {
      throw new Error('No package manager detected');
    }

    const fullPublishCommand = [pm.agent, 'publish'].join(' ');

    try {
      console.log(`Running package manager command: ${fullPublishCommand}`);
      execSync(fullPublishCommand, {
        stdio: 'inherit',
        cwd: dirPath,
      });
      hasPublished = true;
    } catch (error) {
      if (error instanceof Error) {
        // log error if its not a 409
        if (error.message.includes('409 Conflict')) {
          console.warn(`Package ${pkgInfo.name} already exists, skipping...`);
        } else {
          console.error(
            `Error publishing package ${pkgInfo.name}:`,
            error.message
          );
        }
      }
    }
  });

  console.log(
    hasPublished
      ? 'Packages published successfully.'
      : 'No packages were published.'
  );
  setOutput('published', hasPublished);
}

function createTags(packageInfos: PackageInfo[]): void {
  console.log('Creating tags...');

  const tagsToCreate: string[] = [];
  packageInfos.forEach((pkgInfo) => {
    if (!pkgInfo.version) {
      console.warn(
        `No version for package ${pkgInfo.name}, skipping tag creation.`
      );
      return;
    }

    const tagName = getTagName(pkgInfo);

    // Check if tag exists on remote
    const tagExists = doesTagExistOnRemote(tagName);
    if (tagExists) {
      console.log(`Tag ${tagName} already exists on remote, skipping...`);
      return;
    }

    console.log(`Creating tag: ${tagName}`);
    try {
      execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, {
        stdio: 'inherit',
      });
      tagsToCreate.push(tagName);
    } catch (error) {
      console.error(`Failed to create tag ${tagName}:`, error);
    }
  });

  if (tagsToCreate.length === 0) {
    console.log('No new tags to push.');
    return;
  }

  console.log(`Pushing ${tagsToCreate.length} new tags...`);
  try {
    execFileSync('git', ['push', '--tags'], { stdio: 'inherit' });
    console.log('Tags pushed successfully.');
  } catch (error) {
    console.error('Failed to push tags:', error);
  }
}

async function createGitHubRelease(
  releasePkgInfos: ReleasePackageInfo[]
): Promise<void> {
  console.log('Creating GitHub release...');

  for (const releasePkgInfo of releasePkgInfos) {
    const { changelogEntry, pkgInfo } = releasePkgInfo;
    if (!changelogEntry.heading.newVersion) {
      console.warn(
        `No version for package ${changelogEntry.heading.newVersion}, skipping release creation.`
      );
      continue;
    }

    const tagName = getTagName(releasePkgInfo.pkgInfo);

    // Check if tag exists on remote
    const tagExists = doesTagExistOnRemote(tagName);
    if (!tagExists) {
      console.warn(
        `Tag ${tagName} does not exist on remote, skipping release creation.`
      );
      continue;
    }

    const releaseName = getGitHubReleaseName(pkgInfo);
    console.log(`Creating release for ${releaseName}...`);
    await githubApi.createGitHubRelease({
      tag_name: tagName,
      name: releaseName,
      body: changelogEntry.content.trim(),
    });
  }
}

export interface Commit {
  hash: string;
  message: string;
}

async function getRecentCommits(
  ignoreLastest: boolean = false
): Promise<Commit[]> {
  console.log('Getting recent commits...');

  let stdoutBuffer = '';

  console.log('Fetching commits since last release commit...');
  await exec(
    'git',
    [
      'log',
      '--pretty=format:%h:%B%n<COMMIT_SEPARATOR>', // Add a custom separator between commits
    ],
    {
      listeners: {
        stdout: (data: Buffer) => {
          stdoutBuffer += data.toString();
        },
      },
      silent: true,
    }
  );

  const gitLogItems = stdoutBuffer
    .split('<COMMIT_SEPARATOR>')
    .map((msg) => msg.trim())
    .filter((msg) => msg !== '');

  const commits: Commit[] = [];

  console.log(`Found ${gitLogItems.length} commit items.`);

  for (let i = 0; i < gitLogItems.length; i++) {
    const item = gitLogItems[i];

    if (ignoreLastest && i === 0) {
      continue;
    }

    const hash = item.substring(0, item.indexOf(':'));
    if (!hash) {
      console.warn('No commit hash found in item:', item);
      continue;
    }

    const message = item.substring(item.indexOf(':') + 1);
    if (!message) {
      console.warn('No commit message found in item:', item);
      continue;
    }

    if (message.includes(RELEASE_ID)) {
      // get PR number from message
      const prMatch = message.match(/#(\d+)/);

      if (!prMatch) {
        console.warn(
          `Skipping release commit ${hash} because it does not contain a PR number.`
        );
        continue;
      }

      const prNumberWithHash = prMatch[0];
      const prevIndex = i - 1;

      if (prevIndex < 0) {
        console.warn(
          `Skipping release commit ${hash} because it is the first commit.`
        );
        continue;
      }

      const prevItem = gitLogItems[prevIndex];
      const prevItemmMsg = prevItem.substring(prevItem.indexOf(':') + 1);

      const owner = context.repo.owner;
      const repo = context.repo.repo;
      const repoNameWithOwner = `${owner}/${repo}`;

      if (
        prevItemmMsg &&
        prevItemmMsg.includes(`Reverts ${repoNameWithOwner}${prNumberWithHash}`)
      ) {
        console.warn(
          `Skipping release commit ${hash} because it is reverted by the next commit.`
        );
        continue;
      }

      break; // Stop processing further commits if we found a release commit
    }

    commits.push({ hash, message: message.trim() });
  }

  console.log('Commits since last release:');
  console.log(commits);

  // Filter for commits containing "## Changelog"
  const filteredCommits = commits.filter(
    (commit) =>
      CONVENTIONAL_COMMITS_PATTERN.test(commit.message) ||
      commit.message.includes('## Changelog')
  );

  console.log('Filtered commits:');
  console.log(filteredCommits);

  return filteredCommits;
}

async function getLastReleaseCommitHash(
  ignoreLatest: boolean = false
): Promise<string> {
  console.log('Getting last release commit hash...');
  let lastCommitHash = '';
  let releaseCommits: string[] = [];

  // Get more commits than we need to check for revert patterns
  const limit = ignoreLatest ? '5' : '3'; // Increased limit to have enough commits to analyze
  await exec(
    'git',
    ['log', '--format=%H:%s%n<COMMIT_SEPARATOR>', '-n', limit],
    {
      listeners: {
        stdout: (data: Buffer) => {
          const lines = data.toString().trim().split('\n').filter(Boolean);
          lines.forEach((line) => {});
        },
      },
      silent: true,
    }
  );

  if (releaseCommits.length === 0) {
    throw new Error('No release commit found');
  }

  // Check each release commit to see if the next commit is a revert
  for (let i = 0; i < releaseCommits.length; i++) {
    const currentHash = releaseCommits[i];

    // Skip this commit if it's followed by a revert
    let isRevertedCommit = false;

    // Check if the next commit after this one is a revert
    await exec(
      'git',
      ['log', `${currentHash}^..${currentHash}^1`, '--format=%s'],
      {
        listeners: {
          stdout: (data: Buffer) => {
            const commitMessage = data.toString().trim();
            if (commitMessage.startsWith('Revert "')) {
              console.log(
                `Commit ${currentHash} is reverted by the next commit, skipping...`
              );
              isRevertedCommit = true;
            }
          },
        },
        silent: true,
      }
    );

    if (!isRevertedCommit) {
      // If ignoring latest valid release commit and we have another one, use the next one
      if (ignoreLatest && i === 0 && releaseCommits.length > 1) {
        continue;
      }

      lastCommitHash = currentHash;
      break;
    }
  }

  if (!lastCommitHash) {
    throw new Error('No valid release commit found (all were reverted)');
  }

  console.log(`Last release commit hash: ${lastCommitHash}`);
  return lastCommitHash;
}

async function createOrUpdateReleasePR() {
  console.log('Create or update release PR...');

  const commits = await getRecentCommits();

  // get list of packages
  const packagePaths = getPackagePaths();

  // get package data from package.json files
  const packageInfos = getPackageInfos(packagePaths);

  const rootPackageName = packageInfos.find((pkg) => pkg.isRoot)?.name;

  // get changelog from commits
  const changelogs = getChangelogFromCommits(commits, rootPackageName);

  const { changedPackageInfos, indirectPackageInfos } = getChangedPackageInfos(
    changelogs,
    packageInfos
  );

  if (changedPackageInfos.length === 0) {
    console.log('No packages changed, skipping release PR creation.');
    return;
  }

  // checkout release branch
  await createOrCheckoutBranch(RELEASE_BRANCH);

  // update changed packages based on the changelogs
  changedPackageInfos.forEach((pkgInfo) => {
    updatePackageInfo(pkgInfo, changelogs);

    // update the package.json files with the new versions
    updatePackageJsonFile(pkgInfo);

    // create or update changelog files
    createOrUpdateChangelog(pkgInfo, changelogs);
  });

  // update indirect packages based on the changed packages
  indirectPackageInfos.forEach((pkgInfo) => {
    bumpIndirectPackageVersion(pkgInfo);

    updateIndirectPackageJsonFile(pkgInfo, packageInfos);

    createOrUpdateChangelog(pkgInfo, []);
  });

  // generate markdown from changelogs
  const markdown = generateMarkdown(
    changedPackageInfos,
    indirectPackageInfos,
    changelogs
  );

  console.log('Generated markdown:');
  console.log(markdown);

  // update package-lock.json files
  await updatePackageLockFiles();

  if (hasUnstagedChanges()) {
    // commit the changes
    commitAndPushChanges();
  }

  // create or update PR
  await githubApi.createOrUpdatePR({
    title: 'Version Packages',
    body: appendReleaseIdToMarkdown(markdown),
    head: RELEASE_BRANCH,
  });
}

function updateIndirectPackageJsonFile(
  pkgInfo: PackageInfo,
  allPackageInfos: PackageInfo[]
): void {
  if (!pkgInfo.newVersion) {
    return;
  }

  const packageJsonPath = pkgInfo.path;
  let packageJsonString = readFileSync(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonString);

  // Update the version in the package.json
  packageJson.version = pkgInfo.newVersion;

  // Update dependencies that reference other packages in the workspace
  const dependencyFields = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  for (const field of dependencyFields) {
    if (packageJson[field]) {
      for (const depName of Object.keys(packageJson[field])) {
        // Find if this dependency is one of our workspace packages
        const depPackageInfo = allPackageInfos.find(
          (pkg) => pkg.name === depName
        );
        if (depPackageInfo && depPackageInfo.newVersion) {
          const currentVersionSpec = packageJson[field][depName];
          const prefix = getVersionPrefix(currentVersionSpec);
          const newVersionSpec = prefix + depPackageInfo.newVersion;

          console.log(
            `Updating dependency ${depName} from ${currentVersionSpec} to ${newVersionSpec} in ${pkgInfo.name}`
          );

          packageJson[field][depName] = newVersionSpec;
        }
      }
    }
  }

  console.log(`Updating ${pkgInfo.name} to version ${pkgInfo.newVersion}`);

  // go through all the packages, update any package.json files that reference this package
  allPackageInfos.forEach((otherPkg) => {
    updateDependentPackages(pkgInfo, otherPkg);
  });

  // Write the updated package.json back to the file
  writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );
}

function updateDependentPackages(
  indirectPkgInfo: PackageInfo,
  otherPkg: PackageInfo
): void {
  // check if other pkg depends on the indirect package
  if (!otherPkg.dependencies.includes(indirectPkgInfo.name)) {
    return; // No dependency, nothing to update
  }

  console.log(
    `Updating dependent package ${otherPkg.name} for indirect package ${indirectPkgInfo.name}`
  );

  // Read the package.json of the other package
  const otherPackageJsonPath = otherPkg.path;
  let otherPackageJsonString = readFileSync(otherPackageJsonPath, 'utf-8');
  const otherPackageJson = JSON.parse(otherPackageJsonString);

  const dependencyFields = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  for (const field of dependencyFields) {
    if (otherPackageJson[field]) {
      for (const depName of Object.keys(otherPackageJson[field])) {
        // Find if this dependency is one of our workspace packages
        if (depName !== indirectPkgInfo.name) {
          continue;
        }

        const currentVersionSpec = otherPackageJson[field][depName];
        const prefix = getVersionPrefix(currentVersionSpec);
        let newPackageVersion = prefix + indirectPkgInfo.newVersion;
        if (indirectPkgInfo.newVersion?.includes('-snapshot')) {
          newPackageVersion = indirectPkgInfo.newVersion;
        }

        console.log(
          `Updating dependency ${depName} from ${currentVersionSpec} to ${newPackageVersion} in ${otherPkg.name}`
        );

        otherPackageJson[field][depName] = newPackageVersion;
      }
    }
  }

  // Write the updated package.json back to the file
  writeFileSync(
    otherPackageJsonPath,
    JSON.stringify(otherPackageJson, null, 2) + '\n',
    'utf-8'
  );
}

function bumpIndirectPackageVersion(pkgInfo: PackageInfo): void {
  // TODO implement fixed logic for indirect packages

  pkgInfo.newVersion = getNewVersion(pkgInfo.version, 'patch');
}

export function getPackageInfos(packagePaths: string[]): PackageInfo[] {
  const packageInfos = packagePaths.map((packagePath) =>
    getPackageInfo(packagePath)
  );

  // find dependencies for each package
  packageInfos.forEach((pkgInfo) => {
    const packageJsonString = readFileSync(pkgInfo.path, 'utf-8');
    const packageJson = JSON.parse(packageJsonString);

    const allDeps = new Set<string>();

    // Collect all types of dependencies
    const dependencyFields = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ];
    for (const field of dependencyFields) {
      if (packageJson[field]) {
        Object.keys(packageJson[field]).forEach((dep) => allDeps.add(dep));
      }
    }

    // Filter to only include workspace packages
    pkgInfo.dependencies = packageInfos
      .filter((p) => p.name !== pkgInfo.name && allDeps.has(p.name))
      .map((p) => p.name);
  });
  return packageInfos;
}

async function updatePackageLockFiles(dirPath = ''): Promise<void> {
  const pm = await detect();

  if (!pm) {
    throw new Error('No package manager detected');
  }

  const rc = resolveCommand(pm.agent, 'install', []);

  if (!rc?.command) {
    throw new Error(`No command found for package manager ${pm.agent}`);
  }

  const fullCommand = [rc.command, ...(rc.args || [])].join(' ');
  console.log(`Running package manager command: ${fullCommand}`);

  execSync(fullCommand, {
    cwd: dirPath ? dirPath : undefined,
    stdio: 'inherit',
  });
}

function createOrUpdateChangelog(
  packageInfo: PackageInfo,
  changelogs: Changelog[]
): void {
  const dirPath = toDirectoryPath(packageInfo.path);

  console.log(
    `Creating or updating changelog for package: ${packageInfo.name} at ${dirPath}`
  );

  const changelogFilePath = join(dirPath, 'CHANGELOG.md');

  // generate changelog content
  const changelogContent = generateChangelogContent(packageInfo, changelogs);
  console.log(
    `Generated changelog content for ${packageInfo.name}:\n${changelogContent}`
  );

  // check if changelog file exists
  if (existsSync(changelogFilePath)) {
    // update changelog file
    const existingChangelogContent = readFileSync(changelogFilePath, 'utf-8');
    console.log(
      `Existing changelog content for ${packageInfo.name}:\n${existingChangelogContent}`
    );

    const updatedChangelogContent = updateChangelog(
      existingChangelogContent,
      changelogContent,
      packageInfo.newVersion
    );
    console.log(`Updating changelog file at ${changelogFilePath}`);
    console.log(`Updated changelog content:\n${updatedChangelogContent}`);

    writeFileSync(changelogFilePath, updatedChangelogContent, 'utf-8');
  } else {
    console.log(
      `Changelog file does not exist at ${changelogFilePath}, creating new one.`
    );
    // create changelog file
    writeFileSync(changelogFilePath, changelogContent, 'utf-8');
  }
}

export function updatePackageJsonFile(packageInfo: PackageInfo): void {
  if (!packageInfo.newVersion) {
    return;
  }

  const packageJsonPath = packageInfo.path;
  let packageJsonString = readFileSync(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonString);

  // Update the version in the package.json
  packageJson.version = packageInfo.newVersion;

  console.log(
    `Updating ${packageInfo.name} to version ${packageInfo.newVersion}`
  );

  // Write the updated package.json back to the file
  writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );
}

export function updatePackageInfo(
  packageInfo: PackageInfo,
  changelogs: Changelog[]
): void {
  const packageNameWithoutScope = getPackageNameWithoutScope(packageInfo.name);

  let semver = 'patch' as SemverBump;

  for (const changelog of changelogs) {
    const isRelevant =
      (changelog.packages.length > 0 &&
        changelog.packages.some(
          (pkgName) => pkgName === packageNameWithoutScope
        )) ||
      (packageInfo.isRoot && changelog.packages.length === 0);

    if (!isRelevant) {
      continue;
    }

    if (changelog.isBreakingChange) {
      semver = 'major';
      break; // Breaking changes take precedence
    } else if (changelog.semverBump === 'minor' && semver !== 'major') {
      semver = 'minor';
    }
  }

  packageInfo.newVersion = getNewVersion(packageInfo.version, semver);
}

export function getChangedPackages(
  changelogs: Changelog[],
  rootPackageName?: string
): string[] {
  const changedPackages = new Set<string>();
  let hasRootPackageChanged = false;
  for (const changelog of changelogs) {
    if (changelog.packages.length === 0) {
      hasRootPackageChanged = true;
      continue; // This changelog applies to the root package
    }

    for (const pkgName of changelog.packages) {
      changedPackages.add(pkgName);
    }
  }

  if (rootPackageName && hasRootPackageChanged) {
    changedPackages.add(getPackageNameWithoutScope(rootPackageName));
  }

  return Array.from(changedPackages);
}

export function getChangedPackageInfos(
  changelogs: Changelog[],
  allPkgInfos: PackageInfo[]
): { changedPackageInfos: PackageInfo[]; indirectPackageInfos: PackageInfo[] } {
  const rootPackageName = allPkgInfos.find((pkg) => pkg.isRoot)?.name;
  const directlyChangedPackages = getChangedPackages(
    changelogs,
    rootPackageName
  );

  console.log('allPkgInfos', allPkgInfos);

  // Find packages that are directly changed
  const directlyChangedPackageInfos = allPkgInfos.filter((pkg) =>
    directlyChangedPackages.includes(getPackageNameWithoutScope(pkg.name)) ||
    directlyChangedPackages.includes(getDirectoryNameFromPath(pkg.path))
  );

  console.log('directlyChangedPackageInfos:', directlyChangedPackageInfos);

  // Find packages that have dependencies on changed packages
  const indirectlyChangedPackageInfos = allPkgInfos.filter((pkg) => {
    // Skip if already directly changed
    if (
      directlyChangedPackages.includes(getPackageNameWithoutScope(pkg.name)) ||
      directlyChangedPackages.includes(getDirectoryNameFromPath(pkg.path))
    ) {
      return false;
    }

    // Check if any of its dependencies are in the directly changed packages
    return pkg.dependencies.some((dep) =>
      directlyChangedPackages.includes(getPackageNameWithoutScope(dep)) ||
      directlyChangedPackages.includes(getDirectoryNameFromPath(dep))
    );
  });

  console.log('indirectlyChangedPackageInfos:', indirectlyChangedPackageInfos);

  return {
    changedPackageInfos: directlyChangedPackageInfos,
    indirectPackageInfos: indirectlyChangedPackageInfos,
  };
}

export function getNewVersion(
  currentVersion: string,
  semverBump: SemverBump
): string {
  let newVersion = currentVersion;
  switch (semverBump) {
    case 'major':
      newVersion = inc(newVersion, 'major') || '';
      break;
    case 'minor':
      newVersion = inc(newVersion, 'minor') || '';
      break;
    default:
      newVersion = inc(newVersion, 'patch') || '';
      break;
  }

  return newVersion;
}

function findPackageJsonFiles(dir: string, relativePath: string = ''): string[] {
  const packagePaths: string[] = [];
  try {
    const items = readdirSync(dir);

    for (const item of items) {
      const fullPath = join(dir, item);
      const itemRelativePath = relativePath ? join(relativePath, item) : item;

      // Skip node_modules and dist directories
      if (item === 'node_modules' || item === 'dist') {
        continue;
      }

      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively search subdirectories
        findPackageJsonFiles(fullPath, itemRelativePath);
      } else if (item === 'package.json') {
        // Found a package.json file
        packagePaths.push(itemRelativePath);
      }
    }
  } catch (error) {
    console.warn(`Error reading directory ${dir}:`, error);
  }

  return packagePaths;
}

export function getPackagePaths(): string[] {
  const packagePaths = globSync('**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  console.log('getPackagePaths', packagePaths);

  const packagePaths2 = findPackageJsonFiles(process.cwd());
  console.log('packagePaths2', packagePaths2);

  return packagePaths;
}

export interface PackageInfo {
  name: string;
  version: string;
  newVersion?: string;
  path: string;
  isRoot: boolean;
  isPrivate: boolean;
  dependencies: string[];
}

export function getPackageInfo(packagePath: string): PackageInfo {
  const packageJsonString = readFileSync(packagePath, 'utf-8');
  const packageJson = JSON.parse(packageJsonString);

  const packageInfo: PackageInfo = {
    name: packageJson.name,
    version: packageJson.version,
    path: packagePath,
    isRoot: packagePath === 'package.json',
    isPrivate: packageJson.private || false,
    dependencies: [],
  };

  return packageInfo;
}
