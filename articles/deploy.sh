#!/bin/bash
# Deploy LinkSwarm blog updates to Cloudflare Pages

cd ~/clawd/linkswarm

echo "🐝 Deploying LinkSwarm updates..."

# Stage all blog changes
git add blog/

# Check if there are changes
if git diff --staged --quiet; then
    echo "No changes to deploy."
    exit 0
fi

# Show what's being deployed
echo "📝 Changes to deploy:"
git diff --staged --name-only

# Commit
read -p "Commit message (or enter for auto): " msg
if [ -z "$msg" ]; then
    msg="Add new blog articles $(date +%Y-%m-%d)"
fi

git commit -m "$msg"

# Push (triggers Cloudflare Pages auto-deploy)
git push origin main

echo "✅ Deployed! Cloudflare Pages will build shortly."
echo "   Preview: https://linkswarm.ai/blog/"
