import * as vscode from "vscode";
import { Budget, SessionState } from "../common";
import { EventEmitter } from "../events/event-emitter";

const CHOOSE_REDEEMER = "Choose redeemer";
const NO_REDEEMERS_AVAILABLE = "No redeemers available";

export interface ScriptInfo {
  hash: string;
  plutusLangVersion: string;
  plutusCoreVersion: string;
}

export class DebuggerPanelViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _sessionState: SessionState = "empty";
  private _currentRedeemer: string = "No redeemers available";
  private scriptInfo?: ScriptInfo = {
    hash: "-",
    plutusLangVersion: "-",
    plutusCoreVersion: "-",
  };
  private redeemers?: string[] = ["No redeemers available"];
  private budget?: Budget = {
    exUnitsSpent: 0,
    exUnitsAvailable: 0,
    memoryUnitsSpent: 0,
    memoryUnitsAvailable: 0,
  };
  private transactionId?: string = "-";
  private locked = false;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public static register(
    context: vscode.ExtensionContext
  ): DebuggerPanelViewProvider {
    const provider = new DebuggerPanelViewProvider(context.extensionUri);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider("debuggerPanelView", provider)
    );
    return provider;
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { 
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };
    
    // Set the description of the panel
    webviewView.description = "UPLC Debugger Controls";

    const codiconUri = webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "node_modules",
        "@vscode/codicons",
        "dist",
        "codicon.css"
      )
    );

    webviewView.webview.html = this.getHtml(codiconUri);

    // --- Debugger Session Manager Message Handling ---
    webviewView.webview.onDidReceiveMessage(async (message) => {
      console.log("[Debugger Panel] Received message:", message);
      
      if (
        message.command &&
        message.command.startsWith("deuplc.sidebarControl.")
      ) {
        if(message.command !== "deuplc.sidebarControl.unlocked" &&
           message.command !== "deuplc.sidebarControl.locked" &&
           message.command !== "deuplc.sidebarControl.showContext" &&
           message.command !== "deuplc.sidebarControl.showScript") {
          this.lockInterface();
        }
        const lastState = this._sessionState;
        
        switch (message.command) {
          case "deuplc.sidebarControl.startSession":
            // console.log("[Debugger Panel] Starting session");
            EventEmitter.startDebugging(this._currentRedeemer);
            break;
          case "deuplc.sidebarControl.pauseSession":
            // console.log("[Debugger Panel] Pausing session");
            EventEmitter.pauseDebugging();
            break;
          case "deuplc.sidebarControl.continueSession":
            // console.log("[Debugger Panel] Continuing session");
            EventEmitter.continueDebugging();
            break;
          case "deuplc.sidebarControl.step":
            // console.log("[Debugger Panel] Stepping");
            EventEmitter.stepDebugging();
            break;
          case "deuplc.sidebarControl.refresh":
            // console.log("[Debugger Panel] Refreshing session");
            EventEmitter.resetDebuggingSession();
            break;
          case "deuplc.sidebarControl.stop":
            // console.log("[Debugger Panel] Stopping session");
            EventEmitter.stopDebugging();
            break;
          case "deuplc.sidebarControl.locked":
            console.log("[Debugger Panel] Panel is locked");
            break;
          case "deuplc.sidebarControl.unlocked":
            console.log("[Debugger Panel] Panel is unlocked");
            break;
          case "deuplc.sidebarControl.showContext":
            console.log("[Debugger Panel] Showing context");
            EventEmitter.showScriptContext();
            break;
          case "deuplc.sidebarControl.showScript":
            console.log("[Debugger Panel] Showing script");
            EventEmitter.showScript();
            break;
          case "deuplc.sidebarControl.changeRedeemer":
            if (message.value === NO_REDEEMERS_AVAILABLE) {
              break;
            }
            if(message.value === CHOOSE_REDEEMER) {
              await this.selectRedeemer(message.value);
              EventEmitter.selectRedeemer(this._currentRedeemer);
              break;
            }
            console.log("[Debugger Panel] Changing redeemer");
            vscode.window
              .showWarningMessage(
                "Are you sure? Debugging session will be stopped.",
                { modal: true },
                "Yes",
                "No"
              )
              .then(async (selection) => {
                if (selection === "Yes") {
                  this._currentRedeemer = message.value;
                  EventEmitter.selectRedeemer(this._currentRedeemer);
                } else {
                  this.unlockInterface();
                }
                await this.selectRedeemer(this._currentRedeemer);
              });
            break;
          default:
            console.log("[Debugger Panel] Unknown command:", message.command);
            break;
        }
      } else {
        console.log("[Debugger Panel] Message without command:", message);
      }
    });
  }

  // Setter to update the script information.
  public setScriptInfo(scriptInfo: {
    hash: string;
    plutusLangVersion: string;
    plutusCoreVersion: string;
  }): void {
    this.scriptInfo = scriptInfo;
    if (this._view) {
      this._view.webview.postMessage({
        command: "updateScriptInfo",
        scriptInfo,
      });
    }
  }

  // Setter to update the list of redeemers.
  public setRedeemers(redeemers: string[], transactionId?: string): void {
    let hasChanged = !compareRedeemerLists(this.redeemers, redeemers);
    hasChanged = hasChanged || (this.transactionId !== transactionId);
    if(!hasChanged) {
      return;
    }
    
    this.transactionId = transactionId;
    if (redeemers.length < 1) {
      redeemers = ["No redeemers available"];
    } else {
      // Add "Choose redeemer" as the first option when there are real redeemers
      redeemers = [CHOOSE_REDEEMER, ...redeemers];
    }
    this.redeemers = redeemers;
    // Always select "Choose redeemer" by default if it exists
    this.selectRedeemer(redeemers[0]);
    if (this._view) {
      this._view.webview.postMessage({
        command: "updateRedeemers",
        redeemers,
      });
    }
  }

  public unlockInterface(): void {
    this.locked = false;
    if (this._view) {
      this._view.webview.postMessage({
        command: "unlockInterface",
        state: this._sessionState
      });
    }
  }

  public lockInterface(): void {
    this.locked = true;
    if (this._view) {
      this._view.webview.postMessage({
        command: "lockInterface"
      });
    }
  }

  // Setter to update the debugger state.
