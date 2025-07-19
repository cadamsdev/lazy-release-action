# Lazy Release Action

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/stellasoftio/lazy-release-action/issues) [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0) ![GitHub Tag](https://img.shields.io/github/v/tag/stellasoftio/lazy-release-action)

The easiest way to version, publish and create changelogs for your JavaScript/TypeScript projects.

If you enjoy this tool, please consider giving it a star ⭐️ on GitHub! Also if you find it useful, consider supporting my work by buying me a coffee. Your support helps me continue to improve and maintain the project.

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/cadamsdev)

## Table of Contents

- [How does it work?](#how-does-it-work)
- [📝 Setup](#-setup)
- [🏷️ Types](#️-types)
- [🔧 Customization](#-customization)
  - [Inputs](#inputs)
  - [Output Params](#output-params)
- [💡 Inspiration](#inspiration)
- [🔗 Links](#-links)

## How does it work?

[see docs](/docs/how-does-it-work.md)

![diagram](/media/diagram.png)

## 📝 Setup

1. Update pull request settings

- Go to Settings > General > Pull Requests
  - Uncheck "Allow merge merges"
  - Check "Allow squash merges"
    - Choose "Pull request title and description" for default commit message

![PR Settings](/media/pr-settings.png)

2. Update workflow permissions

- Go to Settings > Actions > General
  - Set "Workflow permissions" to "Read and write permissions"
  - Check "Allow GitHub Actions to create and approve pull requests"

![Workflow Permissions](/media/workflow-permissions.png)

3. Create or update workflow files

Example release workflow file
`.github/workflows/release.yml`

```yml
name: Release

on:
  pull_request:
    types: [closed]
    branches:
      - main

jobs:
  release:
    if: github.event.pull_request.head.repo.full_name == github.repository && github.event.pull_request.merged == true
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Create Release PR or Release
        uses: stellasoftio/lazy-release-action@40cbbc343f8b7c8efb5c7ae4e7fd9b9584472531 # v0.5.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

Example pull request workflow file
`.github/workflows/pull-request.yml`

```yml
name: Pull Request

on:
  pull_request:
    types: [opened, synchronize, edited]
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm ci

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build

      - name: Create Release PR or Release
        uses: stellasoftio/lazy-release-action@40cbbc343f8b7c8efb5c7ae4e7fd9b9584472531 # v0.5.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

## 🏷️ Types

| Type          | Description                                       |
| ------------- | ------------------------------------------------- |
| 🚀 `feat`     | A new feature                                     |
| 🐛 `fix`      | A bug fix                                         |
| ⚡️ `perf`    | A code change that improves performance           |
| 🏠 `chore`    | Routine tasks and maintenance                     |
| 📚 `docs`     | Documentation changes                             |
| 🎨 `style`    | CSS changes                                       |
| ♻️ `refactor` | A code refactor                                   |
| ✅ `test`     | Adding missing tests or correcting existing tests |
| 📦 `build`    | Changes that affect the build system              |
| 🤖 `ci`       | Changes to CI configuration files                 |
| ⏪ `revert`   | Reverts a previous commit                         |

## 🔧 Customization

### Inputs

| Input               | Type    | Default Value      | Description                                                                                                                     |
| ------------------- | ------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `github-token`      | string  | `''`               | GitHub authentication token                                                                                                     |
| `npm-token`         | string  | `''`               | NPM authentication token                                                                                                        |
| `default-branch`    | string  | `main`             | The repo's default branch                                                                                                       |
| `snapshots`         | boolean | `false`            | Whether to create snapshots                                                                                                     |
| `end-commit`        | string  | `''`               | The end commit reference                                                                                                        |
| `release-pr-title`  | string  | `Version Packages` | The title of the release PR                                                                                                     |
| `publish-major-tag` | boolean | `false`            | Publishes the major tag e.g v1. This option is useful for GitHub actions. If the tag already exists the tag will be overwritten |

examples

```yaml
- name: Create Release PR or Publish Release
  uses: stellasoftio/lazy-release-action@40cbbc343f8b7c8efb5c7ae4e7fd9b9584472531 # v0.5.1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    snapshots: true
```

### Output Params

| Output Name              | Description                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `published`              | The flag that indicates the packages have been published to npm or GitHub packages |
| `<package-name>_version` | The updated version number of the package (without scope) after processing         |

example

```yaml
- name: Create Release PR or Publish Release
  id: lazy-release
  uses: stellasoftio/lazy-release-action@40cbbc343f8b7c8efb5c7ae4e7fd9b9584472531 # v0.5.1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}

- name: After Publish
  if: steps.lazy-release.outputs.published == 'true'
  run: |
    echo "Run a script after packages have been published"

- name: Get new package version
  if: ${{ steps.lazy-release.outputs.my-package_version != '' }}
  run: |
    echo "Package versions: ${{ steps.lazy-release.outputs.my-package_version }}"
```

## 💡Inspiration

This project was inspired by...
- [changelogen](https://github.com/unjs/changelogen)
  - Using emojis, compare changes
- [changesets](https://github.com/changesets/changesets)
  - Gave me ideas on how to handle versioning for monorepos + providing a status comment
  - Idea of using a release PR
- [vite](https://github.com/vitejs/vite)
  - Adding a date to the changelog
  - Gave me the idea of how to show breaking changes in the changelog

## 🔗 Links

- [Comparison of Similar Tools](docs/comparison-of-similar-tools.md)

