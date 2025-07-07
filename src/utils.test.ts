import { describe, it, expect } from 'vitest';
import {
  getPullRequestUrl,
  replaceVersionInPackageJson,
} from './utils';

describe('generateMarkdown', () => {
  it('should replace version in package.json string', () => {
    const packageJsonString = `{
      "name": "test-package",
      "version": "1.0.0"
    }`;
    const newVersion = '1.1.0';
    const updatedPackageJsonString = `{
      "name": "test-package",
      "version": "1.1.0"
    }`;

    const result = replaceVersionInPackageJson(packageJsonString, newVersion);
    expect(result).toEqual(updatedPackageJsonString);
  });

  it('should uppercase the first letter of a string', () => {
    const input = 'test';
    const output = input.charAt(0).toUpperCase() + input.slice(1);
    expect(output).toEqual('Test');
  });

  it('should return the pull request url', () => {
    const owner = 'test-owner';
    const repo = 'test-repo';
    const prNumber = 123;
    const url = getPullRequestUrl(owner, repo, prNumber);
    expect(url).toEqual('https://github.com/test-owner/test-repo/pull/123');
  });
});
