## What is Lazy Release Action?
Lazy release action is a github action that automates the process of versioning, tagging, publishing, creating changelogs and github releases.

## Workflow

1. Pull Request's should contain a `Changelog` section.

The changelog section format should look like this

```markdown
## Changelog
- <type>(<package-name>): <description>
```

2. When the PR is merged, the action creates a "Release PR" with the version bumps.
The release PR body contains a comment with the uuid so when the PR is merged, the action can identify the release commit.

3. When the "Release PR" is merged, the action creates a tag and publishes the packages to npm.
