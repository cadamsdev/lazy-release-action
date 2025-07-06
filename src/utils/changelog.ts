import { Commit, PackageInfo } from "..";
import { Changelog, createChangelogFromChangelogItem, getChangelogDate, getChangelogItems, getDirectoryNameFromPath, getPackageNameWithoutScope, TYPE_TO_CHANGELOG_TYPE } from "../utils";

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
    if (commit.message.includes('## Changelog')) {
      const changelogSection = getChangelogSectionFromCommitMessage(
        commit.message
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
        commit.message,
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
