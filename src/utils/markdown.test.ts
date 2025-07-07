import { appendReleaseIdToMarkdown, generateMarkdown, increaseHeadingLevel, removeReleasePRComment } from "./markdown";
import { Changelog, PackageInfo } from "../types";
import { RELEASE_ID } from "../constants";

describe('generateMarkdown', () => {
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
});

it('should increase heading level in markdown', () => {
  const markdown = `
# Heading 1
## Heading 2
### Heading 3
  `;
  const result = increaseHeadingLevel(markdown);
  expect(result).toEqual(`
## Heading 1
### Heading 2
#### Heading 3
  `);
});

it('should append release id to markdown', () => {
  const markdown = 'test';
  const newMarkdown = appendReleaseIdToMarkdown(markdown);
  const expectedMarkdown = `test<!-- Release PR: ${RELEASE_ID} -->`;
  expect(newMarkdown).toEqual(expectedMarkdown);
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
