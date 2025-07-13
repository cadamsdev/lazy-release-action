import { createChangelogFromChangelogItem, extractCommitType, extractCommitTypeParts, extractDescription, generateChangelogContent, getChangelogFromCommits, getChangelogItems, getChangelogSectionFromCommitMessage, replaceChangelogSection, updateChangelog } from "./changelog";
import { Changelog, PackageInfo } from "../types";
import { Commit } from "../api/git";

describe('getChangelogSectionFromCommitMessage', () => {
  it('should generate markdown for a given changeset map', async () => {
    const commitMsg = `
## Changelog

- feat(ui-components): Added new responsive table component 
\`\`\`html
<ds-table>
   ...
</ds-table>
\`\`\`
- fix(ui-components): Resolved button focus state accessibility issue
- refactor(api-client!): Completely rewrote authentication flow
- chore(api-client): Updated dependencies and improved test coverage
- fix(utils): Corrected date formatting in exported reports
- chore(utils): Removed unused helper functions    
`;

    const changelogSection = await getChangelogSectionFromCommitMessage(
      commitMsg
    );

    const expectedChangelogSection = `- feat(ui-components): Added new responsive table component 
\`\`\`html
<ds-table>
   ...
</ds-table>
\`\`\`
- fix(ui-components): Resolved button focus state accessibility issue
- refactor(api-client!): Completely rewrote authentication flow
- chore(api-client): Updated dependencies and improved test coverage
- fix(utils): Corrected date formatting in exported reports
- chore(utils): Removed unused helper functions`;

    expect(changelogSection).toBe(expectedChangelogSection);
  });

  it('should return an array of changelog items', async () => {
    const commitMsg = `
## Changelog

- feat(ui-components): Added new responsive table component 
\`\`\`html
<ds-table>
   ...
</ds-table>
\`\`\`
- fix(ui-components): Resolved button focus state accessibility issue
- refactor(api-client!): Completely rewrote authentication flow
- chore(api-client): Updated dependencies and improved test coverage
- fix(utils): Corrected date formatting in exported reports
- chore(utils): Removed unused helper functions    
`;

    const changelogSection = await getChangelogSectionFromCommitMessage(
      commitMsg
    );

    const changelogItems = getChangelogItems(changelogSection);
    expect(changelogItems.length).toEqual(6);
  });
});

describe('getChangelogFromCommits', () => {
  it('should extract changelogs from commit messages', async () => {
    process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';

    const commits: Commit[] = [
      {
        hash: '123456',
        subject: 'feat(package-a): Some description',
        body: `## Changelog
        - feat(package-a): Some description
        - chore(package-a,package-b): Some description 2`,
      },
    ];

    const changelog = getChangelogFromCommits(commits);
    const expectedChangelog: Changelog[] = [
      {
        type: 'feat',
        description: 'Some description',
        semverBump: 'minor',
        isBreakingChange: false,
        packages: ['package-a'],
        hasExplicitVersionBump: false,
      },
      {
        type: 'chore',
        description: 'Some description 2',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-a', 'package-b'],
        hasExplicitVersionBump: false,
      },
    ];

    expect(changelog).toEqual(expectedChangelog);
  });
});

describe('generateChangelogContent', () => {
  it('should generate changelog markdown', () => {
    const pkgInfo: PackageInfo = {
      name: 'some-package',
      version: '1.0.0',
      newVersion: '1.0.1',
      isRoot: false,
      isPrivate: false,
      path: '',
      dependencies: [],
    };

    const changelogs: Changelog[] = [
      {
        type: 'feat',
        description: 'Added new feature',
        semverBump: 'minor',
        isBreakingChange: false,
        packages: ['some-package'],
        hasExplicitVersionBump: false,
      },
      {
        type: 'fix',
        description: 'Fixed a bug',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['some-package'],
        hasExplicitVersionBump: false,
      },
    ];

    const markdown = generateChangelogContent(
      pkgInfo,
      changelogs,
      new Date('2025-06-29')
    );
    const expectedMarkdown = `## 1.0.1 (2025-06-29)

### 🚀 New Features
- Added new feature

### 🐛 Bug Fixes
- Fixed a bug`;

    expect(markdown).toEqual(expectedMarkdown);
  });

    it('should generate changelog markdown using directory name', () => {
      const pkgInfo: PackageInfo = {
        name: '@stellasoftio/atlas-components',
        version: '0.0.6',
        newVersion: '0.1.0',
        path: 'packages/components/package.json',
        isRoot: false,
        isPrivate: false,
        dependencies: [],
      };
  
      const changelogs: Changelog[] = [
        {
          type: 'chore',
          description:
            'Test 28 ([#47](https://github.com/stellasoftio/ds-web-2/pull/47))',
          packages: ['components'],
          isBreakingChange: false,
          semverBump: 'patch',
          hasExplicitVersionBump: false,
        },
        {
          type: 'chore',
          description:
            'Test 27 ([#46](https://github.com/stellasoftio/ds-web-2/pull/46))',
          packages: ['components'],
          isBreakingChange: false,
          semverBump: 'patch',
          hasExplicitVersionBump: false,
        },
        {
          type: 'chore',
          description:
            'Test 26 ([#44](https://github.com/stellasoftio/ds-web-2/pull/44))',
          packages: ['components'],
          isBreakingChange: false,
          semverBump: 'patch',
          hasExplicitVersionBump: false,
        },
        {
          type: 'feat',
          description:
            'Test 25 ([#42](https://github.com/stellasoftio/ds-web-2/pull/42))',
          packages: ['components'],
          isBreakingChange: false,
          semverBump: 'minor',
          hasExplicitVersionBump: false,
        },
      ];
  
      const markdown = generateChangelogContent(
        pkgInfo,
        changelogs,
        new Date('2025-07-04')
      );
  
      const expectedMarkdown = `## 0.1.0 (2025-07-04)

### 🚀 New Features
- Test 25 ([#42](https://github.com/stellasoftio/ds-web-2/pull/42))

### 🏠 Chores
- Test 28 ([#47](https://github.com/stellasoftio/ds-web-2/pull/47))
- Test 27 ([#46](https://github.com/stellasoftio/ds-web-2/pull/46))
- Test 26 ([#44](https://github.com/stellasoftio/ds-web-2/pull/44))`;
  
      expect(markdown).toEqual(expectedMarkdown);
    });
});

describe('createChangelogFromChangelogItem', () => {
  it('should create changelog from PR title', () => {
    const prTitle = 'feat(components): test using directory name';
    const changelog = createChangelogFromChangelogItem(prTitle);
    const expectedChangelog: Changelog = {
      type: 'feat',
      description: 'Test using directory name',
      semverBump: 'minor',
      isBreakingChange: false,
      packages: ['components'],
      hasExplicitVersionBump: false,
    };
    expect(changelog).toEqual(expectedChangelog);
  });

  it('should handle explicit version bumps', () => {
    const prTitle = 'feat(components): some test #major';
    const changelog = createChangelogFromChangelogItem(prTitle);
    const expectedChangelog: Changelog = {
      type: 'feat',
      description: 'Some test #major',
      semverBump: 'major',
      isBreakingChange: false,
      packages: ['components'],
      hasExplicitVersionBump: true,
    };
    expect(changelog).toEqual(expectedChangelog);
  });
});

describe('replaceChangelogSection', () => {
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
});

describe('updateChangelog', () => {
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
