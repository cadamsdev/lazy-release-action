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
import { DEFAULT_BRANCH, GITHUB_TOKEN, NPM_TOKEN, SNAPSHOTS_ENABLED } from './constants';
import {
  appendReleaseIdToMarkdown,
  Changelog,
  createChangelogFromChangelogItem,
  getChangelogFromMarkdown,
  getDirectoryNameFromPath,
  getGitHubReleaseName,
  getPackageNameWithoutScope,
  getTagName,
  getVersionPrefix,
  increaseHeadingLevel,
  parseReleasePRBody,
  RELEASE_ID,
  ReleasePackageInfo,
  SemverBump,
  toDirectoryPath,
  updateChangelog,
} from './utils';
import { globSync } from 'tinyglobby';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { inc } from 'semver';
import * as githubApi from './api/github';
import { join } from 'path';
import { detect } from 'package-manager-detector/detect';
import { resolveCommand } from 'package-manager-detector/commands';
import { setOutput } from '@actions/core';
import { context } from '@actions/github';
import { generateChangelogContent, getChangelogFromCommits } from './utils/changelog';
import { PackageInfo } from './types';
import { getPackageInfos } from './utils/package';
import { generateMarkdown } from './utils/markdown';
import { CONVENTIONAL_COMMITS_PATTERN, isPRTitleValid } from './utils/validation';

const RELEASE_BRANCH = 'lazy-release/main';
const PR_COMMENT_STATUS_ID = 'b3da20ce-59b6-4bbd-a6e3-6d625f45d008';
const RELEASE_PR_TITLE = 'Version Packages';

