import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRecentCommits } from './git';
import { exec } from '@actions/exec';
import { CONVENTIONAL_COMMITS_PATTERN } from '../utils/validation';
import { hasChangelogSection } from '../utils/markdown';

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
vi.mock('../utils/validation');
vi.mock('../utils/markdown');
vi.mock('../constants', () => ({
  RELEASE_ID: '[release-action]'
}));

const mockExec = vi.mocked(exec);
const mockConventionalCommitsPattern = vi.mocked(CONVENTIONAL_COMMITS_PATTERN);
const mockHasChangelogSection = vi.mocked(hasChangelogSection);

describe('getRecentCommits', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockConventionalCommitsPattern.test = vi.fn().mockReturnValue(false);
    mockHasChangelogSection.mockReturnValue(false);
    
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should return commits before release commit', async () => {
    const gitOutput = `abc123:feat: add new feature
<COMMIT_SEPARATOR>
def456:fix: bug fix
<COMMIT_SEPARATOR>
ghi789:chore: release [release-action] (#123)
<COMMIT_SEPARATOR>
jkl012:old commit
<COMMIT_SEPARATOR>`;

    mockExec.mockImplementation(async (command, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(gitOutput));
      }
      return 0;
    });

    mockConventionalCommitsPattern.test = vi.fn()
      .mockReturnValueOnce(true)  // feat: add new feature
      .mockReturnValueOnce(true); // fix: bug fix

    const result = await getRecentCommits();

    expect(result).toEqual([
      { hash: 'abc123', message: 'feat: add new feature' },
      { hash: 'def456', message: 'fix: bug fix' }
    ]);
  });

//   it('should ignore latest commit when ignoreLatest is true', async () => {
//     const gitOutput = `abc123:feat: latest commit
// <COMMIT_SEPARATOR>
// def456:fix: previous commit
// <COMMIT_SEPARATOR>
// ghi789:chore: release [release-action] (#123)
// <COMMIT_SEPARATOR>`;

//     mockExec.mockImplementation(async (command, args, options) => {
//       if (options?.listeners?.stdout) {
//         options.listeners.stdout(Buffer.from(gitOutput));
//       }
//       return 0;
//     });

//     mockConventionalCommitsPattern.test = vi.fn().mockReturnValue(true);

//     const result = await getRecentCommits(true);

//     expect(result).toEqual([
//       { hash: 'def456', message: 'previous commit' }
//     ]);
//   });

//   it('should skip release commit that is reverted', async () => {
//     const gitOutput = `abc123:Reverts test-owner/test-repo#123
// <COMMIT_SEPARATOR>
// def456:chore: release [release-action] (#123)
// <COMMIT_SEPARATOR>
// ghi789:feat: some feature
// <COMMIT_SEPARATOR>`;

//     mockExec.mockImplementation(async (command, args, options) => {
//       if (options?.listeners?.stdout) {
//         options.listeners.stdout(Buffer.from(gitOutput));
//       }
//       return 0;
//     });

//     mockConventionalCommitsPattern.test = vi.fn().mockReturnValue(true);

//     const result = await getRecentCommits();

//     expect(result).toEqual([
//       { hash: 'abc123', message: 'Reverts test-owner/test-repo#123' }
//     ]);
//   });

//   it('should filter commits based on conventional commits pattern', async () => {
//     const gitOutput = `abc123:feat: new feature
// <COMMIT_SEPARATOR>
// def456:random commit message
// <COMMIT_SEPARATOR>
// ghi789:fix: bug fix
// <COMMIT_SEPARATOR>
// jkl012:another random message
// <COMMIT_SEPARATOR>`;

//     mockExec.mockImplementation(async (command, args, options) => {
//       if (options?.listeners?.stdout) {
//         options.listeners.stdout(Buffer.from(gitOutput));
//       }
//       return 0;
//     });

//     mockConventionalCommitsPattern.test = vi.fn()
//       .mockReturnValueOnce(true)   // feat: new feature
//       .mockReturnValueOnce(false)  // random commit message
//       .mockReturnValueOnce(true)   // fix: bug fix
//       .mockReturnValueOnce(false); // another random message

