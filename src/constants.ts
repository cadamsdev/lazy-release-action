export const GITHUB_TOKEN = process.env['INPUT_GITHUB-TOKEN'] || '';
export const SNAPSHOTS_ENABLED = process.env['INPUT_SNAPSHOTS']
  ? process.env['INPUT_SNAPSHOTS'] === 'true'
  : false;
export const BASE_BRANCH = process.env['INPUT_BASE_BRANCH'] || 'main';
