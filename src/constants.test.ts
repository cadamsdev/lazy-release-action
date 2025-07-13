import { DEFAULT_BRANCH, END_COMMIT, GITHUB_TOKEN, NPM_TOKEN, RELEASE_PR_TITLE, SNAPSHOTS_ENABLED, TYPE_TO_CHANGELOG_TYPE } from "./constants";

describe('TYPE_TO_CHANGELOG_TYPE', () => {
  it('should return correct emoji for type', () => {
    expect(TYPE_TO_CHANGELOG_TYPE['fix'].emoji).toEqual('🐛');
    expect(TYPE_TO_CHANGELOG_TYPE['feat'].emoji).toEqual('🚀');
    expect(TYPE_TO_CHANGELOG_TYPE['chore'].emoji).toEqual('🏠');
  });
});

describe('inputs', () => {
  it('should have correct default values', () => {
    expect(GITHUB_TOKEN).toEqual('');
    expect(SNAPSHOTS_ENABLED).toEqual(false);
    expect(DEFAULT_BRANCH).toEqual('main');
    expect(NPM_TOKEN).toEqual('');
    expect(END_COMMIT).toEqual('');
    expect(RELEASE_PR_TITLE).toEqual('Version Packages');
  });
});
