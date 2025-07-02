# Lazy Release Action

**Effortlessly automate your release workflow.** A powerful GitHub Action that handles versioning, publishing, changelog generation, and GitHub releases for JavaScript/TypeScript packages. This action was designed to work well in both single package repos and multi-package (monorepo) repos.
## 🎯 Goals

- **🚀 Zero-config by default** — Get started in minutes with sensible defaults
- **👥 Developer-friendly** — Lower the barrier to entry for new contributors
- **📦 Universal package manager support** — Works with npm, pnpm, yarn, bun
- **🏢 Monorepo ready** — First-class support for multi-package repositories
- **📖 Beautiful changelogs** — Generate clean, readable release notes automatically

## 📝 Setup

Create file `.github/workflows/release.yml`

```yml
name: release

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
      uses: cadamsdev/lazy-release-action@c84ff14137be3375cb79e9f8f6a81099a05e0e0c # v1.0.0
      with:
        github-token: ${{ secrets.GITHUB_TOKEN }}
```

Create file `.github/workflows/ci.yml`

```yml
name: ci

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
        uses: cadamsdev/lazy-release-action@c84ff14137be3375cb79e9f8f6a81099a05e0e0c # v1.0.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          snapshots: true
```

## 🛠️ Current Features

- Updates package.json and package-lock version
- Creates a release PR
- Creates tags
- Creates a GitHub Release
- Publishes packages
- Generates changelogs
- Supports monorepos
- Supports npm, pnpm, yarn and bun

## 🔧 Customization

| Option           | Description                     | Default |
| ---------------- | ------------------------------- | ------- |
| `default_branch` | The default branch for the repo | `main`  |