(async () => {
  init();

  if (context.payload.pull_request?.merged) {
    // checkout git branch
    checkoutBranch(DEFAULT_BRANCH);

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

function init() {
  // print git version
  const version = execSync('git --version')?.toString().trim();
  console.log(`git: ${version.replace('git version ', '')}`);

  // print node version
  const nodeVersion = execSync('node --version')?.toString().trim();
  console.log(`node: ${nodeVersion}`);

  setupGitConfig();
  setNpmConfig();
}

function setNpmConfig() {
  console.log('Setting npm config...');

  if (NPM_TOKEN) {
    // publish to npm
    console.log('Setting npm token...');
    execSync(`npm config set //registry.npmjs.org/:_authToken=${NPM_TOKEN}`, {
      stdio: 'inherit',
    });
  }

  if (GITHUB_TOKEN) {
    console.log('Setting GitHub token...');
    execSync(
      `npm config set //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}`,
      {
        stdio: 'inherit',
      }
    );
  }
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

  const allPkgInfos = getPackageInfos(packagePaths);
  if (allPkgInfos.length === 0) {
    console.log('No packages found, skipping...');
    return;
  }

  console.log(`Found ${allPkgInfos.length} packages.`);

  const rootPackageName = allPkgInfos.find((pkg) => pkg.isRoot)?.name;

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
    allPkgInfos
  );

  const pkgUpdateCount = changedPackageInfos.length + indirectPackageInfos.length;
  if (pkgUpdateCount) {
    markdown += `📦 ${pkgUpdateCount} ${
      pkgUpdateCount ? "package's" : 'package'
    } will be updated.\n`;
  } else {
    markdown += '⚠️ No packages changed.\n';
  }

  const latestCommitHash = context.payload.pull_request?.head.sha;
  if (latestCommitHash) {
    console.log(`Latest commit hash: ${latestCommitHash}`);
    markdown += `Latest commit: ${latestCommitHash}\n\n`;
  }

  if (changedPackageInfos.length) {
    console.log(`Found ${changedPackageInfos.length} changed packages.`);

    changedPackageInfos.forEach((pkgInfo) => {
      // apply the new version based on the changelogs
      applyNewVersion(pkgInfo, changelogs);
    });

    changedPackageInfos.forEach((pkgInfo) => {
      // update the package.json version with the new version
      // bump any dependency versions that reference other packages in the workspace
      updatePackageJsonFile(pkgInfo, allPkgInfos);
    });

    // update indirect packages based on the changed packages
    indirectPackageInfos.forEach((pkgInfo) => {
      bumpIndirectPackageVersion(pkgInfo);

      updateIndirectPackageJsonFile(pkgInfo, allPkgInfos);
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

      setPackageVersionOutput(pkgInfo);
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

function setPackageVersionOutput(pkgInfo: PackageInfo): void {
  const outputName = `${getPackageNameWithoutScope(pkgInfo.name)}_version`;
  console.log(`Setting output for ${outputName} to ${pkgInfo.version}`);
  setOutput(outputName, pkgInfo.version);
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

async function createOrUpdateReleasePR() {
  console.log('Create or update release PR...');

  // checkout release branch
  await createOrCheckoutBranch(RELEASE_BRANCH);

  const commits = await getRecentCommits();

  // get list of packages
  const packagePaths = getPackagePaths();

  // get package data from package.json files
  const allPkgInfos = getPackageInfos(packagePaths);

  const rootPackageName = allPkgInfos.find((pkg) => pkg.isRoot)?.name;

  // get changelog from commits
  const changelogs = getChangelogFromCommits(commits, rootPackageName);

  const { changedPackageInfos, indirectPackageInfos } = getChangedPackageInfos(
    changelogs,
    allPkgInfos
  );

  if (changedPackageInfos.length === 0) {
    console.log('No packages changed, skipping release PR creation.');
    return;
  }

  changedPackageInfos.forEach((pkgInfo) => {
    // apply the new version based on the changelogs
    applyNewVersion(pkgInfo, changelogs);
  });

  changedPackageInfos.forEach((pkgInfo) => {
    // update the package.json files with the new versions
    updatePackageJsonFile(pkgInfo, allPkgInfos);

    // create or update changelog files
    createOrUpdateChangelog(pkgInfo, changelogs);
  });

  // update indirect packages based on the changed packages
  indirectPackageInfos.forEach((pkgInfo) => {
    bumpIndirectPackageVersion(pkgInfo);
    updateIndirectPackageJsonFile(pkgInfo, allPkgInfos);
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

export function updatePackageJsonFile(pkgInfo: PackageInfo, allPkgInfos: PackageInfo[]): void {
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
        const depPackageInfo = allPkgInfos.find(
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

  console.log(
    `Updating ${pkgInfo.name} to version ${pkgInfo.newVersion}`
  );

  // Write the updated package.json back to the file
  writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );
}

export function applyNewVersion(
  packageInfo: PackageInfo,
  changelogs: Changelog[]
): void {
  const isV0 = packageInfo.version.startsWith('0.');
  const packageNameWithoutScope = getPackageNameWithoutScope(packageInfo.name);
  const directoryName = getDirectoryNameFromPath(packageInfo.path);

  let semver = 'patch' as SemverBump;

  for (const changelog of changelogs) {
    const isRelevant =
      (changelog.packages.length > 0 &&
        changelog.packages.some(
          (pkgName) =>
            pkgName === packageNameWithoutScope || pkgName === directoryName
        )) ||
      (packageInfo.isRoot && changelog.packages.length === 0);

    if (!isRelevant) {
      continue;
    }

    if (changelog.isBreakingChange && isV0) {
      semver = 'minor'; // In v0, breaking changes are treated as minor bumps
    } else if (changelog.isBreakingChange) {
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
  console.log('allPkgInfos', allPkgInfos);

  const rootPackageName = allPkgInfos.find((pkg) => pkg.isRoot)?.name;
  console.log('rootPackageName:', rootPackageName);

  const directlyChangedPkgNames = getChangedPackages(
    changelogs,
    rootPackageName
  );
  console.log('directlyChangedPkgNames:', directlyChangedPkgNames);

  // Find packages that are directly changed
  const directlyChangedPackageInfos = allPkgInfos.filter((pkg) =>
    directlyChangedPkgNames.includes(getPackageNameWithoutScope(pkg.name)) ||
    directlyChangedPkgNames.includes(getDirectoryNameFromPath(pkg.path))
  );
  console.log('directlyChangedPackageInfos:', directlyChangedPackageInfos);

  // Find packages that have dependencies on changed packages
  const indirectlyChangedPackageInfos = allPkgInfos.filter((pkg) => {
    const found = directlyChangedPackageInfos.find((changedPkg) => changedPkg.name === pkg.name);

    if (found) {
      // If the package itself is directly changed, skip it
      return false;
    }

    // Check if any of its dependencies are in the directly changed packages
    return pkg.dependencies.some((depName) => directlyChangedPackageInfos.some(
      (changedPkg) => changedPkg.name === depName
    ));
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

export function getPackagePaths(): string[] {
  const packagePaths = globSync('**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  console.log('getPackagePaths', packagePaths);
  return packagePaths;
}
