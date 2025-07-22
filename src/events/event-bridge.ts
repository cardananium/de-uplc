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

export class EventBridge {
  private currentSession: SessionController | undefined;
  private debugLoggingEnabled: boolean = true;

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

  public toggleDebugLogging(enabled?: boolean): boolean {
    this.debugLoggingEnabled = enabled !== undefined ? enabled : !this.debugLoggingEnabled;
    this.logDebugMessage(`Debug event logging ${this.debugLoggingEnabled ? 'enabled' : 'disabled'}`);
    return this.debugLoggingEnabled;
  }

  private logDebugMessage(message: string): void {
    if (this.debugLoggingEnabled) {
      vscode.window.showInformationMessage(`[Event Bridge] ${message}`);
    }
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
          await this.tabManager.openTermInNewTab(rootTerm);
          this.currentSession = currentSession;
          this.debuggerPanelViewProvider.setDebuggerState("running");
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
        ExtensionActionEventNames.OPEN_NEW_SCRIPT,
        async (script: string) => {
          this.logDebugMessage(`Event: OPEN_NEW_SCRIPT`);
          await this.currentSession?.stop();
          await this.tabManager.closeAll();
          this.debuggerManager.terminateDebugging();
          await this.debuggerManager.openTransaction(script);
          this.debuggerPanelViewProvider.setRedeemers(
            await this.debuggerManager.getRedeemers()
          );
          this.currentSession = undefined;
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
          this.debuggerManager.terminateDebugging();
          const session = await this.debuggerManager.initDebugSession(redeemer);
          this.currentSession = session;
          const script = await session.getScript();
          await this.tabManager.openTermInNewTab(script);
          this.debuggerPanelViewProvider.setDebuggerState("stopped");
          this.fillPossibleFields();
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
  }

  private async showError(message: string) {
    vscode.window.showErrorMessage(message);
  }

  private async showWarning(message: string) {
    vscode.window.showWarningMessage(message);
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
    if (node.state) {return "Machine State";}
    if (node.context) {return "Context";}
    if (node.env) {return "Environment";}
    if (node.value) {return "Value";}
    if (node.constant) {return "Constant";}
    if (node.type) {return "Type";}
    if (node.term) {return "Term";}
    if (node.runtime) {return "Runtime";}
    
    return "UPLC Node";
  }
}