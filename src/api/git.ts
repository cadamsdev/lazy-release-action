import { execSync } from 'child_process';

export function setupGitConfig() {
  console.log('Setting up git config');
  execSync('git config --global user.name github-actions[bot]', {
    stdio: 'inherit',
  });
  execSync(
    'git config --global user.email 41898282+github-actions[bot]@users.noreply.github.com',
    { stdio: 'inherit' }
  );
  execSync('git config --global --add safe.directory /github/workspace'),
    { stdio: 'inherit' };
}

export function getLastCommitHash(): string {
  return execSync(`git rev-parse HEAD`).toString().trim();
}

export function checkoutBranch(branchName: string) {
  execSync(`git fetch origin ${branchName}`, { stdio: 'inherit' });
  execSync(`git checkout ${branchName}`, { stdio: 'inherit' });
}

export function createOrCheckoutBranch(branchName: string) {
  try {
    execSync(`git checkout ${branchName}`, { stdio: 'inherit' });
  } catch (error) {
    console.log(`Branch ${branchName} does not exist, creating it.`);
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
  }
}

export function commitAndPushChanges() {
  execSync('git add .', { stdio: 'inherit' });
  execSync('git commit -m "chore: update release branch"', { stdio: 'inherit' });
  execSync('git push origin HEAD', { stdio: 'inherit' });
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
