import { context } from "@actions/github";
import { bumpIndirectPackageVersion, getChangedPackageInfos, getPackageInfos, getPackagePaths, updateIndirectPackageJsonFile, updatePackageJsonFile } from "../utils/package";
import * as githubApi from "../api/github";
import { applyNewVersion } from "./version";
import { generateMarkdown, hasChangelogSection, hasReleasePRComment, increaseHeadingLevel } from "../utils/markdown";
import { detect, resolveCommand } from "package-manager-detector";
import { createSnapshot } from "./snapshots";
import { PR_COMMENT_STATUS_ID } from "../constants";
import { Changelog } from "../types";
import { createChangelogFromChangelogItem, getChangelogFromMarkdown } from "../utils/changelog";

export async function createOrUpdatePRStatusComment(shouldCreateSnapshot = false): Promise<void> {
  const prBody = context.payload.pull_request?.body || '';
  if (hasReleasePRComment(prBody)) {
    console.log('Detected release PR comment, skipping status comment creation.');
    return;
  }

  console.log('Creating or updating PR status comment...');

  let markdown = '## 🚀 Lazy Release Action\n';
  let changelogs: Changelog[] = [];

  // get all package infos
  const packagePaths = getPackagePaths();
  if (packagePaths.length === 0) {
    console.log('No package.json files found, skipping...');
    return;
  }

  console.log(`Found ${packagePaths.length} package.json files.`);

  const allPkgInfos = getPackageInfos(packagePaths);
  if (allPkgInfos.length === 0) {
    console.log('No packages found, skipping...');
    return;
  }

  console.log(`Found ${allPkgInfos.length} packages.`);

  const rootPackageName = allPkgInfos.find((pkg) => pkg.isRoot)?.name;

  if (hasChangelogSection(prBody)) {
    changelogs = getChangelogFromMarkdown(prBody, rootPackageName);
  } else if (githubApi.PR_TITLE) {
    const changelog = createChangelogFromChangelogItem(
      githubApi.PR_TITLE,
      rootPackageName
    );
    if (changelog) {
      changelogs.push(changelog);
    }
  }

  console.log(`Found ${changelogs.length} changelog entries.`);
  console.log(changelogs);

  if (changelogs.length) {
    markdown += '✅ Changelogs found.\n';
  } else if (changelogs.length === 0) {
    markdown += '⚠️ No changelogs found.\n';
  }

  const { changedPackageInfos, indirectPackageInfos } = getChangedPackageInfos(
    changelogs,
    allPkgInfos
  );

  const pkgUpdateCount = changedPackageInfos.length + indirectPackageInfos.length;
  if (pkgUpdateCount) {
    markdown += `📦 ${pkgUpdateCount} ${
      pkgUpdateCount ? "package's" : 'package'
    } will be updated.\n`;
  } else {
    markdown += '⚠️ No packages changed.\n';
  }

  const latestCommitHash = context.payload.pull_request?.head.sha;
  if (latestCommitHash) {
    console.log(`Latest commit hash: ${latestCommitHash}`);
    markdown += `Latest commit: ${latestCommitHash}\n\n`;
  }

  if (changedPackageInfos.length) {
    console.log(`Found ${changedPackageInfos.length} changed packages.`);

    changedPackageInfos.forEach((pkgInfo) => {
      // apply the new version based on the changelogs
      applyNewVersion(pkgInfo, changelogs);
    });

    changedPackageInfos.forEach((pkgInfo) => {
      // update the package.json version with the new version
      // bump any dependency versions that reference other packages in the workspace
      updatePackageJsonFile(pkgInfo, allPkgInfos);
    });

    // update indirect packages based on the changed packages
    indirectPackageInfos.forEach((pkgInfo) => {
      bumpIndirectPackageVersion(pkgInfo);

      updateIndirectPackageJsonFile(pkgInfo, allPkgInfos);
    });

    // generate markdown from changelogs
    const content = generateMarkdown(
      changedPackageInfos,
      indirectPackageInfos,
      changelogs
    );

    markdown += increaseHeadingLevel(content.trim());
  }

  if (shouldCreateSnapshot) {
    const pm = await detect();
    if (!pm) {
      throw new Error('No package manager detected');
    }

    const rc = resolveCommand(pm.agent, 'install', []);
    if (!rc) {
      throw new Error(`Could not resolve command for ${pm.agent}`);
    }

    const allChangedPkgs = [...changedPackageInfos, ...indirectPackageInfos];
    const snapshotResults = await createSnapshot(allChangedPkgs);

    if (snapshotResults.length) {
      markdown += `\n\n## 📸 Snapshots\n`;

      snapshotResults.forEach((result, index) => {
        markdown += `\`\`\`\n`;
        markdown += `${rc.command} ${rc.args.join(' ')} ${result.packageName}@${result.newVersion}\n`;
        markdown += `\`\`\``;

        if (index < snapshotResults.length - 1) {
          markdown += '\n\n';
        } 
      });
    }
  }

  markdown += `\n\n<!-- ${PR_COMMENT_STATUS_ID} -->`;

  const prComments = await githubApi.getPRComments();
  const existingComment = prComments.find((comment) =>
    comment.body?.includes(PR_COMMENT_STATUS_ID)
  );

  console.log('markdown');
  console.log(markdown);

  if (existingComment) {
    console.log('Updating existing PR status comment with ID');
    await githubApi.updatePRComment(existingComment.id, markdown);
  } else {
    console.log('Creating new PR status comment');
    await githubApi.createPRComment(markdown);
  }
}
