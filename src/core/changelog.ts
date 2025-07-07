import { join } from "path";
import { Changelog, PackageInfo } from "../types";
import { generateChangelogContent, updateChangelog } from "../utils/changelog";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { toDirectoryPath } from "../utils/path";


export function createOrUpdateChangelog(
  packageInfo: PackageInfo,
  changelogs: Changelog[]
): void {
  const dirPath = toDirectoryPath(packageInfo.path);

  console.log(
    `Creating or updating changelog for package: ${packageInfo.name} at ${dirPath}`
  );

  const changelogFilePath = join(dirPath, 'CHANGELOG.md');

  // generate changelog content
  const changelogContent = generateChangelogContent(packageInfo, changelogs);
  console.log(
    `Generated changelog content for ${packageInfo.name}:\n${changelogContent}`
  );

  // check if changelog file exists
  if (existsSync(changelogFilePath)) {
    // update changelog file
    const existingChangelogContent = readFileSync(changelogFilePath, 'utf-8');
    console.log(
      `Existing changelog content for ${packageInfo.name}:\n${existingChangelogContent}`
    );

    const updatedChangelogContent = updateChangelog(
      existingChangelogContent,
      changelogContent,
      packageInfo.newVersion
    );
    console.log(`Updating changelog file at ${changelogFilePath}`);
    console.log(`Updated changelog content:\n${updatedChangelogContent}`);

    writeFileSync(changelogFilePath, updatedChangelogContent, 'utf-8');
  } else {
    console.log(
      `Changelog file does not exist at ${changelogFilePath}, creating new one.`
    );
    // create changelog file
    writeFileSync(changelogFilePath, changelogContent, 'utf-8');
  }
}
