#!/bin/bash

# 1. Project Configuration
REPO_URL="https://github.com/kasazen/chess-chat.git"
BRANCH="main"

# 2. Safety Check: Verify current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
  echo "❌ Error: Not on $BRANCH branch. Switch to $BRANCH before committing."
  exit 1
fi

# 3. Handle Commit Message
MESSAGE=$1
if [ -z "$MESSAGE" ]; then
  echo "Enter commit message: "
  read MESSAGE
fi

# 4. Execution: Stage and Commit
# Note: This 'git commit' will automatically trigger .git/hooks/pre-commit
git add .
if git commit -m "$MESSAGE"; then
  echo "🚀 Audit passed. Pushing to $REPO_URL..."
  
  # Push the code changes
  if git push origin $BRANCH; then
    echo "✅ Code pushed successfully."
    
    # 5. Post-Push: Trigger Automatic AI Changelog
    if [ -f "./changelog.sh" ]; then
      ./changelog.sh
      
      # Commit and push the updated README.md
      # We use --no-verify to skip the AI audit for the documentation-only update
      git add README.md
      git commit -m "docs: auto-update coach's changelog [skip ci]" --no-verify
      git push origin $BRANCH
      echo "🏆 Omnipotent cycle complete: Code pushed and README updated."
    else
      echo "⚠️  Note: changelog.sh not found. Skipping README update."
    fi
  else
    echo "❌ Error: Git push failed."
    exit 1
  fi
else
  echo "⚠️  Commit failed or was REJECTED by Gemini Audit. Fix code issues and try again."
  exit 1
fi