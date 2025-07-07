import { getTagName } from "./tag";
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
