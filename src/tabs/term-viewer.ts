import * as vscode from 'vscode';
import JSONBigInt from 'json-bigint';
import { TermWithId, BaseTerm, convertToBaseTerm, ApplyTermWithId, DelayTermWithId, LambdaTermWithId, ForceTermWithId, ConstrTermWithId, CaseTermWithId } from '../uplc-models/term';
import { ExtensionActionEventNames } from '../events/debugger-event-names';
import { Breakpoint } from '../common';

const svgDarkPossible = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="8" r="5" fill="none" stroke="#888" stroke-width="2" /></svg>';
const svgLightPossible = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="8" r="5" fill="none" stroke="#666" stroke-width="2" /></svg>';
const svgDarkActive = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="8" r="5" fill="#e51400" /></svg>';
const svgDarkDisabled = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="8" r="5" fill="#666" /></svg>';
const svgLightActive = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"> <circle cx="10" cy="8" r="5" fill="#d1403f" /></svg>';
const svgLightDisabled = '<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="8" r="5" fill="#999" /></svg>';

interface TermLocation {
    startLine: number;
    endLine: number;
    termId: string;
}

class TermContentProvider implements vscode.TextDocumentContentProvider {
    private contentMap = new Map<string, string>();

    onDidChange?: vscode.Event<vscode.Uri>;

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contentMap.get(uri.toString()) || '';
    }

    updateContent(uri: vscode.Uri, content: string) {
        this.contentMap.set(uri.toString(), content);
    }
}

interface BreakpointInfo {
    termId: string;
    active: boolean;
}

export class TermViewerProvider {
    private contentProvider: TermContentProvider;
    private static readonly scheme = 'term-viewer';
    private readonly _breakpoints = new Map<string, Map<number, BreakpointInfo>>(); // URI -> breakpoints map
    private readonly _termLocations = new Map<string, TermLocation[]>(); // URI -> term locations map
    private _currentEditor: vscode.TextEditor | undefined;
    private _decorationTypes: {
        breakpointPossible: vscode.TextEditorDecorationType;
        breakpointActive: vscode.TextEditorDecorationType;
        breakpointDisabled: vscode.TextEditorDecorationType;
        termHighlight: vscode.TextEditorDecorationType;
        debuggerLine: vscode.TextEditorDecorationType;
    };

