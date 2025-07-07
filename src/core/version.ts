import { inc } from "semver";
import { Changelog, getDirectoryNameFromPath, SemverBump } from "../utils";
import { PackageInfo } from "../types";
import { getPackageNameWithoutScope } from "../utils/package";


export function applyNewVersion(
  packageInfo: PackageInfo,
  changelogs: Changelog[]
): void {
  const isV0 = packageInfo.version.startsWith('0.');
  const packageNameWithoutScope = getPackageNameWithoutScope(packageInfo.name);
  const directoryName = getDirectoryNameFromPath(packageInfo.path);

  let semver = 'patch' as SemverBump;

  for (const changelog of changelogs) {
    const isRelevant =
      (changelog.packages.length > 0 &&
        changelog.packages.some(
          (pkgName) =>
            pkgName === packageNameWithoutScope || pkgName === directoryName
        )) ||
      (packageInfo.isRoot && changelog.packages.length === 0);

    if (!isRelevant) {
      continue;
    }

    if (changelog.isBreakingChange && isV0) {
      semver = 'minor'; // In v0, breaking changes are treated as minor bumps
    } else if (changelog.isBreakingChange) {
      semver = 'major';
      break; // Breaking changes take precedence
    } else if (changelog.semverBump === 'minor' && semver !== 'major') {
      semver = 'minor';
    }
  }

  packageInfo.newVersion = getNewVersion(packageInfo.version, semver);
}

export function getNewVersion(
  currentVersion: string,
  semverBump: SemverBump
): string {
  let newVersion = currentVersion;
  switch (semverBump) {
    case 'major':
      newVersion = inc(newVersion, 'major') || '';
      break;
    case 'minor':
      newVersion = inc(newVersion, 'minor') || '';
      break;
    default:
      newVersion = inc(newVersion, 'patch') || '';
      break;
  }

  return newVersion;
}

