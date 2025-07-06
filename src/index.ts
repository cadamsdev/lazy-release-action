import { exec } from '@actions/exec';
import { execSync } from 'child_process';
import {
  checkoutBranch,
  commitAndPushChanges,
  createOrCheckoutBranch,
  hasUnstagedChanges,
  setupGitConfig,
} from './api/git';
import { DEFAULT_BRANCH, GITHUB_TOKEN, NPM_TOKEN, PR_COMMENT_STATUS_ID, RELEASE_BRANCH, RELEASE_PR_TITLE } from './constants';
import {
  appendReleaseIdToMarkdown,
  Changelog,
  createChangelogFromChangelogItem,
  getChangelogFromMarkdown,
  getDirectoryNameFromPath,
  getPackageNameWithoutScope,
  getVersionPrefix,
  increaseHeadingLevel,
  parseReleasePRBody,
  RELEASE_ID,
  ReleasePackageInfo,
} from './utils';
import { globSync } from 'tinyglobby';
import { readFileSync, writeFileSync } from 'fs';
import * as githubApi from './api/github';
import { detect } from 'package-manager-detector/detect';
import { resolveCommand } from 'package-manager-detector/commands';
import { context } from '@actions/github';
import { getChangelogFromCommits } from './utils/changelog';
import { PackageInfo } from './types';
import { getPackageInfos } from './utils/package';
import { generateMarkdown } from './utils/markdown';
import { CONVENTIONAL_COMMITS_PATTERN, isPRTitleValid } from './utils/validation';
import { createSnapshot } from './core/snapshots';
import { applyNewVersion, getNewVersion, updatePackageJsonFile } from './core/version';
import { createOrUpdateChangelog } from './core/changelog';
import { createTags, publishPackages } from './core/publish';
import { createGitHubRelease } from './core/release';

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

export function updateIndirectPackageJsonFile(
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

export async function updatePackageLockFiles(dirPath = ''): Promise<void> {
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

export function getPackagePaths(): string[] {
  const packagePaths = globSync('**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  console.log('getPackagePaths', packagePaths);
  return packagePaths;
}
