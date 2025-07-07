import { describe, expect, it } from "vitest";
import { getVersionPrefix, replaceVersionInPackageJson } from "./version";

describe('getVersionPrefix', () => {
  it('should return the prefix from a version spec', () => {
    const versionSpec = '^1.0.0';
    const result = getVersionPrefix(versionSpec);
    expect(result).toBe('^');
  });

  it('should return an empty string if no prefix is present', () => {
    const versionSpec = '1.0.0';
    const result = getVersionPrefix(versionSpec);
    expect(result).toBe('');
  });

  it('should handle version specs with multiple characters', () => {
    const versionSpec = '~>1.0.0';
    const result = getVersionPrefix(versionSpec);
    expect(result).toBe('~>');
  });

  it('should return an empty string for an empty input', () => {
    const versionSpec = '';
    const result = getVersionPrefix(versionSpec);
    expect(result).toBe('');
  });
});

it('should replace version in package.json string', () => {
  const packageJsonString = `{
    "name": "test-package",
    "version": "1.0.0"
  }`;
  const newVersion = '1.1.0';
  const updatedPackageJsonString = `{
    "name": "test-package",
    "version": "1.1.0"
  }`;

  const result = replaceVersionInPackageJson(packageJsonString, newVersion);
  expect(result).toEqual(updatedPackageJsonString);
});
