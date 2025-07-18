import { getPRMarkdownLink, replacePRNumberWithLink } from "./markdown";

export function transformDescription(description: string, prNumber?: number): string {
  if (!description) {
    return '';
  }

  // Remove leading and trailing whitespace
  let temp = description.trim();

  // uppercase the first letter
  temp = uppercaseFirstLetter(temp);

  // replace PR number
  temp = replacePRNumberWithLink(temp);

  if (prNumber) {
    const prMarkdownLink = getPRMarkdownLink(prNumber);
    temp = temp += ` (${prMarkdownLink})`;
  }

  return temp;
}

export function uppercaseFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
