import * as vscode from 'vscode';

import { UplcTreeDataProvider } from './sections/uplc-tree/uplc-tree-data-provider';
import { LogsTreeDataProvider } from './sections/logs-tree-data-provider';
import { BreakpointsTreeDataProvider } from './sections/breakpoints-tree-data-provider';
import { DebuggerPanelViewProvider } from './sections/debugger-panel-view-provider';
import { AdditionalControlsViewProvider } from './sections/additional-controls-view-provider';
import { EventBridge } from './events/event-bridge';
import { DebuggerManager } from './debugger/debugger-manager';
import { TabManager } from './tabs/tab-manager';

export function activate(context: vscode.ExtensionContext) {
  console.log('[DE-UPLC] Activating extension...');

  const debuggerManager = new DebuggerManager();
  const tabManager = TabManager.register(context);
  const debuggerPanelViewProvider = DebuggerPanelViewProvider.register(context);
  const additionalControlsViewProvider = AdditionalControlsViewProvider.register(context);
  const machineContextTreeDataProvider = UplcTreeDataProvider.register(context, "machineContextTreeDataProvider");
  const machineStateTreeDataProvider = UplcTreeDataProvider.register(context, "machineStateTreeDataProvider");
  const environmentsTreeDataProvider = UplcTreeDataProvider.register(context, "environmentsTreeDataProvider");
  const logsTreeDataProvider = LogsTreeDataProvider.register(context, "logsTreeDataProvider");
  const breakpointsTreeDataProvider = BreakpointsTreeDataProvider.register(context, "breakpointsTreeDataProvider");

  const bridge = new EventBridge(
    context,
     debuggerManager, 
     tabManager, 
     debuggerPanelViewProvider, 
     machineContextTreeDataProvider, 
     machineStateTreeDataProvider,
     environmentsTreeDataProvider,
     logsTreeDataProvider,
     breakpointsTreeDataProvider
  );

  bridge.registerCommands();

  console.log('[DE-UPLC] Extension activated.');
}

export function deactivate() { }
