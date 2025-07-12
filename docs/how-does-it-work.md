## PR title

For the PR title use [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) syntax.

### Updating the root package

`feat: added some feature`

version bump: 1.0.0 -> 1.1.0

### Specifying a specific package

`chore(package-a): some message`

version bump: 1.0.0 -> 1.0.1

### Specifying multiple packages 

`chore(package-a,package-b): some message`

version bump: 1.0.0 -> 1.0.1

### Breaking change

Use `!` example

`chore(package-a)!: some breaking change`

version bump: 1.0.0 -> 2.0.0

### Explicit version bump

Use `#major`, `#minor` or `#patch` to specify an explicit version bump.

example
`chore(package-a): some message #major`

version bump: 1.0.0 -> 2.0.0

## PR Body

Instead of using the PR title, you can also use the PR Body.

This allows for...
- Longer / more descriptive changelogs
- Using codeblocks
- More granular control over versioning when you have multiple packages

Add section
```
## Changelog
- chore: hello world
- fix: fixed some bug
- feat: added some feature
- chore(package-a): some message
- chore(package-a,package-b): some message
- chore(package-a)!: some breaking change
- feat(package-c): added some feature #major
```
