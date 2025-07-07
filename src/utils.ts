import { context } from "@actions/github";
import { getChangelogSectionFromCommitMessage } from "./utils/changelog";
import { PackageInfo } from "./types";
import { getPackageNameWithoutScope } from "./utils/package";
import { COMMIT_TYPE_PATTERN } from "./constants";

export function getDirectoryNameFromPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 2];
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

export interface PackageRelease {
  pkgInfo: PackageInfo;
  changelog: PackageChangelogEntry;
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
