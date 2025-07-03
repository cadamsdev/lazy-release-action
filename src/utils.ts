import { context } from "@actions/github";
import { Commit, PackageInfo } from ".";

const DATE_NOW = new Date();

export const RELEASE_ID = 'ebe18c5c-b9c6-4fca-8b11-90bf80ad229e';

interface ChangelogType {
  emoji: string;
  displayName: string;
  sort: number;
}

export const TYPE_TO_CHANGELOG_TYPE: Record<string, ChangelogType> = {
  feat: { emoji: '🚀', displayName: 'New Features', sort: 0 },
  fix: { emoji: '🐛', displayName: 'Bug Fixes', sort: 1 },
  perf: { emoji: '⚡️', displayName: 'Performance Improvements', sort: 2 },
  chore: { emoji: '🏠', displayName: 'Chores', sort: 3 },
  docs: { emoji: '📖', displayName: 'Documentation', sort: 4 },
  style: { emoji: '🎨', displayName: 'Styles', sort: 5 },
  refactor: { emoji: '♻️', displayName: 'Refactors', sort: 6 },
  test: { emoji: '✅', displayName: 'Tests', sort: 7 },
  build: { emoji: '📦', displayName: 'Build', sort: 8 },
  ci: { emoji: '🤖', displayName: 'Automation', sort: 9 },
  revert: { emoji: '⏪', displayName: 'Reverts', sort: 10 },
};

export const CONVENTIONAL_COMMITS_PATTERN =
  /^(feat|fix|perf|chore|docs|style|test|build|ci|revert)(!)?(\(([a-z-0-9]+)(,\s*[a-z-0-9]+)*\))?(!)?: .+/; // https://regexr.com/8flmk

export const COMMIT_TYPE_PATTERN =
  /^(feat|fix|perf|chore|docs|style|test|build|ci|revert)(\(([^)]+)\))?(!)?$/;

export function getDirectoryNameFromPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 2];
}

export function getChangelogSectionFromCommitMessage(
  commitMessage: string
): string {
  const section = '## Changelog\n';
  const startIndex = commitMessage.indexOf(section);
  let endIndex = commitMessage.length;

  let sectionCharCount = 0;
  for (let i = startIndex + section.length; i < commitMessage.length; i++) {
    const char = commitMessage[i];
    if (char === '#') {
      sectionCharCount++;

      if (sectionCharCount === 2) {
        endIndex = i;
        break;
      }
    } else {
      sectionCharCount = 0;
    }
  }

  const changelogSection = commitMessage
    .substring(startIndex + section.length, endIndex)
    .trim();
  return changelogSection;
}

export function isPRTitleValid(prTitle: string): boolean {
  return CONVENTIONAL_COMMITS_PATTERN.test(prTitle);
}

export function getChangelogItems(changelogSection: string): string[] {
  const lines = changelogSection.split('- ');
  const items: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine) {
      items.push(trimmedLine);
    }
  }

  return items;
}

export function getVersionPrefix(versionSpec: string): string {
  const match = versionSpec.match(/^([\^~><=]+)/);
  return match ? match[1] : '';
}

export function getChangelogFromMarkdown(
  markdown: string,
  rootPackageName?: string
): Changelog[] {
  const changelogs: Changelog[] = [];

  const changelogSection = getChangelogSectionFromCommitMessage(markdown);
  const changelogItems = getChangelogItems(changelogSection);
  for (const item of changelogItems) {
    const changelog = createChangelogFromChangelogItem(item, rootPackageName);
    if (!changelog) {
      continue;
    }

    changelogs.push(changelog);
  }
    return changelogs;
  }

export function getChangelogFromCommits(commits: Commit[], rootPackageName?: string): Changelog[] {
  const changelogs: Changelog[] = [];

  for (const commit of commits) {
    if (commit.message.includes('## Changelog')) {
      const changelogSection =
        getChangelogSectionFromCommitMessage(commit.message);
      const changelogItems = getChangelogItems(changelogSection);
      for (const item of changelogItems) {
        const changelog = createChangelogFromChangelogItem(
          item,
          rootPackageName
        );
        if (!changelog) {
          continue;
        }

        changelogs.push(changelog);
      }
    } else {
      const changelog = createChangelogFromChangelogItem(
        commit.message,
        rootPackageName
      );

      if (changelog) {
        changelogs.push(changelog);
      }
    }
  }

  return changelogs;
}

