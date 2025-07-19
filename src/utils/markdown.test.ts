import {
  appendReleaseIdToMarkdown,
  generateMarkdown,
  hasChangelogSection,
  hasReleasePRComment,
  increaseHeadingLevel,
  removeReleasePRComment,
} from './markdown';
import { Changelog, PackageInfo } from "../types";
import { RELEASE_ID } from "../constants";

vi.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
  },
}));

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
        hasExplicitVersionBump: false,
      },
      {
        type: 'chore',
        description: 'Some description 2',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-b'],
        hasExplicitVersionBump: false,
      },
      {
        type: 'fix',
        description: 'Some fix',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-b'],
        hasExplicitVersionBump: false,
      },
    ];

    const markdown = generateMarkdown(pkgInfos, [], changelogs);
    const expectedMarkdown = `# 👉 Changelog

## package-a@1.0.0➡️1.0.1

[compare changes](https://github.com/test-owner/test-repo/compare/package-a@1.0.0...package-a@1.0.1)

### 🏠 Chores
- Some description

## package-b@1.0.0➡️1.0.1

[compare changes](https://github.com/test-owner/test-repo/compare/package-b@1.0.0...package-b@1.0.1)

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
        hasExplicitVersionBump: false,
      },
    ];

    const markdown = generateMarkdown(pkgInfos, [], changelogs);
    const expectedMarkdown = `# 👉 Changelog

## 1.0.0➡️1.0.1

[compare changes](https://github.com/test-owner/test-repo/compare/v1.0.0...v1.0.1)

### 🏠 Chores
- Some description
\n`;

    expect(markdown).toEqual(expectedMarkdown);
  });
});

describe('increaseHeadingLevel', () => {
  it('should increase heading level for headings', () => {
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

it('should not increase heading level for non-headings', () => {
  const markdown = `
#major
#minor
#patch
  `;
  const result = increaseHeadingLevel(markdown);
  expect(result).toEqual(`
#major
#minor
#patch
  `);
});
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

it('should check if markdown has release comment', () => {
  const markdownWithComment = `# 👉 Changelog

## 0.0.0➡️0.0.1

### 🐛 Bug Fixes
- Install snapshot command

<!-- Release PR: ${RELEASE_ID} -->`;

  const result = hasReleasePRComment(markdownWithComment);
  expect(result).toBe(true);
});

it('should have a changelog section', () => {
  const markdownWithChangelog = `## Changelog
- feat: added some feature
`;

  const result = hasChangelogSection(markdownWithChangelog);
  expect(result).toBe(true);
});
