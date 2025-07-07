
export function getDirectoryNameFromPath(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 2];
}

export function toDirectoryPath(filePath: string): string {
  const lastSlashIndex = filePath.lastIndexOf('/');
  return lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex) : '';
}
