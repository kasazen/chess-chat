#!/bin/bash

echo "📝 Generating AI Changelog..."

# 1. Get the last 5 commits (or since last tag)
RAW_LOGS=$(git log -n 5 --pretty=format:"- %s (%h)")

# 2. Use Gemini to summarize the changes
# We pass the GEMINI.md context to ensure the summary matches our GM Coach persona
AI_SUMMARY=$(gemini ask "Review these recent git commits:
$RAW_LOGS
Using the standards in @GEMINI.md, write a 3-sentence 'Coach's Update' for the README.
Categorize changes as: ♟️ Board Logic, 🧠 AI Intelligence, or 🛠️ System Fixes.")

# 3. Update the README.md
# This replaces everything between the "CHANGELOG START" and "END" markers
DATE=$(date +%Y-%m-%d)
sed -i "//,//c\\n### Last Updated: $DATE\n$AI_SUMMARY\n" README.md

echo "✅ README.md updated with latest Coach Insights."