public setDebuggerState(state: SessionState): void {
    console.log("[Debugger Panel] Setting state to:", state);
    this._sessionState = state;
    if (this._view) {
      this._view.webview.postMessage({
        command: "updateSessionState",
        state,
      });
    }
  }

  // Setter to update the budget.
  public setBudget(budget: Budget): void {
    this.budget = budget;
    if (this._view) {
      this._view.webview.postMessage({
        command: "updateBudget",
        budget,
      });
    }
  }

  public async selectRedeemer(redeemer: string): Promise<void> {
    // Allow selecting "Choose redeemer" - user must make an explicit choice
    if (this._view) {      
      // If a non-ephemeral redeemer is selected, remove the ephemeral one from the list
      if (redeemer !== CHOOSE_REDEEMER && redeemer !== "No redeemers available" && this.redeemers) {
        const updatedRedeemers = this.redeemers.filter(r => r !== CHOOSE_REDEEMER);
        if (this.redeemers.includes(CHOOSE_REDEEMER)) {
          this.redeemers = updatedRedeemers;
          await this._view.webview.postMessage({
            command: "updateRedeemers",
            redeemers: updatedRedeemers,
          });
        }
      }

      await this._view.webview.postMessage({
        command: "selectRedeemer",
        redeemer,
      });
    }
    this._currentRedeemer = redeemer;
  }

  public resetToInitialState(): void {
    this._sessionState = "empty";
    this._currentRedeemer = NO_REDEEMERS_AVAILABLE;

    if (this._view) {
      this._view.webview.postMessage({
        command: "resetToInitial",
      });

      // Reset all the values
      this.setDebuggerState("empty");
      this.setScriptInfo({
        hash: "-",
        plutusLangVersion: "-",
        plutusCoreVersion: "-",
      });
      this.setBudget({
        exUnitsSpent: 0,
        exUnitsAvailable: 0,
        memoryUnitsSpent: 0,
        memoryUnitsAvailable: 0,
      });
      this.setRedeemers(["No redeemers available"]);
    }
  }

  public clearBudget(): void {
    this.budget = {
      exUnitsSpent: 0,
      exUnitsAvailable: 0,
      memoryUnitsSpent: 0,
      memoryUnitsAvailable: 0,
    };
    this.setBudget(this.budget);
  }



  private getHtml(codiconUri: vscode.Uri): string {
    // Determine CSS classes and button states based on session state
    const bodyClass = this.locked ? "locked" : this._sessionState;

    // Determine which icon to show for the main button
    const mainButtonIcon =
      this._sessionState === "running"
        ? "codicon-debug-pause"
        : "codicon-debug-start";

    // Get the script info data
    const scriptHash = this.scriptInfo?.hash || "-";
    const plutusLangVersion = this.scriptInfo?.plutusLangVersion || "-";
    const plutusCoreVersion = this.scriptInfo?.plutusCoreVersion || "-";

    // Get budget data
    const exUnitsSpent = this.budget?.exUnitsSpent || 0;
    const exUnitsAvailable = this.budget?.exUnitsAvailable || 0;
    const memoryUnitsSpent = this.budget?.memoryUnitsSpent || 0;
    const memoryUnitsAvailable = this.budget?.memoryUnitsAvailable || 0;

    // Check if budget should be displayed
    const shouldShowBudget = this.budget !== undefined && this.budget !== null && this._sessionState !== "stopped" && this._sessionState !== "empty";

    // Build the redeemers options
    let redeemerOptions = '';
    if (this.redeemers && this.redeemers.length > 0) {
      redeemerOptions = this.redeemers.map(redeemer => 
        `<option value="${redeemer}" ${redeemer === this._currentRedeemer ? 'selected' : ''}>${redeemer}</option>`
      ).join('');
    } else {
      redeemerOptions = '<option value="No redeemers available">No redeemers available</option>';
    }

    // Check if show script button should be visible
    const shouldShowScriptButton = this._currentRedeemer !== CHOOSE_REDEEMER && 
                                  this._currentRedeemer !== NO_REDEEMERS_AVAILABLE;
    const showScriptButtonClass = shouldShowScriptButton ? 'show-script-button visible' : 'show-script-button';

    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <link href="${codiconUri}" rel="stylesheet" />
        <style>
          /* Base styles using VS Code theming */
          body {
            background: var(--vscode-sideBar-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            margin: 0;
            padding: 0;
            height: auto;
            overflow-y: auto;
          }
          /* Section */
          .section {
            border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
            padding: 0.5rem 0.75rem;
          }
          .section-no-border {
            padding: 0.5rem 0.75rem;
          }
          /* Sidebar header */
          .section-header {
            background: var(--vscode-sideBarSectionHeader-background);
            color: var(--vscode-sideBarSectionHeader-foreground);
            padding: 0.5rem;
            font-family: var(--vscode-font-family);
            font-size: 0.75rem;
            font-weight: normal;
            text-transform: uppercase;
          }
          /* Budget header */
          .budget-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.125rem 0;
            margin-bottom: 0.125rem;
            font-family: var(--vscode-font-family);
          }
          .budget-header .header-budget {
            flex: 1;
            text-align: left;
            font-family: var(--vscode-font-family);
            font-size: 0.70rem;
            font-weight: 600;
            text-transform: uppercase;
            opacity: 1;
          }
          .budget-header .header-spent,
          .budget-header .header-available {
            flex: 1;
            text-align: right;
            font-size: 0.70rem;
            font-weight: normal;
            text-transform: uppercase;
            opacity: 0.75;
          }
          .budget-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.125rem 0;
          }
          .budget-row .budget-label {
            flex: 1;
            text-align: left;
            font-family: var(--vscode-font-family);
            font-size: 0.75rem;
            font-weight: normal;
            opacity: 1;
          }
          .budget-row .budget-value {
            flex: 1;
            text-align: right;
            padding-left: 0.5rem;
            font-family: var(--vscode-font-family);
            font-size: 0.75rem;
            font-weight: normal;
            opacity: 1;
          }
          .overspend {
            color: var(--vscode-errorForeground);
          }
          
          /* Loading animation for running state */
          @keyframes loading-dots {
            0%, 20% { opacity: 0; }
            50% { opacity: 1; }
            100% { opacity: 0; }
          }
          
          .loading-dots::after {
            content: "...";
            animation: loading-dots 1.5s infinite;
          }
          
          /* Running state budget values */
          body.running .budget-value {
            position: relative;
          }
          
          body.running .budget-value.loading::after {
            content: "—";
            color: var(--vscode-descriptionForeground);
            opacity: 0.7;
          }
          /* Toolbar Section */
          .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background-color: var(--vscode-sideBarSectionHeader-background);
            min-width: 0;
          }
          .icon-box {
            display: inline-flex;
            align-items: center;
            border-radius: 4px;
            overflow: hidden;
            background: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-sideBarSectionHeader-border);
          }
          .icon-button {
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 0.3rem 0.5rem;
            display: flex;
            align-items: center;
            color: var(--vscode-button-foreground);
          }
          .icon-button .codicon {
            font-size: 1rem;
          }
          .inspect-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            padding: 4px 12px;
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
            flex-shrink: 1;
          }
          
          .inspect-button .codicon {
            flex-shrink: 0;
          }
          
          .inspect-button span:not(.codicon) {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .inspect-button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .inspect-button:active {
            background-color: var(--vscode-button-pressedBackground);
          }
          
          /* Locked state - all buttons disabled */
          body.locked .icon-button,
          body.locked .inspect-button,
          body.locked .show-script-button {
            pointer-events: none;
            cursor: default;
          }
          body.locked .icon-button .codicon {
            color: var(--vscode-disabledForeground);
          }
          
          /* Empty state - no active session, disable show context button */
          body.empty .icon-button {
            opacity: 0.5;
            pointer-events: none;
            cursor: default;
          }
          body.empty .icon-button .codicon {
            color: var(--vscode-disabledForeground);
          }
          body.empty .inspect-button,
          body.empty .show-script-button {
            pointer-events: none;
            cursor: default;
          }
          
          /* Hide sections in empty state */
          body.empty #scriptSection,
          body.empty #redeemerSection {
            display: none;
          }
          
          /* Hide budget section in empty and stopped states */
          body.empty #budgetSection,
          body.stopped #budgetSection {
            display: none !important;
          }
          
          /* Stopped state - only Start and Show context buttons active */
          body.stopped .icon-button:first-child {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
          }
          body.stopped .icon-button:first-child .codicon {
            color: var(--vscode-debugIcon-startForeground);
          }
          body.stopped .icon-button:not(:first-child) {
            opacity: 0.5;
            pointer-events: none;
            cursor: default;
          }
          body.stopped .icon-button:not(:first-child) .codicon {
            color: var(--vscode-disabledForeground);
          }
          body.stopped .inspect-button,
          body.stopped .show-script-button {
            pointer-events: auto;
            cursor: pointer;
          }
          
          /* Running state - only Pause and Stop buttons active */
          body.running .icon-button[title="Start/Pause"] {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
          }
          body.running .icon-button[title="Start/Pause"] .codicon {
            color: var(--vscode-debugIcon-pauseForeground);
          }
          body.running .icon-button[title="Stop"] {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
          }
          body.running .icon-button[title="Stop"] .codicon {
            color: var(--vscode-debugIcon-stopForeground);
          }
          body.running .icon-button[title="Refresh"] {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
          }
          body.running .icon-button[title="Refresh"] .codicon {
            color: var(--vscode-debugIcon-restartForeground);
          }
          body.running .icon-button:not([title="Start/Pause"]):not([title="Stop"]):not([title="Refresh"]) {
            opacity: 0.5;
            pointer-events: none;
            cursor: default;
          }
          body.running .icon-button:not([title="Start/Pause"]):not([title="Stop"]):not([title="Refresh"]) .codicon {
            color: var(--vscode-disabledForeground);
          }
          body.running .show-script-button {
            pointer-events: auto;
            cursor: pointer;
          }
          
          /* Pause state - only Step and Stop buttons active */
          body.pause .icon-button[title="Step"] {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
          }
          body.pause .icon-button[title="Step"] .codicon {
            color: var(--vscode-debugIcon-stepOverForeground);
          }
          body.pause .icon-button[title="Stop"] {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
          }
          body.pause .icon-button[title="Stop"] .codicon {
            color: var(--vscode-debugIcon-stopForeground);
          }
          body.pause .icon-button[title="Start/Pause"] {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
          }
          body.pause .icon-button[title="Start/Pause"] .codicon {
            color: var(--vscode-debugIcon-continueForeground);
          }
          body.pause .icon-button[title="Refresh"] {
            opacity: 1;
            pointer-events: auto;
            cursor: pointer;
          }
          body.pause .icon-button[title="Refresh"] .codicon {
            color: var(--vscode-debugIcon-restartForeground);
          }
          body.pause .icon-button:not([title="Step"]):not([title="Stop"]):not([title="Start/Pause"]):not([title="Refresh"]) {
            opacity: 0.5;
            pointer-events: none;
            cursor: default;
          }
          body.pause .icon-button:not([title="Step"]):not([title="Stop"]):not([title="Start/Pause"]):not([title="Refresh"]) .codicon {
            color: var(--vscode-disabledForeground);
          }
          body.pause .show-script-button {
            pointer-events: auto;
            cursor: pointer;
          }
          
          /* SCRIPT Section */
          .script-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.25rem 0;
            background: var(--vscode-sideBarSectionHeader-background);
            color: var(--vscode-sideBarSectionHeader-foreground);
            font-family: var(--vscode-font-family);
            font-size: 0.70rem;
            font-weight: 600;
            text-transform: uppercase;
          }
          .script-title {
            text-align: left;
            position: relative;
          }
          .script-title::after {
            content: "→";
            margin-left: 0.5rem;
            margin-right: 0.5rem;
            opacity: 0.6;
            font-size: 0.8em;
          }
          .script-header select {
            font-family: var(--vscode-font-family);
            font-size: 0.75rem;
            opacity: 0.75;
            margin-left: 0;
          }
          .script-separator {
            border: none;
            border-top: 1px solid var(--vscode-sideBarSectionHeader-border);
            margin: 0.25rem 0;
          }
          .script-details {
            font-family: var(--vscode-font-family);
            font-size: 0.75rem;
            display: flex;
            flex-direction: column;
          }
          .script-versions-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .script-versions-row .plutus-versions {
            flex: 1;
            margin-right: 0.5rem;
          }
          .show-script-button {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 2px 8px;
            border-radius: 2px;
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: 0.75rem;
            white-space: nowrap;
            flex-shrink: 0;
            opacity: 0.75;
            display: none;
          }
          .show-script-button:hover {
            background: var(--vscode-dropdown-listBackground);
            opacity: 0.7;
          }
          .show-script-button.visible {
            display: inline-block;
          }
          .script-details div:not(:last-child) {
            margin-bottom: 0.25rem;
          }
          .script-details .script-hash {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .script-details .plutus-versions {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          select {
            background: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 2px 4px;
            border-radius: 2px;
            margin-left: 0.5rem;
          }
        </style>
      </head>
      <body class="${bodyClass}">
        <!-- Control Section -->
        <div class="section" id="controlSection">
          <div class="toolbar">
            <div class="icon-box">
              <button class="icon-button" data-command="toggleMain" title="Start/Pause" id="toggleMainButton">
                <span class="codicon ${mainButtonIcon}" id="mainButtonIcon"></span>
              </button>
              <button class="icon-button" data-command="step" title="Step" id="stepButton">
                <span class="codicon codicon-debug-step-over"></span>
              </button>
              <button class="icon-button" data-command="refresh" title="Refresh" id="refreshButton">
                <span class="codicon codicon-debug-restart"></span>
              </button>
              <button class="icon-button" data-command="stop" title="Stop" id="stopButton">
                <span class="codicon codicon-debug-stop"></span>
              </button>
            </div>
            <button class="inspect-button" data-command="showContext" id="showContextButton">
              <span class="codicon codicon-symbol-namespace"></span>
              <span>Show context</span>
            </button>
          </div>
        </div>

        <!-- Budget Section -->
        <div class="section" id="budgetSection" style="display: ${shouldShowBudget ? 'block' : 'none'};">
          <div class="budget-header">
            <span class="header-budget">Budget</span>
            <span class="header-spent">Spent</span>
            <span class="header-available">Available</span>
          </div>
          <div class="budget-row" id="exBudgetRow" ${exUnitsSpent > exUnitsAvailable ? 'class="overspend"' : ''}>
            <span class="budget-label">Ex units:</span>
            <span class="budget-value" id="exUnitsSpent">${exUnitsSpent.toLocaleString()}</span>
            <span class="budget-value" id="exUnitsAvailable">${exUnitsAvailable.toLocaleString()}</span>
          </div>
          <div class="budget-row" id="memBudgetRow" ${memoryUnitsSpent > memoryUnitsAvailable ? 'class="overspend"' : ''}>
            <span class="budget-label">Memory units:</span>
            <span class="budget-value" id="memoryUnitsSpent">${memoryUnitsSpent.toLocaleString()}</span>
            <span class="budget-value" id="memoryUnitsAvailable">${memoryUnitsAvailable.toLocaleString()}</span>
          </div>
        </div>

        <!-- SCRIPT Section -->
        <div class="section-no-border" id="scriptInfoSection">
          <div class="script-header">
            <span class="script-title">SELECTED SCRIPT</span>
            <select id="redeemerSelect">
              ${redeemerOptions}
            </select>
          </div>
          <div class="script-details">
            <div id="scriptHash" class="script-hash" title="${scriptHash}">Script hash: ${scriptHash}</div>
            <div class="script-versions-row">
              <div id="plutusVersions" class="plutus-versions" title="Lang: ${plutusLangVersion} | Core: ${plutusCoreVersion}">Lang: ${plutusLangVersion} • Core: ${plutusCoreVersion}</div>
              <button class="${showScriptButtonClass}" id="showScriptButton">Show script</button>
            </div>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          let sessionState = "${this._sessionState}";

          // Function to set icons based on debugger state.
          function setIconsForState() {
            const mainButtonIcon = document.getElementById("mainButtonIcon");
            if (sessionState === "empty" || sessionState === "stopped") {
              mainButtonIcon.className = "codicon codicon-debug-start";
            } else if (sessionState === "running") {
              mainButtonIcon.className = "codicon codicon-debug-pause";
            } else if (sessionState === "pause") {
              mainButtonIcon.className = "codicon codicon-debug-continue";
            }
            
            // Update body class to reflect current state
            document.body.className = sessionState;
            
            // Update budget display based on state
            updateBudgetDisplay(sessionState);
            
            // Log the current state for debugging
            console.log("Current state:", sessionState);
          }

          // Function to update show script button visibility
          function updateShowScriptButtonVisibility() {
            const select = document.getElementById("redeemerSelect");
            const showScriptButton = document.getElementById("showScriptButton");
            
            if (select && showScriptButton) {
              const selectedValue = select.value;
              const shouldShow = selectedValue !== "Choose redeemer" && selectedValue !== "No redeemers available";
              
              if (shouldShow) {
                showScriptButton.classList.add("visible");
              } else {
                showScriptButton.classList.remove("visible");
              }
            }
          }

          // Function to update button states based on debugger state
          function updateButtonStates(state) {
            // Get button references by ID
            const toggleMainButton = document.getElementById("toggleMainButton");
            const stepButton = document.getElementById("stepButton");
            const refreshButton = document.getElementById("refreshButton");
            const stopButton = document.getElementById("stopButton");
            const showContextButton = document.getElementById("showContextButton");
            
            // Control buttons based on state
            if (state === "stopped") {
              // In stopped state, only enable the Start/Pause button
              toggleMainButton.disabled = false;
              stepButton.disabled = true;
              refreshButton.disabled = true;
              stopButton.disabled = true;
            } else if (state === "empty") {
              // In empty state, disable all control buttons
              toggleMainButton.disabled = true;
              stepButton.disabled = true;
              refreshButton.disabled = true;
              stopButton.disabled = true;
            } else if (state === "running") {
              // In running state, enable Start/Pause, Stop, and Refresh buttons
              toggleMainButton.disabled = false;
              stepButton.disabled = true;
              refreshButton.disabled = false;
              stopButton.disabled = false;
            } else if (state === "pause") {
              // In pause state, enable Step, Stop, and Refresh buttons
              toggleMainButton.disabled = false;
              stepButton.disabled = false;
              refreshButton.disabled = false;
              stopButton.disabled = false;
            } else {
              // In other states, enable all buttons
              toggleMainButton.disabled = false;
              stepButton.disabled = false;
              refreshButton.disabled = false;
              stopButton.disabled = false;
            }
            
            // Enable the show context button when there's an active session
            if (showContextButton) {
              showContextButton.disabled = (state === "empty");
            }
          }

          function showSections(showAll) {
            const sections = ['scriptSection', 'redeemerSection'];
            sections.forEach(id => {
              const section = document.getElementById(id);
              if (section) {
                section.style.display = !showAll ? 'none' : 'block';
              }
            });
            
            // Handle budget section separately
            const budgetSection = document.getElementById("budgetSection");
            if (budgetSection) {
              budgetSection.style.display = !showAll ? 'none' : 'block';
            }
          }
          
          function updateBudgetDisplay(state) {
            const budgetValues = [
              document.getElementById("exUnitsSpent"),
              document.getElementById("exUnitsAvailable"),
              document.getElementById("memoryUnitsSpent"),
              document.getElementById("memoryUnitsAvailable")
            ];
            
            budgetValues.forEach(element => {
              if (element) {
                if (state === "running") {
                  // Show loading state with dashes
                  element.classList.add("loading");
                  element.textContent = "—";
                } else {
                  // Remove loading state
                  element.classList.remove("loading");
                }
              }
            });
          }
          
          setIconsForState();
          updateShowScriptButtonVisibility();
          // showSections(sessionState !== 'empty');
          
          window.addEventListener("message", (event) => {
            const message = event.data;
            if (message.command === "resetToInitial") {
              // Reset all UI elements to initial state
              document.body.className = "empty";
              sessionState = "empty";
              
              // Reset budget values and remove loading state
              const budgetValues = [
                document.getElementById("exUnitsSpent"),
                document.getElementById("exUnitsAvailable"),
                document.getElementById("memoryUnitsSpent"),
                document.getElementById("memoryUnitsAvailable")
              ];
              
              budgetValues.forEach(element => {
                if (element) {
                  element.textContent = "0";
                  element.classList.remove("loading");
                }
              });
              
              // Reset script info
              const scriptHashElement = document.getElementById("scriptHash");
              scriptHashElement.textContent = "Script hash: -";
              scriptHashElement.title = "-";
              const plutusVersionsElement = document.getElementById("plutusVersions");
              plutusVersionsElement.textContent = "Lang: - • Core: -";
              plutusVersionsElement.title = "Lang: - | Core: -";
              
              // Reset redeemer select
              const select = document.getElementById("redeemerSelect");
              select.innerHTML = '<option value="No redeemers available">No redeemers available</option>';
              
              // Reset button states
              setIconsForState();
              updateButtonStates("empty");
              updateShowScriptButtonVisibility();
              
              // Hide sections
              showSections(false);
              
              // Hide budget section specifically
              const budgetSection = document.getElementById("budgetSection");
              if (budgetSection) {
                budgetSection.style.display = "none";
              }
            } else if (message.command === "updateSessionState") {
              sessionState = message.state;
              setIconsForState();
              updateButtonStates(sessionState);
              
              // Hide/show budget section based on session state
              const budgetSection = document.getElementById("budgetSection");
              if (budgetSection) {
                if (sessionState === "stopped" || sessionState === "empty") {
                  budgetSection.style.display = "none";
                } else {
                  budgetSection.style.display = "block";
                  // Update budget display based on state
                  updateBudgetDisplay(sessionState);
                }
              }
            } else if (message.command === "lockInterface") {
              // Set body class to locked to visually disable all controls
              document.body.className = "locked";
              
              // Disable all interactive elements
              document.querySelectorAll(".icon-button, .inspect-button, select, .show-script-button").forEach(element => {
                element.disabled = true;
              });
              vscode.postMessage({ command: "deuplc.sidebarControl.locked" });
            } else if (message.command === "unlockInterface") {
              // Restore the session state
              sessionState = message.state;
              document.body.className = sessionState;
              
              // Update button states based on the current state
              updateButtonStates(sessionState);
              
              // Select box
              document.getElementById("redeemerSelect").disabled = false;
              
              // Show script button
              document.getElementById("showScriptButton").disabled = false;
              
              // Update icons for the current state and budget display
              setIconsForState();
              vscode.postMessage({ command: "deuplc.sidebarControl.unlocked" });
            } else if (message.command === "updateScriptInfo") {
              const info = message.scriptInfo;
              const scriptHashElement = document.getElementById("scriptHash");
              scriptHashElement.textContent = "Script hash: " + info.hash;
              scriptHashElement.title = info.hash;
              const plutusVersionsElement = document.getElementById("plutusVersions");
              plutusVersionsElement.textContent = "Lang: " + info.plutusLangVersion + " • Core: " + info.plutusCoreVersion;
              plutusVersionsElement.title = "Lang: " + info.plutusLangVersion + " | Core: " + info.plutusCoreVersion;
            } else if (message.command === "updateRedeemers") {
              const select = document.getElementById("redeemerSelect");
              select.innerHTML = "";
              message.redeemers.forEach(redeemer => {
                const option = document.createElement("option");
                option.value = redeemer;
                option.text = redeemer;
                select.appendChild(option);
              });
              updateShowScriptButtonVisibility();
            } else if (message.command === "updateBudget") {
              const budget = message.budget;
              const exUnitsSpent = Number(budget.exUnitsSpent);
              const exUnitsAvailable = Number(budget.exUnitsAvailable);
              const memoryUnitsSpent = Number(budget.memoryUnitsSpent);
              const memoryUnitsAvailable = Number(budget.memoryUnitsAvailable);

              // Show budget section when budget is updated and session is not empty/stopped
              const budgetSection = document.getElementById("budgetSection");
              if (budgetSection && sessionState !== "empty" && sessionState !== "stopped") {
                budgetSection.style.display = "block";
              }

              // Update budget values and remove loading state
              const exUnitsSpentElement = document.getElementById("exUnitsSpent");
              const exUnitsAvailableElement = document.getElementById("exUnitsAvailable");
              const memoryUnitsSpentElement = document.getElementById("memoryUnitsSpent");
              const memoryUnitsAvailableElement = document.getElementById("memoryUnitsAvailable");
              
              if (exUnitsSpentElement) {
                exUnitsSpentElement.textContent = exUnitsSpent.toLocaleString();
                exUnitsSpentElement.classList.remove("loading");
              }
              if (exUnitsAvailableElement) {
                exUnitsAvailableElement.textContent = exUnitsAvailable.toLocaleString();
                exUnitsAvailableElement.classList.remove("loading");
              }
              if (memoryUnitsSpentElement) {
                memoryUnitsSpentElement.textContent = memoryUnitsSpent.toLocaleString();
                memoryUnitsSpentElement.classList.remove("loading");
              }
              if (memoryUnitsAvailableElement) {
                memoryUnitsAvailableElement.textContent = memoryUnitsAvailable.toLocaleString();
                memoryUnitsAvailableElement.classList.remove("loading");
              }

              // Recalculate overspend status and update CSS classes.
              const exOverspend = exUnitsSpent > exUnitsAvailable;
              const memOverspend = memoryUnitsSpent > memoryUnitsAvailable;
              const exBudgetRow = document.getElementById("exBudgetRow");
              const memBudgetRow = document.getElementById("memBudgetRow");

              if (exOverspend) {
                exBudgetRow.classList.add("overspend");
              } else {
                exBudgetRow.classList.remove("overspend");
              }

              if (memOverspend) {
                memBudgetRow.classList.add("overspend");
              } else {
                memBudgetRow.classList.remove("overspend");
              }
            } else if (message.command === "selectRedeemer") {
              // Update the selected redeemer in the dropdown.
              const select = document.getElementById("redeemerSelect");
              select.value = message.redeemer;
              updateShowScriptButtonVisibility();
            }
          });

          // Replace the querySelectorAll with getElementById
          document.getElementById("toggleMainButton").addEventListener("click", () => {
            if (sessionState === "empty" || sessionState === "stopped") {
              vscode.postMessage({ command: "deuplc.sidebarControl.startSession" });
            } else if (sessionState === "running") {
              vscode.postMessage({ command: "deuplc.sidebarControl.pauseSession" });
            } else if (sessionState === "pause") {
              vscode.postMessage({ command: "deuplc.sidebarControl.continueSession" });
            }
          });

          document.getElementById("stepButton").addEventListener("click", () => {
            if (sessionState === "running" || sessionState === "pause") {
              vscode.postMessage({ command: "deuplc.sidebarControl.step" });
            }
          });

          document.getElementById("refreshButton").addEventListener("click", () => {
            if (sessionState === "running" || sessionState === "pause") {
              vscode.postMessage({ command: "deuplc.sidebarControl.refresh" });
            }
          });

          document.getElementById("stopButton").addEventListener("click", () => {
            if (sessionState === "running" || sessionState === "pause") {
              vscode.postMessage({ command: "deuplc.sidebarControl.stop" });
            }
          });

          document.getElementById("showContextButton").addEventListener("click", () => {
            vscode.postMessage({ command: "deuplc.sidebarControl.showContext" });
          });

          document.getElementById("redeemerSelect").addEventListener("change", () => {
            const select = document.getElementById("redeemerSelect");
            vscode.postMessage({
              command: "deuplc.sidebarControl.changeRedeemer",
              value: select.value,
            });
            updateShowScriptButtonVisibility();
          });

          document.getElementById("showScriptButton").addEventListener("click", () => {
            vscode.postMessage({ command: "deuplc.sidebarControl.showScript" });
          });

          // Add script to handle state changes
          window.addEventListener('message', event => {
            const message = event.data;
            
            if (message.type === 'updateState') {
              // Update body class
              document.body.className = message.state;
              
              // Update button states
              updateButtonStates(message.state);
              
              // Update main button icon
              const mainButtonIcon = document.getElementById('mainButtonIcon');
              if (mainButtonIcon) {
                if (message.state === 'running') {
                  mainButtonIcon.className = 'codicon codicon-debug-pause';
                } else {
                  mainButtonIcon.className = 'codicon codicon-debug-start';
                }
              }
              // showSections(!isInitialState);
            }
          });
        </script>
      </body>
      </html>
    `;
  }
}


const compareRedeemerLists = (list1?: string[], list2?: string[]): boolean => {
  if (list1 === list2) {
    return true;
  }
  if (!list1 || !list2) {
    return false;
  }
  
  // Filter out the ephemeral "Choose redeemer" option before comparing
  const filteredList1 = new Set(list1.filter(r => r !== CHOOSE_REDEEMER));
  const filteredList2 = new Set(list2.filter(r => r !== CHOOSE_REDEEMER));
  
  if (filteredList1.size !== filteredList2.size) {
    return false;
  }

  for (const redeemer of filteredList1) {
    if (!filteredList2.has(redeemer)) {
      return false;
    }
  }
  return true;
};
