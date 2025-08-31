#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');
const pkgPath = resolve(root, 'package.json');

const allowed = new Set(['patch', 'minor', 'major', 'prerelease']);
const bump = process.argv[2];
const preidIndex = process.argv.indexOf('--preid');
const preid = preidIndex !== -1 ? process.argv[preidIndex + 1] : undefined;

if (!allowed.has(bump)) {
  console.error(`Usage: node scripts/version-up.mjs <patch|minor|major|prerelease>`);
  process.exit(1);
}

function run(cmd) {
  return execSync(cmd, { stdio: 'inherit' });
}

try {
  // Ensure working tree is clean
  const status = execSync('git status --porcelain').toString().trim();
  if (status) {
    console.error('Working tree not clean. Commit or stash changes before bumping version.');
    process.exit(1);
  }

  // Ensure we are on a branch (not detached)
  execSync('git symbolic-ref -q HEAD');

  // Validate package.json
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (!pkg.name || !pkg.version) {
    console.error('package.json must have name and version.');
    process.exit(1);
  }

  // Bump version with npm (creates git tag automatically). npm will run preversion/version/postversion hooks.
  const preidArg = bump === 'prerelease' && preid ? ` --preid ${preid}` : '';
  run(`npm version ${bump}${preidArg} -m "chore(release): %s"`);

  console.log('Version bump complete. Remember to `git push && git push --tags` if not pushed by hooks.');
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
