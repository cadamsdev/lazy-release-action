import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecentCommits } from './git';
import { execFileSync } from 'child_process';
import { END_COMMIT } from '../constants';

// Mock dependencies
vi.mock('@actions/exec');
vi.mock('@actions/github', () => ({
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
  },
}));
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));
vi.mock('../utils/validation');
vi.mock('../utils/markdown');

vi.mock('../constants', () => {
  const mockConstants = {
    RELEASE_ID: '[release-action]',
    END_COMMIT: '',
  };

  // Expose the mock object so we can modify it in tests
  (globalThis as any).__mockConstants = mockConstants;

  return mockConstants;
});

const mockExecFileSync = vi.mocked(execFileSync);

describe('getRecentCommits', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should return commits before release commit', async () => {
    const gitOutput = `abc123<HASH_SEPARATOR>feat: add new feature<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>
def456<HASH_SEPARATOR>fix: bug fix<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>
ghi789<HASH_SEPARATOR>chore: release (#123)<SUBJECT_SEPARATOR>[release-action]
<COMMIT_SEPARATOR>
jkl012<HASH_SEPARATOR>old commit<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>`;

    mockExecFileSync.mockImplementation(() => {
      return gitOutput;
    });

    const result = await getRecentCommits();

    expect(result).toEqual([
      { hash: 'abc123', subject: 'feat: add new feature', body: '' },
      { hash: 'def456', subject: 'fix: bug fix', body: '' },
    ]);
  });

  it('should ignore latest commit when ignoreLatest is true', async () => {
    const gitOutput = `abc123<HASH_SEPARATOR>feat: latest commit<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>
def456<HASH_SEPARATOR>fix: previous commit<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>
ghi789<HASH_SEPARATOR>chore: release (#123)<SUBJECT_SEPARATOR>[release-action]
<COMMIT_SEPARATOR>`;

    mockExecFileSync.mockImplementation(() => {
      return gitOutput;
    });

    const result = await getRecentCommits(true);

    expect(result).toEqual([
      { hash: 'def456', subject: 'fix: previous commit', body: '' },
    ]);
  });

  it('should skip release commit that is reverted', async () => {
    const gitOutput = `abc123<HASH_SEPARATOR>Revert some changes<SUBJECT_SEPARATOR>Reverts test-owner/test-repo#123
<COMMIT_SEPARATOR>
def456<HASH_SEPARATOR>chore: release (#123)<SUBJECT_SEPARATOR>[release-action]
<COMMIT_SEPARATOR>
ghi789<HASH_SEPARATOR>feat: some feature<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>`;

    mockExecFileSync.mockImplementation(() => {
      return gitOutput;
    });

    const result = await getRecentCommits();

    expect(result).toEqual([
      { hash: 'ghi789', subject: 'feat: some feature', body: '' },
    ]);
  });

  it('should exclude reverted commits', async () => {
    const gitOutput = `abc123<HASH_SEPARATOR>feat: add new feature<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>
cc88b03<HASH_SEPARATOR>Revert "feat: add support for snapshots" (#5)<SUBJECT_SEPARATOR>Reverts stellasoftio/lazy-release-action#4
<COMMIT_SEPARATOR>
b4ddfdb<HASH_SEPARATOR>feat: add support for snapshots (#4)<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>
ghi789<HASH_SEPARATOR>fix: bug fix<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>
jkl012<HASH_SEPARATOR>chore: release (#123)<SUBJECT_SEPARATOR>[release-action]
<COMMIT_SEPARATOR>`;

    mockExecFileSync.mockImplementation(() => {
      return gitOutput;
    });

    const result = await getRecentCommits();

    expect(result).toEqual([
      { hash: 'abc123', subject: 'feat: add new feature', body: '' },
      { hash: 'ghi789', subject: 'fix: bug fix', body: '' },
    ]);
  });

  it('should use END_COMMIT range when END_COMMIT is provided', async () => {
    (globalThis as any).__mockConstants.END_COMMIT = 'abc123';

    const gitOutput = `def456<HASH_SEPARATOR>feat: new feature<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>
ghi789<HASH_SEPARATOR>fix: bug fix<SUBJECT_SEPARATOR>
<COMMIT_SEPARATOR>`;

    mockExecFileSync.mockReturnValue(gitOutput);

    await getRecentCommits();

    // Verify that execFileSync was called with the correct arguments including the range
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'git',
      [
        'log',
        '--pretty=format:"%h<HASH_SEPARATOR>%s<SUBJECT_SEPARATOR>%b<COMMIT_SEPARATOR>"',
        'abc123^..HEAD',
      ],
      {
        encoding: 'utf8',
        stdio: 'pipe',
      }
    );
  });
});
