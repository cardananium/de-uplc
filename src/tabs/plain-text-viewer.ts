import * as vscode from 'vscode';
import { createHash } from 'crypto';

class PlainTextViewerContentProvider implements vscode.TextDocumentContentProvider {
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

export class PlainTextViewer {
    private contentProvider: PlainTextViewerContentProvider;
    private static readonly scheme = 'plain-text-viewer';

    public static register(context: vscode.ExtensionContext): PlainTextViewer {
        const viewer = new PlainTextViewer(context);
        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider(
                PlainTextViewer.scheme,
                viewer.contentProvider
            ),
            vscode.workspace.onDidOpenTextDocument(doc => {
                if (doc.uri.scheme === PlainTextViewer.scheme) {
                    vscode.languages.setTextDocumentLanguage(doc, 'plaintext');
                }
            })
        );
        return viewer;
    }

    private constructor(private readonly _context: vscode.ExtensionContext) {
        this.contentProvider = new PlainTextViewerContentProvider();
    }

    public async show(content: string, fileName?: string) {
        const displayName = fileName || createHash('sha256').update(content).digest('hex');
        const uri = vscode.Uri.parse(`${PlainTextViewer.scheme}:${displayName}`);

        // Update content provider with the plain text content
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