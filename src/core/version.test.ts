import { Changelog, PackageInfo } from "../types";
import { getVersionPrefix, replaceVersionInPackageJson } from "../utils/version";
import { applyNewVersion, getNewVersion } from "./version";

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
describe('applyNewVersion', () => {
  it('should apply patch version by default when no relevant changelogs', () => {
    const packageInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('1.0.1');
  });

  it('should apply minor version bump for minor changes', () => {
    const packageInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: 'feat',
        description: 'Added new feature',
        packages: ['test-package'],
        semverBump: 'minor',
        isBreakingChange: false,
        hasExplicitVersionBump: false
      }
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('1.1.0');
  });

  it('should apply major version bump for breaking changes', () => {
    const packageInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: 'fix',
        description: 'Fixed a bug',
        packages: ['test-package'],
        semverBump: 'patch',
        isBreakingChange: true,
        hasExplicitVersionBump: false
      }
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('2.0.0');
  });

  it('should apply minor version bump for breaking changes in v0', () => {
    const packageInfo: PackageInfo = {
      name: 'test-package',
      version: '0.1.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: 'fix',
        description: 'Fixed a bug',
        packages: ['test-package'],
        semverBump: 'patch',
        isBreakingChange: true,
        hasExplicitVersionBump: false,
      },
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('0.2.0');
  });

  it('should use explicit version bump when specified', () => {
    const packageInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: 'fix',
        description: 'Fixed a bug',
        packages: ['test-package'],
        semverBump: 'major',
        isBreakingChange: false,
        hasExplicitVersionBump: true,
      },
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('2.0.0');
  });

  it('should handle scoped package names', () => {
    const packageInfo: PackageInfo = {
      name: '@scope/test-package',
      version: '1.0.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: 'feat',
        description: 'Added new feature',
        packages: ['test-package'],
        semverBump: 'minor',
        isBreakingChange: false,
        hasExplicitVersionBump: false,
      },
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('1.1.0');
  });

  it('should handle directory name matching', () => {
    const packageInfo: PackageInfo = {
      name: 'different-name',
      version: '1.0.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: 'feat',
        description: 'Added new feature',
        packages: ['to'],
        semverBump: 'minor',
        isBreakingChange: false,
        hasExplicitVersionBump: false,
      },
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('1.1.0');
  });

  it('should handle root package with empty changelog packages', () => {
    const packageInfo: PackageInfo = {
      name: 'root-package',
      version: '1.0.0',
      path: '/path/to/root',
      isRoot: true,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: 'feat',
        description: 'Added new feature',
        packages: [],
        semverBump: 'minor',
        isBreakingChange: false,
        hasExplicitVersionBump: false,
      },
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('1.1.0');
  });

  it('should ignore irrelevant changelogs', () => {
    const packageInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: '',
        description: 'Added new feature',
        packages: ['other-package'],
        semverBump: 'major',
        isBreakingChange: true,
        hasExplicitVersionBump: false,
      },
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('1.0.1');
  });

  it('should prioritize major version bumps', () => {
    const packageInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: 'feat',
        description: 'Added new feature',
        packages: ['test-package'],
        semverBump: 'minor',
        isBreakingChange: false,
        hasExplicitVersionBump: false,
      },
      {
        type: 'fix',
        description: 'Fixed a bug',
        packages: ['test-package'],
        semverBump: 'patch',
        isBreakingChange: true,
        hasExplicitVersionBump: false,
      },
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('2.0.0');
  });

  it('should prioritize minor over patch', () => {
    const packageInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: '/path/to/test-package',
      isRoot: false,
      newVersion: '',
      isPrivate: false,
      dependencies: [],
    };
    const changelogs: Changelog[] = [
      {
        type: 'fix',
        description: 'Fixed a bug',
        packages: ['test-package'],
        semverBump: 'patch',
        isBreakingChange: false,
        hasExplicitVersionBump: false,
      },
      {
        type: 'feat',
        description: 'Added new feature',
        packages: ['test-package'],
        semverBump: 'minor',
        isBreakingChange: false,
        hasExplicitVersionBump: false,
      },
    ];

    applyNewVersion(packageInfo, changelogs);

    expect(packageInfo.newVersion).toBe('1.1.0');
  });
});

describe('getNewVersion', () => {
  it('should increment major version', () => {
    const result = getNewVersion('1.2.3', 'major');
    expect(result).toBe('2.0.0');
  });

  it('should increment minor version', () => {
    const result = getNewVersion('1.2.3', 'minor');
    expect(result).toBe('1.3.0');
  });

  it('should increment patch version', () => {
    const result = getNewVersion('1.2.3', 'patch');
    expect(result).toBe('1.2.4');
  });

  it('should handle v0 versions correctly', () => {
    expect(getNewVersion('0.1.0', 'major')).toBe('1.0.0');
    expect(getNewVersion('0.1.0', 'minor')).toBe('0.2.0');
    expect(getNewVersion('0.1.0', 'patch')).toBe('0.1.1');
  });
});
