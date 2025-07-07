export function getVersionPrefix(versionSpec: string): string {
  const match = versionSpec.match(/^([\^~><=]+)/);
  return match ? match[1] : '';
}

export function replaceVersionInPackageJson(
  packageJsonString: string,
  newVersion: string
): string {
  return packageJsonString.replace(
    /("version":\s*")[^"]*(")/,
    `$1${newVersion}$2`
  );
}
