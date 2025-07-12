import { context } from "@actions/github";
import { RELEASE_ID, TYPE_TO_CHANGELOG_TYPE } from "../constants";
import { Changelog, PackageChangelogEntry, PackageInfo } from "../types";
import { getPackageNameWithoutScope } from "./package";
import { getDirectoryNameFromPath } from "./path";
import { getPullRequestUrl } from "./github";

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

export function increaseHeadingLevel(message: string): string {
  return message.replace(/(#+)\s/g, '$1# '); // https://regexr.com/8g0di
}

export function appendReleaseIdToMarkdown(markdown: string): string {
  const releaseIdComment = `<!-- Release PR: ${RELEASE_ID} -->`;
  return markdown + releaseIdComment;
}

export function removeReleasePRComment(markdown: string): string {
  const releaseIdComment = `<!-- Release PR: ${RELEASE_ID} -->`;
  return markdown.replace(releaseIdComment, '').trim();
}

export function hasReleasePRComment(markdown: string): boolean {
  const releaseIdComment = `<!-- Release PR: ${RELEASE_ID} -->`;
  return markdown.includes(releaseIdComment);
}

const heading2Regex =
  /^## ((@[a-z]+)?(\/)?([\w-]+)@)?(\d+\.\d+\.\d+)➡️(\d+\.\d+\.\d+)(\n\n)?/;

export function parseReleasePRBody(prBody: string): PackageChangelogEntry[] {
  prBody = removeReleasePRComment(prBody);

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

export function hasChangelogSection(markdown: string): boolean  {
  return markdown.includes('## Changelog');
}
