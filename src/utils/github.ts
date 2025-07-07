
export function getPullRequestUrl(
  owner: string,
  repo: string,
  prNumber: number
): string {
  return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
}
