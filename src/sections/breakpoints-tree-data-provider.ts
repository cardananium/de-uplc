import * as vscode from 'vscode';
import { Breakpoint } from '../common';

export interface BreakpointNode {
    getTreeItem(): vscode.TreeItem;
    getChildren(): BreakpointNode[];
}

export class BreakpointEntryNode implements BreakpointNode {
    constructor(private breakpoint: Breakpoint) {}
    
    getBreakpoint(): Breakpoint {
        return this.breakpoint;
    }
    
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(
            `Line ${this.breakpoint.line}: ${this.breakpoint.id}`, 
            vscode.TreeItemCollapsibleState.None
        );
        
        // Use native VS Code checkbox support
        item.checkboxState = this.breakpoint.active 
            ? vscode.TreeItemCheckboxState.Checked 
            : vscode.TreeItemCheckboxState.Unchecked;
        
        item.tooltip = `${this.breakpoint.active ? 'Active' : 'Inactive'} breakpoint at line ${this.breakpoint.line} for term ${this.breakpoint.id}`;
        
        // Set context value for menu actions
        item.contextValue = this.breakpoint.active ? 'activeBreakpoint' : 'inactiveBreakpoint';
        
        return item;
    }
    
    getChildren(): BreakpointNode[] {
        return [];
    }
}

export class BreakpointsTreeDataProvider implements vscode.TreeDataProvider<BreakpointNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<BreakpointNode | undefined | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<BreakpointNode | undefined | void> = this._onDidChangeTreeData.event;

    private _onDidChangeCheckboxState: vscode.EventEmitter<vscode.TreeCheckboxChangeEvent<BreakpointNode>> = new vscode.EventEmitter();
    readonly onDidChangeCheckboxState: vscode.Event<vscode.TreeCheckboxChangeEvent<BreakpointNode>> = this._onDidChangeCheckboxState.event;

    private breakpoints: Breakpoint[] = [];

    public static register(context: vscode.ExtensionContext, name: string): BreakpointsTreeDataProvider {
        const provider = new BreakpointsTreeDataProvider();
        const treeView = vscode.window.createTreeView(name, { 
            treeDataProvider: provider,
            showCollapseAll: false
        });
        
        context.subscriptions.push(treeView);
        
        // Handle checkbox changes
        treeView.onDidChangeCheckboxState(e => {
            for (const [item, checkboxState] of e.items) {
                if (item instanceof BreakpointEntryNode) {
                    const breakpoint = item.getBreakpoint();
                    const newActive = checkboxState === vscode.TreeItemCheckboxState.Checked;
                    provider.updateBreakpointState(breakpoint, newActive);
                }
            }
        });
        
        // Register command for removing breakpoints
        context.subscriptions.push(
            vscode.commands.registerCommand('breakpointsTreeDataProvider.removeBreakpoint', (breakpointNode: BreakpointEntryNode) => {
                provider.removeBreakpoint(breakpointNode.getBreakpoint());
            })
        );
        
        return provider;
    }

    clear() {
        this.breakpoints = [];
        this._onDidChangeTreeData.fire();
    }

    setBreakpoints(breakpoints: Breakpoint[]) {
        this.breakpoints = breakpoints;
        this._onDidChangeTreeData.fire();
    }

    updateBreakpointState(breakpoint: Breakpoint, newActive: boolean) {
        const index = this.breakpoints.findIndex(bp => bp.id === breakpoint.id && bp.line === breakpoint.line);
        if (index !== -1) {
            this.breakpoints[index] = { ...breakpoint, active: newActive };
            this._onDidChangeTreeData.fire();
            
            // Emit custom event for TermViewer to update its state
            vscode.commands.executeCommand('termViewer.setBreakpointState', breakpoint.line, breakpoint.id, newActive);
        }
    }

    removeBreakpoint(breakpoint: Breakpoint) {
        const index = this.breakpoints.findIndex(bp => bp.id === breakpoint.id && bp.line === breakpoint.line);
        if (index !== -1) {
            this.breakpoints.splice(index, 1);
            this._onDidChangeTreeData.fire();
            
            // Emit custom event for TermViewer to remove breakpoint
            vscode.commands.executeCommand('termViewer.removeBreakpoint', breakpoint.line, breakpoint.id);
        }
    }

    getBreakpoints(): Breakpoint[] {
        return [...this.breakpoints];
    }

    getTreeItem(element: BreakpointNode): vscode.TreeItem {
        return element.getTreeItem();
    }

    getChildren(element?: BreakpointNode): BreakpointNode[] {
        if (!element) {
            return this.breakpoints.map(breakpoint => new BreakpointEntryNode(breakpoint));
        }
        return element.getChildren();
    }
} 