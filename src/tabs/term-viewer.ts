import * as vscode from 'vscode';
import JSONBigInt from 'json-bigint';
import { Constant, Term, Type } from '../debugger-types';
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
    termId:  number;
}

interface ConstantData {
    type: string;
    value: any;
}

// Specific types for structured constants
interface ProtoListData {
    elementType: Type;
    values: Constant[];
}

interface ProtoPairData {
    first_type: Type;
    second_type: Type;
    first_element: Constant;
    second_element: Constant;
}

type StructuredConstantData = ProtoListData | ProtoPairData;

export type HintKind = 
    | 'term'             // term type indicators (Apply, Lambda, etc.)
    | 'name'             // term names
    | 'constant_type'    // constant type indicators (Integer, String, etc.)
    | 'builtin_function'; // builtin function names

interface TermHintInfo {
    line: number;
    character: number;
    text: string;
    kind: HintKind;
}

class TermInlayHintsProvider implements vscode.InlayHintsProvider {
    private _hintsMap = new Map<string, TermHintInfo[]>(); // URI -> hints map
    private _activeHintKinds = new Set<HintKind>([
        'term',
        'name',
        'constant_type',
        'builtin_function'
    ]); // Default active hint kinds
    private _onDidChangeInlayHints = new vscode.EventEmitter<void>();
    private _configChangeDisposable: vscode.Disposable;

    onDidChangeInlayHints = this._onDidChangeInlayHints.event;

    constructor() {
        // Listen for configuration changes
        this._configChangeDisposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('deuplc.enableInlayHints')) {
                this._onDidChangeInlayHints.fire();
            }
        });
    }

    provideInlayHints(document: vscode.TextDocument, range: vscode.Range, token: vscode.CancellationToken): vscode.InlayHint[] {
        // Check if inlay hints are globally enabled
        const config = vscode.workspace.getConfiguration('deuplc');
        const enableInlayHints = config.get<boolean>('enableInlayHints', true);
        
        if (!enableInlayHints) {
            return [];
        }

        const hints = this._hintsMap.get(document.uri.toString()) || [];
        
        return hints
            .filter(hint => 
                range.contains(new vscode.Position(hint.line, hint.character)) &&
                this._activeHintKinds.has(hint.kind)
            )
            .map(hint => {
                const position = new vscode.Position(hint.line, hint.character);
                const inlayHint = new vscode.InlayHint(position, hint.text);
                inlayHint.kind = this.mapToVSCodeHintKind(hint.kind);
                inlayHint.paddingLeft = false;
                inlayHint.paddingRight = true;
                return inlayHint;
            });
    }

    private mapToVSCodeHintKind(kind: HintKind): vscode.InlayHintKind {
        switch (kind) {
            case 'term':
            case 'constant_type':
                return vscode.InlayHintKind.Type;
            case 'name':
            case 'builtin_function':
                return vscode.InlayHintKind.Parameter;
            default:
                return vscode.InlayHintKind.Parameter;
        }
    }

    enableHintKind(kind: HintKind) {
        this._activeHintKinds.add(kind);
        this._onDidChangeInlayHints.fire();
    }

    disableHintKind(kind: HintKind) {
        this._activeHintKinds.delete(kind);
        this._onDidChangeInlayHints.fire();
    }

    toggleHintKind(kind: HintKind) {
        if (this._activeHintKinds.has(kind)) {
            this.disableHintKind(kind);
        } else {
            this.enableHintKind(kind);
        }
    }

    setActiveHintKinds(kinds: Set<HintKind>) {
        this._activeHintKinds = new Set(kinds);
        this._onDidChangeInlayHints.fire();
    }

    getActiveHintKinds(): Set<HintKind> {
        return new Set(this._activeHintKinds);
    }

    isHintKindActive(kind: HintKind): boolean {
        return this._activeHintKinds.has(kind);
    }

    isInlayHintsEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('deuplc');
        return config.get<boolean>('enableInlayHints', true);
    }

    updateHints(uri: vscode.Uri, hints: TermHintInfo[]) {
        this._hintsMap.set(uri.toString(), hints);
    }

    clearHints(uri: vscode.Uri) {
        this._hintsMap.delete(uri.toString());
    }

    dispose() {
        this._onDidChangeInlayHints.dispose();
        this._configChangeDisposable.dispose();
    }
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
    termId: number;
    active: boolean;
}

export class TermViewerProvider {
    private contentProvider: TermContentProvider;
    private inlayHintsProvider: TermInlayHintsProvider;
    private static readonly scheme = 'term-viewer';
    private readonly _breakpoints = new Map<string, Map<number, BreakpointInfo>>(); // URI -> breakpoints map
    private readonly _termLocations = new Map<string, TermLocation[]>(); // URI -> term locations map
    private readonly _termHints = new Map<string, TermHintInfo[]>(); // URI -> term hints map
    private _currentEditor: vscode.TextEditor | undefined;
    private _currentDebuggerTermId: number | undefined;
    private _decorationTypes: {
        breakpointPossible: vscode.TextEditorDecorationType;
        breakpointActive: vscode.TextEditorDecorationType;
        breakpointDisabled: vscode.TextEditorDecorationType;
        termHighlight: vscode.TextEditorDecorationType;
        debuggerLine: vscode.TextEditorDecorationType;
    };

