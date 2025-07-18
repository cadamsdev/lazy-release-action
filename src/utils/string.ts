import { getPRMarkdownLink, replacePRNumberWithLink } from "./markdown";
import { PR_NUMBER_PATTERN } from "./regex";

export function transformDescription(description: string, prNumber?: number): string {
  if (!description) {
    return '';
  }

  // Remove leading and trailing whitespace
  let temp = description.trim();

  // uppercase the first letter
  temp = uppercaseFirstLetter(temp);

  // check if temp has a PR Number in it
  const prNumberMatch = temp.match(PR_NUMBER_PATTERN);
  if (prNumberMatch) {
    // replace PR number
    temp = replacePRNumberWithLink(temp);
  } else if (prNumber) {
    const prMarkdownLink = getPRMarkdownLink(prNumber);
    temp += ` (${prMarkdownLink})`;
  }

  return temp;
}

export function uppercaseFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
