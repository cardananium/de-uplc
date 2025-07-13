import * as vscode from 'vscode';
import { MachineState } from '../../uplc-models/machine-state';
import { Context } from '../../uplc-models/context';
import { ContextNode, EnvNode, MachineStateNode, UplcNode } from './nodes';
import { Env } from '../../uplc-models/value';

export class UplcTreeDataProvider implements vscode.TreeDataProvider<UplcNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<UplcNode | undefined | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<UplcNode | undefined | void> = this._onDidChangeTreeData.event;

    private machineState: MachineState | undefined;
    private contexts: Context[] = [];
    private currentEnv: Env | undefined;

    public static register(context: vscode.ExtensionContext, name: string): UplcTreeDataProvider {
        const provider = new UplcTreeDataProvider();
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider(name, provider)
        );
        return provider;
    }

    clear() {
        this.machineState = undefined;
        this.contexts = [];
        this.currentEnv = undefined;
        this._onDidChangeTreeData.fire();
    }

    setMachineState(state: MachineState) {
        this.machineState = state;
        this._onDidChangeTreeData.fire();
    }

    setContexts(contexts: Context[]) {
        this.contexts = contexts;
        this._onDidChangeTreeData.fire();
    }

    setCurrentEnv(env: Env) {
        this.currentEnv = env;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: UplcNode): vscode.TreeItem {
        return element.getTreeItem();
    }

    getChildren(element?: UplcNode): UplcNode[] {
        if (!element) {
            const nodes: UplcNode[] = [];
            if (this.machineState) {
                nodes.push(new MachineStateNode(this.machineState));
            }
            this.contexts.forEach((c, i) => {
                nodes.push(new ContextNode(c, `Context ${i}`));
            });
            if (this.currentEnv) {
                nodes.push(new EnvNode(this.currentEnv));
            }
            return nodes;
        }
        return element.getChildren();
    }
}