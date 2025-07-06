import { describe, it, expect } from 'vitest';
import {
  appendReleaseIdToMarkdown,
  Changelog,
  CONVENTIONAL_COMMITS_PATTERN,
  extractCommitType,
  extractCommitTypeParts,
  extractDescription,
  generateMarkdown,
  getDirectoryNameFromPath,
  getPackageNameWithoutScope,
  getPullRequestUrl,
  getTagName,
  RELEASE_ID,
  removeReleasePRComment,
  replaceChangelogSection,
  replaceVersionInPackageJson,
  toDirectoryPath,
  TYPE_TO_CHANGELOG_TYPE,
  updateChangelog,
} from './utils';
import { PackageInfo } from './types';

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

  it('should generate markdown for changelog', () => {
    const pkgInfos: PackageInfo[] = [
      {
        name: 'package-a',
        version: '1.0.0',
        newVersion: '1.0.1',
        path: '/path/to/package-a',
        isRoot: false,
        isPrivate: false,
        dependencies: [],
      },
      {
        name: 'package-b',
        version: '1.0.0',
        newVersion: '1.0.1',
        path: '/path/to/package-b',
        isRoot: false,
        isPrivate: false,
        dependencies: [],
      },
    ];

    const changelogs: Changelog[] = [
      {
        type: 'chore',
        description: 'Some description',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-a'],
      },
      {
        type: 'chore',
        description: 'Some description 2',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-b'],
      },
      {
        type: 'fix',
        description: 'Some fix',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-b'],
      },
    ];

    const markdown = generateMarkdown(pkgInfos, [], changelogs);
    const expectedMarkdown = `# 👉 Changelog

## package-a@1.0.0➡️1.0.1

### 🏠 Chores
- Some description

## package-b@1.0.0➡️1.0.1

### 🐛 Bug Fixes
- Some fix

### 🏠 Chores
- Some description 2
\n`;

    expect(markdown).toEqual(expectedMarkdown);
  });

  it('should generate markdown for changelog', () => {
    const pkgInfos: PackageInfo[] = [
      {
        name: 'package-a',
        version: '1.0.0',
        newVersion: '1.0.1',
        path: '/path/to/package-a',
        isRoot: true,
        isPrivate: false,
        dependencies: [],
      },
    ];

    const changelogs: Changelog[] = [
      {
        type: 'chore',
        description: 'Some description',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-a'],
      },
    ];

    const markdown = generateMarkdown(pkgInfos, [], changelogs);
    const expectedMarkdown = `# 👉 Changelog

## 1.0.0➡️1.0.1

### 🏠 Chores
- Some description
\n`;

    expect(markdown).toEqual(expectedMarkdown);
  });

  it('should return correct emoji for type', () => {
    expect(TYPE_TO_CHANGELOG_TYPE['fix'].emoji).toEqual('🐛');
    expect(TYPE_TO_CHANGELOG_TYPE['feat'].emoji).toEqual('🚀');
    expect(TYPE_TO_CHANGELOG_TYPE['chore'].emoji).toEqual('🏠');
  });

  it('should return the package name without scope', () => {
    const packageNameWithScope = '@scope/package-name';
    const packageNameWithoutScope = 'package-name';
    expect(getPackageNameWithoutScope(packageNameWithScope)).toEqual(
      packageNameWithoutScope
    );
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

  it('should append release id to markdown', () => {
    const markdown = 'test';
    const newMarkdown = appendReleaseIdToMarkdown(markdown);
    const expectedMarkdown = `test<!-- Release PR: ${RELEASE_ID} -->`;
    expect(newMarkdown).toEqual(expectedMarkdown);
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

  it('should match conventional commit format', () => {
    expect(CONVENTIONAL_COMMITS_PATTERN.test('fix: hello world')).toBe(true);
    expect(CONVENTIONAL_COMMITS_PATTERN.test('fix(scope): hello world')).toBe(
      true
    );
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a,scope-b): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a, scope-b): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a,scope-b)!: test')
    ).toBe(true);
    expect(CONVENTIONAL_COMMITS_PATTERN.test('fix!: hello world')).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a-1,scope-b-2): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a,scope-b,scope-c): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test(
        'fix(scope-a,scope-b,scope-c,scope-d): test'
      )
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(ds-components-2): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test(
        'chore(ds-components-2,ds-components-react-2): switch to lazy release action (#3)'
      )
    ).toBe(true);
  });

  it('should get the tagName', () => {
    const pkgInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      newVersion: '1.0.1',
      isRoot: false,
      isPrivate: false,
      path: '',
      dependencies: [],
    }

    expect(getTagName(pkgInfo)).toEqual('test-package@1.0.0');
  });

  it('should get the tagName for root package', () => {
    const pkgInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      newVersion: '1.0.1',
      isRoot: true,
      isPrivate: false,
      path: '',
      dependencies: [],
    };

    expect(getTagName(pkgInfo)).toEqual('v1.0.0');
  });

  it('should get directory name from a file path', () => {
    const filePath = 'src/packages/components/package.json';
    expect(getDirectoryNameFromPath(filePath)).toEqual('components');
  });

  it('should remove Release PR comment from markdown', () => {
    const markdown = `## Changelog

### 🚀 New Features
- Added new feature

### 🐛 Bug Fixes
- Fixed a bug

<!-- Release PR: ${RELEASE_ID} -->`;

    const result = removeReleasePRComment(markdown);
    expect(result).not.toContain(`<!-- Release PR: ${RELEASE_ID} -->`);
  });
});
