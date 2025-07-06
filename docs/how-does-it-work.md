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

## PR Body

Instead of using the PR title, you can use the PR Body. This allows for more descriptive changelogs.
- Longer changelogs
- Supports codeblocks etc

Add section
```
## Changelog
- chore: hello world
- fix: some bug
- feat: added some feature
```
