import * as vscode from 'vscode';
import { TermViewerProvider } from './term-viewer';
import { UplcDataViewer } from './uplc-viewer';
import { PlainTextViewer } from './plain-text-viewer';
import { Term } from '../debugger-types';
import { AnyUplcData } from '../uplc-models/any-uplc';
import { Breakpoint } from '../common';
        
export class TabManager {

    private readonly termViewer: TermViewerProvider;
    private readonly uplcViewer: UplcDataViewer;
    private readonly plainTextViewer: PlainTextViewer;
    
    private constructor(context: vscode.ExtensionContext) {
        this.termViewer = TermViewerProvider.register(context);
        this.uplcViewer = UplcDataViewer.register(context);
        this.plainTextViewer = PlainTextViewer.register(context);
    }

    public static register(context: vscode.ExtensionContext): TabManager {
        const manager = new TabManager(context);
        return manager;
    }
    
    public async openTermInNewTab(term: Term) {
        return await this.termViewer.openTermInNewTab(term);
    }

    public clearBreakpoints() {
        this.termViewer.clearBreakpoints();
    }

    public async openUplcInNewTab(uplc: AnyUplcData, fileName?: string) {
        return await this.uplcViewer.show(uplc, fileName);
    }

    public async openPlainTextInNewTab(content: string, fileName?: string) {
        return await this.plainTextViewer.show(content, fileName);
    }

    public focusOnTerm(termId: number) {
        return this.termViewer.focusOnTerm(termId);
    }

    public highlightDebuggerLine(termId: number) {
        return this.termViewer.highlightDebuggerLine(termId);
    }

    public clearDebuggerHighlight() {
        return this.termViewer.clearDebuggerHighlight();
    }

    public closeAll(): Thenable<unknown> {
        return Promise.all([
            this.termViewer.closeTab(),
            this.uplcViewer.closeAllTabs(),
            this.plainTextViewer.closeAllTabs()
        ]).then(() => true);
    }

    public closeSessionSpecificTabs(): Thenable<unknown> {
        return Promise.all([
            this.uplcViewer.closeAllTabs(),
            this.plainTextViewer.closeAllTabs()
        ]).then(() => true);
    }

    public getBreakpoints(): Breakpoint[] {
        return this.termViewer.getBreakpoints();
    }
}
