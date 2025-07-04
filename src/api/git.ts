import { execFileSync, execSync } from 'child_process';
import { DEFAULT_BRANCH } from '../constants';
import { getPackagePaths } from '..';
import { toDirectoryPath } from '../utils';

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

    execFileSync('git', ['fetch', 'origin'], { stdio: 'inherit' });
    execFileSync('git', ['reset', '--hard', `origin/${DEFAULT_BRANCH}`], {
      stdio: 'inherit',
    });

    // Check if there are any changes to commit
    if (hasUnstagedChanges()) {
      execFileSync('git', ['add', '.'], { stdio: 'inherit' });
      execFileSync(
        'git',
        ['commit', '-m', `Sync ${branchName} with ${DEFAULT_BRANCH}`],
        { stdio: 'inherit' }
      );
    }

    execFileSync('git', ['push', 'origin', branchName], { stdio: 'inherit' });
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
