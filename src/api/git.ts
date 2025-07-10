import { execFileSync, execSync } from 'child_process';
import { DEFAULT_BRANCH, RELEASE_ID } from '../constants';
import { exec } from '@actions/exec';
import { CONVENTIONAL_COMMITS_PATTERN } from '../utils/validation';
import { context } from '@actions/github';
import { hasChangelogSection } from '../utils/markdown';

export function setupGitConfig() {
  console.log('Setting up git config');
  execFileSync('git', ['config', '--global', 'user.name', 'github-actions[bot]'], {
    stdio: 'inherit',
  });
  execFileSync(
    'git',
    ['config', '--global', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'],
    { stdio: 'inherit' }
  );
  execFileSync('git', ['config', '--global', '--add', 'safe.directory', '/github/workspace'], {
    stdio: 'inherit',
  });
}

export function checkoutBranch(branchName: string) {
  execFileSync('git', ['fetch', 'origin', branchName], { stdio: 'inherit' });
  execFileSync('git', ['checkout', branchName], { stdio: 'inherit' });
}

export function createOrCheckoutBranch(branchName: string) {
  try {
    execFileSync('git', ['checkout', branchName], { stdio: 'inherit' });
    console.log(`Switched to branch ${branchName}`);

    // merge default branch into the current branch
    try {
      execFileSync('git', ['merge', `origin/${DEFAULT_BRANCH}`], {
        stdio: 'inherit',
      });
      console.log(`Merged ${DEFAULT_BRANCH} into ${branchName}`);
      // oxlint-disable-next-line no-unused-vars
    } catch (mergeError) {
      console.log(
        `Merge conflicts detected, resolving by taking theirs strategy`
      );
      // Reset to clean state and merge with theirs strategy
      execFileSync('git', ['merge', '--abort'], { stdio: 'inherit' });
      execFileSync(
        'git',
        ['merge', '-X', 'theirs', `origin/${DEFAULT_BRANCH}`],
        {
          stdio: 'inherit',
        }
      );
      console.log(`Resolved merge conflicts by taking theirs strategy`);
    }

    // Push the updated branch to remote
    execFileSync('git', ['push', 'origin', branchName], { stdio: 'inherit' });
    console.log(`Pushed updated ${branchName} to remote`);

    // checkout all files from default branch
    execFileSync('git', ['checkout', `origin/${DEFAULT_BRANCH}`, '--', '.'], {
      stdio: 'inherit',
    });

    // commit and push
    execFileSync('git', ['add', '.'], { stdio: 'inherit' });
    execFileSync(
      'git',
      ['commit', '-m', `sync ${branchName} with ${DEFAULT_BRANCH}`],
      { stdio: 'inherit' }
    );
    execFileSync('git', ['push', 'origin', branchName], { stdio: 'inherit' });
    console.log(`Committed and pushed changes to ${branchName}`);
    // oxlint-disable-next-line no-unused-vars
  } catch (error) {
    console.log(`Branch ${branchName} does not exist, creating it.`);
    execFileSync('git', ['checkout', '-b', branchName], { stdio: 'inherit' });

    // Push the new branch to remote
    execFileSync('git', ['push', '-u', 'origin', branchName], {
      stdio: 'inherit',
    });
    console.log(`Created and pushed new branch ${branchName}`);
  }
}

export function commitAndPushChanges() {
  execFileSync('git', ['add', '.'], { stdio: 'inherit' });
  execFileSync('git', ['commit', '-m', 'update release branch'], { stdio: 'inherit' });
  execFileSync('git', ['push', 'origin', 'HEAD'], { stdio: 'inherit' });
}

export function hasUnstagedChanges(): boolean {
  try {
    const statusOutput = execSync('git status --porcelain', {
      encoding: 'utf-8',
    });
    return statusOutput.trim().length > 0;
  } catch (error) {
    console.error('Error checking git status:', error);
    return false;
  }
}

export function doesTagExistOnRemote(tagName: string): boolean {
  try {
    // First, fetch all remote tags to ensure we have the latest information
    execSync('git fetch --tags', { stdio: 'pipe' });

    // Check if the tag exists on remote
    const result = execSync(
      `git ls-remote --tags origin refs/tags/${tagName}`,
      {
        stdio: 'pipe',
        encoding: 'utf-8',
      }
    );
    return result.trim().length > 0;
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    // If the command exits with a non-zero status, the tag doesn't exist
    return false;
  }
}

export async function isLastCommitAReleaseCommit(): Promise<boolean> {
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

export interface Commit {
  hash: string;
  subject: string;
  body?: string;
}

export async function getRecentCommits(
  ignoreLastest: boolean = false
): Promise<Commit[]> {
  console.log('Getting recent commits...');
  console.log('Fetching commits since last release commit...');

  const HASH_SEPARATOR = '<HASH_SEPARATOR>';
  const SUBJECT_SEPARATOR = '<SUBJECT_SEPARATOR>';
  const COMMIT_SEPARATOR = '<COMMIT_SEPARATOR>';

  const data = execSync(
    `git log --pretty=format:"%h${HASH_SEPARATOR}%s${SUBJECT_SEPARATOR}%b${COMMIT_SEPARATOR}"`,
    {
      encoding: 'utf8',
      stdio: 'pipe',
    }
  );

  const gitLogItems = data
    .split(COMMIT_SEPARATOR)
    .map((msg) => msg.trim())
    .filter((msg) => msg !== '');

  const commits: Commit[] = [];

  console.log(`Found ${gitLogItems.length} commit items.`);

  for (let i = 0; i < gitLogItems.length; i++) {
    const item = gitLogItems[i];

    if (ignoreLastest && i === 0) {
      continue;
    }

    const hash = item.substring(0, item.indexOf(HASH_SEPARATOR));
    if (!hash) {
      console.warn('No commit hash found in item:', item);
      continue;
    }

    const subject = item.substring(item.indexOf(HASH_SEPARATOR) + HASH_SEPARATOR.length, item.indexOf(SUBJECT_SEPARATOR));
    if (!subject) {
      console.warn('No commit subject found in item:', item);
      continue;
    }

    const body = item.substring(item.indexOf(SUBJECT_SEPARATOR) + SUBJECT_SEPARATOR.length) || '';

    if (body && body.includes(RELEASE_ID)) {
      // get PR number from subject
      const prMatch = subject.match(/#(\d+)/);

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
      const prevItemBody = prevItem.substring(prevItem.indexOf(SUBJECT_SEPARATOR) + 1);

      const owner = context.repo.owner;
      const repo = context.repo.repo;
      const repoNameWithOwner = `${owner}/${repo}`;

      if (
        prevItemBody &&
        prevItemBody.includes(`Reverts ${repoNameWithOwner}${prNumberWithHash}`)
      ) {
        console.warn(
          `Skipping release commit ${hash} because it is reverted by the next commit.`
        );
        continue;
      }

      break; // Stop processing further commits if we found a release commit
    }

    commits.push({ hash, subject: subject.trim(), body: body.trim() });
  }

  console.log('Commits since last release:');
  commits.forEach((commit) => console.log(`${commit.hash}: ${commit.subject}`));

  // Filter for commits containing "## Changelog"
  const filteredCommits = commits.filter(
    (commit) =>
      CONVENTIONAL_COMMITS_PATTERN.test(commit.subject) ||
      (commit.body && hasChangelogSection(commit.body))
  );

  console.log('Filtered commits:');
  console.log(filteredCommits);

  return filteredCommits;
}
