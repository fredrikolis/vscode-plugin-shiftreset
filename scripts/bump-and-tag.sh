#!/bin/bash
set -e

# Change to repo root directory
cd "$(dirname "$0")/.."

# Bump patch version and create git tag
VERSION=$(npm version patch --no-git-tag-version)
git add package.json package-lock.json
git commit -m "chore: bump version to ${VERSION}"
git tag "${VERSION}"

echo "Bumped to ${VERSION}"
echo "Run 'git push && git push --tags' to trigger release"
