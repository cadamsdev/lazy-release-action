import { getPackageNameWithoutScope } from "./package";
import { vi } from 'vitest';
import { readFileSync, writeFileSync } from 'fs';
import { updatePackageJsonFile } from './package';
import { getVersionPrefix } from './version';

describe('getPackageNameWithoutScope', () => {
  it('should return the package name without scope', () => {
    const packageNameWithScope = '@scope/package-name';
    const packageNameWithoutScope = 'package-name';
    expect(getPackageNameWithoutScope(packageNameWithScope)).toEqual(
      packageNameWithoutScope
    );
  });
});
vi.mock('fs');
vi.mock('./version');

describe('updatePackageJsonFile', () => {
  const mockReadFileSync = vi.mocked(readFileSync);
  const mockWriteFileSync = vi.mocked(writeFileSync);
  const mockGetVersionPrefix = vi.mocked(getVersionPrefix);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return early when pkgInfo has no newVersion', () => {
    const pkgInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: 'package.json',
      isRoot: false,
      isPrivate: false,
      dependencies: [],
      newVersion: undefined
    };

    updatePackageJsonFile(pkgInfo, []);

    expect(mockReadFileSync).not.toHaveBeenCalled();
    expect(mockWriteFileSync).not.toHaveBeenCalled();
  });

  it('should update package version', () => {
    const pkgInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: 'package.json',
      isRoot: false,
      isPrivate: false,
      dependencies: [],
      newVersion: '1.1.0'
    };

    const packageJson = {
      name: 'test-package',
      version: '1.0.0'
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));

    updatePackageJsonFile(pkgInfo, []);

    expect(mockReadFileSync).toHaveBeenCalledWith('package.json', 'utf-8');
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      'package.json',
      JSON.stringify({ ...packageJson, version: '1.1.0' }, null, 2) + '\n',
      'utf-8'
    );
  });

  it('should update workspace dependencies with version prefixes', () => {
    const pkgInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: 'package.json',
      isRoot: false,
      isPrivate: false,
      dependencies: [],
      newVersion: '1.1.0'
    };

    const depPackage = {
      name: 'dep-package',
      version: '2.0.0',
      path: 'packages/dep/package.json',
      isRoot: false,
      isPrivate: false,
      dependencies: [],
      newVersion: '2.1.0'
    };

    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'dep-package': '^2.0.0',
        'external-dep': '^3.0.0'
      }
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockGetVersionPrefix.mockReturnValue('^');

    updatePackageJsonFile(pkgInfo, [pkgInfo, depPackage]);

    const expectedPackageJson = {
      name: 'test-package',
      version: '1.1.0',
      dependencies: {
        'dep-package': '^2.1.0',
        'external-dep': '^3.0.0'
      }
    };

    expect(mockGetVersionPrefix).toHaveBeenCalledWith('^2.0.0');
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      'package.json',
      JSON.stringify(expectedPackageJson, null, 2) + '\n',
      'utf-8'
    );
  });

  it('should skip workspace:* dependencies', () => {
    const pkgInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: 'package.json',
      isRoot: false,
      isPrivate: false,
      dependencies: [],
      newVersion: '1.1.0'
    };

    const depPackage = {
      name: 'dep-package',
      version: '2.0.0',
      path: 'packages/dep/package.json',
      isRoot: false,
      isPrivate: false,
      dependencies: [],
      newVersion: '2.1.0'
    };

    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'dep-package': 'workspace:*'
      }
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));

    updatePackageJsonFile(pkgInfo, [pkgInfo, depPackage]);

    const expectedPackageJson = {
      name: 'test-package',
      version: '1.1.0',
      dependencies: {
        'dep-package': 'workspace:*'
      }
    };

    expect(mockGetVersionPrefix).not.toHaveBeenCalled();
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      'package.json',
      JSON.stringify(expectedPackageJson, null, 2) + '\n',
      'utf-8'
    );
  });

  it('should update multiple dependency types', () => {
    const pkgInfo = {
      name: 'test-package',
      version: '1.0.0',
      path: 'package.json',
      isRoot: false,
      isPrivate: false,
      dependencies: [],
      newVersion: '1.1.0'
    };

    const depPackage = {
      name: 'dep-package',
      version: '2.0.0',
      path: 'packages/dep/package.json',
      isRoot: false,
      isPrivate: false,
      dependencies: [],
      newVersion: '2.1.0'
    };

    const packageJson = {
      name: 'test-package',
      version: '1.0.0',
      dependencies: {
        'dep-package': '^2.0.0'
      },
      devDependencies: {
        'dep-package': '~2.0.0'
      },
      peerDependencies: {
        'dep-package': '>=2.0.0'
      }
    };

    mockReadFileSync.mockReturnValue(JSON.stringify(packageJson));
    mockGetVersionPrefix.mockReturnValueOnce('^')
                        .mockReturnValueOnce('~')
                        .mockReturnValueOnce('>=');

    updatePackageJsonFile(pkgInfo, [pkgInfo, depPackage]);

    const expectedPackageJson = {
      name: 'test-package',
      version: '1.1.0',
      dependencies: {
        'dep-package': '^2.1.0'
      },
      devDependencies: {
        'dep-package': '~2.1.0'
      },
      peerDependencies: {
        'dep-package': '>=2.1.0'
      }
    };

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      'package.json',
      JSON.stringify(expectedPackageJson, null, 2) + '\n',
      'utf-8'
    );
  });
});
