#!/usr/bin/env bash
set -e

echo -e "\033[1;35m=== RyzenDesk GitHub Deploy Script ===\033[0m"

REPO="${GITHUB_REPO:-romangalaxys10-spec/RyzenDesk}"
BRANCH="${GITHUB_BRANCH:-main}"
TOKEN="${GITHUB_TOKEN:-}"

# Fallback: check .github_token file if TOKEN is not in env
if [ -z "$TOKEN" ] && [ -f ".github_token" ]; then
  TOKEN="$(cat .github_token | tr -d '[:space:]')"
fi

# Fallback: check if passed as first argument
if [ -z "$TOKEN" ] && [ -n "$1" ]; then
  TOKEN="$1"
fi

if [ -z "$TOKEN" ]; then
  echo -e "\033[31m✖ Error: GITHUB_TOKEN is required to push to GitHub.\033[0m"
  echo "Usage: ./scripts/deploy.sh [GITHUB_TOKEN] [OPTIONAL_COMMIT_MESSAGE]"
  echo "   or: GITHUB_TOKEN=ghp_... ./scripts/deploy.sh"
  exit 1
fi

COMMIT_MSG="${2:-feat: deploy latest updates - RyzenDesk Professional Polish [$(date -u +"%Y-%m-%dT%H:%M:%SZ")]}"

# Initialize git if not already
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init -b "$BRANCH"
fi

git config user.name "RyzenDesk Deployer"
git config user.email "deploy@ryzendesk.internal"

REMOTE_URL="https://x-access-token:${TOKEN}@github.com/${REPO}.git"

if git remote | grep -q 'origin'; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

git checkout -B "$BRANCH"

echo "Staging all updates..."
git add -A

if git diff-index --quiet HEAD -- 2>/dev/null; then
  echo -e "\033[33mℹ No uncommitted changes detected.\033[0m"
else
  echo "Committing: $COMMIT_MSG"
  git commit -m "$COMMIT_MSG"
fi

echo "Pushing code to https://github.com/${REPO} on branch ${BRANCH}..."
if ! git push -u origin "$BRANCH"; then
  echo "Non-fast-forward push detected, syncing remote branch with force push..."
  git push -u origin "$BRANCH" --force
fi

echo -e "\033[32m✔ SUCCESS: All updates deployed to GitHub!\033[0m"
echo "View at: https://github.com/${REPO}/tree/${BRANCH}"
