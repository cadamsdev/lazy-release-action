import { readFileSync, writeFileSync } from "fs";
import { PackageInfo } from "../types";
import { Changelog, getDirectoryNameFromPath, getVersionPrefix } from "../utils";
import { getNewVersion } from "../core/version";
import { detect, resolveCommand } from "package-manager-detector";
import { execSync } from "child_process";
import { globSync } from "tinyglobby";

export function getPackagePaths(): string[] {
  const packagePaths = globSync('**/package.json', {
    ignore: ['**/node_modules/**', '**/dist/**'],
  });

  console.log('getPackagePaths', packagePaths);
  return packagePaths;
}

export function getPackageInfo(packagePath: string): PackageInfo {
  const packageJsonString = readFileSync(packagePath, 'utf-8');
  const packageJson = JSON.parse(packageJsonString);

  const packageInfo: PackageInfo = {
    name: packageJson.name,
    version: packageJson.version,
    path: packagePath,
    isRoot: packagePath === 'package.json',
    isPrivate: packageJson.private || false,
    dependencies: [],
  };

  return packageInfo;
}

export function getPackageInfos(packagePaths: string[]): PackageInfo[] {
  const packageInfos = packagePaths.map((packagePath) =>
    getPackageInfo(packagePath)
  );

  // find dependencies for each package
  packageInfos.forEach((pkgInfo) => {
    const packageJsonString = readFileSync(pkgInfo.path, 'utf-8');
    const packageJson = JSON.parse(packageJsonString);

    const allDeps = new Set<string>();

    // Collect all types of dependencies
    const dependencyFields = [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ];
    for (const field of dependencyFields) {
      if (packageJson[field]) {
        Object.keys(packageJson[field]).forEach((dep) => allDeps.add(dep));
      }
    }

    // Filter to only include workspace packages
    pkgInfo.dependencies = packageInfos
      .filter((p) => p.name !== pkgInfo.name && allDeps.has(p.name))
      .map((p) => p.name);
  });
  return packageInfos;
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

export function updateIndirectPackageJsonFile(
  pkgInfo: PackageInfo,
  allPackageInfos: PackageInfo[]
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
        const depPackageInfo = allPackageInfos.find(
          (pkg) => pkg.name === depName
        );
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

  // go through all the packages, update any package.json files that reference this package
  allPackageInfos.forEach((otherPkg) => {
    updateDependentPackages(pkgInfo, otherPkg);
  });

  // Write the updated package.json back to the file
  writeFileSync(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );
}

function updateDependentPackages(
  indirectPkgInfo: PackageInfo,
  otherPkg: PackageInfo
): void {
  // check if other pkg depends on the indirect package
  if (!otherPkg.dependencies.includes(indirectPkgInfo.name)) {
    return; // No dependency, nothing to update
  }

  console.log(
    `Updating dependent package ${otherPkg.name} for indirect package ${indirectPkgInfo.name}`
  );

  // Read the package.json of the other package
  const otherPackageJsonPath = otherPkg.path;
  let otherPackageJsonString = readFileSync(otherPackageJsonPath, 'utf-8');
  const otherPackageJson = JSON.parse(otherPackageJsonString);

  const dependencyFields = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ];

  for (const field of dependencyFields) {
    if (otherPackageJson[field]) {
      for (const depName of Object.keys(otherPackageJson[field])) {
        // Find if this dependency is one of our workspace packages
        if (depName !== indirectPkgInfo.name) {
          continue;
        }

        const currentVersionSpec = otherPackageJson[field][depName];
        const prefix = getVersionPrefix(currentVersionSpec);
        let newPackageVersion = prefix + indirectPkgInfo.newVersion;
        if (indirectPkgInfo.newVersion?.includes('-snapshot')) {
          newPackageVersion = indirectPkgInfo.newVersion;
        }

        console.log(
          `Updating dependency ${depName} from ${currentVersionSpec} to ${newPackageVersion} in ${otherPkg.name}`
        );

        otherPackageJson[field][depName] = newPackageVersion;
      }
    }
  }

  // Write the updated package.json back to the file
  writeFileSync(
    otherPackageJsonPath,
    JSON.stringify(otherPackageJson, null, 2) + '\n',
    'utf-8'
  );
}

export function bumpIndirectPackageVersion(pkgInfo: PackageInfo): void {
  // TODO implement fixed logic for indirect packages

  pkgInfo.newVersion = getNewVersion(pkgInfo.version, 'patch');
}

export async function updatePackageLockFiles(dirPath = ''): Promise<void> {
  const pm = await detect();

  if (!pm) {
    throw new Error('No package manager detected');
  }

  const rc = resolveCommand(pm.agent, 'install', []);

  if (!rc?.command) {
    throw new Error(`No command found for package manager ${pm.agent}`);
  }

  const fullCommand = [rc.command, ...(rc.args || [])].join(' ');
  console.log(`Running package manager command: ${fullCommand}`);

  execSync(fullCommand, {
    cwd: dirPath ? dirPath : undefined,
    stdio: 'inherit',
  });
}

export function getChangedPackages(
  changelogs: Changelog[],
  rootPackageName?: string
): string[] {
  const changedPackages = new Set<string>();
  let hasRootPackageChanged = false;
  for (const changelog of changelogs) {
    if (changelog.packages.length === 0) {
      hasRootPackageChanged = true;
      continue; // This changelog applies to the root package
    }

    for (const pkgName of changelog.packages) {
      changedPackages.add(pkgName);
    }
  }

  if (rootPackageName && hasRootPackageChanged) {
    changedPackages.add(getPackageNameWithoutScope(rootPackageName));
  }

  return Array.from(changedPackages);
}

export function getChangedPackageInfos(
  changelogs: Changelog[],
  allPkgInfos: PackageInfo[]
): { changedPackageInfos: PackageInfo[]; indirectPackageInfos: PackageInfo[] } {
  console.log('allPkgInfos', allPkgInfos);

  const rootPackageName = allPkgInfos.find((pkg) => pkg.isRoot)?.name;
  console.log('rootPackageName:', rootPackageName);

  const directlyChangedPkgNames = getChangedPackages(
    changelogs,
    rootPackageName
  );
  console.log('directlyChangedPkgNames:', directlyChangedPkgNames);

  // Find packages that are directly changed
  const directlyChangedPackageInfos = allPkgInfos.filter(
    (pkg) =>
      directlyChangedPkgNames.includes(getPackageNameWithoutScope(pkg.name)) ||
      directlyChangedPkgNames.includes(getDirectoryNameFromPath(pkg.path))
  );
  console.log('directlyChangedPackageInfos:', directlyChangedPackageInfos);

  // Find packages that have dependencies on changed packages
  const indirectlyChangedPackageInfos = allPkgInfos.filter((pkg) => {
    const found = directlyChangedPackageInfos.find(
      (changedPkg) => changedPkg.name === pkg.name
    );

    if (found) {
      // If the package itself is directly changed, skip it
      return false;
    }

    // Check if any of its dependencies are in the directly changed packages
    return pkg.dependencies.some((depName) =>
      directlyChangedPackageInfos.some(
        (changedPkg) => changedPkg.name === depName
      )
    );
  });

  console.log('indirectlyChangedPackageInfos:', indirectlyChangedPackageInfos);
  return {
    changedPackageInfos: directlyChangedPackageInfos,
    indirectPackageInfos: indirectlyChangedPackageInfos,
  };
}

export function getPackageNameWithoutScope(packageName: string): string {
  // Remove the scope if it exists (e.g., @scope/package-name)
  return packageName.startsWith('@') ? packageName.split('/')[1] : packageName;
}
