

export function getPullRequestUrl(owner: string, repo: string, prNumber: number): string {
  return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
}

export function replaceVersionInPackageJson(packageJsonString: string, newVersion: string): string {
  return packageJsonString.replace(/("version":\s*")[^"]*(")/, `$1${newVersion}$2`);
}
