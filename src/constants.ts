export const GITHUB_TOKEN = process.env['INPUT_GITHUB-TOKEN'] || '';
export const SNAPSHOTS_ENABLED = process.env['INPUT_SNAPSHOTS']
  ? process.env['INPUT_SNAPSHOTS'] === 'true'
  : false;
export const DEFAULT_BRANCH = process.env['INPUT_DEFAULT-BRANCH'] || 'main';
export const NPM_TOKEN = process.env['INPUT_NPM-TOKEN'] || '';
