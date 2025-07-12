import { CONVENTIONAL_COMMITS_PATTERN } from "./validation";

describe('CONVENTIONAL_COMMITS_PATTERN', () => {
  it('should match conventional commit format', () => {
    expect(CONVENTIONAL_COMMITS_PATTERN.test('fix: hello world')).toBe(true);
    expect(CONVENTIONAL_COMMITS_PATTERN.test('fix(scope): hello world')).toBe(
      true
    );
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a,scope-b): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a, scope-b): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a,scope-b)!: test')
    ).toBe(true);
    expect(CONVENTIONAL_COMMITS_PATTERN.test('fix!: hello world')).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a-1,scope-b-2): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope-a,scope-b,scope-c): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test(
        'fix(scope-a,scope-b,scope-c,scope-d): test'
      )
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(ds-components-2): test')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test(
        'chore(ds-components-2,ds-components-react-2): switch to lazy release action (#3)'
      )
    ).toBe(true);
  });

  it('should allow for explicit version bumps', () => {
    expect(CONVENTIONAL_COMMITS_PATTERN.test('fix: hello world #major')).toBe(
      true
    );
    expect(CONVENTIONAL_COMMITS_PATTERN.test('fix: hello world #minor')).toBe(
      true
    );
    expect(CONVENTIONAL_COMMITS_PATTERN.test('fix: hello world #patch')).toBe(
      true
    );
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope): hello world #major')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope): hello world #minor')
    ).toBe(true);
    expect(
      CONVENTIONAL_COMMITS_PATTERN.test('fix(scope): hello world #patch')
    ).toBe(true);
  });
});
