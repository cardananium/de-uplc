import * as vscode from 'vscode';

export interface LogNode {
    getTreeItem(): vscode.TreeItem;
    getChildren(): LogNode[];
}

export class LogEntryNode implements LogNode {
    constructor(private logMessage: string, private index: number) {}
    
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(`${this.index + 1}. ${this.logMessage}`, vscode.TreeItemCollapsibleState.None);
        // item.iconPath = new vscode.ThemeIcon('symbol-text');
        item.tooltip = this.logMessage;
        item.contextValue = 'logEntry';
        return item;
    }
    
    getChildren(): LogNode[] {
        return [];
    }

    // Getter to access log message for extraction
    getLogMessage(): string {
        return this.logMessage;
    }

    getIndex(): number {
        return this.index;
    }
}

export class LogsTreeDataProvider implements vscode.TreeDataProvider<LogNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<LogNode | undefined | void> = new vscode.EventEmitter();
    readonly onDidChangeTreeData: vscode.Event<LogNode | undefined | void> = this._onDidChangeTreeData.event;

    private logs: string[] = [];

    public static register(context: vscode.ExtensionContext, name: string): LogsTreeDataProvider {
        const provider = new LogsTreeDataProvider();
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider(name, provider)
        );
        return provider;
    }

    clear() {
        this.logs = [];
        this._onDidChangeTreeData.fire();
    }

    setLogs(logs: string[]) {
        this.logs = logs;
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: LogNode): vscode.TreeItem {
        return element.getTreeItem();
    }

    getChildren(element?: LogNode): LogNode[] {
        if (!element) {
            return this.logs.map((log, index) => new LogEntryNode(log, index));
        }
        return element.getChildren();
    }
} 