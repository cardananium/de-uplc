import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // const wasmPath = path.join(context.extensionPath, 'wasm', 'module.wasm');
    // const wasmBinary = fs.readFileSync(wasmPath);

    // WebAssembly.instantiate(wasmBinary).then((result: WebAssembly.WebAssemblyInstantiatedSource) => {
    //     console.log('WASM module loaded:', result.instance);
    //     // Use the wasm module as needed
    // }).catch((err: any) => {
    //     console.error('Failed to load WASM module:', err);
    // });

    // console.log('Congratulations, your extension "de-uplc" is now active!');

    let disposable = vscode.commands.registerCommand('de-uplc.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from your extension!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
