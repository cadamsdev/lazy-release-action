export interface PackageInfo {
  name: string;
  version: string;
  newVersion?: string;
  path: string;
  isRoot: boolean;
  isPrivate: boolean;
  dependencies: string[];
}

export interface ChangelogType {
  emoji: string;
  displayName: string;
  sort: number;
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

export type SemverBump = 'major' | 'minor' | 'patch';