export function createChangelogFromChangelogItem(item: string, rootPackageName?: string): Changelog|undefined {
  
  const commitType = extractCommitType(item);
  const description = extractDescription(item);
  const typeParts = extractCommitTypeParts(commitType);

  if (!typeParts.type) {
    console.warn(
      `Skipping item with no type: "${item}". Expected format: "type(package): description".`
    );
    return;
  }

  const semverBump: SemverBump = typeParts.isBreakingChange
    ? 'major'
    : typeParts.type === 'feat'
    ? 'minor'
    : 'patch';

  let tempPackageNames = typeParts.packageNames || [];

  if (rootPackageName && tempPackageNames.length) {
    // remove the root package name from the the list if it exists
    tempPackageNames = tempPackageNames.filter(
      (pkgName) =>
        getPackageNameWithoutScope(pkgName) !==
        getPackageNameWithoutScope(rootPackageName)
    );
  }

  const changelog: Changelog = {
    type: typeParts.type,
    description: transformDescription(description),
    packages: tempPackageNames,
    isBreakingChange: typeParts.isBreakingChange,
    semverBump,
  };

  return changelog;
}

export function transformDescription(description: string): string {
  if (!description) {
    return '';
  }

  // Remove leading and trailing whitespace
  let temp = description.trim();

  // uppercase the first letter
  temp = uppercaseFirstLetter(temp);

  // replace PR number
  temp = replacePRNumberWithLink(temp);
  return temp;
}

