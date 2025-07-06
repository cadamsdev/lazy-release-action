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
