## PR title

For the PR title use [Conventional Commit](https://www.conventionalcommits.org/en/v1.0.0/) syntax.

### Updating the root package

`feat: added some feature`

### Specifying a specific package

`chore(package-a): some message`

### Specifying multiple packages 

`chore(package-a,package-b): some message`

### Breaking change

Use `!` example

`chore(package-a)!: some breaking change`

### Explicit version bump

Use `#major`, `#minor` or `#patch` to specify an explicit version bump.

example
`chore(package-a): some message #major`

## PR Body

Instead of using the PR title, you can use the PR Body. This allows for more descriptive changelogs.
- Longer changelogs
- Supports codeblocks etc

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