    private constructor(private readonly _context: vscode.ExtensionContext) {
        this.contentProvider = new TermContentProvider();
        this.inlayHintsProvider = new TermInlayHintsProvider();
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
            vscode.languages.registerInlayHintsProvider(
                { scheme: TermViewerProvider.scheme },
                provider.inlayHintsProvider
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
            vscode.commands.registerCommand('termViewer.setBreakpointState', async (line: number, termId: number, active: boolean) => {
                provider.setBreakpointState(line, termId, active);
            }),
            vscode.commands.registerCommand('termViewer.removeBreakpoint', async (line: number, termId: number) => {
                provider.removeBreakpoint(line, termId);
            }),
            vscode.commands.registerCommand('termViewer.toggleHintKind', async (kind: HintKind) => {
                provider.inlayHintsProvider.toggleHintKind(kind);
            }),
            vscode.commands.registerCommand('termViewer.enableHintKind', async (kind: HintKind) => {
                provider.inlayHintsProvider.enableHintKind(kind);
            }),
            vscode.commands.registerCommand('termViewer.disableHintKind', async (kind: HintKind) => {
                provider.inlayHintsProvider.disableHintKind(kind);
            }),
            vscode.commands.registerCommand('termViewer.setActiveHintKinds', async (kinds: HintKind[]) => {
                provider.inlayHintsProvider.setActiveHintKinds(new Set(kinds));
            }),
            vscode.commands.registerCommand('termViewer.toggleInlayHints', async () => {
                const config = vscode.workspace.getConfiguration('deuplc');
                const currentValue = config.get<boolean>('enableInlayHints', true);
                await config.update('enableInlayHints', !currentValue, vscode.ConfigurationTarget.Global);
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
                    provider.restoreDebuggerHighlight();
                }
            })
        );

