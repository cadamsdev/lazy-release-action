import { describe, it, expect } from 'vitest';
import {
  extractCommitType,
  extractCommitTypeParts,
  extractDescription,
  getDirectoryNameFromPath,
  getPullRequestUrl,
  replaceVersionInPackageJson,
} from './utils';

describe('generateMarkdown', () => {
  it('should extract the commit type from a changlog item', () => {
    const item = 'feat(ui-components): Added new responsive table component';
    const commitType = extractCommitType(item);

    expect(commitType).toEqual('feat(ui-components)');
  });

  it('should extract the description from a changlog item', () => {
    const item = 'feat(ui-components): Added new responsive table component';
    const description = extractDescription(item);

    expect(description).toEqual('Added new responsive table component');
  });

  describe('extractCommitTypeParts', () => {
    it('should extract single package', () => {
      const commitType = 'chore(package-a)';
      const { packageNames } = extractCommitTypeParts(commitType);
      expect(packageNames).toEqual(['package-a']);
    });

    it('should extract multiple packages', () => {
      const commitType = 'chore(package-a, package-b)';
      const { packageNames } = extractCommitTypeParts(commitType);
      expect(packageNames).toEqual(['package-a', 'package-b']);
    });

    it('should extract breaking change', () => {
      const commitType = 'chore(package-a)!';
      const { isBreakingChange } = extractCommitTypeParts(commitType);
      expect(isBreakingChange).toBe(true);
    });

    it('should extract type and package names', () => {
      const commitType = 'feat(package-a, package-b)';
      const { type } = extractCommitTypeParts(commitType);
      expect(type).toEqual('feat');
    });

    it('should extract type without scope', () => {
      const commitType = 'feat';
      const { type } = extractCommitTypeParts(commitType);
      expect(type).toEqual('feat');
    });
  });

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

  it('should get directory name from a file path', () => {
    const filePath = 'src/packages/components/package.json';
    expect(getDirectoryNameFromPath(filePath)).toEqual('components');
  });
});
