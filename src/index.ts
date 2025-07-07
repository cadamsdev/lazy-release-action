import { execSync } from 'child_process';
import {
  checkoutBranch,
  commitAndPushChanges,
  createOrCheckoutBranch,
  getRecentCommits,
  hasUnstagedChanges,
  isLastCommitAReleaseCommit,
  setupGitConfig,
} from './api/git';
import { DEFAULT_BRANCH, GITHUB_TOKEN, NPM_TOKEN, RELEASE_BRANCH, RELEASE_PR_TITLE } from './constants';
import {
  appendReleaseIdToMarkdown,
  getPackageNameWithoutScope,
  parseReleasePRBody,
  ReleasePackageInfo,
} from './utils';
import * as githubApi from './api/github';
import { context } from '@actions/github';
import { getChangelogFromCommits } from './utils/changelog';
import { bumpIndirectPackageVersion, getChangedPackageInfos, getPackageInfos, getPackagePaths, updateIndirectPackageJsonFile, updatePackageJsonFile, updatePackageLockFiles } from './utils/package';
import { generateMarkdown } from './utils/markdown';
import { isPRTitleValid } from './utils/validation';
import { applyNewVersion } from './core/version';
import { createOrUpdateChangelog } from './core/changelog';
import { createTags, publishPackages } from './core/publish';
import { createGitHubRelease } from './core/release';
import { createOrUpdatePRStatusComment } from './core/comments';

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
