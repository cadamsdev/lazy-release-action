
export function getDirectoryNameFromPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 2];
}
