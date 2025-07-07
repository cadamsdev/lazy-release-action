import { getDirectoryNameFromPath, toDirectoryPath } from "./path";

it('should get directory name from a file path', () => {
  const filePath = 'src/packages/components/package.json';
  expect(getDirectoryNameFromPath(filePath)).toEqual('components');
});

it('should return the directory path from a file path', () => {
  const filePath = '/path/to/file.txt';
  const directoryPath = '/path/to';
  expect(toDirectoryPath(filePath)).toEqual(directoryPath);
});
