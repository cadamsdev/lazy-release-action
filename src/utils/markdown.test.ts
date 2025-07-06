import { describe, expect, it } from "vitest";
import { generateMarkdown } from "./markdown";
import { PackageInfo } from "../types";
import { Changelog } from "../utils";

describe('generateMarkdown', () => {
  it('should generate markdown for changelog', () => {
    const pkgInfos: PackageInfo[] = [
      {
        name: 'package-a',
        version: '1.0.0',
        newVersion: '1.0.1',
        path: '/path/to/package-a',
        isRoot: false,
        isPrivate: false,
        dependencies: [],
      },
      {
        name: 'package-b',
        version: '1.0.0',
        newVersion: '1.0.1',
        path: '/path/to/package-b',
        isRoot: false,
        isPrivate: false,
        dependencies: [],
      },
    ];

    const changelogs: Changelog[] = [
      {
        type: 'chore',
        description: 'Some description',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-a'],
      },
      {
        type: 'chore',
        description: 'Some description 2',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-b'],
      },
      {
        type: 'fix',
        description: 'Some fix',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-b'],
      },
    ];

    const markdown = generateMarkdown(pkgInfos, [], changelogs);
    const expectedMarkdown = `# 👉 Changelog

## package-a@1.0.0➡️1.0.1

### 🏠 Chores
- Some description

## package-b@1.0.0➡️1.0.1

### 🐛 Bug Fixes
- Some fix

### 🏠 Chores
- Some description 2
\n`;

    expect(markdown).toEqual(expectedMarkdown);
  });

  it('should generate markdown for changelog', () => {
    const pkgInfos: PackageInfo[] = [
      {
        name: 'package-a',
        version: '1.0.0',
        newVersion: '1.0.1',
        path: '/path/to/package-a',
        isRoot: true,
        isPrivate: false,
        dependencies: [],
      },
    ];

    const changelogs: Changelog[] = [
      {
        type: 'chore',
        description: 'Some description',
        semverBump: 'patch',
        isBreakingChange: false,
        packages: ['package-a'],
      },
    ];

    const markdown = generateMarkdown(pkgInfos, [], changelogs);
    const expectedMarkdown = `# 👉 Changelog

## 1.0.0➡️1.0.1

### 🏠 Chores
- Some description
\n`;

    expect(markdown).toEqual(expectedMarkdown);
  });
});
