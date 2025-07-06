import { readFileSync } from "fs";
import { PackageInfo } from "../types";

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
