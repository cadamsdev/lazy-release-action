
export const CONVENTIONAL_COMMITS_PATTERN =
  /^(feat|fix|perf|chore|docs|style|test|build|ci|revert)(!)?(\(([a-z-0-9]+)(,\s*[a-z-0-9]+)*\))?(!)?: .+/; // https://regexr.com/8flmk


export function isPRTitleValid(prTitle: string): boolean {
  return CONVENTIONAL_COMMITS_PATTERN.test(prTitle);
}
