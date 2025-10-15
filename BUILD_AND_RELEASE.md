# Building and Releasing DE-UPLC Extension

This document describes the process of building and publishing the DE-UPLC VS Code extension.

## Prerequisites

### Required Tools
- **Node.js** (version 18+)
- **Rust** and **Cargo** (for WASM module compilation)
- **Git** (for version control)

### For Publishing Releases
- **GitHub CLI** (`gh`) - for creating GitHub releases
  ```bash
  # macOS
  brew install gh
  
  # Other platforms: https://cli.github.com/
  ```

## Building the Extension

### Automatic Build (Recommended)

```bash
# Using script
./build-extension.sh

# Or via npm
npm run build:extension
```

### Manual Build

```bash
# 1. Generate schemas and types
npm run generate-all

# 2. Build WASM module (using quick build)
cd rust-src
./build-quick.sh
cd ..

# 3. Install dependencies
npm ci

# 4. Linting
npm run lint

# 5. Build extension
npm run package

# 6. Create .vsix package
npx vsce package
```

## Publishing Release

### Automatic Publication

```bash
# Create release with current version from package.json
./release-extension.sh

# Create release with new version
./release-extension.sh 1.2.0

# Or via npm
npm run release
npm run release 1.2.0
```

### What the Release Script Does

1. Checks for required tools (gh, git)
2. Verifies GitHub authorization
3. Updates version in `package.json` (if specified)
4. Builds extension using `build-extension.sh`
5. Creates Git tag with version
6. Pushes tag to repository
7. Creates GitHub release with attached .vsix file
8. Generates release notes

## Publishing to VS Code Marketplace

After creating a GitHub release, you can publish the extension to the official Marketplace:

```bash
# Requires Personal Access Token from Visual Studio Marketplace
vsce publish

# Or via npm script
npm run vsce:publish
```

### Setup for VS Code Marketplace

1. Create account at [Visual Studio Marketplace](https://marketplace.visualstudio.com/)
2. Get Personal Access Token
3. Perform authorization:
   ```bash
   vsce login <publisher-name>
   ```

## Useful Commands

```bash
# Just create .vsix without building
npm run vsce:package

# Check package contents
vsce ls

# Check package before publication
vsce package --pre-release

# Local installation for testing
code --install-extension de-uplc-*.vsix
```

## Release Structure

Each release includes:
- 📦 Extension `.vsix` file
- 📋 Release notes with change description
- 🏷️ Git tag with version
- 🔗 Links to changelog and version comparison

## Troubleshooting

### WASM Build Error
```bash
# Make sure wasm-pack is installed
cargo install wasm-pack

# Reinstall Rust target
rustup target add wasm32-unknown-unknown
```

### Publication Error
```bash
# Check GitHub CLI authorization
gh auth status

# Re-authorize
gh auth login
```

### Permission Issues
```bash
# Make scripts executable
chmod +x build-extension.sh release-extension.sh
```
