#!/bin/bash

# Script for publishing VS Code extension to GitHub Release
# Usage: ./release-extension.sh [version]
# Example: ./release-extension.sh 1.0.0

set -e  # Stop execution on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting DE-UPLC extension publication to GitHub Release...${NC}"

# Get version from argument or package.json
if [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION=$(node -p "require('./package.json').version")
fi

echo -e "${BLUE}📋 Release version: ${VERSION}${NC}"

# Check for required tools
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI (gh) not found.${NC}"
    echo "Install GitHub CLI: https://cli.github.com/"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Error: Git not found.${NC}"
    exit 1
fi

# Check that we're in a Git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: This is not a Git repository.${NC}"
    exit 1
fi

# Check GitHub CLI authorization
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}🔑 GitHub CLI authorization required...${NC}"
    gh auth login
fi

# Check that working directory is clean
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}❌ Error: There are unsaved changes. Commit them before release.${NC}"
    exit 1
fi

# Update version in package.json if new version provided
if [ -n "$1" ]; then
    echo -e "${BLUE}📝 Updating version in package.json to ${VERSION}...${NC}"
    npm version "$VERSION" --no-git-tag-version
fi

# Build extension
echo -e "${BLUE}🔨 Building extension...${NC}"
./build-extension.sh

# Get the created .vsix file name
VSIX_FILE=$(ls *.vsix | head -n1)

if [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}❌ Error: .vsix file not found. Build failed.${NC}"
    exit 1
fi

# Create and push tag
TAG_NAME="v${VERSION}"
echo -e "${BLUE}🏷️  Creating tag ${TAG_NAME}...${NC}"

# Check if tag already exists
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Tag ${TAG_NAME} already exists. Removing it...${NC}"
    git tag -d "$TAG_NAME" || true
    git push origin ":refs/tags/$TAG_NAME" || true
fi

# Commit version changes if version was updated
if [ -n "$1" ]; then
    git add package.json package-lock.json
    git commit -m "chore: bump version to ${VERSION}" || echo "No changes to commit"
fi

# Create tag
git tag -a "$TAG_NAME" -m "Release version ${VERSION}"
git push origin "$TAG_NAME"

# Generate release notes
RELEASE_NOTES_FILE="release-notes-${VERSION}.md"
cat > "$RELEASE_NOTES_FILE" << EOF
# Release ${VERSION}

## Features
- DE-UPLC VS Code Extension
- UPLC (Untyped Plutus Core) language support
- Interactive debugger for UPLC programs
- Syntax highlighting and language features

## Installation
Download the \`${VSIX_FILE}\` file and install it in VS Code:
\`\`\`bash
code --install-extension ${VSIX_FILE}
\`\`\`

## What's Changed
- See commit history for detailed changes

**Full Changelog**: https://github.com/\$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/compare/\$(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "initial")...${TAG_NAME}
EOF

# Create GitHub release
echo -e "${BLUE}🎉 Creating GitHub release...${NC}"
gh release create "$TAG_NAME" "$VSIX_FILE" \
    --title "DE-UPLC Extension v${VERSION}" \
    --notes-file "$RELEASE_NOTES_FILE" \
    --latest

# Clean up temporary files
rm -f "$RELEASE_NOTES_FILE"

echo -e "${GREEN}✅ Release created successfully!${NC}"
echo -e "${GREEN}🔗 Release URL: $(gh release view "$TAG_NAME" --json url -q '.url')${NC}"
echo -e "${GREEN}📦 Extension file: ${VSIX_FILE}${NC}"

echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Check the release on GitHub"
echo "2. Edit release description if needed"
echo "3. To publish to VS Code Marketplace use: vsce publish"
