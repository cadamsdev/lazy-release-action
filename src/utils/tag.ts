import { major } from "semver";
import { PackageInfo } from "../types";

export function getTagName(pkgInfo: PackageInfo): string {
  let tagName = '';

  if (pkgInfo.isRoot) {
    tagName = `v${pkgInfo.version}`;
  } else {
    tagName = `${pkgInfo.name}@${pkgInfo.version}`;
  }

  return tagName;
}

export function getMajorTagName(version: string): string {
  const majorVersion = major(version);
  return `v${majorVersion}`;
}
