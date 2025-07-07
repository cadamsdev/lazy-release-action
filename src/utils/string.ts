import { replacePRNumberWithLink } from "./markdown";

export function transformDescription(description: string): string {
  if (!description) {
    return '';
  }

  // Remove leading and trailing whitespace
  let temp = description.trim();

  // uppercase the first letter
  temp = uppercaseFirstLetter(temp);

  // replace PR number
  temp = replacePRNumberWithLink(temp);
  return temp;
}

export function uppercaseFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
