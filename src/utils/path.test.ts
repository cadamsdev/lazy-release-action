import { expect, it } from "vitest";
import { getDirectoryNameFromPath } from "./path";

it('should get directory name from a file path', () => {
  const filePath = 'src/packages/components/package.json';
  expect(getDirectoryNameFromPath(filePath)).toEqual('components');
});
