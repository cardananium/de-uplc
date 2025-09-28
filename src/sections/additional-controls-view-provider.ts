import * as vscode from "vscode";
import { ExtensionActionEventNames } from "../events/debugger-event-names";
import { EventEmitter } from "../events/event-emitter";

export class AdditionalControlsViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public static register(
    context: vscode.ExtensionContext
  ): AdditionalControlsViewProvider {
    const provider = new AdditionalControlsViewProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        "additionalControlsView",
        provider
      )
    );
    return provider;
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (!message || !message.command) {
        return;
      }

      switch (message.command) {
        case "openTransaction": {
          try {
            // Set button to loading state
            this._view?.webview.postMessage({
              command: "setLoadingState",
              loading: true,
            });

            const selection = await vscode.window.showOpenDialog({
              canSelectFiles: true,
              canSelectFolders: false,
              canSelectMany: false,
              title: "Open Transaction",
              filters: {
                "All Files": ["*"],
                "JSON / Text": ["json", "txt", "cbor", "bin", "tx"]
              },
            });

            if (!selection || selection.length === 0) {
              // Reset button state if user cancelled
              this._view?.webview.postMessage({
                command: "setLoadingState",
                loading: false,
              });
              return;
            }

            const filePath = selection[0].fsPath;
            await EventEmitter.openNewTransaction(filePath);
            
            vscode.window.showInformationMessage(`Transaction loaded: ${filePath.split('/').pop()}`);
            
            // Inform the webview and reset loading state
            this._view?.webview.postMessage({
              command: "transactionSelected",
              path: filePath,
            });
            this._view?.webview.postMessage({
              command: "setLoadingState",
              loading: false,
            });
          } catch (error) {
            // Reset button state on error
            this._view?.webview.postMessage({
              command: "setLoadingState",
              loading: false,
            });
            vscode.window.showErrorMessage(`Failed to open transaction: ${error}`);
          }
          break;
        }
        // case "resetDebugger": {
        //   try {
        //     EventEmitter.resetDebuggingSession();
        //   } catch (error) {
        //     vscode.window.showErrorMessage(`Failed to reset debugger: ${error}`);
        //   }
        //   break;
        // }
        default:
          break;
      }
    });
  }

  private getHtml(): string {
    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <style>
          body {
            background: var(--vscode-sideBar-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            margin: 0;
            padding: 0.5rem 0.75rem;
          }
          .button-row {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.5rem;
            align-items: stretch;
            width: 100%;
          }
          .primary-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 13px;
            width: 100%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
          }
          .primary-button:hover { background-color: var(--vscode-button-hoverBackground); }
          .primary-button:active { background-color: var(--vscode-button-pressedBackground); }
          .primary-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
            opacity: 0.6;
          }
          .primary-button:disabled:hover {
            background-color: var(--vscode-button-secondaryBackground);
          }
          .path-label {
            font-size: 0.75rem;
            opacity: 0.8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        </style>
      </head>
      <body>
        <div class="button-row">
          <button id="openBtn" class="primary-button">Open Transaction</button>
          <!-- <button id="resetBtn" class="primary-button">Reset debugger</button> -->
        </div>
        <div style="margin-top: 0.25rem;">
          <span id="selectedPath" class="path-label" title=""></span>
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          const openBtn = document.getElementById('openBtn');
          
          openBtn.addEventListener('click', () => {
            if (!openBtn.disabled) {
              vscode.postMessage({ command: 'openTransaction' });
            }
          });
          
          // document.getElementById('resetBtn').addEventListener('click', () => {
          //   vscode.postMessage({ command: 'resetDebugger' });
          // });
          
          window.addEventListener('message', event => {
            const msg = event.data;
            if (msg && msg.command === 'transactionSelected') {
              const el = document.getElementById('selectedPath');
              if (el) { el.textContent = msg.path; el.title = msg.path; }
            } else if (msg && msg.command === 'setLoadingState') {
              if (msg.loading) {
                openBtn.disabled = true;
                openBtn.textContent = 'Loading...';
              } else {
                openBtn.disabled = false;
                openBtn.textContent = 'Open Transaction';
              }
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}


