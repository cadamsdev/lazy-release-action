import { describe, expect, it } from "vitest";
import { getVersionPrefix } from "./version";

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
