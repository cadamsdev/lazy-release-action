export interface PackageInfo {
  name: string;
  version: string;
  newVersion?: string;
  path: string;
  isRoot: boolean;
  isPrivate: boolean;
  dependencies: string[];
}