export function replacePRNumberWithLink(
  description: string
): string {
  if (!description) {
    return description;
  }

  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const prPattern = /\(#(\d+)\)/;
  let tempDesc = description;
  const prNumberMatch = tempDesc.match(prPattern);

  if (prNumberMatch) {
    const prNumber = parseInt(prNumberMatch[1]);
    const prUrl = getPullRequestUrl(owner, repo, prNumber);
    tempDesc = tempDesc.replace(prPattern, `([#${prNumber}](${prUrl}))`);
  }

  return tempDesc;
}

export function getPullRequestUrl(owner: string, repo: string, prNumber: number): string {
  return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
}

export function uppercaseFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function extractCommitType(changelogItem: string): string {
  return changelogItem.substring(0, changelogItem.indexOf(':')).trim();
}

export function extractDescription(changelogItem: string): string {
  return changelogItem.substring(changelogItem.indexOf(':') + 1).trim();
}

export function extractCommitTypeParts(commitType: string): CommitTypeParts {
  const typeMatch = commitType.match(COMMIT_TYPE_PATTERN);
  const type = typeMatch?.[1];
  const packageNames = typeMatch?.[3] ? typeMatch?.[3].split(',') : [];
  const isBreakingChange = !!typeMatch?.[4];

  return {
    type: type || '',
    packageNames: packageNames.map((pkg) => pkg.trim()),
    isBreakingChange: isBreakingChange,
  };
}

export function getPackageNameWithoutScope(packageName: string): string {
  // Remove the scope if it exists (e.g., @scope/package-name)
  return packageName.startsWith('@') ? packageName.split('/')[1] : packageName;
}

export function increaseHeadingLevel(message: string): string {
  return message.replace(/(#+)/g, '$1#');
}

export function generateMarkdown(
  changedPackageInfos: PackageInfo[],
  indirectPackageInfos: PackageInfo[],
  changelogs: Changelog[],
): string {

  let markdown = '# 👉 Changelog\n\n';

  changedPackageInfos.forEach((pkg) => {
    const pkgNameWithoutScope = getPackageNameWithoutScope(pkg.name);
    const packageChangelogs = changelogs.filter(
      (changelog) =>
        changelog.packages.includes(pkgNameWithoutScope) ||
        (pkg.isRoot && changelog.packages.length === 0)
    );

    if (packageChangelogs.length === 0) {
      // no changelogs for this package
      return;
    }

    if (pkg.isRoot) {
      markdown += `## ${pkg.version}`;
    } else {
      markdown += `## ${pkgNameWithoutScope}@${pkg.version}`;
    }
  
    if (pkg.newVersion) {
      markdown += `➡️${pkg.newVersion}`;
    }

    markdown += '\n\n';

    const changelogsWithBreakingChanges = packageChangelogs.filter(
      (changelog) => changelog.isBreakingChange
    );

    // breaking changes section
    if (changelogsWithBreakingChanges.length) {
      markdown += `### ⚠️ Breaking Changes\n`;
    }

    for (let i = 0; i < changelogsWithBreakingChanges.length; i++) {
      const changelog = changelogsWithBreakingChanges[i];
      markdown += '- ';
      markdown += changelog.description + '\n';
    }

    if (changelogsWithBreakingChanges.length) {
      markdown += '\n';
    }

    // group changelogs by type
    const groupedChangelogs: Record<string, Changelog[]> = {};

    for (const changelog of packageChangelogs) {
      if (changelog.isBreakingChange) {
        continue;
      }

      if (!groupedChangelogs[changelog.type]) {
        groupedChangelogs[changelog.type] = [];
      }

      groupedChangelogs[changelog.type].push(changelog);
    }

    // sort types by their defined order
    const sortedTypes = Object.keys(groupedChangelogs).sort(
      (a, b) => TYPE_TO_CHANGELOG_TYPE[a].sort - TYPE_TO_CHANGELOG_TYPE[b].sort
    );

    // generate markdown for each type
    for (const sortedType of sortedTypes) {
      const changelogs = groupedChangelogs[sortedType];
      const changelogType = TYPE_TO_CHANGELOG_TYPE[sortedType];
      markdown += `### ${changelogType.emoji} ${changelogType.displayName}\n`;
      for (const changelog of changelogs) {
        markdown += `- ${changelog.description}\n`;
      }
      markdown += '\n';
    }
  });

  indirectPackageInfos.forEach((pkgInfo) => {
    const pkgNameWithoutScope = getPackageNameWithoutScope(pkgInfo.name);
    markdown += `## ${pkgNameWithoutScope}@${pkgInfo.version}`;
    if (pkgInfo.newVersion) {
      markdown += `➡️${pkgInfo.newVersion}`;
    }
    markdown += '\n\n';

    // if the package is a dependency, we don't have changelogs for it
    markdown += `📦 Updated due to dependency changes\n\n`;
  });

  return markdown;
}

export interface PackageRelease {
  pkgInfo: PackageInfo;
  changelog: PackageChangelogEntry;
}

export function getTagName(pkgInfo: PackageInfo): string {
  let tagName = '';

  if (pkgInfo.isRoot) {
    tagName = `v${pkgInfo.version}`;
  } else {
    tagName = `${pkgInfo.name}@${pkgInfo.version}`;
  }

  return tagName;
}

export function getGitHubReleaseName(pkgInfo: PackageInfo): string {
  let releaseName = '';

  if (pkgInfo.isRoot) {
    releaseName = `v${pkgInfo.version}`;
  } else {
    releaseName = `${getPackageNameWithoutScope(pkgInfo.name)}@${pkgInfo.version}`;
  }

  return releaseName;
}

export interface ReleasePackageInfo {
  pkgInfo: PackageInfo;
  changelogEntry: PackageChangelogEntry;
}

export interface PackageChangelogEntry {
  heading: {
    packageName: string;
    oldVersion: string;
    newVersion: string;
    isRoot: boolean;
  };
  content: string;
}

const heading2Regex =
  /^## ((@[a-z]+)?(\/)?([\w-]+)@)?(\d+\.\d+\.\d+)➡️(\d+\.\d+\.\d+)(\n\n)?/;

  export function parseReleasePRBody(prBody: string): PackageChangelogEntry[] {
    const changelogEntries: PackageChangelogEntry[] = [];
    const headings = Array.from(
      prBody.matchAll(new RegExp(heading2Regex, 'gm'))
    );

    console.log(`Found ${headings.length} headings in PR body.`);

    for (let i = 0; i < headings.length; i++) {
      const heading = headings[i];
      const headingData = parseHeading2(heading[0]);
      const startIndex = heading.index! + heading[0].length;
      const endIndex =
        i < headings.length - 1 ? headings[i + 1].index! : prBody.length;
      const content = prBody.substring(startIndex, endIndex).trim();

      changelogEntries.push({
        heading: headingData,
        content: content,
      });
    }

    return changelogEntries;
  };

export function parseHeading2(heading: string): {
  packageName: string;
  oldVersion: string;
  newVersion: string;
  isRoot: boolean;
} {
  const match = heading.match(heading2Regex);
  if (!match) {
    throw new Error(`Invalid heading format: ${heading}`);
  }

  const scope = match[2]; // e.g., @scope
  const packageName = match[4]; // e.g., some-package
  const oldVersion = match[5]; // e.g., 1.0.0
  const newVersion = match[6]; // e.g., 1.0.1
  const isRoot = !packageName;

  let fullPackageName = packageName;
  if (scope) {
    fullPackageName = `${scope}/${packageName}`; // e.g., @scope/some-package
  }

  return {
    packageName: fullPackageName,
    oldVersion,
    newVersion,
    isRoot,
  };
}

export function appendReleaseIdToMarkdown(markdown: string): string {
  const releaseIdComment = `<!-- Release PR: ${RELEASE_ID} -->`;
  return markdown + releaseIdComment;
}

export function updateChangelog(
  existingChangelogContent: string,
  newChangelogContent: string,
  newVersion?: string
): string {
  if (!newVersion) {
    return '';
  }

  let updatedChangelogContent = existingChangelogContent;

  if (existingChangelogContent.includes(newVersion)) {
    // replace section with new changelog content
    updatedChangelogContent = replaceChangelogSection(
      newVersion,
      newChangelogContent,
      existingChangelogContent
    );
  } else {
    updatedChangelogContent = newChangelogContent + '\n\n\n' + existingChangelogContent;
  }

  return updatedChangelogContent;
}

export function getChangelogDate(date: Date): string {
  return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
}

export function generateChangelogContent(pkgInfo: PackageInfo, changelogs: Changelog[], date: Date = DATE_NOW): string {
  const pkgNameWithoutScope = getPackageNameWithoutScope(pkgInfo.name);
  const packageChangelogs = changelogs.filter(
    (changelog) =>
      changelog.packages.includes(pkgNameWithoutScope) ||
      (pkgInfo.isRoot && changelog.packages.length === 0)
  );

  let markdown = `## ${pkgInfo.newVersion} (${getChangelogDate(date)})\n\n`;

  const changelogsWithBreakingChanges = packageChangelogs.filter(
    (changelog) => changelog.isBreakingChange
  );

  if (changelogsWithBreakingChanges.length) {
    markdown += `### ⚠️ Breaking Changes\n`;
  }

  for (let i = 0; i < changelogsWithBreakingChanges.length; i++) {
    const changelog = changelogsWithBreakingChanges[i];
    markdown += `- ${changelog.description}\n`;
  }

  if (changelogsWithBreakingChanges.length) {
    markdown += '\n';
  }

  // group changelogs by type
  const groupedChangelogs: Record<string, Changelog[]> = {};
  for (const changelog of packageChangelogs) {
    if (changelog.isBreakingChange) {
      continue;
    }

    if (!groupedChangelogs[changelog.type]) {
      groupedChangelogs[changelog.type] = [];
    }
    groupedChangelogs[changelog.type].push(changelog);
  }

  // sort types by their defined order
  const sortedTypes = Object.keys(groupedChangelogs).sort(
    (a, b) => TYPE_TO_CHANGELOG_TYPE[a].sort - TYPE_TO_CHANGELOG_TYPE[b].sort
  );

  // generate markdown for each type
  for (const sortedType of sortedTypes) {
    const changelogs = groupedChangelogs[sortedType];
    const changelogType = TYPE_TO_CHANGELOG_TYPE[sortedType];

    markdown += `### ${changelogType.emoji} ${changelogType.displayName}\n`;
    for (const changelog of changelogs) {
      markdown += `- ${changelog.description}\n`;
    }
    markdown += '\n';
  }

  if (packageChangelogs.length === 0) {
    // it's a depenendant
    markdown += `📦 Updated due to dependency changes`;
  }

  return markdown.trim();
}

export function replaceChangelogSection(
  newVersion: string,
  newChangelogContent: string,
  existingChangelogContent: string
): string {
  const versionHeader = `## ${newVersion}\n`;
  const startIndex = existingChangelogContent.indexOf(versionHeader);

  if (startIndex === -1) {
    return '';
  }

  let endIndex = existingChangelogContent.indexOf(
    '\n## ',
    startIndex + versionHeader.length
  );

  // replace text between startIndex and endIndex with newChangelogContent
  let updatedChangelog = existingChangelogContent.slice(0, startIndex);
    updatedChangelog += newChangelogContent;

    if (endIndex !== -1) {
      updatedChangelog += '\n\n';
      updatedChangelog += existingChangelogContent.slice(endIndex);
    }
  return updatedChangelog;
}

export function replaceVersionInPackageJson(packageJsonString: string, newVersion: string): string {
  return packageJsonString.replace(/("version":\s*")[^"]*(")/, `$1${newVersion}$2`);
}

export function toDirectoryPath(filePath: string): string {
  const lastSlashIndex = filePath.lastIndexOf('/');
  return lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';
}

export interface DependencyUpdate {
  dependencyName: string;
  oldVersion: string;
  newVersion: string;
}

export interface CommitTypeParts {
  type: string;
  packageNames: string[];
  isBreakingChange: boolean;
}

export interface Changelog {
  type: string;
  description: string;
  packages: string[];
  isBreakingChange: boolean;
  semverBump: SemverBump;
}

export type SemverBump = 'major' | 'minor' | 'patch';
