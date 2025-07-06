import { PackageInfo } from "../types";
import { Changelog, getDirectoryNameFromPath, getPackageNameWithoutScope, TYPE_TO_CHANGELOG_TYPE } from "../utils";

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
        changelog.packages.includes(getDirectoryNameFromPath(pkg.path)) ||
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
