export function getVersionPrefix(versionSpec: string): string {
  const match = versionSpec.match(/^([\^~><=]+)/);
  return match ? match[1] : '';
}
