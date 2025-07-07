import { getPullRequestUrl } from "./github";

it('should return the pull request url', () => {
  const owner = 'test-owner';
  const repo = 'test-repo';
  const prNumber = 123;
  const url = getPullRequestUrl(owner, repo, prNumber);
  expect(url).toEqual('https://github.com/test-owner/test-repo/pull/123');
});
