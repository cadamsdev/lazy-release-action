export const GITHUB_TOKEN = process.env['INPUT_GITHUB-TOKEN'] || '';
export const SNAPSHOTS_ENABLED = process.env['INPUT_SNAPSHOTS']
  ? process.env['INPUT_SNAPSHOTS'] === 'true'
  : false;
export const GITHUB_PACKAGES_ENABLED = process.env['INPUT_GITHUB-PACKAGES']
  ? process.env['INPUT_GITHUB-PACKAGES'] === 'true'
  : false;
export const DEFAULT_BRANCH = process.env.DEFAULT_BRANCH || 'main';
