import { describe, it, expect } from 'vitest';
import {
  extractCommitType,
  extractCommitTypeParts,
  extractDescription,
  getDirectoryNameFromPath,
  getPullRequestUrl,
  replaceChangelogSection,
  replaceVersionInPackageJson,
  toDirectoryPath,
  updateChangelog,
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

  it('should return the directory path from a file path', () => {
    const filePath = '/path/to/file.txt';
    const directoryPath = '/path/to';
    expect(toDirectoryPath(filePath)).toEqual(directoryPath);
  });

  it('should replace a section in the changelog file', () => {
    const existingChangelog = `# 👉 Changelog

## 0.1.0

### 🚀 feat
- Create CHANGELOG.md
- Added more types
- added some feature

### 🧹 chore
- test123
- Description 2
- Description
`;

    const newChangelog = `## 0.1.0

### 🚀 feat
- Create CHANGELOG.md
- Added more types
- added some feature
- bla ba 1

### 🧹 chore
- test123
- Description 2
- Description
- bla bla 2`;

    const expectedChangelog = `# 👉 Changelog

## 0.1.0

### 🚀 feat
- Create CHANGELOG.md
- Added more types
- added some feature
- bla ba 1

### 🧹 chore
- test123
- Description 2
- Description
- bla bla 2`;

    const updatedChangelog = replaceChangelogSection(
      '0.1.0',
      newChangelog,
      existingChangelog
    );
    expect(updatedChangelog).toEqual(expectedChangelog);
  });

  it('should replace a section in the changelog file', () => {
    const existingChangelog = `# 👉 Changelog

## 0.1.0

### 🚀 feat
- Create CHANGELOG.md

### 🧹 chore
- test123

## 0.0.1

### 🏠 chore
- Switched to pnpm
`;

    const newChangelog = `## 0.1.0

### 🚀 feat
- Create CHANGELOG.md
- Added more types

### 🧹 chore
- test123
- Description 2`;

    const expectedChangelog = `# 👉 Changelog

## 0.1.0

### 🚀 feat
- Create CHANGELOG.md
- Added more types

### 🧹 chore
- test123
- Description 2


## 0.0.1

### 🏠 chore
- Switched to pnpm
`;

    const updatedChangelog = replaceChangelogSection(
      '0.1.0',
      newChangelog,
      existingChangelog
    );
    expect(updatedChangelog).toEqual(expectedChangelog);
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

  it('should append changelog to existing changelog with a custom heading', () => {
    const existingChangelog = `## 0.0.1

### 🏠 chore
- Switched to pnpm`;

    const newChangelog = `## 0.0.2

### 🐛 bug fix
- Updated dependencies`;

    const expectedChangelog = `## 0.0.2

### 🐛 bug fix
- Updated dependencies


## 0.0.1

### 🏠 chore
- Switched to pnpm`;

    const updatedChangelog = updateChangelog(
      existingChangelog,
      newChangelog,
      '0.0.2'
    );
    expect(updatedChangelog).toEqual(expectedChangelog);
  });

  it('should append changelog to existing changelog', () => {
    const existingChangelog = `## 0.0.1

### 🏠 chore
- Switched to pnpm`;

    const newChangelog = `## 0.0.2

### 🐛 bug fix
- Updated dependencies`;

    const expectedChangelog = `## 0.0.2

### 🐛 bug fix
- Updated dependencies


## 0.0.1

### 🏠 chore
- Switched to pnpm`;

    const updatedChangelog = updateChangelog(
      existingChangelog,
      newChangelog,
      '0.0.2'
    );
    expect(updatedChangelog).toEqual(expectedChangelog);
  });

  it('should get directory name from a file path', () => {
    const filePath = 'src/packages/components/package.json';
    expect(getDirectoryNameFromPath(filePath)).toEqual('components');
  });
});
