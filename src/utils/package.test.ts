import { getPackageNameWithoutScope } from "./package";

describe('getPackageNameWithoutScope', () => {
  it('should return the package name without scope', () => {
    const packageNameWithScope = '@scope/package-name';
    const packageNameWithoutScope = 'package-name';
    expect(getPackageNameWithoutScope(packageNameWithScope)).toEqual(
      packageNameWithoutScope
    );
  });
});
