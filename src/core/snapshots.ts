import { existsSync, readFileSync } from "fs";
import { SNAPSHOTS_ENABLED } from "../constants";
import { PackageInfo } from "../types";
import { toDirectoryPath } from "../utils";
import { getPackageInfos, getPackagePaths, updateIndirectPackageJsonFile, updatePackageLockFiles } from "../utils/package";
import { detect } from "package-manager-detector";
import { join } from "path";
import { execSync } from "child_process";

interface SnapshotResult {
  packageName: string;
  newVersion: string;
}

export async function createSnapshot(
  changedPkgInfos: PackageInfo[]
): Promise<SnapshotResult[]> {
  if (!SNAPSHOTS_ENABLED) {
    console.log('Snapshots are disabled, skipping snapshot creation.');
    return [];
  }

  const allPkgInfos = getPackageInfos(getPackagePaths());

  const snapshotResults: SnapshotResult[] = [];
  for (const pkgInfo of changedPkgInfos) {
    // create a snapshot for each changed package
    const snapshotResult = await createPackageSnapshot(pkgInfo, allPkgInfos);
    if (snapshotResult) {
      snapshotResults.push(snapshotResult);
    }
  }
  return snapshotResults;
}

async function createPackageSnapshot(pkgInfo: PackageInfo, allPkgInfos: PackageInfo[]): Promise<SnapshotResult | undefined> {
  console.log(`Creating snapshot for package: ${pkgInfo.name}`);

  const dirPath = toDirectoryPath(pkgInfo.path);
  if (!pkgInfo.isRoot && !existsSync(dirPath)) {
    console.warn(`Directory ${dirPath} does not exist, skipping snapshot.`);
    return;
  }

  const pm = await detect();
  if (!pm) {
    throw new Error('No package manager detected');
  }

  // rewrite the package.json version to a snapshot version
  const packageJsonPath = join(dirPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    console.warn(`Package.json file not found in ${dirPath}, skipping snapshot.`);
    return;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  if (packageJson.private) {
    console.warn(`Package ${pkgInfo.name} is private, skipping snapshot.`);
    return;
  }

  if (!packageJson.version) {
    console.warn(`No version found in package.json for ${pkgInfo.name}, skipping snapshot.`);
    return;
  }

  const newVersion = `${packageJson.version}-snapshot-${new Date().getTime()}`;
  pkgInfo.newVersion = newVersion;
  updateIndirectPackageJsonFile(pkgInfo, allPkgInfos);

  // update the package locks
  await updatePackageLockFiles(dirPath);

  // publish the package with npm publish --tag snapshot
  const fullPublishCommand = [pm.agent, 'publish', '--tag', 'snapshot'].join(' ');
  execSync(fullPublishCommand, { cwd: dirPath ? dirPath : undefined, stdio: 'inherit' });
  console.log(`Snapshot created for package: ${pkgInfo.name}`);

  return {
    packageName: pkgInfo.name,
    newVersion: newVersion,
  };
}
