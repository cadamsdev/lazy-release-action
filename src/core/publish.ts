import { detect } from "package-manager-detector";
import { PackageInfo } from "../types";
import { execFileSync, execSync } from "child_process";
import { setOutput } from "@actions/core";
import { getMajorTagName, getTagName } from "../utils/tag";
import { doesTagExistOnRemote } from "../api/git";
import { getPackageNameWithoutScope } from "../utils/package";
import { toDirectoryPath } from "../utils/path";
import { PUBLISH_MAJOR_TAG } from "../constants";

export async function publishPackages(changedPkgInfos: PackageInfo[]): Promise<void> {
  console.log('Publishing packages...');

  let hasPublished: boolean = false;
  changedPkgInfos.forEach(async (pkgInfo) => {
    if (pkgInfo.isPrivate) {
      console.warn(`Package ${pkgInfo.name} is private, skipping publish.`);
      return;
    }

    if (!pkgInfo.version) {
      console.warn(`No version for package ${pkgInfo.name}, skipping publish.`);
      return;
    }

    console.log(
      `Publishing package ${pkgInfo.name} version ${pkgInfo.version}...`
    );

    const dirPath = toDirectoryPath(pkgInfo.path);

    const pm = await detect();
    if (!pm) {
      throw new Error('No package manager detected');
    }

    const fullPublishCommand = [pm.agent, 'publish'].join(' ');

    try {
      console.log(`Running package manager command: ${fullPublishCommand}`);
      execSync(fullPublishCommand, {
        stdio: 'inherit',
        cwd: dirPath,
      });
      hasPublished = true;
    } catch (error) {
      if (error instanceof Error) {
        // log error if its not a 409
        if (error.message.includes('409 Conflict')) {
          console.warn(`Package ${pkgInfo.name} already exists, skipping...`);
        } else {
          console.error(
            `Error publishing package ${pkgInfo.name}:`,
            error.message
          );
        }
      }
    }
  });

  console.log(
    hasPublished
      ? 'Packages published successfully.'
      : 'No packages were published.'
  );
  setOutput('published', hasPublished);
}

export function createTags(packageInfos: PackageInfo[]): void {
  console.log('Creating tags...');

  let rootPkg: PackageInfo | undefined;
  const tagsToCreate: string[] = [];
  packageInfos.forEach((pkgInfo) => {
    if (!pkgInfo.version) {
      console.warn(
        `No version for package ${pkgInfo.name}, skipping tag creation.`
      );
      return;
    }

    if (pkgInfo.isRoot) { 
      rootPkg = pkgInfo;
    }

    const tagName = getTagName(pkgInfo);

    // Check if tag exists on remote
    const tagExists = doesTagExistOnRemote(tagName);

    if (tagExists) {
      console.log(`Tag ${tagName} already exists on remote, skipping...`);
      return;
    }

    console.log(`Creating tag: ${tagName}`);
    try {
      execSync(`git tag -a ${tagName} -m "Release ${tagName}"`, {
        stdio: 'inherit',
      });
      tagsToCreate.push(tagName);

      setPackageVersionOutput(pkgInfo);
    } catch (error) {
      console.error(`Failed to create tag ${tagName}:`, error);
    }
  });

  if (tagsToCreate.length === 0) {
    console.log('No new tags to push.');
    return;
  }

  console.log(`Pushing ${tagsToCreate.length} new tags...`);
  try {
    execFileSync('git', ['push', '--tags'], { stdio: 'inherit' });
    console.log('Tags pushed successfully.');
  } catch (error) {
    console.error('Failed to push tags:', error);
  }

  if (rootPkg && PUBLISH_MAJOR_TAG) {
    const majorTagName = getMajorTagName(rootPkg.version);

    let publishTag = false;
    try {
      // create local tag
      execSync(`git tag -f ${majorTagName}`, {
        stdio: 'inherit',
      });
      publishTag = true;
      console.log(`Created local major tag: ${majorTagName}`);
    } catch (error) {
      console.error(`Failed to create local major tag ${majorTagName}:`, error);
    }

    if (publishTag) {
      try {
        // override tag
        execSync(`git push origin ${majorTagName} --force`, {
          stdio: 'inherit',
        });
        console.log(`Pushed major tag: ${majorTagName}`);
      } catch (error) {
        console.error(`Failed to push local major tag ${majorTagName}:`, error);
      }
    }
  }
}

function setPackageVersionOutput(pkgInfo: PackageInfo): void {
  const outputName = `${getPackageNameWithoutScope(pkgInfo.name)}_version`;
  console.log(`Setting output for ${outputName} to ${pkgInfo.version}`);
  setOutput(outputName, pkgInfo.version);
}