    private constructor(private readonly _context: vscode.ExtensionContext) {
        this.contentProvider = new TermContentProvider();
        const dataUriDarkActive = vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svgDarkActive)}`);
        const dataUriLightActive = vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svgLightActive)}`);
        const dataUriDarkPossible = vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svgDarkPossible)}`);
        const dataUriLightPossible = vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svgLightPossible)}`);
        const dataUriDarkDisabled = vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svgDarkDisabled)}`);
        const dataUriLightDisabled = vscode.Uri.parse(`data:image/svg+xml,${encodeURIComponent(svgLightDisabled)}`);

        this._decorationTypes = {
            breakpointPossible: vscode.window.createTextEditorDecorationType({
                dark: { gutterIconPath: dataUriLightPossible },
                light: { gutterIconPath: dataUriLightPossible },
                gutterIconSize: 'auto',
                rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
            }),
            breakpointActive: vscode.window.createTextEditorDecorationType({
                dark: { gutterIconPath: dataUriLightActive },
                light: { gutterIconPath: dataUriLightActive },
                gutterIconSize: 'auto',
                rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
            }),
            breakpointDisabled: vscode.window.createTextEditorDecorationType({
                dark: { gutterIconPath: dataUriDarkDisabled },
                light: { gutterIconPath: dataUriDarkDisabled },
                gutterIconSize: 'auto',
                rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
            }),
            termHighlight: vscode.window.createTextEditorDecorationType({
                backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
                isWholeLine: true
            }),
            debuggerLine: vscode.window.createTextEditorDecorationType({
                backgroundColor: new vscode.ThemeColor('editor.stackFrameHighlightBackground'),
                isWholeLine: true,
                after: {
                    contentText: ' // Debugger is paused here',
                    color: new vscode.ThemeColor('editorLineNumber.activeForeground'),
                    margin: '0 0 0 1em'
                }
            })
        };
    }

    public static register(context: vscode.ExtensionContext): TermViewerProvider {
        const provider = new TermViewerProvider(context);

        context.subscriptions.push(
            vscode.workspace.registerTextDocumentContentProvider(
                TermViewerProvider.scheme,
                provider.contentProvider
            ),
            vscode.commands.registerCommand('termViewer.toggleBreakpoint', async (args?: { lineNumber?: number }) => {
                let line = 0;
                if (args?.lineNumber === undefined) {
                    line = vscode.window.activeTextEditor?.selection.active.line ?? 0;
                } else {
                    line = args.lineNumber - 1;
                }
                if (typeof line === 'number') {
                    provider.toggleBreakpoint(line);
                }
            }),
            vscode.commands.registerCommand('termViewer.setBreakpointState', async (line: number, termId: string, active: boolean) => {
                provider.setBreakpointState(line, termId, active);
            }),
            vscode.commands.registerCommand('termViewer.removeBreakpoint', async (line: number, termId: string) => {
                provider.removeBreakpoint(line, termId);
            })
        );

        context.subscriptions.push(
            vscode.workspace.onDidChangeTextDocument(e => {
                if (e.document.uri.scheme === TermViewerProvider.scheme) {
                    provider.updateAllDecorations();
                }
            }),
            // Add listener for active editor changes
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor && editor.document.uri.scheme === TermViewerProvider.scheme) {
                    provider.setCurrentEditor(editor);
                    provider.updateAllDecorations();
                }
            })
        );

        return provider;
    }

    private setCurrentEditor(editor: vscode.TextEditor) {
        this._currentEditor = editor;
    }

    private getCurrentUriString(): string {
        return this._currentEditor?.document.uri.toString() || '';
    }

    private getCurrentBreakpoints(): Map<number, BreakpointInfo> {
        const uriString = this.getCurrentUriString();
        if (!this._breakpoints.has(uriString)) {
            this._breakpoints.set(uriString, new Map());
        }
        return this._breakpoints.get(uriString)!;
    }

    private getCurrentTermLocations(): TermLocation[] {
        const uriString = this.getCurrentUriString();
        if (!this._termLocations.has(uriString)) {
            this._termLocations.set(uriString, []);
        }
        return this._termLocations.get(uriString)!;
    }

    public getBreakpoints(): Breakpoint[] {
        const result: Breakpoint[] = [];
        // Collect breakpoints from all URIs
        for (const [uriString, breakpointsMap] of this._breakpoints.entries()) {
            for (const [line, info] of breakpointsMap.entries()) {
                result.push({
                    id: info.termId,
                    line: line,
                    active: info.active
                });
            }
        }
        return result;
    }

    public setBreakpointState(line: number, termId: string, active: boolean) {
        const breakpointsMap = this.getCurrentBreakpoints();
        const existingBreakpoint = breakpointsMap.get(line);
        if (existingBreakpoint && existingBreakpoint.termId === termId) {
            if (active) {
                breakpointsMap.set(line, { termId, active: true });
            } else {
                breakpointsMap.set(line, { termId, active: false });
            }
            this.updateAllDecorations();
        }
    }

    public removeBreakpoint(line: number, termId: string) {
        const breakpointsMap = this.getCurrentBreakpoints();
        const existingBreakpoint = breakpointsMap.get(line);
        if (existingBreakpoint && existingBreakpoint.termId === termId) {
            breakpointsMap.delete(line);
            this.updateAllDecorations();
        }
    }

    /**
     * Opens a term in a new tab
     * @param term The term to open in a new tab
     */
    public async openTermInNewTab(term: TermWithId): Promise<void> {
        await this.showTerm(term);
    }

    /**
     * Moves the cursor to a specific term by its ID
     * @param termId The ID of the term to navigate to
     * @returns A boolean indicating whether the term was found and navigated to
     */
    public navigateToTerm(termId: string): boolean {
        // Find the term location by ID in current editor
        const termLocations = this.getCurrentTermLocations();
        const termLocation = termLocations.find(location => location.termId === termId);
        
        if (!termLocation || !this._currentEditor) {
            return false;
        }
        
        // Create a selection at the start of the term
        const position = new vscode.Position(termLocation.startLine, 0);
        this._currentEditor.selection = new vscode.Selection(position, position);
        
        // Reveal the position in the editor
        this._currentEditor.revealRange(
            new vscode.Range(position, position),
            vscode.TextEditorRevealType.InCenter
        );
        
        return true;
    }

    /**
     * Closes the current term viewer tab
     * @returns A boolean indicating whether the tab was successfully closed
     */
    public closeTab(): Thenable<unknown> {
        if (!this._currentEditor) {
            return Promise.resolve(false);
        }
        
        // Get the document URI to close
        const documentUri = this._currentEditor.document.uri;
        
        // Close the specific document
        return vscode.window.tabGroups.close(
            vscode.window.tabGroups.all
                .flatMap(group => group.tabs)
                .filter(tab => tab.input instanceof vscode.TabInputText && tab.input.uri.toString() === documentUri.toString())
        );
    }

    private async showTerm(termWithId: TermWithId) {
        // Generate unique URI for each term
        const uri = vscode.Uri.parse(`${TermViewerProvider.scheme}:Term View - ${termWithId.id}`);
        const uriString = uri.toString();

        // Clear only the locations for this specific URI
        this._termLocations.set(uriString, []);

        // Serialize content with the specific URI
        const content = this.serializeTermToString(termWithId, uriString);
        this.contentProvider.updateContent(uri, content);

        const document = await vscode.workspace.openTextDocument(uri);
        this._currentEditor = await vscode.window.showTextDocument(document, {
            preview: false,
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: false
        });

        vscode.commands.executeCommand('setContext', 'editorHasDecorations', true);
        vscode.commands.executeCommand('setContext', 'debuggersAvailable', true);

        this.updateAllDecorations();
        
        // Notify that breakpoints have been updated
        this.notifyBreakpointUpdate();
    }

    private serializeTermToString(termWithId: TermWithId, uriString: string): string {
        const baseTerm = convertToBaseTerm(termWithId);
        const result = this.processTermWithLocations(baseTerm, termWithId, 0, uriString);
        return result.text;
    }

    private processTermWithLocations(term: BaseTerm, termWithId: TermWithId, startLine: number, uriString: string, visited: Set<string> = new Set()): {
        text: string;
        endLine: number;
    } {
        // Check for circular references
        if (visited.has(termWithId.id)) {
            return {
                text: `[Circular reference to term ${termWithId.id}]`,
                endLine: startLine
            };
        }
        
        visited.add(termWithId.id);
        let currentLine = startLine;

        // Get or create term locations array for this URI
        if (!this._termLocations.has(uriString)) {
            this._termLocations.set(uriString, []);
        }
        const termLocations = this._termLocations.get(uriString)!;
        
        // Temporarily create termLocation that will be updated later
        const termLocationIndex = termLocations.length;
        termLocations.push({
            startLine: currentLine,
            endLine: currentLine, // Will be updated later
            termId: termWithId.id
        });

        let output = '';
        switch (term.term_type) {
            case 'Var':
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}",`,
                    `name: "${term.name}"`
                ].join('\n  ');
                currentLine += 2; // 3 lines, but last line is endLine-1
                break;

            case 'Apply':
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}",`,
                    'function: {'
                ].join('\n  ');
                currentLine += 2; // 3 lines, but last line is endLine-1

                const funcResult = this.processTermWithLocations(term.function, (termWithId as ApplyTermWithId).function, currentLine + 1, uriString, visited);
                output += '\n  ' + funcResult.text.split('\n').join('\n  ');
                currentLine = funcResult.endLine;
                output += '\n  },';
                currentLine += 1;

                output += '\n  argument: {';
                currentLine += 1;
                const argResult = this.processTermWithLocations(term.argument, (termWithId as ApplyTermWithId).argument, currentLine + 1, uriString, visited);
                output += '\n  ' + argResult.text.split('\n').join('\n  ');
                currentLine = argResult.endLine;
                output += '\n  }';
                currentLine += 1;
                break;

            case 'Delay':
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}",`,
                    'term: {'
                ].join('\n  ');
                currentLine += 2;

                const delayTermResult = this.processTermWithLocations(term.term, (termWithId as DelayTermWithId).term, currentLine + 1, uriString, visited);
                output += '\n  ' + delayTermResult.text.split('\n').join('\n  ');
                currentLine = delayTermResult.endLine;
                output += '\n  }';
                currentLine += 1;
                break;

            case 'Lambda':
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}",`,
                    `parameterName: "${term.parameterName}",`,
                    'body: {'
                ].join('\n  ');
                currentLine += 3;

                const bodyResult = this.processTermWithLocations(term.body, (termWithId as LambdaTermWithId).body, currentLine + 1, uriString, visited);
                output += '\n  ' + bodyResult.text.split('\n').join('\n  ');
                currentLine = bodyResult.endLine;
                output += '\n  }';
                currentLine += 1;
                break;

            case 'Force':
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}",`,
                    'term: {'
                ].join('\n  ');
                currentLine += 2;

                const forceTermResult = this.processTermWithLocations(term.term, (termWithId as ForceTermWithId).term, currentLine + 1, uriString, visited);
                output += '\n  ' + forceTermResult.text.split('\n').join('\n  ');
                currentLine = forceTermResult.endLine;
                output += '\n  }';
                currentLine += 1;
                break;

            case 'Constant':
                // Use json-bigint to handle BigInt values
                const JSONBig = JSONBigInt({ storeAsString: true });
                const constantJson = JSONBig.stringify(term.constant, null, 2);
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}",`,
                    `constant: ${constantJson.split('\n').join('\n  ')}`
                ].join('\n  ');
                // Calculate number of lines in JSON
                const constantLines = constantJson.split('\n').length;
                currentLine += 2 + constantLines - 1;
                break;

            case 'Error':
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}"`
                ].join('\n  ');
                currentLine += 1;
                break;

            case 'Builtin':
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}",`,
                    `fun: "${term.fun}"`
                ].join('\n  ');
                currentLine += 2;
                break;

            case 'Constr':
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}",`,
                    `constructorTag: ${term.constructorTag},`,
                    'fields: ['
                ].join('\n  ');
                currentLine += 3;

                const constrTermWithId = termWithId as ConstrTermWithId;
                for (let i = 0; i < constrTermWithId.fields.length; i++) {
                    output += '\n  {';
                    currentLine += 1;
                    const fieldResult = this.processTermWithLocations(term.fields[i], constrTermWithId.fields[i], currentLine + 1, uriString, visited);
                    output += '\n  ' + fieldResult.text.split('\n').join('\n  ');
                    currentLine = fieldResult.endLine;
                    output += '\n  }' + (i < constrTermWithId.fields.length - 1 ? ',' : '');
                    currentLine += 1;
                }
                output += '\n  ]';
                currentLine += 1;
                break;

            case 'Case':
                output = [
                    `term_type: "${term.term_type}",`,
                    `term_name: "${term.term_name}",`,
                    'constr: {'
                ].join('\n  ');
                currentLine += 2;

                const caseTermWithId = termWithId as CaseTermWithId;
                const constrResult = this.processTermWithLocations(term.constr, caseTermWithId.constr, currentLine + 1, uriString, visited);
                output += '\n  ' + constrResult.text.split('\n').join('\n  ');
                currentLine = constrResult.endLine;
                output += '\n  },';
                currentLine += 1;

                output += '\n  branches: [';
                currentLine += 1;
                for (let i = 0; i < caseTermWithId.branches.length; i++) {
                    output += '\n  {';
                    currentLine += 1;
                    const branchResult = this.processTermWithLocations(term.branches[i], caseTermWithId.branches[i], currentLine + 1, uriString, visited);
                    output += '\n  ' + branchResult.text.split('\n').join('\n  ');
                    currentLine = branchResult.endLine;
                    output += '\n  }' + (i < caseTermWithId.branches.length - 1 ? ',' : '');
                    currentLine += 1;
                }
                output += '\n  ]';
                currentLine += 1;
                break;

            default:
                // Exhaustive check - all types should be handled above
                const _exhaustiveCheck: never = term;
                throw new Error(`Unhandled term type: ${JSON.stringify(_exhaustiveCheck)}`);
        }

        // Update endLine for termLocation
        termLocations[termLocationIndex].endLine = currentLine;

        // Remove from visited set to allow same term to be processed in different branches
        visited.delete(termWithId.id);

        return {
            text: output,
            endLine: currentLine
        };
    }

    private toggleBreakpoint(line: number) {
        if (!this._currentEditor) {
            return;
        }

        const termLocations = this.getCurrentTermLocations();
        const breakpointsMap = this.getCurrentBreakpoints();

        // First, check if the line is within any term (accounting for indentation)
        let termLocation = this.findTermAtLine(line, termLocations);
        
        // If no term found at the current line, find the nearest term
        if (!termLocation) {
            termLocation = this.findNearestTerm(line, termLocations);
            if (!termLocation) {
                return; // No terms found
            }
        }

        const breakpointLine = termLocation.startLine;
        const existingBreakpoint = breakpointsMap.get(breakpointLine);
        if (!existingBreakpoint) {
            // No breakpoint -> create active breakpoint
            breakpointsMap.set(breakpointLine, { termId: termLocation.termId, active: true });
        } else {
            // Inactive breakpoint -> remove it
            breakpointsMap.delete(breakpointLine);
        }

        this.updateAllDecorations();
        
        // Notify that breakpoints have been updated
        this.notifyBreakpointUpdate();
    }
    
    private notifyBreakpointUpdate() {
        const breakpoints: Breakpoint[] = this.getBreakpoints();
        vscode.commands.executeCommand(ExtensionActionEventNames.BREAKPOINT_LIST_UPDATED, breakpoints);
    }

    private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent) {
        if (!this._currentEditor || event.textEditor !== this._currentEditor) {
            return;
        }

        const line = event.selections[0].active.line;
        const termLocations = this.getCurrentTermLocations();
        const termLocation = this.findTermAtLine(line, termLocations);

        if (termLocation) {
            this.highlightTerm(termLocation);
        }
    }

    private findTermAtLine(line: number, termLocations: TermLocation[]): TermLocation | undefined {
        // Find all terms that contain the given line
        const containingTerms = termLocations.filter(loc =>
            line >= loc.startLine && line <= loc.endLine
        );
        
        if (containingTerms.length === 0) {
            return undefined;
        }
        
        // Return the most nested term (smallest range)
        return containingTerms.reduce((mostNested, current) => {
            const currentRange = current.endLine - current.startLine;
            const nestedRange = mostNested.endLine - mostNested.startLine;
            return currentRange < nestedRange ? current : mostNested;
        });
    }

    private findNearestTerm(line: number, termLocations: TermLocation[]): TermLocation | undefined {
        if (termLocations.length === 0) {
            return undefined;
        }

        // Find the term with startLine closest to the current line
        return termLocations.reduce((nearest, current) => {
            const currentDistance = Math.abs(current.startLine - line);
            const nearestDistance = Math.abs(nearest.startLine - line);
            return currentDistance < nearestDistance ? current : nearest;
        });
    }

    private updateAllDecorations() {
        if (!this._currentEditor) {
            return;
        }

        const termLocations = this.getCurrentTermLocations();
        const breakpointsMap = this.getCurrentBreakpoints();

        const possibleBreakpoints: vscode.DecorationOptions[] = termLocations
            .filter(loc => !breakpointsMap.has(loc.startLine))
            .map(loc => ({
                range: new vscode.Range(loc.startLine, 0, loc.startLine, 1),
                hoverMessage: 'Right-click to open context menu to toggle breakpoint.'
            }));

        const activeBreakpoints: vscode.DecorationOptions[] = [];
        const disabledBreakpoints: vscode.DecorationOptions[] = [];

        for (const [line, breakpointInfo] of breakpointsMap.entries()) {
            const decoration = {
                range: new vscode.Range(line, 0, line, 1),
                hoverMessage: `${breakpointInfo.active ? 'Active' : 'Inactive'} breakpoint for term ${breakpointInfo.termId}`
            };

            if (breakpointInfo.active) {
                activeBreakpoints.push(decoration);
            } else {
                disabledBreakpoints.push(decoration);
            }
        }

        this._currentEditor.setDecorations(this._decorationTypes.breakpointPossible, possibleBreakpoints);
        this._currentEditor.setDecorations(this._decorationTypes.breakpointActive, activeBreakpoints);
        this._currentEditor.setDecorations(this._decorationTypes.breakpointDisabled, disabledBreakpoints);

        const breakpointLines = termLocations.map(loc => loc.startLine + 1);
        vscode.commands.executeCommand('setContext', 'termViewer.possibleBreakpointLines', breakpointLines);
    }

    private highlightTerm(location: TermLocation) {
        if (!this._currentEditor) {
            return;
        }

        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(
                location.startLine,
                0,
                location.endLine,
                Number.MAX_VALUE
            )
        };

        this._currentEditor.setDecorations(
            this._decorationTypes.termHighlight,
            [decoration]
        );
    }

    public highlightDebuggerLine(termId: string): boolean {
        if (!this._currentEditor) {
            return false;
        }

        this._currentEditor.setDecorations(this._decorationTypes.debuggerLine, []);

        const termLocations = this.getCurrentTermLocations();
        const termLocation = termLocations.find(loc => loc.termId === termId);
        if (!termLocation) {
            return false;
        }

        const decoration: vscode.DecorationOptions = {
            range: new vscode.Range(
                termLocation.startLine,
                0,
                termLocation.startLine,
                Number.MAX_VALUE
            )
        };

        this._currentEditor.setDecorations(this._decorationTypes.debuggerLine, [decoration]);

        this._currentEditor.revealRange(
            new vscode.Range(termLocation.startLine, 0, termLocation.startLine, 0),
            vscode.TextEditorRevealType.InCenter
        );

        return true;
    }

    public clearDebuggerHighlight(): void {
        if (this._currentEditor) {
            this._currentEditor.setDecorations(this._decorationTypes.debuggerLine, []);
        }
    }

    public async focusOnTerm(termId: string): Promise<boolean> {
        if (!this._currentEditor) {
            return false;
        }

        const termLocations = this.getCurrentTermLocations();
        const termLocation = termLocations.find(loc => loc.termId === termId);
        if (!termLocation) {
            return false;
        }

        const selection = new vscode.Selection(
            termLocation.startLine,
            0,
            termLocation.endLine,
            this._currentEditor.document.lineAt(termLocation.endLine).text.length
        );

        this._currentEditor.selection = selection;
        this._currentEditor.revealRange(
            selection,
            vscode.TextEditorRevealType.InCenter
        );

        this.highlightTerm(termLocation);
        return true;
    }

    public clearHighlights(): void {
        if (this._currentEditor) {
            this._currentEditor.setDecorations(this._decorationTypes.termHighlight, []);
            this._currentEditor.setDecorations(this._decorationTypes.debuggerLine, []);
            this._currentEditor.setDecorations(this._decorationTypes.breakpointDisabled, []);
        }
    }

    public dispose() {
        this._decorationTypes.breakpointPossible.dispose();
        this._decorationTypes.breakpointActive.dispose();
        this._decorationTypes.breakpointDisabled.dispose();
        this._decorationTypes.termHighlight.dispose();
        this._decorationTypes.debuggerLine.dispose();
    }
}