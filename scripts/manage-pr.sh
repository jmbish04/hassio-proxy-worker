#!/usr/bin/env bash
set -euo pipefail

BRANCH="${BRANCH_NAME:-copilot/fix-2}"
BASE_BRANCH="${BASE_BRANCH:-main}"
REMOTE="${REMOTE_NAME:-origin}"
COMMIT_MSG="${COMMIT_MSG:-Merge main into copilot/fix-2: resolve conflicts, add apiRoutes, mount under /v1, switch voice TTS to Workers AI, fix tests}"
PR_TITLE="${PR_TITLE:-Merge: resolve conflicts, add apiRoutes, TTS via Workers AI, fix tests}"
PR_BODY="${PR_BODY:-This PR resolves merge conflicts, restores and mounts apiRoutes under /v1, switches voice TTS to Workers AI (@cf/myshell-ai/melotts), fixes tests to call the worker fetch handler, and removes package-lock.json to align with main.}"

echo "Checking git status..."
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: Not inside a git repository."
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  echo "Switching to branch: $BRANCH"
  git checkout "$BRANCH"
fi

echo "Staging changes..."
git add -A

if git diff --cached --quiet; then
  echo "No staged changes to commit."
else
  echo "Committing changes..."
  git commit -m "$COMMIT_MSG"
fi

echo "Pushing to $REMOTE $BRANCH..."
git push "$REMOTE" "$BRANCH"

# PR management
if command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI detected. Managing PR..."
  # Try to get an existing open PR number
  PR_NUMBER="$(gh pr list --head "$BRANCH" --base "$BASE_BRANCH" --state open --json number --jq '.[0].number' 2>/dev/null || true)"
  if [[ -n "${PR_NUMBER:-}" ]]; then
    echo "Updating existing PR #$PR_NUMBER title/body..."
    gh pr edit "$PR_NUMBER" --title "$PR_TITLE" --body "$PR_BODY" || true
    gh pr view "$PR_NUMBER" --web || true
    exit 0
  fi

  echo "Creating PR from $BRANCH to $BASE_BRANCH..."
  gh pr create --title "$PR_TITLE" --body "$PR_BODY" --base "$BASE_BRANCH" --head "$BRANCH" --fill || true
  gh pr view --web || true
else
  echo "GitHub CLI not found. Skipping PR creation. Install gh to manage PRs:"
  echo "  https://cli.github.com/"
fi

echo "Done."

