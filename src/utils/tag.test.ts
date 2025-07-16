import { getMajorTagName, getTagName } from "./tag";
import { PackageInfo } from "../types";

describe('getTagName', () => {
  it('should get the tagName', () => {
    const pkgInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      newVersion: '1.0.1',
      isRoot: false,
      isPrivate: false,
      path: '',
      dependencies: [],
    };

    expect(getTagName(pkgInfo)).toEqual('test-package@1.0.0');
  });

  it('should get the tagName for root package', () => {
    const pkgInfo: PackageInfo = {
      name: 'test-package',
      version: '1.0.0',
      newVersion: '1.0.1',
      isRoot: true,
      isPrivate: false,
      path: '',
      dependencies: [],
    };

    expect(getTagName(pkgInfo)).toEqual('v1.0.0');
  });
});

describe('getMajorTagName', () => {
  it('should get the major tag name', () => {
    const pkgInfo: PackageInfo = {
      name: 'test-package',
      version: '1.2.3',
      newVersion: '1.2.4',
      isRoot: false,
      isPrivate: false,
      path: '',
      dependencies: [],
    };

    expect(getMajorTagName(pkgInfo.version)).toEqual('v1');
  });
});
