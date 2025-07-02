import { readFileSync } from "fs";

const data = readFileSync("package.json", "utf-8");
console.log(data);

// check if there's a new line at th end of the file
if (data.endsWith("\n")) {
  console.log("New line at the end of the file");
}

