import * as vscode from "vscode";
import { DebuggerManager } from "../debugger/debugger-manager";
import { SessionController } from "../debugger/session-controller";
import { TabManager } from "../tabs/tab-manager";
import {
  DebuggerControlEventNames,
  ExtensionActionEventNames,
} from "./debugger-event-names";
import { DebuggerPanelViewProvider } from "../sections/debugger-panel-view-provider";
import { UplcTreeDataProvider } from "../sections/uplc-tree/uplc-tree-data-provider";
import { LogsTreeDataProvider } from "../sections/logs-tree-data-provider";
import { BreakpointsTreeDataProvider } from "../sections/breakpoints-tree-data-provider";
import { EventEmitter } from "./event-emitter";
import { Breakpoint } from "../common";
import { Term } from "../debugger-types";

export class EventBridge {
  private currentSession: SessionController | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly debuggerManager: DebuggerManager,
    private readonly tabManager: TabManager,
    private readonly debuggerPanelViewProvider: DebuggerPanelViewProvider,
    private readonly machineContextTreeDataProvider: UplcTreeDataProvider,
    private readonly machineStateTreeDataProvider: UplcTreeDataProvider,
    private readonly environmentsTreeDataProvider: UplcTreeDataProvider,
    private readonly logsTreeDataProvider: LogsTreeDataProvider,
    private readonly breakpointsTreeDataProvider: BreakpointsTreeDataProvider
  ) {
    this.fillPossibleFields();
  }

  private logDebugMessage(message: string): void {
    console.debug(`[Event Bridge] ${message}`);
  }

  public registerCommands() {
    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.START_DEBUGGING,
        async (redeemer: string) => {
          this.logDebugMessage(`Event: START_DEBUGGING with redeemer: ${redeemer}`);
          const currentSession = await this.debuggerManager.initDebugSession(
            redeemer
          );
          const rootTerm = await currentSession.getScript();
          if (rootTerm) {
            await this.tabManager.openTermInNewTab(rootTerm);
          }
          this.currentSession = currentSession;
          this.debuggerPanelViewProvider.setDebuggerState("running");
          await currentSession.start();
          // this.fillSessionSpecificFields();
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.STOP_DEBUGGING,
        async () => {
          this.logDebugMessage(`Event: STOP_DEBUGGING`);
          await this.currentSession?.stop();
          this.currentSession = undefined;
          await this.tabManager.closeSessionSpecificTabs();
          await this.clearSessionSpecificFields();
          this.debuggerPanelViewProvider.setDebuggerState("stopped");
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.PAUSE_DEBUGGING,
        async () => {
          this.logDebugMessage(`Event: PAUSE_DEBUGGING`);
          await this.currentSession?.pause();
          await this.fillSessionSpecificFields();
          const termId = await this.currentSession?.getCurrentTermId();
          if (termId !== undefined) {
            this.tabManager.highlightDebuggerLine(termId);
          } else {
            this.logDebugMessage(`Warning: Current term ID is undefined on pause.`);
          }
          this.debuggerPanelViewProvider.setDebuggerState("pause");
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.STEP_DEBUGGING,
        async () => {
          this.logDebugMessage(`Event: STEP_DEBUGGING`);
          await this.currentSession?.step();
          await this.fillSessionSpecificFields();
          const termId = await this.currentSession?.getCurrentTermId();
          if (termId !== undefined) {
            this.tabManager.highlightDebuggerLine(termId);
          } else {
            this.logDebugMessage(`Warning: Current term ID is undefined on pause.`);
          }
          this.debuggerPanelViewProvider.setDebuggerState("pause");
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.CONTINUE_DEBUGGING,
        async () => {
          this.logDebugMessage(`Event: CONTINUE_DEBUGGING`);
          await this.currentSession?.continue();
          this.debuggerPanelViewProvider.setDebuggerState("running");
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.DEBUGGER_CAUGHT_BREAKPOINT,
        async (termId: number) => {
          this.logDebugMessage(`Event: DEBUGGER_CAUGHT_BREAKPOINT at termId: ${termId}`);
          this.tabManager.highlightDebuggerLine(termId);
          await this.fillSessionSpecificFields();
          this.debuggerPanelViewProvider.setDebuggerState("pause");
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.DEBUGGER_CAUGHT_ERROR,
        async (message: string) => {
          this.logDebugMessage(`Event: DEBUGGER_CAUGHT_ERROR with message: ${message}`);
          await this.presentExecutionResult(message);
          this.debuggerPanelViewProvider.setDebuggerState("stopped");
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.DEBUGGER_CAUGHT_FINISHED,
        async (term: Term) => {
          this.logDebugMessage(`Event: DEBUGGER_CAUGHT_FINISHED`);
          if (term) {
            await this.presentFinishedResult(term);
          }
          this.debuggerPanelViewProvider.setDebuggerState("stopped");
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.RESET_DEBUGGING_SESSION,
        async () => {
          this.logDebugMessage(`Event: RESET_DEBUGGING_SESSION`);
          if (this.currentSession) {
            await this.currentSession.stop();
            const redeemer = await this.currentSession.getRedeemer();
            await this.tabManager.closeSessionSpecificTabs();
            await this.debuggerManager.terminateDebugging();
            const session = await this.debuggerManager.initDebugSession(redeemer);
            this.currentSession = session;
            this.debuggerPanelViewProvider.setDebuggerState("stopped");
            this.clearSessionSpecificFields();
            EventEmitter.startDebugging(redeemer);
          } else {
            this.debuggerPanelViewProvider.unlockInterface();
          }
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        DebuggerControlEventNames.FINISHED_DEBUGGING,
        async () => {
          this.logDebugMessage(`Event: FINISHED_DEBUGGING`);
          this.debuggerPanelViewProvider.setDebuggerState("stopped");
          await this.currentSession?.stop();
          this.currentSession = undefined;
          await this.tabManager.closeSessionSpecificTabs();
          await this.debuggerManager.terminateDebugging();
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        ExtensionActionEventNames.OPEN_NEW_TRANSACTION,
        async (script: string) => {
          this.logDebugMessage(`Event: OPEN_NEW_TRANSACTION`);
          await this.currentSession?.stop();
          await this.tabManager.closeAll();
          await this.debuggerManager.terminateDebugging();
          await this.debuggerManager.openTransaction(script);
          this.debuggerPanelViewProvider.setRedeemers(
            await this.debuggerManager.getRedeemers(),
            await this.debuggerManager.getTransactionId()
          );
          this.currentSession = undefined;
          this.clearSessionSpecificFields();
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        ExtensionActionEventNames.SELECT_REDEEMER,
        async (redeemer: string) => {
          this.logDebugMessage(`Event: SELECT_REDEEMER with redeemer: ${redeemer}`);
          await this.currentSession?.stop();
          await this.tabManager.closeAll();
          this.breakpointsTreeDataProvider.clear();
          this.tabManager.clearBreakpoints();
          this.debuggerManager.terminateDebugging();
          const session = await this.debuggerManager.initDebugSession(redeemer);
          this.currentSession = session;
          const script = await session.getScript();
          if (script) {
            await this.tabManager.openTermInNewTab(script);
          }
          this.debuggerPanelViewProvider.setDebuggerState("stopped");
          this.fillScriptInfo();
          this.clearSessionSpecificFields();
          this.debuggerPanelViewProvider.unlockInterface();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        ExtensionActionEventNames.ERROR_OCCURRED,
        async (message: string) => {
          this.logDebugMessage(`Event: ERROR_OCCURRED with message: ${message}`);
          this.showError(message);
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        ExtensionActionEventNames.BREAKPOINT_LIST_UPDATED,
        async (breakpoints: Breakpoint[]) => {
          this.logDebugMessage(`Event: BREAKPOINT_LIST_UPDATED with ${breakpoints.length} breakpoints`);
          this.breakpointsTreeDataProvider.setBreakpoints(breakpoints);
          this.debuggerManager.setBreakpoints(
            breakpoints.filter(bp => bp.active).map(bp => bp.id)
          );
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        ExtensionActionEventNames.SHOW_SCRIPT_CONTEXT,
        async () => {
          this.logDebugMessage(`Event: SHOW_SCRIPT_CONTEXT`);
          await this.showScriptContextInTab();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        ExtensionActionEventNames.SHOW_SCRIPT,
        async () => {
          this.logDebugMessage(`Event: SHOW_SCRIPT`);
          await this.showScriptInTab();
        }
      )
    );

    this.context.subscriptions.push(
      vscode.commands.registerCommand(
        'uplcTree.showNodeInTab',
        async (node: any) => {
          this.logDebugMessage(`Event: uplcTree.showNodeInTab`);
          await this.showNodeInTab(node);
        }
      )
    );
  }

  private async fillPossibleFields() {
    await this.fillRedeemers();
    await this.fillScriptInfo();
    await this.fillSessionSpecificFields();
  }

  private async fillScriptInfo() {
    const plutusCoreVersion = await this.currentSession?.getPlutusCoreVersion();
    const plutusLanguageVersion = await this.currentSession?.getPlutusLanguageVersion();
    const scriptHash = await this.currentSession?.getScriptHash();
    if (plutusCoreVersion && plutusLanguageVersion && scriptHash) {
      this.debuggerPanelViewProvider.setScriptInfo({ plutusCoreVersion, plutusLangVersion: plutusLanguageVersion, hash: scriptHash });
    }
  }

  private async fillRedeemers() {
    const redeemers = await this.debuggerManager.getRedeemers();
    const transactionId = await this.debuggerManager.getTransactionId();
    this.debuggerPanelViewProvider.setRedeemers(redeemers, transactionId);
  }

  private async fillBudget() {
    const budget = await this.currentSession?.getBudget();
    if (budget) {
      this.debuggerPanelViewProvider.setBudget(budget);
    }
  }

  private async fillSessionSpecificFields() {
    const machineState = await this.currentSession?.getMachineState();
    if (machineState) {
      this.machineStateTreeDataProvider.setMachineState(machineState);
    }
    const contexts = await this.currentSession?.getMachineContext();
    if (contexts) {
      this.machineContextTreeDataProvider.setContexts(contexts);
    }
    const currentEnv = await this.currentSession?.getCurrentEnv();
    if (currentEnv) {
      this.environmentsTreeDataProvider.setCurrentEnv(currentEnv);
    }
    const budget = await this.currentSession?.getBudget();
    if (budget) {
      this.debuggerPanelViewProvider.setBudget(budget);
    }
    const logs = await this.currentSession?.getLogs();
    if (logs) {
      this.logsTreeDataProvider.setLogs(logs);
    }

    // Update breakpoints from TermViewer
    this.updateBreakpointsFromTermViewer();
  }

  private async clearSessionSpecificFields() {
    this.machineStateTreeDataProvider.clear();
    this.machineContextTreeDataProvider.clear();
    this.environmentsTreeDataProvider.clear();
    this.logsTreeDataProvider.clear();
    this.breakpointsTreeDataProvider.clear();
    this.debuggerPanelViewProvider.clearBudget();
    this.tabManager.clearDebuggerHighlight();
  }

  private async showError(message: string) {
    vscode.window.showErrorMessage(message);
  }

  private async showWarning(message: string) {
    vscode.window.showWarningMessage(message);
  }

  private async presentErrorModal(message: string) {
    await vscode.window.showErrorMessage(message, { modal: true });
  }

  private async presentExecutionResult(message: string) {
    console.log('[EventBridge] Presenting execution result:', message);

    // Try to parse the message as JSON to see if it contains execution result data
    try {
      const parsedResult = JSON.parse(message);
      console.log('[EventBridge] Parsed execution result:', parsedResult);

      // Check if this is a successful execution result
      if (parsedResult.status_type === 'Done' && parsedResult.result) {
        console.log('[EventBridge] Showing successful execution result');
        const choice = await vscode.window.showInformationMessage(
          "Script execution completed successfully!",
          { modal: true },
          "Open Result",
          "Dismiss"
        );

        if (choice === "Open Result") {
          // Open the execution result as a term in a new tab
          await this.tabManager.openTermInNewTab(parsedResult.result);
        }
        return;
      }

      // Check if this is an execution error with detailed information
      if (parsedResult.status_type === 'Error') {
        console.log('[EventBridge] Showing execution error with details');
        const choice = await vscode.window.showErrorMessage(
          `Script execution failed: ${parsedResult.message}`,
          { modal: true },
          "Show Details",
          "Dismiss"
        );

        if (choice === "Show Details") {
          await this.tabManager.openPlainTextInNewTab(
            JSON.stringify(parsedResult, null, 2),
            "Execution Error Details"
          );
        }
        return;
      }

      // Check if the parsed result has a different structure but contains result data
      if (parsedResult.result || parsedResult.data) {
        console.log('[EventBridge] Found result data in non-standard format');
        const choice = await vscode.window.showInformationMessage(
          "Execution completed with result data.",
          { modal: true },
          "Show Details",
          "Dismiss"
        );

        if (choice === "Show Details") {
          await this.tabManager.openPlainTextInNewTab(
            JSON.stringify(parsedResult, null, 2),
            "Execution Result"
          );
        }
        return;
      }
    } catch (parseError) {
      console.log('[EventBridge] Message is not JSON, treating as plain text:', parseError);
    }

    // Try to identify execution results from plain text messages
    if (message.includes('Done') || message.includes('execution completed') || message.includes('finished') || message.includes('success')) {
      console.log('[EventBridge] Identified as successful execution from text pattern');
      const choice = await vscode.window.showInformationMessage(
        "Script execution completed. Result: " + (message.length > 200 ? message.substring(0, 200) + '...' : message),
        { modal: true },
        "Show Details",
        "Dismiss"
      );

      if (choice === "Show Details") {
        await this.tabManager.openPlainTextInNewTab(message, "Execution Result");
      }
    } else {
      // This is likely an actual error, show it as an error modal
      console.log('[EventBridge] Treating as error');
      await this.presentErrorModal(message);
    }
  }

  private updateBreakpointsFromTermViewer() {
    const breakpoints = this.tabManager.getBreakpoints();
    this.breakpointsTreeDataProvider.setBreakpoints(breakpoints);
  }

  private async showScriptContextInTab() {
    if (!this.currentSession) {
      vscode.window.showWarningMessage("No active debugging session to show context.");
      return;
    }

    try {
      const context = await this.currentSession.getTxScriptContext();

      if (!context) {
        vscode.window.showWarningMessage("Script context is empty or undefined.");
        return;
      }

      await this.tabManager.openUplcInNewTab(context, "Script Context");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get script context: ${error}`);
    }
  }

  private async showScriptInTab() {
    if (!this.currentSession) {
      vscode.window.showWarningMessage("No active debugging session to show script.");
      return;
    }

    try {
      const script = await this.currentSession.getScript();

      if (!script) {
        vscode.window.showWarningMessage("Script is empty or undefined.");
        return;
      }

      await this.tabManager.openTermInNewTab(script);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to get script: ${error}`);
    }
  }

  private async showNodeInTab(node: any) {
    try {
      // Check if this node represents an EitherTermOrId with type 'Id'
      if (this.isEitherTermOrIdWithId(node)) {
        const termId = this.extractTermIdFromNode(node);
        if (termId !== null) {
          this.tabManager.focusOnTerm(termId);
          return;
        }
      }

      // Get the full node data including children
      const nodeData = this.extractNodeData(node);

      if (!nodeData) {
        vscode.window.showWarningMessage("Unable to extract node data.");
        return;
      }

      // Generate a meaningful filename based on the node
      const fileName = this.generateNodeFileName(node);

      // Check if it's a plain text log entry
      if (typeof nodeData === 'string') {
        await this.showPlainTextInTab(nodeData, fileName);
      } else {
        await this.tabManager.openUplcInNewTab(nodeData, fileName);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to show node in tab: ${error}`);
    }
  }

  private async presentFinishedResult(term: Term) {
    try {
      const choice = await vscode.window.showInformationMessage(
        "Script execution finished. What would you like to do?",
        { modal: true },
        "Open Result",
        "Dismiss"
      );

      if (choice === "Open Result") {
        await this.tabManager.openTermInNewTab(term);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to present result: ${error}`);
    }
  }

  private async showPlainTextInTab(content: string, fileName: string) {
    await this.tabManager.openPlainTextInNewTab(content, fileName);
  }

  private extractNodeData(node: any): any {
    if (!node) {
      return null;
    }

    // Extract the node's data with all its children
    const result: any = {};

    // Check if it's a log entry node
    if (node.getLogMessage && node.getIndex) {
      // Return just the plain text message
      return node.getLogMessage();
    }

    // Get the main node data
    if (node.state) {
      result.state = node.state;
    } else if (node.context) {
      result.context = node.context;
    } else if (node.env) {
      result.env = node.env;
    } else if (node.value) {
      result.value = node.value;
    } else if (node.constant) {
      result.constant = node.constant;
    } else if (node.type) {
      result.type = node.type;
    } else if (node.term) {
      result.term = node.term;
    } else if (node.runtime) {
      result.runtime = node.runtime;
    } else {
      // Try to extract any visible properties
      const nodeItem = node.getTreeItem?.();
      if (nodeItem) {
        result.label = nodeItem.label;
        result.description = nodeItem.description;
      }

      // Get children
      const children = node.getChildren?.();
      if (children && children.length > 0) {
        result.children = children.map((child: any) => this.extractNodeData(child));
      }
    }

    return result;
  }

  private isEitherTermOrIdWithId(node: any): boolean {
    // Check if this is a SimpleNode created from EitherTermOrId with type 'Id'
    // These nodes have text pattern like "${label} (Term ID: ${id})"
    if (!node || !node.getTreeItem) {
      return false;
    }

    try {
      const treeItem = node.getTreeItem();
      const label = treeItem.label;
      if (typeof label !== 'string') {
        return false;
      }

      return label.includes('(Term ID: ') && label.endsWith(')');
    } catch (error) {
      return false;
    }
  }

  private extractTermIdFromNode(node: any): number | null {
    if (!node || !node.getTreeItem) {
      return null;
    }

    try {
      const treeItem = node.getTreeItem();
      const label = treeItem.label;
      if (typeof label !== 'string') {
        return null;
      }

      const match = label.match(/\(Term ID: (\d+)\)$/);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    } catch (error) {
      // Handle any errors gracefully
    }

    return null;
  }

  private generateNodeFileName(node: any): string {
    // Check if it's a log entry node
    if (node.getLogMessage && node.getIndex) {
      return `Log Entry ${node.getIndex() + 1}`;
    }

    const treeItem = node.getTreeItem?.();
    if (treeItem?.label) {
      // Clean up the label to make it a valid filename
      return treeItem.label.toString().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    }

    // Fallback names based on node type
    if (node.state) { return "Machine State"; }
    if (node.context) { return "Context"; }
    if (node.env) { return "Environment"; }
    if (node.value) { return "Value"; }
    if (node.constant) { return "Constant"; }
    if (node.type) { return "Type"; }
    if (node.term) { return "Term"; }
    if (node.runtime) { return "Runtime"; }

    return "UPLC Node";
  }
}