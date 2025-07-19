import { major } from "semver";
import { PackageInfo } from "../types";

export function getTagName(pkgInfo: PackageInfo, newVersion: boolean = false): string {
  let tagName = '';

  const version = newVersion ? pkgInfo.newVersion : pkgInfo.version;
  if (pkgInfo.isRoot) {
    tagName = `v${version}`;
  } else {
    tagName = `${pkgInfo.name}@${version}`;
  }

  return tagName;
}

export function getMajorTagName(version: string): string {
  const majorVersion = major(version);
  return `v${majorVersion}`;
}
