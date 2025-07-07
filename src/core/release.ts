import { doesTagExistOnRemote } from "../api/git";
import { PackageInfo } from "../types";
import { ReleasePackageInfo } from "../utils";
import { getTagName } from "../utils/tag";
import * as githubApi from "../api/github";
import { getPackageNameWithoutScope } from "../utils/package";

export async function createGitHubRelease(
  releasePkgInfos: ReleasePackageInfo[]
): Promise<void> {
  console.log('Creating GitHub release...');

  for (const releasePkgInfo of releasePkgInfos) {
    const { changelogEntry, pkgInfo } = releasePkgInfo;
    if (!changelogEntry.heading.newVersion) {
      console.warn(
        `No version for package ${changelogEntry.heading.newVersion}, skipping release creation.`
      );
      continue;
    }

    const tagName = getTagName(releasePkgInfo.pkgInfo);

    // Check if tag exists on remote
    const tagExists = doesTagExistOnRemote(tagName);
    if (!tagExists) {
      console.warn(
        `Tag ${tagName} does not exist on remote, skipping release creation.`
      );
      continue;
    }

    const releaseName = getGitHubReleaseName(pkgInfo);
    console.log(`Creating release for ${releaseName}...`);
    await githubApi.createGitHubRelease({
      tag_name: tagName,
      name: releaseName,
      body: changelogEntry.content.trim(),
    });
  }
}

function getGitHubReleaseName(pkgInfo: PackageInfo): string {
  let releaseName = '';

  if (pkgInfo.isRoot) {
    releaseName = `v${pkgInfo.version}`;
  } else {
    releaseName = `${getPackageNameWithoutScope(pkgInfo.name)}@${pkgInfo.version}`;
  }

  return releaseName;
}
