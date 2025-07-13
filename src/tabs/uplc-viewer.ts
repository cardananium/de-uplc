import * as vscode from 'vscode';
import JSONBig from 'json-bigint';
import { createHash } from 'crypto';
import { AnyUplcData } from '../uplc-models/any-uplc';

class UplcDataViewerContentProvider implements vscode.TextDocumentContentProvider {
    private contentMap = new Map<string, string>();

    onDidChange?: vscode.Event<vscode.Uri>;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contentMap.get(uri.toString()) || '';
    }

    updateContent(uri: vscode.Uri, content: string) {
        this.contentMap.set(uri.toString(), content);
    }

    public clear() {
        this.contentMap.clear();
    }

    getUris(): string[] {
        return Array.from(this.contentMap.keys());
    }
}

export class UplcDataViewer {
    private contentProvider: UplcDataViewerContentProvider;
    private static readonly scheme = 'uplc-data-viewer';

    public static register(context: vscode.ExtensionContext): UplcDataViewer {
        const viewer = new UplcDataViewer(context);
        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider(
                UplcDataViewer.scheme,
                viewer.contentProvider
            ),
            vscode.workspace.onDidOpenTextDocument(doc => {
                if (doc.uri.scheme === UplcDataViewer.scheme) {
                    vscode.languages.setTextDocumentLanguage(doc, 'plutus-types-json');
                }
            })
        );
        return viewer;
    }

    private constructor(private readonly _context: vscode.ExtensionContext) {
        this.contentProvider = new UplcDataViewerContentProvider();
    }

    public async show(item: AnyUplcData, fileName?: string) {
        let content = JSONBig.stringify(item, null, 2);
        
        // Remove quotes from field names to make JSON more readable
        // Transform "fieldName": to fieldName:
        content = content.replace(/"([^"]+)":/g, '$1:');
        
        const displayName = fileName || createHash('sha256').update(content).digest('hex');
        const uri = vscode.Uri.parse(`${UplcDataViewer.scheme}:${displayName}`);

        // Update content provider with the formatted JSON
        this.contentProvider.updateContent(uri, content);

        await vscode.window.showTextDocument(uri, {
            preview: false,
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: false
        });
    }

    public closeAllTabs(): Thenable<unknown> {
        const uris = new Set(this.contentProvider.getUris());
        return vscode.window.tabGroups.close(
            vscode.window.tabGroups.all
                .flatMap(group => group.tabs)
                .filter(tab => tab.input instanceof vscode.TabInputText
                    && uris.has(tab.input.uri.toString())));
    }
}