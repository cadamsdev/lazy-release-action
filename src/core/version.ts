import { inc } from "semver";
import { Changelog, getDirectoryNameFromPath, getPackageNameWithoutScope, getVersionPrefix, SemverBump } from "../utils";
import { PackageInfo } from "../types";
import { readFileSync, writeFileSync } from "fs";

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

export function updatePackageJsonFile(
  pkgInfo: PackageInfo,
  allPkgInfos: PackageInfo[]
): void {
  if (!pkgInfo.newVersion) {
    return;
  }

  const packageJsonPath = pkgInfo.path;
  let packageJsonString = readFileSync(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonString);

  // Update the version in the package.json
  packageJson.version = pkgInfo.newVersion;

  // Update dependencies that reference other packages in the workspace
  const dependencyFields = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  for (const field of dependencyFields) {
    if (packageJson[field]) {
      for (const depName of Object.keys(packageJson[field])) {
        // Find if this dependency is one of our workspace packages
        const depPackageInfo = allPkgInfos.find((pkg) => pkg.name === depName);
        if (depPackageInfo && depPackageInfo.newVersion) {
          const currentVersionSpec = packageJson[field][depName];
          const prefix = getVersionPrefix(currentVersionSpec);
          const newVersionSpec = prefix + depPackageInfo.newVersion;

          console.log(
            `Updating dependency ${depName} from ${currentVersionSpec} to ${newVersionSpec} in ${pkgInfo.name}`
          );

          packageJson[field][depName] = newVersionSpec;
        }
      }
    }
  }

  console.log(`Updating ${pkgInfo.name} to version ${pkgInfo.newVersion}`);

  // Write the updated package.json back to the file
  writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );
}