//     const result = await getRecentCommits();

//     expect(result).toEqual([
//       { hash: 'abc123', message: 'feat: new feature' },
//       { hash: 'ghi789', message: 'fix: bug fix' }
//     ]);
//   });

//   it('should filter commits based on changelog section', async () => {
//     const gitOutput = `abc123:commit with changelog
// <COMMIT_SEPARATOR>
// def456:regular commit
// <COMMIT_SEPARATOR>`;

//     mockExec.mockImplementation(async (command, args, options) => {
//       if (options?.listeners?.stdout) {
//         options.listeners.stdout(Buffer.from(gitOutput));
//       }
//       return 0;
//     });

//     mockHasChangelogSection
//       .mockReturnValueOnce(true)   // commit with changelog
//       .mockReturnValueOnce(false); // regular commit

//     const result = await getRecentCommits();

//     expect(result).toEqual([
//       { hash: 'abc123', message: 'commit with changelog' }
//     ]);
//   });

//   it('should handle malformed commit data gracefully', async () => {
//     const gitOutput = `abc123:valid commit
// <COMMIT_SEPARATOR>
// malformed-no-colon
// <COMMIT_SEPARATOR>
// :no-hash-message
// <COMMIT_SEPARATOR>
// def456:another valid commit
// <COMMIT_SEPARATOR>`;

//     mockExec.mockImplementation(async (command, args, options) => {
//       if (options?.listeners?.stdout) {
//         options.listeners.stdout(Buffer.from(gitOutput));
//       }
//       return 0;
//     });

//     mockConventionalCommitsPattern.test = vi.fn().mockReturnValue(true);

//     const result = await getRecentCommits();

//     expect(result).toEqual([
//       { hash: 'abc123', message: 'valid commit' },
//       { hash: 'def456', message: 'another valid commit' }
//     ]);
//   });

//   it('should skip release commit without PR number', async () => {
//     const gitOutput = `abc123:feat: some feature
// <COMMIT_SEPARATOR>
// def456:chore: release [release-action] without PR
// <COMMIT_SEPARATOR>
// ghi789:older commit
// <COMMIT_SEPARATOR>`;

//     mockExec.mockImplementation(async (command, args, options) => {
//       if (options?.listeners?.stdout) {
//         options.listeners.stdout(Buffer.from(gitOutput));
//       }
//       return 0;
//     });

//     mockConventionalCommitsPattern.test = vi.fn().mockReturnValue(true);

//     const result = await getRecentCommits();

//     expect(result).toEqual([
//       { hash: 'abc123', message: 'feat: some feature' }
//     ]);
//   });

//   it('should skip release commit if it is the first commit', async () => {
//     const gitOutput = `abc123:chore: release [release-action] (#123)
// <COMMIT_SEPARATOR>`;

//     mockExec.mockImplementation(async (command, args, options) => {
//       if (options?.listeners?.stdout) {
//         options.listeners.stdout(Buffer.from(gitOutput));
//       }
//       return 0;
//     });
//     mockConventionalCommitsPattern.test = vi.fn().mockReturnValue(true);

//     const result = await getRecentCommits();
//     expect(result).toEqual([]);
//   }); 

  // it('should return empty array if no commits found', async () => {
  //   const gitOutput = '';

  //   mockExec.mockImplementation(async (command, args, options) => {
  //     if (options?.listeners?.stdout) {
  //       options.listeners.stdout(Buffer.from(gitOutput));
  //     }
  //     return 0;
  //   });

  //   mockConventionalCommitsPattern.test = vi.fn().mockReturnValue(true);

  //   const result = await getRecentCommits();
  //   expect(result).toEqual([]);
  // });

  // it('should handle empty git output gracefully', async () => {
  //   const gitOutput = '';

  //   mockExec.mockImplementation(async (command, args, options) => {
  //     if (options?.listeners?.stdout) {
  //       options.listeners.stdout(Buffer.from(gitOutput));
  //     }
  //     return 0;
  //   });

  //   const result = await getRecentCommits();
  //   expect(result).toEqual([]);
  // });
});
