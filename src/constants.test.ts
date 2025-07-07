import { TYPE_TO_CHANGELOG_TYPE } from "./constants";

describe('TYPE_TO_CHANGELOG_TYPE', () => {
  it('should return correct emoji for type', () => {
    expect(TYPE_TO_CHANGELOG_TYPE['fix'].emoji).toEqual('🐛');
    expect(TYPE_TO_CHANGELOG_TYPE['feat'].emoji).toEqual('🚀');
    expect(TYPE_TO_CHANGELOG_TYPE['chore'].emoji).toEqual('🏠');
  });
});
