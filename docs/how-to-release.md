# How to Release

Concise, repeatable process for releasing `@avavilov/apple-script`.

## Policy (SemVer)
- Patch: bug fixes/docs only
- Minor: new features, backward compatible (pre-1.0: may include breaking)
- Major: breaking changes
- Prerelease: alpha/beta/rc tagged builds

## TL;DR
```bash
# One-step (version + publish)
npm run release:patch|minor|major

# Or step-by-step
git checkout main && git pull && git status  # must be clean
npm ci && npm test && npm run typecheck
# Update CHANGELOG.md and docs (don’t forget!)
npm run version:patch|minor|major   # creates commit + tag + pushes
npm publish --access public         # or: npm publish --tag beta
```

## Standard Flow (Step-by-step)
1) Decide release type
	- patch = fixes; minor = features; major = breaking; prerelease = preview

2) Prepare working copy
	- On `main`, up to date, clean: `git checkout main && git pull && git status`
	- Validate: `npm ci && npm test && npm run typecheck`

3) Update documentation
	- Update CHANGELOG.md and any user-facing docs to reflect this release
	- Commit docs changes

4) Bump version and tag
	- `npm run version:patch|minor|major`
	- This runs safety checks and creates commit + tag, then pushes via hooks
	- Prerelease: `npm run version:prerelease -- --preid beta`

5) Publish to npm
	- Optional preview: `npm run publish:dry`
	- Publish: `npm publish --access public` (or `--tag beta` for prerelease)

6) Announce (optional)
	- Create GitHub Release from the tag and paste the changelog entry

## Scripts Reference
- `release:*` — one-step release (version + publish)
- `version:*` — version only (commit + tag + push)
- `publish:dry` — preview what will be published

Note: `version:*` uses `scripts/version-up.mjs` for clean-tree checks and consistent tagging.

## Troubleshooting (quick)
- Working tree not clean → commit/stash
- Not authenticated to npm → `npm login` / `npm whoami`
- Tests failing → `npm ci`, ensure macOS for integration tests
- Tag not on GitHub → `git push --tags`

## Checklist
Before:
- Tests and typecheck pass
- On clean `main` synced with `origin`
- Changelog and docs updated

After:
- Tag visible on GitHub
- Package available on npm
- (Optional) GitHub Release created