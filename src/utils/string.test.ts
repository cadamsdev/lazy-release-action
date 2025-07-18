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

  it('should add a link to the PR', () => {
    const input = 'some description without PR number';
    const expected =
      'Some description without PR number ([#100](https://github.com/test-owner/test-repo/pull/100))';
    const result = transformDescription(input, 100);
    expect(result).toBe(expected);
  });

  it('should add link to PR found in description', () => {
    const input = 'some description without PR number (#123)';
    const expected =
      'Some description without PR number ([#123](https://github.com/test-owner/test-repo/pull/123))';
    const result = transformDescription(input, 100);
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
