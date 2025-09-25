#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class CardanoWasmInliner {
    constructor(pkgDir = 'pkg', target = 'nodejs') {
        this.pkgDir = pkgDir;
        this.wasmFile = 'de_uplc_bg.wasm';
        this.mainJsFile = 'de_uplc.js';
        this.target = target;
    }

    processPackage() {
        const wasmPath = path.join(this.pkgDir, this.wasmFile);
        const wasmBuffer = fs.readFileSync(wasmPath);
        const wasmBase64 = wasmBuffer.toString('base64');
        
        const mainJsPath = path.join(this.pkgDir, this.mainJsFile);
        const originalContent = fs.readFileSync(mainJsPath, 'utf8');
        
        let finalContent;
        
        if (this.target === 'nodejs') {
            const inlinedWasmModule = `// Base64 encoded WASM binary
const __WASM_BASE64__ = '${wasmBase64}';

// Replace the file reading with base64 decoding
const bytes = Buffer.from(__WASM_BASE64__, 'base64');`;
            
            const wasmLoadingPattern = /const path = require\('path'\)\.join\(__dirname, 'de_uplc_bg\.wasm'\);\nconst bytes = require\('fs'\)\.readFileSync\(path\);/g;
            finalContent = originalContent.replace(wasmLoadingPattern, inlinedWasmModule);
        } else {
            const inlinedWasmModule = `const __CARDANO_WASM_BASE64__ = '${wasmBase64}';

import * as bg_js_imports from "./de_uplc_bg.js";
const __createInlinedWasmModule__ = () => {
    const wasmBinary = (() => {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(__CARDANO_WASM_BASE64__, 'base64');
        } else {
            const binaryString = atob(__CARDANO_WASM_BASE64__);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes;
        }
    })();

    const wasmModule = new WebAssembly.Module(wasmBinary);
    const wasmInstance = new WebAssembly.Instance(wasmModule, {
        './de_uplc_bg.js': bg_js_imports
    });
    
    const wasmExports = wasmInstance.exports;
    return {
        ...wasmExports,
        memory: wasmExports.memory
    };
};

const wasm = __createInlinedWasmModule__();`;
            
            const newContent = originalContent.replace(
                /import \* as wasm from ["']\.\/de_uplc_bg\.wasm[""];/g,
                '// WASM module inlined'
            );
            finalContent = `${inlinedWasmModule}\n\n${newContent}`;
        }
        
        fs.writeFileSync(mainJsPath, finalContent);
        
        // Update package.json
        const packageJsonPath = path.join(this.pkgDir, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.files) {
            packageJson.files = packageJson.files.filter(file => !file.endsWith('.wasm'));
        }
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        
        // Delete WASM file
        fs.unlinkSync(wasmPath);
    }
}

// Main
const args = process.argv.slice(2);
const pkgDir = args[0] || 'pkg';
const targetIndex = args.findIndex(arg => arg === '--target' || arg === '-t');
const target = targetIndex !== -1 && args[targetIndex + 1] ? args[targetIndex + 1] : 'nodejs';

const inliner = new CardanoWasmInliner(pkgDir, target);
inliner.processPackage();