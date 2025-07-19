## 0.6.0 (2025-07-19)

### 🚀 New Features
- Added a link in the GitHub release to compare changes ([#50](https://github.com/stellasoftio/lazy-release-action/pull/50))
- Added input to publish major tag ([#46](https://github.com/stellasoftio/lazy-release-action/pull/46))

### 🐛 Bug Fixes
- Fix updating dependencies that use workspace:* ([#49](https://github.com/stellasoftio/lazy-release-action/pull/49))


## 0.5.1 (2025-07-15)

### 🐛 Bug Fixes
- Update action, description and icon ([#43](https://github.com/stellasoftio/lazy-release-action/pull/43))


## 0.5.0 (2025-07-13)

### ⚠️ Breaking Changes
- Moved repo to stellasoftio org ([#40](https://github.com/stellasoftio/lazy-release-action/pull/40))

### 🚀 New Features
- Added input to change release PR title ([#42](https://github.com/stellasoftio/lazy-release-action/pull/42))
- Added input for end commit reference ([#41](https://github.com/stellasoftio/lazy-release-action/pull/41))
- Added explicit version bumps ([#38](https://github.com/stellasoftio/lazy-release-action/pull/38))


## 0.4.1 (2025-07-11)

### 🐛 Bug Fixes
- Ignore commits that have been reverted
- Only add the changelog section in the PR Body to the changelogs
- Don't enforce PR title to be formatted ([#33](https://github.com/stellasoftio/lazy-release-action/pull/33))
- Don't show status comment on Release PR ([#31](https://github.com/stellasoftio/lazy-release-action/pull/31))
- Don't log PR body ([#30](https://github.com/stellasoftio/lazy-release-action/pull/30))
- Skip creating status comment for release PR ([#29](https://github.com/stellasoftio/lazy-release-action/pull/29))
- Install snapshot command ([#28](https://github.com/stellasoftio/lazy-release-action/pull/28))

### 🏠 Chores
- Setup oxlint ([#26](https://github.com/stellasoftio/lazy-release-action/pull/26))
- Organize code ([#24](https://github.com/stellasoftio/lazy-release-action/pull/24))

### ✅ Tests
- Add vitest globals ([#27](https://github.com/stellasoftio/lazy-release-action/pull/27))


## 0.4.0 (2025-07-06)

### 🚀 New Features
- Can now publish packages to npm ([#22](https://github.com/stellasoftio/lazy-release-action/pull/22))
- Added input to specify default branch ([#20](https://github.com/stellasoftio/lazy-release-action/pull/20))
- Added outputs for the new package versions ([#16](https://github.com/stellasoftio/lazy-release-action/pull/16))

### 🐛 Bug Fixes
- Latest commit hash in PR status comment ([#23](https://github.com/stellasoftio/lazy-release-action/pull/23))
- Remove Release PR comment from GitHub Release ([#21](https://github.com/stellasoftio/lazy-release-action/pull/21))
- Updating package.json dependency versions ([#15](https://github.com/stellasoftio/lazy-release-action/pull/15))
- Versioning breaking changes for v0 ([#13](https://github.com/stellasoftio/lazy-release-action/pull/13))

### 🏠 Chores
- Added license ([#18](https://github.com/stellasoftio/lazy-release-action/pull/18))

### 📖 Documentation
- Updated README ([#17](https://github.com/stellasoftio/lazy-release-action/pull/17))

### 🤖 Automation
- Renamed ci.yml to pull-request.yml ([#19](https://github.com/stellasoftio/lazy-release-action/pull/19))


## 0.3.0 (2025-07-04)

### 🚀 New Features
- Allow for using the directory name instead of package name in PR
title

### 🐛 Bug Fixes
- Sync release branch with default branch ([#11](https://github.com/stellasoftio/lazy-release-action/pull/11))
- Package count in PR status comment ([#8](https://github.com/stellasoftio/lazy-release-action/pull/8))


## 0.2.0 (2025-07-02)

### 🚀 New Features
- Add support for snapshots ([#7](https://github.com/stellasoftio/lazy-release-action/pull/7))


## 0.1.0 (2025-07-02)

### 🚀 New Features
- Added a PR status comment ([#2](https://github.com/stellasoftio/lazy-release-action/pull/2))

### 🏠 Chores
- Initial release ([#1](https://github.com/stellasoftio/lazy-release-action/pull/1))
