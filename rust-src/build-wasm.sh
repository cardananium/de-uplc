#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🦀 Building WASM package for de-uplc${NC}"

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo -e "${RED}❌ wasm-pack is not installed${NC}"
    echo -e "${YELLOW}Please install it with: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh${NC}"
    exit 1
fi

# Navigate to the rust-src directory (if not already there)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${YELLOW}📁 Working directory: $(pwd)${NC}"

# Clean previous builds
echo -e "${YELLOW}🧹 Cleaning previous builds...${NC}"
if [ -d "pkg" ]; then
    rm -rf pkg
fi
if [ -d "wasm-out" ]; then
    rm -rf wasm-out
fi

# Build for different targets
echo -e "${YELLOW}🔨 Building WASM package for bundlers (webpack, rollup, etc.)...${NC}"
wasm-pack build --target bundler --out-dir pkg-bundler --release

echo -e "${YELLOW}🔨 Building WASM package for Node.js...${NC}"
wasm-pack build --target nodejs --out-dir pkg-nodejs --release

echo -e "${YELLOW}🔨 Building WASM package for web (no bundler)...${NC}"
wasm-pack build --target web --out-dir pkg-web --release

# Create a combined output directory
echo -e "${YELLOW}📦 Creating combined output directory...${NC}"
mkdir -p wasm-out

# Copy bundler version as default
cp -r pkg-bundler/* wasm-out/

# Create different versions with suffixes
mkdir -p wasm-out/nodejs
cp pkg-nodejs/*.js wasm-out/nodejs/
cp pkg-nodejs/*.d.ts wasm-out/nodejs/
cp pkg-nodejs/package.json wasm-out/nodejs/

mkdir -p wasm-out/web
cp pkg-web/*.js wasm-out/web/
cp pkg-web/*.d.ts wasm-out/web/

# Update package.json to include all targets
echo -e "${YELLOW}📝 Updating package.json...${NC}"
cat > wasm-out/package.json << EOF
{
  "name": "de-uplc-wasm",
  "version": "0.1.0",
  "description": "WASM bindings for de-uplc debugger",
  "main": "de_uplc.js",
  "module": "de_uplc.js",
  "types": "de_uplc.d.ts",
  "files": [
    "de_uplc_bg.wasm",
    "de_uplc.js",
    "de_uplc.d.ts",
    "nodejs/",
    "web/"
  ],
  "exports": {
    ".": {
      "import": "./de_uplc.js",
      "require": "./nodejs/de_uplc.js",
      "types": "./de_uplc.d.ts"
    },
    "./web": {
      "import": "./web/de_uplc.js",
      "types": "./web/de_uplc.d.ts"
    },
    "./nodejs": {
      "require": "./nodejs/de_uplc.js",
      "types": "./nodejs/de_uplc.d.ts"
    }
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/your-repo/de-uplc"
  },
  "keywords": [
    "wasm",
    "rust",
    "plutus",
    "cardano",
    "uplc",
    "debugger"
  ],
  "author": "Your Name",
  "license": "MIT"
}
EOF

# Create README for the WASM package
echo -e "${YELLOW}📄 Creating README...${NC}"
cat > wasm-out/README.md << EOF
# de-uplc WASM

WebAssembly bindings for the de-uplc Plutus debugger.

## Installation

\`\`\`bash
npm install de-uplc-wasm
\`\`\`

## Usage

### For bundlers (webpack, rollup, etc.)

\`\`\`javascript
import * as deUplc from 'de-uplc-wasm';

// Create debugger engine
const engine = new deUplc.DebuggerEngine(txHex, utxosJson, protocolParamsJson, network);

// Create session controller
const controller = engine.create_session(scriptHash, redeemer);
\`\`\`

### For Node.js

\`\`\`javascript
const deUplc = require('de-uplc-wasm/nodejs');

// Same API as above
\`\`\`

### For web (no bundler)

\`\`\`html
<script type="module">
  import init, * as deUplc from 'de-uplc-wasm/web';
  
  async function run() {
    await init();
    
    // Use deUplc here
    const engine = new deUplc.DebuggerEngine(txHex, utxosJson, protocolParamsJson, network);
  }
  
  run();
</script>
\`\`\`

## API

### DebuggerEngine

The main entry point for creating debugging sessions.

### SessionController

Controls the execution of a single debugging session.

For detailed API documentation, see the TypeScript definitions in \`de_uplc.d.ts\`.
EOF

# Clean up temporary directories
echo -e "${YELLOW}🧹 Cleaning up temporary directories...${NC}"
rm -rf pkg-bundler pkg-nodejs pkg-web

# Show final output
echo -e "${GREEN}✅ WASM package built successfully!${NC}"
echo -e "${YELLOW}📦 Output directory: wasm-out/${NC}"
echo -e "${YELLOW}📁 Contents:${NC}"
ls -la wasm-out/

echo -e "${GREEN}🎉 Build complete! You can now use the WASM package.${NC}"
echo -e "${YELLOW}To publish: cd wasm-out && npm publish${NC}" 