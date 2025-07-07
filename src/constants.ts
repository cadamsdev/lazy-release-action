import { ChangelogType } from "./types";

// inputs
export const GITHUB_TOKEN = process.env['INPUT_GITHUB-TOKEN'] || '';
export const SNAPSHOTS_ENABLED = process.env['INPUT_SNAPSHOTS']
  ? process.env['INPUT_SNAPSHOTS'] === 'true'
  : false;
export const DEFAULT_BRANCH = process.env['INPUT_DEFAULT-BRANCH'] || 'main';
export const NPM_TOKEN = process.env['INPUT_NPM-TOKEN'] || '';

// constants
export const RELEASE_BRANCH = 'lazy-release/main';
export const PR_COMMENT_STATUS_ID = 'b3da20ce-59b6-4bbd-a6e3-6d625f45d008';
export const RELEASE_PR_TITLE = 'Version Packages';
export const RELEASE_ID = 'ebe18c5c-b9c6-4fca-8b11-90bf80ad229e';
export const COMMIT_TYPE_PATTERN =
  /^(feat|fix|perf|chore|docs|style|test|build|ci|revert)(\(([^)]+)\))?(!)?$/;

export const TYPE_TO_CHANGELOG_TYPE: Record<string, ChangelogType> = {
  feat: { emoji: '🚀', displayName: 'New Features', sort: 0 },
  fix: { emoji: '🐛', displayName: 'Bug Fixes', sort: 1 },
  perf: { emoji: '⚡️', displayName: 'Performance Improvements', sort: 2 },
  chore: { emoji: '🏠', displayName: 'Chores', sort: 3 },
  docs: { emoji: '📖', displayName: 'Documentation', sort: 4 },
  style: { emoji: '🎨', displayName: 'Styles', sort: 5 },
  refactor: { emoji: '♻️', displayName: 'Refactors', sort: 6 },
  test: { emoji: '✅', displayName: 'Tests', sort: 7 },
  build: { emoji: '📦', displayName: 'Build', sort: 8 },
  ci: { emoji: '🤖', displayName: 'Automation', sort: 9 },
  revert: { emoji: '⏪', displayName: 'Reverts', sort: 10 },
};
