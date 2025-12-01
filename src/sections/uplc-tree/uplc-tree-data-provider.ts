import * as vscode from 'vscode';
import { 
    MachineState, MachineStateLazy,
    MachineContext, MachineContextLazy, 
    Env, EnvLazy 
} from '../../debugger-types';
import { 
    ContextNode, ContextNodeLazy, 
    EnvNode, EnvNodeLazy, 
    MachineStateNode, MachineStateNodeLazy, 
    UplcNode 
} from './nodes';
import { SessionController } from '../../debugger/session-controller';

export class UplcTreeDataProvider implements vscode.TreeDataProvider<UplcNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<UplcNode | undefined | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<UplcNode | undefined | void> = this._onDidChangeTreeData.event;

    private machineStateLazy: MachineStateLazy | undefined;
    private contextsLazy: MachineContextLazy[] = [];
    private currentEnvLazy: EnvLazy | undefined;
    private useLazyLoading: boolean = false;
    private sessionController: SessionController | undefined;
    private treeView: vscode.TreeView<UplcNode> | undefined;
    private treeGeneration: number = 0; // Increment on each root update

    public static register(context: vscode.ExtensionContext, name: string): UplcTreeDataProvider {
        const provider = new UplcTreeDataProvider();
        provider.treeView = vscode.window.createTreeView(name, { treeDataProvider: provider });
        context.subscriptions.push(provider.treeView);
        return provider;
    }

    setUseLazyLoading(useLazy: boolean) {
        const wasChanged = this.useLazyLoading !== useLazy;
        this.useLazyLoading = useLazy;
        // Recreate tree when switching modes
        if (wasChanged) {
            this.treeGeneration++; // Force VS Code to treat nodes as new
            this._onDidChangeTreeData.fire(undefined); // undefined = refresh all
        }
    }

    setSessionController(sessionController: SessionController | undefined) {
        this.sessionController = sessionController;
    }

    clear() {
        // Completely clear all data - this will create an empty tree
        // All old nodes (including LoadableLazyNode with cache) will be discarded
        this.machineStateLazy = undefined;
        this.contextsLazy = [];
        this.currentEnvLazy = undefined;
        this.sessionController = undefined;
        this.treeGeneration++; // Force VS Code to treat nodes as new
        // Trigger tree recreation - new node instances will start collapsed
        this._onDidChangeTreeData.fire(undefined); // undefined = refresh all
    }

    // Lazy loading setters
    // Important: each call creates NEW root nodes to clear
    // LoadableLazyNode cache from the previous state
    // New node instances will start collapsed (not remembering expansion state)
    setMachineStateLazy(state: MachineStateLazy) {
        // Explicitly overwrite root with new data
        this.machineStateLazy = state;
        this.treeGeneration++; // Force VS Code to treat nodes as new
        // Trigger tree recreation with new root nodes (will start collapsed)
        this._onDidChangeTreeData.fire(undefined); // undefined = refresh all
    }

    setContextsLazy(contexts: MachineContextLazy[]) {
        // Explicitly overwrite root with new data
        this.contextsLazy = contexts;
        this.treeGeneration++; // Force VS Code to treat nodes as new
        // Trigger tree recreation with new root nodes (will start collapsed)
        this._onDidChangeTreeData.fire(undefined); // undefined = refresh all
    }

    setCurrentEnvLazy(env: EnvLazy) {
        // Explicitly overwrite root with new data
        this.currentEnvLazy = env;
        this.treeGeneration++; // Force VS Code to treat nodes as new
        // Trigger tree recreation with new root nodes (will start collapsed)
        this._onDidChangeTreeData.fire(undefined); // undefined = refresh all
    }

    getTreeItem(element: UplcNode): vscode.TreeItem {
        return element.getTreeItem();
    }

    async getChildren(element?: UplcNode): Promise<UplcNode[]> {
        if(!this.sessionController) {
            return [];
        }

        if (!element) {
            // IMPORTANT: Always create NEW root nodes
            // This ensures old nodes with LoadableLazyNode cache are discarded
            const nodes: UplcNode[] = [];
            
            // Always use lazy loading nodes - create new instances
            // Pass SessionController for dynamic lazy loading
            // Use treeGeneration to ensure VS Code treats them as new nodes
                if (this.machineStateLazy) {
                nodes.push(new MachineStateNodeLazy(this.machineStateLazy, this.sessionController, [], 'machineState', this.treeGeneration));
                }
            // Create new ContextNodeLazy for each context
                this.contextsLazy.forEach((c, i) => {
                nodes.push(new ContextNodeLazy(c, `Context ${i}`, [String(i)], 'context', this.sessionController!, this.treeGeneration));
                });
                if (this.currentEnvLazy) {
                nodes.push(new EnvNodeLazy(this.currentEnvLazy, 'Environment', [], 'env', this.sessionController, this.treeGeneration));
            }
            
            return nodes;
        }
        
        // Handle async getChildren for child nodes
        const children = element.getChildren();
        if (children instanceof Promise) {
            return await children;
        }
        return children;
    }
    
    // Command to reload a lazy node with full data
    async reloadLazyNode(node: UplcNode) {
        // This would call the API to load the full data for a lazy node
        // For now, just refresh the tree
        this._onDidChangeTreeData.fire();
    }
}