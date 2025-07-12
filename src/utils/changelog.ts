import { Commit } from "../api/git";
import { COMMIT_TYPE_PATTERN, TYPE_TO_CHANGELOG_TYPE } from "../constants";
import { Changelog, CommitTypeParts, PackageInfo, SemverBump } from "../types";
import { hasChangelogSection } from "./markdown";
import { getPackageNameWithoutScope } from "./package";
import { getDirectoryNameFromPath } from "./path";
import { transformDescription } from "./string";

const DATE_NOW = new Date();

export function generateChangelogContent(
  pkgInfo: PackageInfo,
  changelogs: Changelog[],
  date: Date = DATE_NOW
): string {
  const pkgNameWithoutScope = getPackageNameWithoutScope(pkgInfo.name);
  const packageChangelogs = changelogs.filter(
    (changelog) =>
      changelog.packages.includes(pkgNameWithoutScope) ||
      changelog.packages.includes(getDirectoryNameFromPath(pkgInfo.path)) ||
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

export function getChangelogFromCommits(
  commits: Commit[],
  rootPackageName?: string
): Changelog[] {
  const changelogs: Changelog[] = [];

  for (const commit of commits) {
    if (commit.body && hasChangelogSection(commit.body)) {
      const changelogSection = getChangelogSectionFromCommitMessage(
        commit.body
      );
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
        commit.subject,
        rootPackageName
      );

      if (changelog) {
        changelogs.push(changelog);
      }
    }
  }

  console.log(
    `Found ${changelogs.length} changelogs from commits.`,
    changelogs
  );
  return changelogs;
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
    updatedChangelogContent =
      newChangelogContent + '\n\n\n' + existingChangelogContent;
  }

  return updatedChangelogContent;
}

export function getChangelogDate(date: Date): string {
  return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
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

function getSemverFromDescription(description: string): SemverBump | undefined {
  const match = description.match(/#(major|minor|patch)/);
  if (match) {
    return match[1] as SemverBump;
  }
  return undefined;
}

function getSemverBump(typeParts: CommitTypeParts): SemverBump {
  if (typeParts.isBreakingChange) {
    return 'major';
  }

  if (typeParts.type === 'feat') {
    return 'minor';
  }

  return 'patch';
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

  const explicitVersionBump = getSemverFromDescription(description);
  const semverBump = explicitVersionBump || getSemverBump(typeParts);

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
    hasExplicitVersionBump: !!explicitVersionBump,
  };

  return changelog;
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
