import { transformDescription, uppercaseFirstLetter } from "./string";

vi.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
  },
}));

describe('transformDescription', () => {
  it('should transform the description correctly', () => {
    const input = '   some description with a PR (#123)   ';
    const expected = 'Some description with a PR ([#123](https://github.com/test-owner/test-repo/pull/123))';
    const result = transformDescription(input);
    expect(result).toBe(expected);
  });
});
describe('uppercaseFirstLetter', () => {
  it('should uppercase the first letter of a string', () => {
    const input = 'hello world';
    const expected = 'Hello world';
    const result = uppercaseFirstLetter(input);
    expect(result).toBe(expected);
  });

  it('should handle empty strings', () => {
    const input = '';
    const expected = '';
    const result = uppercaseFirstLetter(input);
    expect(result).toBe(expected);
  });
});
