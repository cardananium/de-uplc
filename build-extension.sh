#!/bin/bash

# Script for building VS Code extension ready for distribution
# Usage: ./build-extension.sh

set -e  # Stop execution on error

echo "🚀 Starting DE-UPLC extension build..."

# Check that we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run script from project root."
    exit 1
fi

# Install vsce if not installed
if ! command -v vsce &> /dev/null; then
    echo "📦 Installing vsce (Visual Studio Code Extension CLI)..."
    npm install -g @vscode/vsce
fi

# Check for Rust and cargo
if ! command -v cargo &> /dev/null; then
    echo "❌ Error: Rust not found. Install Rust from https://rustup.rs/"
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf out/
rm -rf rust-src/target/wasm32-unknown-unknown/release/
rm -f *.vsix

# Generate schemas and types
echo "📋 Generating schemas and types..."
npm run generate-all

# Build WASM module using quick build
echo "🦀 Building Rust WASM module (quick build)..."
cd rust-src
chmod +x build-quick.sh
./build-quick.sh
cd ..

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run linter
echo "🔍 Running linter..."
npm run lint

# Build extension in production mode
echo "🔨 Building extension..."
npm run package

# Create .vsix file
echo "📦 Creating .vsix package..."
vsce package

# Get the created file name
VSIX_FILE=$(ls *.vsix | head -n1)

if [ -f "$VSIX_FILE" ]; then
    echo "✅ Build completed successfully!"
    echo "📁 Created file: $VSIX_FILE"
    echo "📏 File size: $(du -h "$VSIX_FILE" | cut -f1)"
    echo ""
    echo "To install extension locally use:"
    echo "  code --install-extension $VSIX_FILE"
    echo ""
    echo "To publish to VS Code Marketplace use:"
    echo "  vsce publish"
else
    echo "❌ Error: .vsix file was not created"
    exit 1
fi