        return provider;
    }

    public clearBreakpoints() {
        this._breakpoints.clear();
        this.updateAllDecorations();
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

    public setBreakpointState(line: number, termId: number, active: boolean) {
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

    public removeBreakpoint(line: number, termId: number) {
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
    public async openTermInNewTab(term: Term): Promise<void> {
        await this.showTerm(term);
    }

    /**
     * Moves the cursor to a specific term by its ID
     * @param termId The ID of the term to navigate to
     * @returns A boolean indicating whether the term was found and navigated to
     */
    public navigateToTerm(termId: number): boolean {
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

    private async showTerm(termWithId: Term) {
        // Generate unique URI for each term
        const uri = vscode.Uri.parse(`${TermViewerProvider.scheme}:Term View - ${termWithId.id}`);
        const uriString = uri.toString();

        // Clear only the locations and hints for this specific URI
        this._termLocations.set(uriString, []);
        this._termHints.set(uriString, []);

        // Serialize content with the specific URI
        const content = this.serializeTermToString(termWithId, uriString);
        this.contentProvider.updateContent(uri, content);

        // Activate the term document with proper settings
        this._currentEditor = await this.activateTermDocument(uri);

        // Update hints in the inlay hints provider
        const hints = this._termHints.get(uriString) || [];
        this.inlayHintsProvider.updateHints(uri, hints);

        vscode.commands.executeCommand('setContext', 'editorHasDecorations', true);
        vscode.commands.executeCommand('setContext', 'debuggersAvailable', true);

        this.updateAllDecorations();
        this.restoreDebuggerHighlight();
        
        // Notify that breakpoints have been updated
        this.notifyBreakpointUpdate();
    }

    private serializeTermToString(term: Term, uriString: string): string {
        const result = this.processTermWithLocations(term, 0, uriString, new Set(), 0, true, '');
        return result.text;
    }

    private createTermHints(uriString: string, line: number, termType: string, termId: number, prefixLength: number, termText: string = ''): void {
        if (!this._termHints.has(uriString)) {
            this._termHints.set(uriString, []);
        }
        const hints = this._termHints.get(uriString)!;
        
        const shortTermType = this.getShortTermType(termType);
        // Calculate exact position based on actual line content
        let startPos = prefixLength; 
        if (startPos < 0) {
            startPos = 0;
        }
        
        // "term:" hint at the beginning of the term type
        hints.push({
            line: line,
            character: startPos,
            text: `term:`,
            kind: 'term'
        });
        
        // "id:" hint - calculate position based on term text
        // Find position before opening brace or at end of line
        let idPos = prefixLength + termText.length;
        const braceIndex = termText.indexOf(' {');
        if (braceIndex !== -1) {
            idPos = prefixLength + braceIndex;
        } else if (termText.endsWith(',')) {
            idPos = prefixLength + termText.length - 1;
        }
        
        hints.push({
            line: line,
            character: idPos,
            text: ` id:${termId}`,
            kind: 'name'
        });
    }

    private createBuiltinHints(uriString: string, line: number, termType: string, termId: number, functionName: string, prefixLength: number): void {
        if (!this._termHints.has(uriString)) {
            this._termHints.set(uriString, []);
        }
        const hints = this._termHints.get(uriString)!;
        
        // Calculate exact position based on actual line content
        const startPos = prefixLength;
        
        // "term:" hint at the beginning
        hints.push({
            line: line,
            character: startPos,
            text: `term:`,
            kind: 'term'
        });
        
        // "fn:" hint after the term type
        const shortTermType = this.getShortTermType(termType);
        const fnHintPos = startPos + shortTermType.length + 1; // +1 for space after term type
        hints.push({
            line: line,
            character: fnHintPos,
            text: `fn:`,
            kind: 'builtin_function'
        });
        
        // "id:" hint at the end of line
        const fullText = `${shortTermType} ${functionName}`;
        hints.push({
            line: line,
            character: prefixLength + fullText.length,
            text: ` id:${termId}`,
            kind: 'name'
        });
    }

    private createConstantHints(uriString: string, line: number, termType: string, termId: number, constantType: string, prefixLength: number, termText: string = ''): void {
        if (!this._termHints.has(uriString)) {
            this._termHints.set(uriString, []);
        }
        const hints = this._termHints.get(uriString)!;
        
        // Calculate exact position based on actual line content
        const startPos = prefixLength;
        
        // "term:" hint at the beginning
        hints.push({
            line: line,
            character: startPos,
            text: `term:`,
            kind: 'term'
        });
        
        // "type:" hint after "Const "
        const shortTermType = this.getShortTermType(termType);
        const typeHintPos = startPos + shortTermType.length + 1; // +1 for space after "Const"
        hints.push({
            line: line,
            character: typeHintPos,
            text: `type:`,
            kind: 'constant_type'
        });
        
        // "id:" hint - calculate position based on term text
        // Find position before opening brace or at end of line
        let idPos = prefixLength + termText.length;
        const braceIndex = termText.indexOf(' {');
        if (braceIndex !== -1) {
            idPos = prefixLength + braceIndex;
        } else if (termText.endsWith(',')) {
            idPos = prefixLength + termText.length - 1;
        }
        
        hints.push({
            line: line,
            character: idPos,
            text: ` id:${termId}`,
            kind: 'name'
        });
    }

    private parseConstantData(constant: Constant): ConstantData {
        switch (constant.type) {
            case 'Integer':
            case 'ByteString':
            case 'String':
            case 'Bool':
                return {
                    type: constant.type,
                    value: constant.value
                };
            
            case 'Unit':
                return {
                    type: constant.type,
                    value: undefined
                };
            
            case 'ProtoList':
                return {
                    type: constant.type,
                    value: {
                        elementType: constant.elementType,
                        values: constant.values
                    }
                };
            
            case 'ProtoPair':
                return {
                    type: constant.type,
                    value: {
                        first_type: constant.first_type,
                        second_type: constant.second_type,
                        first_element: constant.first_element,
                        second_element: constant.second_element
                    }
                };
            
            case 'Data':
                return {
                    type: constant.type,
                    value: constant.data
                };
            
            case 'Bls12_381G1Element':
            case 'Bls12_381G2Element':
                return {
                    type: constant.type,
                    value: constant.serialized
                };
            
            case 'Bls12_381MlResult':
                return {
                    type: constant.type,
                    value: constant.bytes
                };
            
            default:
                // This should never happen with proper typing
                const _exhaustiveCheck: never = constant;
                throw new Error(`Unknown constant type: ${JSON.stringify(_exhaustiveCheck)}`);
        }
    }
        
    private shouldUseInlineFormat(type: string): boolean {
        // Types that should use inline format (simple types)
        const inlineTypes = ['Bool', 'Integer', 'String', 'ByteString', 'UsignedInteger', 'Unit'];
        
        // Types that should use multiline format (complex types)
        // Note: 'List' is the same as 'ProtoList', 'Pair' is the same as 'ProtoPair'
        const multilineTypes = ['Data', 'Bls12_381G1Element', 'Bls12_381G2Element', 'Bls12_381MlResult', 'ProtoList', 'ProtoPair', 'List', 'Pair'];
        
        // If explicitly marked as multiline, use multiline format
        if (multilineTypes.includes(type)) {
            return false;
        }
        
        // Otherwise use inline format for simple types
        return inlineTypes.includes(type);
    }

    private formatConstantValue(value: ConstantData['value']): string {
        if (typeof value === 'string') {
            return `"${value}"`;
        } else if (typeof value === 'number') {
            return String(value);
        } else if (typeof value === 'boolean') {
            return String(value);
        } else if (typeof value === 'bigint') {
            return String(value);
        } else if (value === null) {
            return 'null';
        } else if (value === undefined) {
            return 'undefined';
        } else if (Array.isArray(value)) {
            // For arrays, format as JSON array
            const formattedItems = value.map(item => this.formatConstantValue(item));
            return `[${formattedItems.join(', ')}]`;
        } else if (typeof value === 'object') {
            // For complex objects, check if it's a simple key-value object
            const keys = Object.keys(value);
            if (keys.length === 1 && keys[0] === 'value') {
                // Simple wrapper object, unwrap it
                return this.formatConstantValue(value.value);
            } else if (keys.length <= 3) {
                // For small objects, format inline
                const pairs = keys.map(key => `${key}: ${this.formatConstantValue(value[key])}`);
                return `{${pairs.join(', ')}}`;
            } else {
                // For complex objects, use JSON representation
                try {
                    return JSONBigInt({ storeAsString: true }).stringify(value);
                } catch (e) {
                    return String(value);
                }
            }
        }
        return String(value);
    }

    private renderNestedConstant(type: string, value: Constant, currentLine: number, uriString: string, indentLevel: number): { text: string; endLine: number } {
        let output = '';
        let line = currentLine;
        
        // Parse the constant data first to get consistent type and value
        const constantData = this.parseConstantData(value);
        const actualType = constantData.type;
        const actualValue = constantData.value;
        
        // Handle structured types (ProtoList, ProtoPair and their aliases)
        if (actualType === 'ProtoList' || actualType === 'List' || actualType === 'ProtoPair' || actualType === 'Pair') {
            const standardType = (actualType === 'List') ? 'ProtoList' : (actualType === 'Pair') ? 'ProtoPair' : actualType;
            return this.renderStructuredType(standardType, actualValue, line, uriString, indentLevel, true);
        }
        
        // Handle Data type with special formatting
        if (actualType === 'Data') {
            const dataJson = JSONBigInt({ storeAsString: true }).stringify(actualValue, null, 2);
            const jsonLines = dataJson.split('\n');
            
            if (jsonLines.length > 2 && jsonLines[0] === '{' && jsonLines[jsonLines.length - 1] === '}') {
                // Remove outer braces and adjust indentation
                const contentLines = jsonLines.slice(1, -1).map(line => line.startsWith('  ') ? line.slice(2) : line);
                output = [
                    `${actualType} {`,
                    contentLines.map(line => `  ${line}`).join('\n'),
                    '}'
                ].join('\n');
                line += 1 + contentLines.length + 1; // +1 for the closing brace
            } else {
                output = `${actualType} ${dataJson}`;
                line += 1;
            }
            return { text: output, endLine: line };
        }
        
        // Handle other complex types with JSON representation
        const constantJson = JSONBigInt({ storeAsString: true }).stringify(actualValue, null, 2);
        const jsonLines = constantJson.split('\n');
        
        if (jsonLines.length > 2 && jsonLines[0] === '{' && jsonLines[jsonLines.length - 1] === '}') {
            // Remove outer braces and adjust indentation
            const contentLines = jsonLines.slice(1, -1).map(line => line.startsWith('  ') ? line.slice(2) : line);
            output = [
                `${actualType} {`,
                contentLines.map(line => `  ${line}`).join('\n'),
                '}'
            ].join('\n');
            line += 1 + contentLines.length + 1; // +1 for the closing brace
        } else {
            output = `${actualType} ${constantJson}`;
            line += 1;
        }
        
        return { text: output, endLine: line };
    }

    private renderStructuredType(type: string, value: StructuredConstantData, currentLine: number, uriString: string, indentLevel: number, nestedConsts: boolean = false): { text: string; endLine: number } {
        let output = '';
        let line = currentLine;

        if (type === 'ProtoList') {
            const protoListValue = value as ProtoListData;
            
            // ProtoList structure: elementType + values array
            if (nestedConsts) {
                output = `${type} {`;
            } else {
                output = `${this.getShortTermType('Constant')} ${type} {`;
            }
            line += 1; // Account for the header line
            
            // elementType field
            output += '\n  elementType: ';
            line += 1;
            const elementTypeStr = this.formatType(protoListValue.elementType);
            
            output += elementTypeStr;
            output += ',';
            
            // values array
            output += '\n  values: [';
            line += 1;
            
            if (protoListValue.values && Array.isArray(protoListValue.values)) {
                for (let i = 0; i < protoListValue.values.length; i++) {
                    output += '\n    ';
                    line += 1;
                    
                    // Check if element should be formatted inline or as complex type
                    if (this.shouldUseInlineFormat(elementTypeStr)) {
                        const valueData = this.parseConstantData(protoListValue.values[i]);
                        output += this.formatConstantValue(valueData.value);
                    } else {
                        // Recursively process complex constants
                        const nestedResult = this.renderNestedConstant(elementTypeStr, protoListValue.values[i], line, uriString, indentLevel + 2);
                        // For multiline nested constants, we need to indent properly
                        const nestedLines = nestedResult.text.split('\n');
                        if (nestedLines.length > 1) {
                            output += nestedLines[0];
                            output += nestedLines.slice(1).map(line => '\n    ' + line).join('');
                        } else {
                            output += nestedResult.text;
                        }
                        // The last line is at nestedResult.endLine - 1
                        line = nestedResult.endLine - 1;
                    }
                    
                    if (i < protoListValue.values.length - 1) {
                        output += ',';
                    }
                }
            }
            
            output += '\n  ]';
            line += 1;
            output += '\n}';
            line += 1;
            
        } else if (type === 'ProtoPair') {
            const protoPairValue = value as ProtoPairData;
            
            // ProtoPair structure: first_type + second_type + first_element + second_element
            if (nestedConsts) {
                output = `${type} {`;
            } else {
                output = `${this.getShortTermType('Constant')} ${type} {`;
            }
            line += 1; // Account for the header line
            
            // first_type field
            output += '\n  first_type: ';
            line += 1;
            const firstTypeStr = this.formatType(protoPairValue.first_type);
            
            output += firstTypeStr;
            output += ',';
            
            // second_type field
            output += '\n  second_type: ';
            line += 1;
            const secondTypeStr = this.formatType(protoPairValue.second_type);
            
            output += secondTypeStr;
            output += ',';
            
            // first_element field
            output += '\n  first_element: ';
            line += 1;
            
            if (this.shouldUseInlineFormat(firstTypeStr)) {
                const firstElementData = this.parseConstantData(protoPairValue.first_element);
                output += this.formatConstantValue(firstElementData.value);
            } else {
                // Recursively process complex constants
                const nestedResult = this.renderNestedConstant(firstTypeStr, protoPairValue.first_element, line, uriString, indentLevel + 1);
                // For multiline nested constants, we need to indent properly
                const nestedLines = nestedResult.text.split('\n');
                if (nestedLines.length > 1) {
                    output += nestedLines[0];
                    output += nestedLines.slice(1).map(line => '\n  ' + line).join('');
                } else {
                    output += nestedResult.text;
                }
                // The last line is at nestedResult.endLine - 1
                line = nestedResult.endLine - 1;
            }
            output += ',';
            
            // second_element field
            output += '\n  second_element: ';
            line += 1;
            
            if (this.shouldUseInlineFormat(secondTypeStr)) {
                const secondElementData = this.parseConstantData(protoPairValue.second_element);
                output += this.formatConstantValue(secondElementData.value);
            } else {
                // Recursively process complex constants
                const nestedResult = this.renderNestedConstant(secondTypeStr, protoPairValue.second_element, line, uriString, indentLevel + 1);
                // For multiline nested constants, we need to indent properly
                const nestedLines = nestedResult.text.split('\n');
                if (nestedLines.length > 1) {
                    output += nestedLines[0];
                    output += nestedLines.slice(1).map(line => '\n  ' + line).join('');
                } else {
                    output += nestedResult.text;
                }
                // The last line is at nestedResult.endLine - 1
                line = nestedResult.endLine - 1;
            }
            
            output += '\n}';
            line += 1;
        }
        
        return { text: output, endLine: line };
    }



    private formatType(type: Type | string): string {
        if (typeof type === 'string') {
            return type;
        } else if (typeof type === 'object' && type !== null) {
            if (type.type) {
                return type.type;
            } else {
                return JSONBigInt({ storeAsString: true }).stringify(type);
            }
        }
        return String(type);
    }

    private getShortTermType(termType: string): string {
        switch (termType) {
            case 'Lambda':
                return 'λ';
            case 'Constant':
                return 'Const';
            case 'Builtin':
                return 'Built-in';
            case 'Error':
                return '⚠️ Error';
            default:
                return termType;
        }
    }

    private processTermWithLocations(term: Term, startLine: number, uriString: string, visited: Set<string | number> = new Set(), indentLevel: number = 0, shouldCreateHints: boolean = true, prefix: string = ''): {
        text: string;
        endLine: number;
    } {
        // Check for circular references
        if (visited.has(term.id)) {
            return {
                text: `[Circular reference to term ${term.id}]`,
                endLine: startLine
            };
        }
        
        visited.add(term.id);
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
            termId: term.id
        });

        let output = '';
        switch (term.term_type) {
            case 'Var':
                output = `${this.getShortTermType(term.term_type)} ${term.name}`;
                if (shouldCreateHints) {
                    // For root terms use indentLevel, for nested terms use prefix length
                    const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                    this.createTermHints(uriString, currentLine, term.term_type, term.id, prefixLength, output);
                }
                currentLine += 1;
                break;

            case 'Apply':
                output = `${this.getShortTermType(term.term_type)} {`;
                if (shouldCreateHints) {
                    // For root terms use indentLevel, for nested terms use prefix length
                    const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                    this.createTermHints(uriString, currentLine, term.term_type, term.id, prefixLength, output);
                }
                currentLine += 1; // Apply { line
                
                output += '\n  fun: ';
                const funcStartLine = currentLine;
                currentLine += 1; // fun: line - this is where the nested term starts
                const funcPrefix = '  '.repeat(indentLevel + 1) + 'fun: ';
                const funcResult = this.processTermWithLocations(term.function, funcStartLine, uriString, visited, indentLevel + 1, true, funcPrefix);
                // When adding indentation, the first line stays on the same line as "fun: "
                const funcLines = funcResult.text.split('\n');
                if (funcLines.length > 1) {
                    output += funcLines[0];
                    output += funcLines.slice(1).map(line => '\n  ' + line).join('');
                } else {
                    output += funcResult.text;
                }
                currentLine = funcResult.endLine;
                output += ',';

                output += '\n  arg: ';
                const argStartLine = currentLine;
                currentLine += 1; // arg: line - this is where the nested term starts
                const argPrefix = '  '.repeat(indentLevel + 1) + 'arg: ';
                const argResult = this.processTermWithLocations(term.argument, argStartLine, uriString, visited, indentLevel + 1, true, argPrefix);
                // When adding indentation, the first line stays on the same line as "arg: "
                const argLines = argResult.text.split('\n');
                if (argLines.length > 1) {
                    output += argLines[0];
                    output += argLines.slice(1).map(line => '\n  ' + line).join('');
                } else {
                    output += argResult.text;
                }
                currentLine = argResult.endLine;
                output += '\n}';
                currentLine += 1; // closing } line
                break;

            case 'Delay':
                output = `${this.getShortTermType(term.term_type)} {`;
                if (shouldCreateHints) {
                    // For root terms use indentLevel, for nested terms use prefix length
                    const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                    this.createTermHints(uriString, currentLine, term.term_type, term.id, prefixLength, output);
                }
                currentLine += 1; // Account for the header line

                output += '\n  term: ';
                const delayStartLine = currentLine;
                currentLine += 1; // term: line - this is where the nested term starts
                const delayPrefix = '  '.repeat(indentLevel + 1) + 'term: ';
                const delayTermResult = this.processTermWithLocations(term.term, delayStartLine, uriString, visited, indentLevel + 1, true, delayPrefix);
                // When adding indentation, the first line stays on the same line as "term: "
                const delayLines = delayTermResult.text.split('\n');
                if (delayLines.length > 1) {
                    output += delayLines[0];
                    output += delayLines.slice(1).map(line => '\n  ' + line).join('');
                } else {
                    output += delayTermResult.text;
                }
                currentLine = delayTermResult.endLine;
                output += '\n}';
                currentLine += 1; // closing } line
                break;

            case 'Lambda':
                output = `${this.getShortTermType(term.term_type)} ${term.parameterName} {`;
                if (shouldCreateHints) {
                    // For root terms use indentLevel, for nested terms use prefix length
                    const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                    this.createTermHints(uriString, currentLine, term.term_type, term.id, prefixLength, output);
                }
                currentLine += 1; // Lambda line

                output += '\n  body: ';
                const bodyStartLine = currentLine;
                currentLine += 1; // body: line - this is where the nested term starts
                const bodyPrefix = '  '.repeat(indentLevel + 1) + 'body: ';
                const bodyResult = this.processTermWithLocations(term.body, bodyStartLine, uriString, visited, indentLevel + 1, true, bodyPrefix);
                // When adding indentation, the first line stays on the same line as "body: "
                const bodyLines = bodyResult.text.split('\n');
                if (bodyLines.length > 1) {
                    output += bodyLines[0];
                    output += bodyLines.slice(1).map(line => '\n  ' + line).join('');
                } else {
                    output += bodyResult.text;
                }
                currentLine = bodyResult.endLine;
                output += '\n}';
                currentLine += 1; // closing } line
                break;

            case 'Force':
                output = `${this.getShortTermType(term.term_type)} {`;
                if (shouldCreateHints) {
                    // For root terms use indentLevel, for nested terms use prefix length
                    const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                    this.createTermHints(uriString, currentLine, term.term_type, term.id, prefixLength, output);
                }
                currentLine += 1; // Account for the header line

                output += '\n  term: ';
                const forceStartLine = currentLine;
                currentLine += 1; // term: line - this is where the nested term starts
                const forcePrefix = '  '.repeat(indentLevel + 1) + 'term: ';
                const forceTermResult = this.processTermWithLocations(term.term, forceStartLine, uriString, visited, indentLevel + 1, true, forcePrefix);
                // When adding indentation, the first line stays on the same line as "term: "
                const forceLines = forceTermResult.text.split('\n');
                if (forceLines.length > 1) {
                    output += forceLines[0];
                    output += forceLines.slice(1).map(line => '\n  ' + line).join('');
                } else {
                    output += forceTermResult.text;
                }
                currentLine = forceTermResult.endLine;
                output += '\n}';
                currentLine += 1; // closing } line
                break;

            case 'Constant':
                // Parse the constant data to extract type and value
                const constantData = this.parseConstantData(term.constant);
                
                if (this.shouldUseInlineFormat(constantData.type)) {
                    // Use inline format for simple types
                    output = `${this.getShortTermType(term.term_type)} ${constantData.type}: ${this.formatConstantValue(constantData.value)}`;
                    if (shouldCreateHints) {
                        // For root terms use indentLevel, for nested terms use prefix length
                        const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                        this.createConstantHints(uriString, currentLine, term.term_type, term.id, constantData.type, prefixLength, output);
                    }
                    currentLine += 1;
                } else {
                    // Use multiline format for complex types (Data, Bls12_381 types, etc.)
                    if (constantData.type === 'ProtoList' || constantData.type === 'ProtoPair') {
                        // Use structured rendering for ProtoList and ProtoPair
                        const firstLineOutput = `${this.getShortTermType(term.term_type)} ${constantData.type} {`;
                        if (shouldCreateHints) {
                            // For root terms use indentLevel, for nested terms use prefix length
                        const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                            this.createConstantHints(uriString, currentLine, term.term_type, term.id, constantData.type, prefixLength, firstLineOutput);
                        }
                        
                        const structuredResult = this.renderStructuredType(constantData.type, constantData.value, currentLine, uriString, indentLevel, false);
                        output = structuredResult.text;
                        currentLine = structuredResult.endLine;
                    } else {
                        // Use standard JSON format for other complex types
                        const firstLineOutput = `${this.getShortTermType(term.term_type)} ${constantData.type} {`;
                        if (shouldCreateHints) {
                            // For root terms use indentLevel, for nested terms use prefix length
                        const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                            this.createConstantHints(uriString, currentLine, term.term_type, term.id, constantData.type, prefixLength, firstLineOutput);
                        }
                        
                        // Use the parsed value from constantData, which already has type removed
                        const constantJson = JSONBigInt({ storeAsString: true }).stringify(constantData.value, null, 2);
                        
                        // Remove outer braces if the JSON is an object
                        const jsonLines = constantJson.split('\n');
                        let contentLines: string[];
                        if (jsonLines.length > 2 && jsonLines[0] === '{' && jsonLines[jsonLines.length - 1] === '}') {
                            // Remove first and last lines (outer braces) and reduce indentation
                            contentLines = jsonLines.slice(1, -1).map(line => line.startsWith('  ') ? line.slice(2) : line);
                        } else {
                            // Keep as is for non-objects
                            contentLines = jsonLines;
                        }
                        
                        // Include the type in the header: Const <type> <name> {
                        output = [
                            firstLineOutput,
                            contentLines.map(line => `  ${line}`).join('\n'),
                            '}'
                        ].join('\n');
                        // Calculate number of lines (header + content + closing brace)
                        currentLine += 1 + contentLines.length + 1;
                    }
                }
                break;

            case 'Error':
                output = `${this.getShortTermType(term.term_type)}`;
                if (shouldCreateHints) {
                    // For root terms use indentLevel, for nested terms use prefix length
                    const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                    this.createTermHints(uriString, currentLine, term.term_type, term.id, prefixLength, output);
                }
                currentLine += 1;
                break;

            case 'Builtin':
                output = `${this.getShortTermType(term.term_type)} ${term.fun}`;
                if (shouldCreateHints) {
                    // For root terms use indentLevel, for nested terms use prefix length
                    const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                    this.createBuiltinHints(uriString, currentLine, term.term_type, term.id, term.fun, prefixLength);
                }
                currentLine += 1;
                break;

            case 'Constr':
                output = `${this.getShortTermType(term.term_type)} {`;
                if (shouldCreateHints) {
                    // For root terms use indentLevel, for nested terms use prefix length
                    const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                    this.createTermHints(uriString, currentLine, term.term_type, term.id, prefixLength, output);
                }
                const constrHeader = [
                    output,
                    `  tag: ${term.constructorTag},`,
                    '  fields: ['
                ].join('\n');
                output = constrHeader;
                currentLine += 2;

                for (let i = 0; i < term.fields.length; i++) {
                    output += '\n    ';
                    const fieldStartLine = currentLine;
                    currentLine += 1; // field line - this is where the nested term starts
                    const fieldPrefix = '  '.repeat(indentLevel + 2);
                    const fieldResult = this.processTermWithLocations(term.fields[i], fieldStartLine, uriString, visited, indentLevel + 2, true, fieldPrefix);
                    // When adding indentation, the first line stays on the same line after the spaces
                    const fieldLines = fieldResult.text.split('\n');
                    if (fieldLines.length > 1) {
                        output += fieldLines[0];
                        output += fieldLines.slice(1).map(line => '\n    ' + line).join('');
                    } else {
                        output += fieldResult.text;
                    }
                    currentLine = fieldResult.endLine;
                    if (i < term.fields.length - 1) {
                        output += ',';
                    }
                }
                output += '\n  ]';
                currentLine += 1; // ] line
                output += '\n}';
                currentLine += 1;
                break;

            case 'Case':
                output = `${this.getShortTermType(term.term_type)} {`;
                if (shouldCreateHints) {
                    // For root terms use indentLevel, for nested terms use prefix length
                    const prefixLength = prefix === '' ? indentLevel * 2 : prefix.length;
                    this.createTermHints(uriString, currentLine, term.term_type, term.id, prefixLength, output);
                }
                currentLine += 1; // Account for the header line

                output += '\n  constr: ';
                const constrStartLine = currentLine;
                currentLine += 1; // constr: line - this is where the nested term starts
                const constrPrefix = '  '.repeat(indentLevel + 1) + 'constr: ';
                const constrResult = this.processTermWithLocations(term.constr, constrStartLine, uriString, visited, indentLevel + 1, true, constrPrefix);
                // When adding indentation, the first line stays on the same line as "constr: "
                const constrLines = constrResult.text.split('\n');
                if (constrLines.length > 1) {
                    output += constrLines[0];
                    output += constrLines.slice(1).map(line => '\n  ' + line).join('');
                } else {
                    output += constrResult.text;
                }
                currentLine = constrResult.endLine;
                output += ',';

                output += '\n  branches: [';
                currentLine += 1; // branches: [ line
                for (let i = 0; i < term.branches.length; i++) {
                    output += '\n    ';
                    const branchStartLine = currentLine;
                    currentLine += 1; // branch line - this is where the nested term starts
                    const branchPrefix = '  '.repeat(indentLevel + 2);
                    const branchResult = this.processTermWithLocations(term.branches[i], branchStartLine, uriString, visited, indentLevel + 2, true, branchPrefix);
                    // When adding indentation, the first line stays on the same line after the spaces
                    const branchLines = branchResult.text.split('\n');
                    if (branchLines.length > 1) {
                        output += branchLines[0];
                        output += branchLines.slice(1).map(line => '\n    ' + line).join('');
                    } else {
                        output += branchResult.text;
                    }
                    currentLine = branchResult.endLine;
                    if (i < term.branches.length - 1) {
                        output += ',';
                    }
                }
                output += '\n  ]';
                currentLine += 1;
                output += '\n}';
                currentLine += 1; // closing } line
                break;

            default:
                // Exhaustive check - all types should be handled above
                const _exhaustiveCheck: never = term;
                throw new Error(`Unhandled term type: ${JSON.stringify(_exhaustiveCheck)}`);
        }

        // Update endLine for termLocation
        termLocations[termLocationIndex].endLine = currentLine;

        // Remove from visited set to allow same term to be processed in different branches
        visited.delete(term.id);

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


    private findTermAtLine(line: number, termLocations: TermLocation[]): TermLocation | undefined {
        // First, try to find terms that start exactly at this line
        const termsStartingAtLine = termLocations.filter(loc => loc.startLine === line);
        
        if (termsStartingAtLine.length > 0) {
            // If multiple terms start at the same line, prefer the most nested one (smallest range)
            return termsStartingAtLine.reduce((mostNested, current) => {
                const currentRange = current.endLine - current.startLine;
                const nestedRange = mostNested.endLine - mostNested.startLine;
                return currentRange < nestedRange ? current : mostNested;
            });
        }
        
        // If no terms start at this line, find all terms that contain the given line
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


    public async highlightDebuggerLine(termId: number): Promise<boolean> {
        this._currentDebuggerTermId = termId;

        // If no current editor, try to find and activate the term viewer tab
        if (!this._currentEditor) {
            const termViewerTab = await this.findAndActivateTermViewerTab();
            if (!termViewerTab) {
                return false;
            }
        }

        this._currentEditor!.setDecorations(this._decorationTypes.debuggerLine, []);

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

        this._currentEditor!.setDecorations(this._decorationTypes.debuggerLine, [decoration]);

        this._currentEditor!.revealRange(
            new vscode.Range(termLocation.startLine, 0, termLocation.startLine, 0),
            vscode.TextEditorRevealType.InCenter
        );

        return true;
    }

    public clearDebuggerHighlight(): void {
        this._currentDebuggerTermId = undefined;
        if (this._currentEditor) {
            this._currentEditor.setDecorations(this._decorationTypes.debuggerLine, []);
        }
    }

    private restoreDebuggerHighlight(): void {
        if (this._currentDebuggerTermId !== undefined && this._currentEditor) {
            const termLocations = this.getCurrentTermLocations();
            const termLocation = termLocations.find(loc => loc.termId === this._currentDebuggerTermId);
            if (termLocation) {
                const decoration: vscode.DecorationOptions = {
                    range: new vscode.Range(
                        termLocation.startLine,
                        0,
                        termLocation.startLine,
                        Number.MAX_VALUE
                    )
                };
                this._currentEditor.setDecorations(this._decorationTypes.debuggerLine, [decoration]);
            }
        }
    }

    public async focusOnTerm(termId: string | number): Promise<boolean> {
        // If no current editor, try to find and activate the term viewer tab
        if (!this._currentEditor) {
            const termViewerTab = await this.findAndActivateTermViewerTab();
            if (!termViewerTab) {
                return false;
            }
        }

        const termLocations = this.getCurrentTermLocations();
        const termLocation = termLocations.find(loc => loc.termId === termId);
        if (!termLocation) {
            return false;
        }

        // Make sure the editor is focused
        if (this._currentEditor) {
            await vscode.window.showTextDocument(this._currentEditor.document, {
                viewColumn: this._currentEditor.viewColumn,
                preserveFocus: false
            });
        }

        // Select only the first line of the term using regular text selection
        const selection = new vscode.Selection(
            termLocation.startLine,
            0,
            termLocation.startLine,
            this._currentEditor!.document.lineAt(termLocation.startLine).text.length
        );

        this._currentEditor!.selection = selection;
        this._currentEditor!.revealRange(
            selection,
            vscode.TextEditorRevealType.InCenter
        );

        return true;
    }

    /**
     * Activates a term document with proper settings (language, preview mode, etc.)
     * @param uri The URI of the term document
     * @param viewColumn The view column to show the document in
     * @returns The activated text editor
     */
    private async activateTermDocument(uri: vscode.Uri, viewColumn?: vscode.ViewColumn): Promise<vscode.TextEditor> {
        const document = await vscode.workspace.openTextDocument(uri);
        // Set the language to UPLC for syntax highlighting
        await vscode.languages.setTextDocumentLanguage(document, 'uplc');
        return await vscode.window.showTextDocument(document, {
            preview: false,
            viewColumn: viewColumn || vscode.ViewColumn.One,
            preserveFocus: false
        });
    }

    /**
     * Finds and activates the term viewer tab if it exists
     * @returns A boolean indicating whether the tab was found and activated
     */
    private async findAndActivateTermViewerTab(): Promise<boolean> {
        // Search for a term viewer tab in all tab groups
        for (const tabGroup of vscode.window.tabGroups.all) {
            for (const tab of tabGroup.tabs) {
                if (tab.input instanceof vscode.TabInputText) {
                    const uri = tab.input.uri;
                    if (uri.scheme === TermViewerProvider.scheme) {
                        // Found a term viewer tab, activate it
                        this._currentEditor = await this.activateTermDocument(uri, tabGroup.viewColumn);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    public clearHighlights(): void {
        if (this._currentEditor) {
            this._currentEditor.setDecorations(this._decorationTypes.termHighlight, []);
            this._currentEditor.setDecorations(this._decorationTypes.debuggerLine, []);
            this._currentEditor.setDecorations(this._decorationTypes.breakpointDisabled, []);
        }
    }

    public get hintProvider(): TermInlayHintsProvider {
        return this.inlayHintsProvider;
    }

    public dispose() {
        this._decorationTypes.breakpointPossible.dispose();
        this._decorationTypes.breakpointActive.dispose();
        this._decorationTypes.breakpointDisabled.dispose();
        this._decorationTypes.termHighlight.dispose();
        this._decorationTypes.debuggerLine.dispose();
        
        // Dispose inlay hints provider
        this.inlayHintsProvider.dispose();
        
        // Clear all hints
        this._termHints.clear();
    }
}