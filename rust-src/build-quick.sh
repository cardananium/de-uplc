#!/bin/bash

set -e

echo "🦀 Quick WASM build for de-uplc"

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack is not installed"
    echo "Please install it with: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"
    exit 1
fi

# Navigate to the rust-src directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔨 Building WASM package (nodejs target)..."
wasm-pack build --target nodejs --out-dir pkg --release
node encode-wasm-to-base64.js 

echo "✅ Quick build complete!"
echo "📦 Output in: pkg/"
echo "🚀 Ready for production (release build)" 