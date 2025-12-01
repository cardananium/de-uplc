import * as vscode from 'vscode';
import { 
    MachineState, MachineStateLazy, 
    BuiltinRuntime, BuiltinRuntimeLazy, 
    Constant, ConstantLazy, 
    Term, TermLazy, 
    Type, 
    Env, EnvLazy, 
    Value, ValueLazy, 
    MachineContext, MachineContextLazy, 
    EitherTermOrId, EitherTermOrIdLazy,
    LazyLoadableValue,
    LazyLoadableConstant,
    LazyLoadableTermOrId,
    LazyLoadableEnv,
    LazyLoadableContext,
    LazyLoadableBuiltinRuntime,
    LazyLoadableTerm,
    LazyLoadableData
} from '../../debugger-types';
import { SessionController } from '../../debugger/session-controller';

export interface UplcNode {
    getTreeItem(): vscode.TreeItem;
    getChildren(): UplcNode[] | Promise<UplcNode[]>;
}

// Helper to check if a lazy loadable is loaded or just type info
function isLoaded<T>(value: T | { _type: string; _kind: string; _length?: number | null }): value is T {
    return value !== null && 
           typeof value === 'object' && 
           !('_type' in value && '_kind' in value);
}

// Helper function to create a label for lazy loadable items
function createLazyLabel(baseLabel: string, typeInfo: { _type: string; _kind: string; _length?: number | null }): string {
    let label = `${baseLabel} [${typeInfo._type}]`;
    if (typeInfo._length !== null && typeInfo._length !== undefined) {
        label += ` (${typeInfo._length} items)`;
    }
    label += ' 🔄'; // Indicates lazy loadable
    return label;
}

// Helper function to handle EitherTermOrId
function createTermNode(termOrId: EitherTermOrId, label: string): UplcNode {
    if (termOrId.type === 'Term') {
        return new TermNode(termOrId.term, label);
    } else {
        return new SimpleNode(`${label} (Term ID: ${termOrId.id})`);
    }
}

// Helper function to handle lazy EitherTermOrId
function createTermNodeLazy(termOrId: EitherTermOrIdLazy | LazyLoadableTermOrId, label: string): UplcNode {
    if (isLoaded(termOrId)) {
        const loaded = termOrId as EitherTermOrIdLazy;
        if (loaded.type === 'Term') {
            return new TermNodeLazy(loaded.term, label);
        } else {
            return new SimpleNode(`${label} (Term ID: ${loaded.id})`);
        }
    } else {
        const typeInfo = termOrId as { _type: string; _kind: string; _length?: number | null };
        return new LazyNode(createLazyLabel(label, typeInfo));
    }
}

export class LazyNode implements UplcNode {
    constructor(private text: string) {}
    
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(this.text, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('sync');
        item.contextValue = 'uplcLazyNode';
        item.tooltip = 'This data is not fully loaded.';
        return item;
    }
    
    getChildren(): UplcNode[] {
        return [];
    }
}

/**
 * LoadableLazyNode - a node that loads data automatically when expanded
 */
export class LoadableLazyNode implements UplcNode {
    private cachedChildren: UplcNode[] | null = null;
    private isLoading: boolean = false;
    
    constructor(
        private label: string,
        private path: string[],
        private dataSource: 'machineState' | 'context' | 'env',
        private typeInfo: { _type: string; _kind: string; _length?: number | null },
        private loadDataFn: (path: string[], dataSource: string) => Promise<any>,
        private sessionController?: any // For creating child lazy nodes
    ) {}
    
    getTreeItem(): vscode.TreeItem {
        // If data is already loaded, show as expanded node
        // Otherwise show as collapsed
        const collapsibleState = this.cachedChildren !== null 
            ? vscode.TreeItemCollapsibleState.Expanded 
            : vscode.TreeItemCollapsibleState.Collapsed;
        
        const item = new vscode.TreeItem(this.label, collapsibleState);
        item.iconPath = new vscode.ThemeIcon('symbol-property');
        item.contextValue = 'uplcNode';
        
        return item;
    }
    
    async getChildren(): Promise<UplcNode[]> {
        // If already loaded, return from cache
        if (this.cachedChildren !== null) {
            return this.cachedChildren;
        }
        
        // If already loading, wait for it to complete
        if (this.isLoading) {
            // Return empty array to avoid showing duplicate "Loading..." nodes
            // VSCode will call getChildren again after this resolves
            return [];
        }
        
        try {
            this.isLoading = true;
            
            console.log(`[LoadableLazyNode] Loading data: label="${this.label}", path=${JSON.stringify(this.path)}, dataSource="${this.dataSource}"`);
            
            // Load data via callback function
            const loadedData = await this.loadDataFn(this.path, this.dataSource);
            
            console.log(`[LoadableLazyNode] Loaded data successfully for path=${JSON.stringify(this.path)}`);
            
            // Convert loaded data to tree nodes
            this.cachedChildren = this.convertDataToNodes(loadedData);
            
            return this.cachedChildren;
            
        } catch (error) {
            console.error(`[LoadableLazyNode] Failed to load lazy children for ${this.path.join('.')}:`, error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Cache the error to avoid repeated loading attempts
            this.cachedChildren = [new SimpleNode(`Error: ${errorMessage}`)];
            return this.cachedChildren;
        } finally {
            this.isLoading = false;
        }
    }
    
    /**
     * Convert loaded data to tree nodes
     * Instead of creating intermediate nodes, create the actual typed node
     */
    private convertDataToNodes(data: any): UplcNode[] {
        if (!data || typeof data !== 'object') {
            return [new SimpleNode(String(data))];
        }
        
        console.log(`[LoadableLazyNode.convertDataToNodes] Converting data type: ${data.value_type || data.frame_type || (data.values ? 'Env' : 'unknown')}, path=${JSON.stringify(this.path)}, hasSessionController=${!!this.sessionController}`);
        
        // If it's a Value, create ValueNodeLazy and return its children
        if (data.value_type) {
            const valueNode = new ValueNodeLazy(
                data,
                this.label,
                this.path,
                this.dataSource,
                this.sessionController
            );
            const children = valueNode.getChildren();
            // Handle both sync and async getChildren
            if (children instanceof Promise) {
                // Data is loaded, so this shouldn't return Promise
                // But just in case, return empty
                return [];
            }
            return children;
        }
        
        // If it's an Env, create children as ValueNodeLazy
        if (data.values && Array.isArray(data.values)) {
            const nodes: UplcNode[] = data.values.map((value: any, index: number) => 
                new ValueNodeLazy(
                    value,
                    `Value ${index}`, // These are Values, not Env
                    [...this.path, 'values', String(index)],
                    this.dataSource,
                    this.sessionController
                )
            );
            
            // Add truncation info if elements were limited
            if (data.truncation_message && data.displayed_count !== undefined && data.total_count !== undefined) {
                nodes.push(new TruncationInfoNode(
                    data.displayed_count,
                    data.total_count,
                    data.truncation_message
                ));
            }
            
            return nodes;
        }
        
        // If it's a Context
        if (data.context_type || data.frame_type) {
            const contextNode = new ContextNodeLazy(
                data,
                this.label,
                this.path,
                this.dataSource,
                this.sessionController
            );
            const children = contextNode.getChildren();
            if (children instanceof Promise) {
                return [];
            }
            return children;
        }
        
        // If it's an array of contexts
        if (Array.isArray(data)) {
            return data.map((item, index) => 
                new ContextNodeLazy(
                    item,
                    `Context ${index}`,
                    [String(index)],
                    'context',
                    this.sessionController
                )
            );
        }
        
        // For all other cases - just output object fields
        const nodes: UplcNode[] = [];
        Object.entries(data).forEach(([key, value]) => {
            if (value && typeof value === 'object') {
                nodes.push(new SimpleNode(`${key}: ${JSON.stringify(value).substring(0, 50)}...`));
            } else {
                nodes.push(new SimpleNode(`${key}: ${value}`));
            }
        });
        
        return nodes;
    }
    
    /**
     * Clear cache (e.g., on step/continue)
     */
    clearCache() {
        this.cachedChildren = null;
    }
}

export class SimpleNode implements UplcNode {
    constructor(private text: string) {}
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(this.text, vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('symbol-property');
        item.contextValue = 'uplcNode';
        return item;
    }
    getChildren(): UplcNode[] {
        return [];
    }
}

/**
 * Node that displays truncation information when elements are limited
 */
export class TruncationInfoNode implements UplcNode {
    constructor(
        private displayedCount: number,
        private totalCount: number,
        private message: string
    ) {}
    
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(
            `⚠️ Showing ${this.displayedCount} of ${this.totalCount} elements`,
            vscode.TreeItemCollapsibleState.None
        );
        item.description = this.message;
        item.tooltip = this.message;
        item.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
        item.contextValue = 'truncationInfo';
        return item;
    }
    
    getChildren(): UplcNode[] {
        return [];
    }
}

export class MachineStateNode implements UplcNode {
    constructor(public state: MachineState) {}

    getTreeItem(): vscode.TreeItem {
        let label = `${this.state.machine_state_type}`;
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('gear');
        item.contextValue = 'uplcNode';
        return item;
    }

    getChildren(): UplcNode[] {
        switch (this.state.machine_state_type) {
            case "Return":
                return [new ValueNode(this.state.value, 'Return value')];
            case "Compute":
                return [createTermNode(this.state.term, 'Term to compute')];
            case "Done":
                return [createTermNode(this.state.term, 'Computed term')];
        }
    }
}

export class MachineStateNodeLazy implements UplcNode {
    constructor(
        public state: MachineStateLazy,
        private sessionController: SessionController, // SessionController for lazy loading
        public path: string[] = [], // Path for loading full data
        public dataSource: 'machineState' | 'context' | 'env' = 'machineState',
        private generation: number = 0 // Generation number to force new identity
    ) {}

    getTreeItem(): vscode.TreeItem {
        let label = `${this.state.machine_state_type}`;
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('gear');
        item.contextValue = 'uplcNode';
        // Add unique id based on generation to force VS Code to treat as new node
        item.id = `machineState-${this.generation}-${this.state.machine_state_type}`;
        return item;
    }

    getChildren(): UplcNode[] {
        switch (this.state.machine_state_type) {
            case "Return":
                return [
                    new ValueNodeLazy(this.state.value, 'Return value', ['value'], 'machineState', this.sessionController),
                    new ContextNodeLazy(this.state.context, 'Context', ['context'], 'machineState', this.sessionController)
                ];
            case "Compute":
                return [
                    new ContextNodeLazy(this.state.context, 'Context', ['context'], 'machineState', this.sessionController),
                    new EnvNodeLazy(this.state.env, 'Environment', ['env'], 'machineState', this.sessionController),
                    createTermNodeLazy(this.state.term, 'Term to compute')
                ];
            case "Done":
                return [createTermNodeLazy(this.state.term, 'Computed term')];
        }
    }
}

export class ContextNode implements UplcNode {
    constructor(private context: MachineContext, private label: string = 'Context') {}
    getTreeItem(): vscode.TreeItem {
        // Create more informative labels based on context type
        let displayLabel;
        if (this.context.context_type === "FrameConstr") {
            displayLabel = `${this.context.context_type}: tag=${this.context.tag}`;
        } else if (this.context.context_type === "FrameCases") {
            displayLabel = `${this.context.context_type}: ${this.context.terms.length} branches`;
        } else {
            displayLabel = `${this.context.context_type}`;
        }
        
        const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('layers');
        item.contextValue = 'uplcNode';
        return item;
    }
    getChildren(): UplcNode[] {
        switch (this.context.context_type) {
            case "FrameAwaitArg":
                return [new ValueNode(this.context.value, 'Await Arg Value')];
            case "FrameAwaitFunTerm":
                return [new EnvNode(this.context.env), createTermNode(this.context.term, 'Await Fun Term')];
            case "FrameAwaitFunValue":
                return [new ValueNode(this.context.value, 'Await Fun Value')];
            case "FrameForce":
                return [];
            case "FrameConstr":
                return [
                    new EnvNode(this.context.env),
                    new SimpleNode(`Constructor tag: ${this.context.tag}`),
                    ...this.context.terms.map((t, i) => createTermNode(t, `Remaining term ${i}`)),
                    ...this.context.values.map((v, i) => new ValueNode(v, `Evaluated value ${i}`))
                ];
            case "FrameCases":
                return [
                    new EnvNode(this.context.env),
                    ...this.context.terms.map((b, i) => createTermNode(b, `Branch ${i}`))
                ];
            case "NoFrame":
                return [];
        }
    }
}

export class ContextNodeLazy implements UplcNode {
    constructor(
        public context: MachineContextLazy | LazyLoadableContext, 
        private label: string = 'Context',
        public path: string[] = [],
        public dataSource: 'machineState' | 'context' | 'env' = 'context',
        private sessionController: SessionController,
        private generation: number = 0 // Generation number to force new identity
    ) {}
    
    getTreeItem(): vscode.TreeItem {
        if (!isLoaded(this.context)) {
            // Use _type and _kind to build informative label
            const typeInfo = this.context as { _type: string; _kind: string; _length?: number | null };
            let displayLabel = this.label;
            if (typeInfo._type && typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._type}: ${typeInfo._kind})`;
            } else if (typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._kind})`;
            }
            const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);
            item.iconPath = new vscode.ThemeIcon('symbol-namespace');
            item.contextValue = 'uplcNode';
            // Add unique id based on generation to force VS Code to treat as new node
            item.id = `context-${this.generation}-${this.path.join('-')}`;
            return item;
        }
        
        const loadedContext = this.context as MachineContextLazy;
        let displayLabel;
        if (loadedContext.context_type === "FrameConstr") {
            displayLabel = `${loadedContext.context_type}: tag=${loadedContext.tag}`;
        } else if (loadedContext.context_type === "FrameCases") {
            displayLabel = `${loadedContext.context_type}`;
        } else {
            displayLabel = `${loadedContext.context_type}`;
        }
        
        const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('layers');
        item.contextValue = 'uplcNode';
        // Add unique id based on generation to force VS Code to treat as new node
        item.id = `context-${this.generation}-${this.path.join('-')}-${loadedContext.context_type}`;
        return item;
    }
    
    getChildren(): UplcNode[] | Promise<UplcNode[]> {
        if (!isLoaded(this.context)) {
            const typeInfo = this.context as { _type: string; _kind: string; _length?: number | null };
            
            // If we have SessionController, create LoadableLazyNode that will load data
            if (this.sessionController && this.path.length > 0) {
                const loadFn = async (path: string[], dataSource: string) => {
                    const pathJson = JSON.stringify(path);
                    // Use returnFullObject: false to load only structure, not full depth
                    switch (dataSource) {
                        case 'machineState':
                            return await this.sessionController.getMachineStateLazy(pathJson, false);
                        case 'context':
                            return await this.sessionController.getMachineContextLazy(pathJson, false);
                        case 'env':
                            return await this.sessionController.getCurrentEnvLazy(pathJson, false);
                    }
                };
                
                const loadableNode = new LoadableLazyNode(
                    this.label,
                    this.path,
                    this.dataSource,
                    typeInfo,
                    loadFn,
                    this.sessionController
                );
                return loadableNode.getChildren();
            }
            
            return [new SimpleNode('Data not loaded')];
        }
        
        const loadedContext = this.context as MachineContextLazy;
        switch (loadedContext.context_type) {
            case "FrameAwaitArg":
                return [new ValueNodeLazy(
                    loadedContext.value, 
                    'Await Arg Value',
                    [...this.path, 'value'],
                    this.dataSource,
                    this.sessionController
                )];
            case "FrameAwaitFunTerm":
                return [
                    new EnvNodeLazy(
                        loadedContext.env, 
                        'Environment',
                        [...this.path, 'env'],
                        this.dataSource,
                        this.sessionController
                    ), 
                    createTermNodeLazy(loadedContext.term, 'Await Fun Term')
                ];
            case "FrameAwaitFunValue":
                return [new ValueNodeLazy(
                    loadedContext.value, 
                    'Await Fun Value',
                    [...this.path, 'value'],
                    this.dataSource,
                    this.sessionController
                )];
            case "FrameForce":
                return [];
            case "FrameConstr":
                return [
                    new EnvNodeLazy(
                        loadedContext.env, 
                        'Environment',
                        [...this.path, 'env'],
                        this.dataSource,
                        this.sessionController
                    ),
                    new SimpleNode(`Constructor tag: ${loadedContext.tag}`),
                    ...loadedContext.terms.map((t, i) => createTermNodeLazy(t, `Remaining term ${i}`)),
                    ...loadedContext.values.map((v, i) => new ValueNodeLazy(
                        v, 
                        `Evaluated value ${i}`,
                        [...this.path, 'values', String(i)],
                        this.dataSource,
                        this.sessionController
                    ))
                ];
            case "FrameCases":
                return [
                    new EnvNodeLazy(
                        loadedContext.env, 
                        'Environment',
                        [...this.path, 'env'],
                        this.dataSource,
                        this.sessionController
                    ),
                    ...loadedContext.terms.map((b, i) => createTermNodeLazy(b, `Branch ${i}`))
                ];
            case "NoFrame":
                return [];
        }
    }
}

export class EnvNode implements UplcNode {
    constructor(private env: Env) {}
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(`Env (${this.env.values.length} values)`,
            this.env.values.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('symbol-field');
        item.contextValue = 'uplcNode';
        return item;
    }
    getChildren(): UplcNode[] {
        return this.env.values.map((v, i) => new ValueNode(v, `Value ${i}`));
    }
}

export class EnvNodeLazy implements UplcNode {
    constructor(
        public env: EnvLazy | LazyLoadableEnv, 
        private label: string = 'Environment',
        public path: string[] = [],
        public dataSource: 'machineState' | 'context' | 'env' = 'env',
        private sessionController?: any,
        private generation: number = 0 // Generation number to force new identity
    ) {}
    
    getTreeItem(): vscode.TreeItem {
        if (!isLoaded(this.env)) {
            // Use _type and _kind to build informative label
            const typeInfo = this.env as { _type: string; _kind: string; _length?: number | null };
            let displayLabel = this.label;
            if (typeInfo._type && typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._type}: ${typeInfo._kind})`;
            } else if (typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._kind})`;
            }
            const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);
            item.iconPath = new vscode.ThemeIcon('symbol-field');
            item.contextValue = 'uplcNode';
            // Add unique id based on generation to force VS Code to treat as new node
            item.id = `env-${this.generation}-${this.path.join('-')}`;
            return item;
        }
        
        const loadedEnv = this.env as EnvLazy;
        const item = new vscode.TreeItem(`${this.label} (${loadedEnv.values.length} values)`,
            loadedEnv.values.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        item.iconPath = new vscode.ThemeIcon('symbol-field');
        item.contextValue = 'uplcNode';
        // Add unique id based on generation to force VS Code to treat as new node
        item.id = `env-${this.generation}-${this.path.join('-')}-${loadedEnv.values.length}`;
        return item;
    }
    
    getChildren(): UplcNode[] | Promise<UplcNode[]> {
        if (!isLoaded(this.env)) {
            const typeInfo = this.env as { _type: string; _kind: string; _length?: number | null };
            
            // If we have SessionController, create LoadableLazyNode that will load data
            if (this.sessionController && this.path.length > 0) {
                const loadFn = async (path: string[], dataSource: string) => {
                    const pathJson = JSON.stringify(path);
                    // Use returnFullObject: false to load only structure, not full depth
                    switch (dataSource) {
                        case 'machineState':
                            return await this.sessionController.getMachineStateLazy(pathJson, false);
                        case 'context':
                            return await this.sessionController.getMachineContextLazy(pathJson, false);
                        case 'env':
                            return await this.sessionController.getCurrentEnvLazy(pathJson, false);
                    }
                };
                
                const loadableNode = new LoadableLazyNode(
                    this.label,
                    this.path,
                    this.dataSource,
                    typeInfo,
                    loadFn,
                    this.sessionController
                );
                return loadableNode.getChildren();
            }
            
            return [new SimpleNode('Data not loaded')];
        }
        
        const loadedEnv = this.env as EnvLazy;
        // Build proper path based on parent path
        // If parent path is ['env'] in machineState, children will be ['env', 'values', '0']
        // If parent path is ['context', 'env'] in context, children will be ['context', 'env', 'values', '0']
        const nodes: UplcNode[] = loadedEnv.values.map((v, i) => new ValueNodeLazy(
            v, 
            `Value ${i}`, // These are Values, not Env
            [...this.path, 'values', String(i)], // Append to parent path
            this.dataSource, // Inherit parent dataSource
            this.sessionController
        ));
        
        // Add truncation info if elements were limited
        const envData = this.env as any;
        if (envData.truncation_message && envData.displayed_count !== undefined && envData.total_count !== undefined) {
            nodes.push(new TruncationInfoNode(
                envData.displayed_count,
                envData.total_count,
                envData.truncation_message
            ));
        }
        
        return nodes;
    }
}

export class ValueNode implements UplcNode {
    constructor(private value: Value, private label: string = 'Value') {}
    getTreeItem(): vscode.TreeItem {
        // Create more informative labels based on value type
        let displayLabel = this.label;
        if (this.value.value_type === "Lambda") {
            displayLabel = `${this.label} (${this.value.value_type}: ${this.value.parameterName})`;
        } else if (this.value.value_type === "Constr") {
            displayLabel = `${this.label} (${this.value.value_type}: tag=${this.value.tag})`;
        } else if (this.value.value_type === "Builtin") {
            displayLabel = `${this.label} (${this.value.value_type}: ${this.value.fun})`;
        } else {
            displayLabel = `${this.label} (${this.value.value_type})`;
        }
        
        const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);

        let iconName: string;
        switch (this.value.value_type) {
            case "Con":
                iconName = 'symbol-constant';
                break;
            case "Delay":
                iconName = 'debug-pause';
                break;
            case "Lambda":
                iconName = 'symbol-function';
                break;
            case "Builtin":
                iconName = 'symbol-module';
                break;
            case "Constr":
                iconName = 'symbol-class';
                break;
            default:
                iconName = 'symbol-field';
        }
        item.iconPath = new vscode.ThemeIcon(iconName);
        item.contextValue = 'uplcNode';
        return item;
    }
    getChildren(): UplcNode[] {
        switch (this.value.value_type) {
            case "Con":
                return [new ConstantNode(this.value.constant)];
            case "Delay":
                return [createTermNode(this.value.body, 'Delayed Term'), new EnvNode(this.value.env)];
            case "Lambda":
                return [
                    new SimpleNode(`Parameter: ${this.value.parameterName}`),
                    createTermNode(this.value.body, 'Body'),
                    new EnvNode(this.value.env)
                ];
            case "Builtin":
                return [
                    new SimpleNode(`Function: ${this.value.fun}`),
                    new BuiltinRuntimeNode(this.value.runtime)
                ];
            case "Constr":
                return [
                    new SimpleNode(`Constructor tag: ${this.value.tag}`),
                    ...this.value.fields.map((f, i) => new ValueNode(f, `Field ${i}`))
                ];
        }
    }
}

export class ValueNodeLazy implements UplcNode {
    private loadedValue: ValueLazy | null = null; // Cache for loaded data
    
    constructor(
        public value: ValueLazy | LazyLoadableValue, 
        private label: string = 'Value',
        public path: string[] = [],
        public dataSource: 'machineState' | 'context' | 'env' = 'machineState',
        private sessionController?: any // SessionController for lazy loading
    ) {}
    
    getTreeItem(): vscode.TreeItem {
        if (!isLoaded(this.value)) {
            // Use _type and _kind to build informative label even before loading
            const typeInfo = this.value as { _type: string; _kind: string; _length?: number | null };
            let displayLabel = this.label;
            if (typeInfo._type && typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._type}: ${typeInfo._kind})`;
            } else if (typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._kind})`;
            }
            
            // Choose icon based on value type
            let iconName: string;
            switch (typeInfo._type) {
                case 'Con':
                    // For Con, use _kind to determine constant type
                    if (typeInfo._kind === 'Integer') {
                        iconName = 'symbol-number';
                    } else if (typeInfo._kind === 'ByteString') {
                        iconName = 'symbol-array';
                    } else if (typeInfo._kind === 'String') {
                        iconName = 'symbol-string';
                    } else if (typeInfo._kind === 'Bool') {
                        iconName = 'symbol-boolean';
                    } else if (typeInfo._kind === 'Unit') {
                        iconName = 'symbol-misc';
                    } else if (typeInfo._kind === 'ProtoList') {
                        iconName = 'list-unordered';
                    } else if (typeInfo._kind === 'ProtoPair') {
                        iconName = 'symbol-interface';
                    } else if (typeInfo._kind === 'Data') {
                        iconName = 'symbol-object';
                    } else {
                        iconName = 'symbol-constant';
                    }
                    break;
                case 'Builtin':
                    iconName = 'symbol-module';
                    break;
                case 'Lambda':
                    iconName = 'symbol-function';
                    break;
                case 'Delay':
                    iconName = 'debug-pause';
                    break;
                case 'Constr':
                    iconName = 'symbol-class';
                    break;
                default:
                    iconName = 'symbol-field';
            }
            
            const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);
            item.iconPath = new vscode.ThemeIcon(iconName);
            item.contextValue = 'uplcNode';
            return item;
        }
        
        const loadedValue = this.value as ValueLazy;
        let displayLabel = this.label;
        if (loadedValue.value_type === "Lambda" && 'parameterName' in loadedValue) {
            displayLabel = `${this.label} (${loadedValue.value_type}: ${loadedValue.parameterName})`;
        } else if (loadedValue.value_type === "Constr" && 'tag' in loadedValue) {
            displayLabel = `${this.label} (${loadedValue.value_type}: tag=${loadedValue.tag})`;
        } else if (loadedValue.value_type === "Builtin" && 'fun' in loadedValue) {
            displayLabel = `${this.label} (${loadedValue.value_type}: ${loadedValue.fun})`;
        } else {
            displayLabel = `${this.label} (${loadedValue.value_type})`;
        }
        
        const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);

        let iconName: string;
        switch (loadedValue.value_type) {
            case "Con":
                iconName = 'symbol-constant';
                break;
            case "Delay":
                iconName = 'debug-pause';
                break;
            case "Lambda":
                iconName = 'symbol-function';
                break;
            case "Builtin":
                iconName = 'symbol-module';
                break;
            case "Constr":
                iconName = 'symbol-class';
                break;
            default:
                iconName = 'symbol-field';
        }
        item.iconPath = new vscode.ThemeIcon(iconName);
        item.contextValue = 'uplcNode';
        return item;
    }
    
    getChildren(): UplcNode[] | Promise<UplcNode[]> {
        if (!isLoaded(this.value)) {
            const typeInfo = this.value as { _type: string; _kind: string; _length?: number | null };
            
            console.log(`[ValueNodeLazy.getChildren] Not loaded: label="${this.label}", path=${JSON.stringify(this.path)}, dataSource="${this.dataSource}", hasSessionController=${!!this.sessionController}`);
            
            // If we have SessionController, create LoadableLazyNode that will load data
            if (this.sessionController && this.path.length > 0) {
                const loadFn = async (path: string[], dataSource: string) => {
                    const pathJson = JSON.stringify(path);
                    // Use returnFullObject: false to load only structure, not full depth
                    switch (dataSource) {
                        case 'machineState':
                            return await this.sessionController.getMachineStateLazy(pathJson, false);
                        case 'context':
                            return await this.sessionController.getMachineContextLazy(pathJson, false);
                        case 'env':
                            return await this.sessionController.getCurrentEnvLazy(pathJson, false);
                    }
                };
                
                const loadableNode = new LoadableLazyNode(
                    this.label,
                    this.path,
                    this.dataSource,
                    typeInfo,
                    loadFn,
                    this.sessionController
                );
                // Return the LoadableLazyNode which will load data when expanded
                return loadableNode.getChildren();
            }
            
            // No SessionController - can't load
            return [new SimpleNode('Data not loaded')];
        }
        
        const loadedValue = this.value as ValueLazy;
        switch (loadedValue.value_type) {
            case "Con":
                if ('constant' in loadedValue) {
                    return [new ConstantNodeLazy(
                        loadedValue.constant,
                        'Constant',
                        [...this.path, 'constant'],
                        this.dataSource,
                        this.sessionController
                    )];
                }
                return [];
            case "Delay":
                if ('body' in loadedValue && 'env' in loadedValue) {
                    return [
                        createTermNodeLazy(loadedValue.body, 'Delayed Term'), 
                        new EnvNodeLazy(
                            loadedValue.env, 
                            'Environment',
                            [...this.path, 'env'],
                            this.dataSource,
                            this.sessionController
                        )
                    ];
                }
                return [];
            case "Lambda":
                if ('parameterName' in loadedValue && 'body' in loadedValue && 'env' in loadedValue) {
                    return [
                        new SimpleNode(`Parameter: ${loadedValue.parameterName}`),
                        createTermNodeLazy(loadedValue.body, 'Body'),
                        new EnvNodeLazy(
                            loadedValue.env, 
                            'Environment',
                            [...this.path, 'env'],
                            this.dataSource,
                            this.sessionController
                        )
                    ];
                }
                return [];
            case "Builtin":
                if ('fun' in loadedValue && 'runtime' in loadedValue) {
                    return [
                        new SimpleNode(`Function: ${loadedValue.fun}`),
                        ...(loadedValue.runtime ? [new BuiltinRuntimeNodeLazy(
                            loadedValue.runtime,
                            [...this.path, 'runtime'],
                            this.dataSource,
                            this.sessionController
                        )] : [])
                    ];
                }
                return [];
            case "Constr":
                if ('tag' in loadedValue && 'fields' in loadedValue) {
                    return [
                        new SimpleNode(`Constructor tag: ${loadedValue.tag}`),
                        ...loadedValue.fields.map((f: any, i: number) => new ValueNodeLazy(
                            f, 
                            `Field ${i}`,
                            [...this.path, 'fields', String(i)],
                            this.dataSource,
                            this.sessionController
                        ))
                    ];
                }
                return [];
            default:
                return [];
        }
    }
}

export class ConstantNode implements UplcNode {
    constructor(public constant: Constant, private label: string = 'Constant') {}
    
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(
            `${this.label} (${this.constant.type})`, 
            this.constant.type === "Integer" || 
            this.constant.type === "ByteString" || 
            this.constant.type === "String" || 
            this.constant.type === "Unit" || 
            this.constant.type === "Bool" ? 
                vscode.TreeItemCollapsibleState.None : 
                vscode.TreeItemCollapsibleState.Collapsed
        );
        
        item.iconPath = new vscode.ThemeIcon(
            this.constant.type === "Integer"? 'symbol-number' :
            this.constant.type === "ByteString" ? 'symbol-array' :
            this.constant.type === "String" ? 'symbol-string' :
            this.constant.type === "Bool" ? 'symbol-boolean' :
            this.constant.type === "ProtoList" ? 'list-unordered' :
            this.constant.type === "ProtoPair" ? 'symbol-interface' :
            this.constant.type === "Data" ? 'symbol-object' :
            this.constant.type === "Unit" ? 'symbol-misc' :
            'symbol-constant'
        );
        
        // Improved label display with actual values
        if (this.constant.type === "Integer") {
            const intValue = this.constant.value || '';
            const displayValue = intValue.length > 50 ? intValue.substring(0, 50) + '...' : intValue;
            item.label = `${this.label}: ${displayValue}`;
        } else if (this.constant.type === "String") {
            const strValue = this.constant.value || '';
            const displayValue = strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue;
            item.label = `${this.label}: "${displayValue}"`;
        } else if (this.constant.type === "Bool") {
            item.label = `${this.label}: ${this.constant.value}`;
        } else if (this.constant.type === "ByteString") {
            const hexValue = this.constant.value || '';
            const displayValue = hexValue.length > 64 ? hexValue.substring(0, 64) + '...' : hexValue;
            item.label = `${this.label}: 0x${displayValue}`;
        } else if (this.constant.type === "ProtoList") {
            item.label = `${this.label}: List[${this.constant.elementType.type}] (${this.constant.values.length} items)`;
        } else if (this.constant.type === "ProtoPair") {
            item.label = `${this.label}: Pair<${this.constant.first_type.type}, ${this.constant.second_type.type}>`;
        } else if (this.constant.type === "Bls12_381G1Element") {
            const serialized = this.constant.serialized || '';
            const displayValue = serialized.length > 64 ? serialized.substring(0, 64) + '...' : serialized;
            item.label = `${this.label}: BLS G1 0x${displayValue}`;
        } else if (this.constant.type === "Bls12_381G2Element") {
            const serialized = this.constant.serialized || '';
            const displayValue = serialized.length > 64 ? serialized.substring(0, 64) + '...' : serialized;
            item.label = `${this.label}: BLS G2 0x${displayValue}`;
        } else if (this.constant.type === "Bls12_381MlResult") {
            const bytes = this.constant.bytes || '';
            const displayValue = bytes.length > 64 ? bytes.substring(0, 64) + '...' : bytes;
            item.label = `${this.label}: BLS ML 0x${displayValue}`;
        } else {
            item.label = `${this.label} (${this.constant.type})`;
        }
        
        item.contextValue = 'uplcNode';
        return item;
    }

    getChildren(): UplcNode[] {
        switch (this.constant.type) {
            case "ProtoList":
                return [
                    new TypeNode(this.constant.elementType, 'Element Type'),
                    ...this.constant.values.map((val, i) => new ConstantNode(val, `List item ${i}`))
                ];
            case "ProtoPair":
                return [
                    new TypeNode(this.constant.first_type, 'First Type'),
                    new TypeNode(this.constant.second_type, 'Second Type'),
                    new ConstantNode(this.constant.first_element, 'First Value'),
                    new ConstantNode(this.constant.second_element, 'Second Value')
                ];
            default:
                return [];
        }
    }
}

export class ConstantNodeLazy implements UplcNode {
    constructor(
        public constant: ConstantLazy | LazyLoadableConstant, 
        private label: string = 'Constant',
        public path: string[] = [],
        public dataSource: 'machineState' | 'context' | 'env' = 'machineState',
        private sessionController?: any
    ) {}
    
    getTreeItem(): vscode.TreeItem {
        if (!isLoaded(this.constant)) {
            // Use _type and _kind to build informative label
            const typeInfo = this.constant as { _type: string; _kind: string; _length?: number | null };
            let displayLabel = this.label;
            if (typeInfo._type && typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._type}: ${typeInfo._kind})`;
            } else if (typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._kind})`;
            }
            const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);
            item.iconPath = new vscode.ThemeIcon('symbol-constant');
            item.contextValue = 'uplcNode';
            return item;
        }
        
        const loadedConstant = this.constant as ConstantLazy;
        const item = new vscode.TreeItem(
            `${this.label} (${loadedConstant.type})`, 
            loadedConstant.type === "Integer" || 
            loadedConstant.type === "ByteString" || 
            loadedConstant.type === "String" || 
            loadedConstant.type === "Unit" || 
            loadedConstant.type === "Bool" ? 
                vscode.TreeItemCollapsibleState.None : 
                vscode.TreeItemCollapsibleState.Collapsed
        );
        
        item.iconPath = new vscode.ThemeIcon(
            loadedConstant.type === "Integer"? 'symbol-number' :
            loadedConstant.type === "ByteString" ? 'symbol-array' :
            loadedConstant.type === "String" ? 'symbol-string' :
            loadedConstant.type === "Bool" ? 'symbol-boolean' :
            loadedConstant.type === "ProtoList" ? 'list-unordered' :
            loadedConstant.type === "ProtoPair" ? 'symbol-interface' :
            loadedConstant.type === "Data" ? 'symbol-object' :
            loadedConstant.type === "Unit" ? 'symbol-misc' :
            'symbol-constant'
        );
        
        // Improved label display with actual values
        if (loadedConstant.type === "Integer") {
            const intValue = loadedConstant.value || '';
            const displayValue = intValue.length > 50 ? intValue.substring(0, 50) + '...' : intValue;
            item.label = `${this.label}: ${displayValue}`;
        } else if (loadedConstant.type === "String") {
            const strValue = loadedConstant.value || '';
            const displayValue = strValue.length > 100 ? strValue.substring(0, 100) + '...' : strValue;
            item.label = `${this.label}: "${displayValue}"`;
        } else if (loadedConstant.type === "Bool") {
            item.label = `${this.label}: ${loadedConstant.value}`;
        } else if (loadedConstant.type === "ByteString") {
            const hexValue = loadedConstant.value || '';
            const displayValue = hexValue.length > 64 ? hexValue.substring(0, 64) + '...' : hexValue;
            item.label = `${this.label}: 0x${displayValue}`;
        } else if (loadedConstant.type === "ProtoList") {
            item.label = `${this.label}: List[${loadedConstant.elementType.type}] (${loadedConstant.values.length} items)`;
        } else if (loadedConstant.type === "ProtoPair") {
            item.label = `${this.label}: Pair<${loadedConstant.first_type.type}, ${loadedConstant.second_type.type}>`;
        } else if (loadedConstant.type === "Bls12_381G1Element") {
            const serialized = loadedConstant.serialized || '';
            const displayValue = serialized.length > 64 ? serialized.substring(0, 64) + '...' : serialized;
            item.label = `${this.label}: BLS G1 0x${displayValue}`;
        } else if (loadedConstant.type === "Bls12_381G2Element") {
            const serialized = loadedConstant.serialized || '';
            const displayValue = serialized.length > 64 ? serialized.substring(0, 64) + '...' : serialized;
            item.label = `${this.label}: BLS G2 0x${displayValue}`;
        } else if (loadedConstant.type === "Bls12_381MlResult") {
            const bytes = loadedConstant.bytes || '';
            const displayValue = bytes.length > 64 ? bytes.substring(0, 64) + '...' : bytes;
            item.label = `${this.label}: BLS ML 0x${displayValue}`;
        } else {
            item.label = `${this.label} (${loadedConstant.type})`;
        }
        
        item.contextValue = 'uplcNode';
        return item;
    }
    
    getChildren(): UplcNode[] | Promise<UplcNode[]> {
        if (!isLoaded(this.constant)) {
            const typeInfo = this.constant as { _type: string; _kind: string; _length?: number | null };
            
            // If we have SessionController, create LoadableLazyNode that will load data
            if (this.sessionController && this.path.length > 0) {
                const loadFn = async (path: string[], dataSource: string) => {
                    const pathJson = JSON.stringify(path);
                    switch (dataSource) {
                        case 'machineState':
                            return await this.sessionController.getMachineStateLazy(pathJson, false);
                        case 'context':
                            return await this.sessionController.getMachineContextLazy(pathJson, false);
                        case 'env':
                            return await this.sessionController.getCurrentEnvLazy(pathJson, false);
                    }
                };
                
                const loadableNode = new LoadableLazyNode(
                    this.label,
                    this.path,
                    this.dataSource,
                    typeInfo,
                    loadFn,
                    this.sessionController
                );
                return loadableNode.getChildren();
            }
            
            return [new SimpleNode('Data not loaded')];
        }
        
        const loadedConstant = this.constant as ConstantLazy;
        switch (loadedConstant.type) {
            case "ProtoList":
                return [
                    new TypeNode(loadedConstant.elementType, 'Element Type'),
                    ...loadedConstant.values.map((val, i) => new ConstantNodeLazy(
                        val, 
                        `List item ${i}`,
                        [...this.path, 'values', String(i)],
                        this.dataSource,
                        this.sessionController
                    ))
                ];
            case "ProtoPair":
                return [
                    new TypeNode(loadedConstant.first_type, 'First Type'),
                    new TypeNode(loadedConstant.second_type, 'Second Type'),
                    new ConstantNodeLazy(
                        loadedConstant.first_element, 
                        'First Value',
                        [...this.path, 'first_element'],
                        this.dataSource,
                        this.sessionController
                    ),
                    new ConstantNodeLazy(
                        loadedConstant.second_element, 
                        'Second Value',
                        [...this.path, 'second_element'],
                        this.dataSource,
                        this.sessionController
                    )
                ];
            case "Data":
                // Check if data is loaded
                if (loadedConstant.data && typeof loadedConstant.data === 'object') {
                    // Check if it's TypeOnly (has _type, _kind fields) or actual PlutusData
                    if ('_type' in loadedConstant.data && '_kind' in loadedConstant.data) {
                        // Not loaded yet - would need lazy loading here too
                        const typeInfo = loadedConstant.data as { _type: string; _kind: string };
                        return [new SimpleNode(`Plutus Data (${typeInfo._kind || 'not loaded'})`)];
                    } else {
                        // Loaded PlutusData
                        return [new PlutusDataNode(loadedConstant.data)];
                    }
                }
                return [new SimpleNode('Plutus Data (empty)')];
            
            default:
                return [];
        }
    }
}

class PlutusDataMapEntryNode implements UplcNode {
    constructor(private key: any, private value: any, private index: number) {}
    
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(`Entry ${this.index}`, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('symbol-key');
        item.contextValue = 'uplcNode';
        return item;
    }
    
    getChildren(): UplcNode[] {
        return [
            new PlutusDataNode(this.key),
            new PlutusDataNode(this.value)
        ];
    }
}

export class PlutusDataNode implements UplcNode {
    constructor(public data: any) {
        console.log('[PlutusDataNode] Created with data:', JSON.stringify(data).substring(0, 200));
    }
    
    getTreeItem(): vscode.TreeItem {
        let label = 'Plutus Data';
        let collapsible = vscode.TreeItemCollapsibleState.None;
        
        console.log('[PlutusDataNode.getTreeItem] data.type:', this.data.type, 'data:', this.data);
        
        if (this.data.type === 'Constr') {
            label = `Constr (tag: ${this.data.tag}, ${this.data.fields?.length || 0} fields)`;
            collapsible = this.data.fields?.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        } else if (this.data.type === 'Map') {
            label = `Map (${this.data.key_value_pairs?.length || 0} entries)`;
            collapsible = this.data.key_value_pairs?.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        } else if (this.data.type === 'Array') {
            label = `Array (${this.data.values?.length || 0} items)`;
            collapsible = this.data.values?.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
        } else if (this.data.type === 'BoundedBytes') {
            // Show truncated value in tree for compactness
            const fullValue = this.data.value || '';
            console.log('[PlutusDataNode] BoundedBytes value:', fullValue, 'length:', fullValue.length);
            const displayValue = fullValue.length > 40 ? fullValue.substring(0, 40) + '...' : fullValue;
            label = `BoundedBytes: 0x${displayValue}`;
        } else if (this.data.Int !== undefined) {
            const intValue = String(this.data.Int);
            const displayValue = intValue.length > 50 ? intValue.substring(0, 50) + '...' : intValue;
            label = `Int: ${displayValue}`;
        } else if (this.data.BigUInt !== undefined) {
            const intValue = String(this.data.BigUInt);
            const displayValue = intValue.length > 50 ? intValue.substring(0, 50) + '...' : intValue;
            label = `BigUInt: ${displayValue}`;
        } else if (this.data.BigNInt !== undefined) {
            const intValue = String(this.data.BigNInt);
            const displayValue = intValue.length > 50 ? intValue.substring(0, 50) + '...' : intValue;
            label = `BigNInt: ${displayValue}`;
        }
        
        // Choose icon based on PlutusData type (consistent with TypeNode icons)
        let iconName: string;
        if (this.data.type === 'Constr') {
            iconName = 'symbol-class'; // Constructor
        } else if (this.data.type === 'Map') {
            iconName = 'symbol-interface'; // Like Pair
        } else if (this.data.type === 'Array') {
            iconName = 'list-unordered'; // Like List
        } else if (this.data.type === 'BoundedBytes') {
            iconName = 'symbol-array'; // Like ByteString
        } else if (this.data.Int !== undefined || this.data.BigUInt !== undefined || this.data.BigNInt !== undefined) {
            iconName = 'symbol-number'; // Like Integer
        } else {
            iconName = 'symbol-object'; // Default
        }
        
        const item = new vscode.TreeItem(label, collapsible);
        item.iconPath = new vscode.ThemeIcon(iconName);
        item.contextValue = 'uplcNode';
        return item;
    }
    
    getChildren(): UplcNode[] {
        if (this.data.type === 'Constr' && this.data.fields) {
            return this.data.fields.map((field: any, i: number) => 
                new PlutusDataNode(field)
            );
        } else if (this.data.type === 'Map' && this.data.key_value_pairs) {
            return this.data.key_value_pairs.map((pair: any, i: number) => 
                new PlutusDataMapEntryNode(pair.key, pair.value, i)
            );
        } else if (this.data.type === 'Array' && this.data.values) {
            return this.data.values.map((value: any, i: number) => 
                new PlutusDataNode(value)
            );
        }
        return [];
    }
}


export class TypeNode implements UplcNode {
    constructor(private type: Type, private label: string = 'Type') {}
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(`${this.label} (${this.type.type})`, vscode.TreeItemCollapsibleState.Collapsed);
        
        let iconName: string;
        switch (this.type.type) {
            case "Bool":
                iconName = 'symbol-boolean';
                break;
            case "Integer":
                iconName = 'symbol-number';
                break;
            case "String":
                iconName = 'symbol-string';
                break;
            case "ByteString":
                iconName = 'symbol-array';
                break;
            case "Unit":
                iconName = 'symbol-misc';
                break;
            case "List":
                iconName = 'list-unordered';
                break;
            case "Pair":
                iconName = 'symbol-interface';
                break;
            case "Bls12_381G1Element":
            case "Bls12_381G2Element":
            case "Bls12_381MlResult":
                iconName = 'symbol-key';
                break;
            case "Data":
                iconName = 'symbol-json';
                break;
            default:
                iconName = 'symbol-type';
        }
        item.iconPath = new vscode.ThemeIcon(iconName);
        item.contextValue = 'uplcNode';
        return item;
    }
    getChildren(): UplcNode[] {
        const t = this.type;
        switch (t.type) {
            case "Bool":
                return [new SimpleNode('BoolType')];
            case "Integer":
                return [new SimpleNode('IntegerType')];
            case "String":
                return [new SimpleNode('StringType')];
            case "ByteString":
                return [new SimpleNode('ByteStringType')];
            case "Unit":
                return [new SimpleNode('UnitType')];
            case "List":
                return [new SimpleNode('ListType'), new TypeNode(t.elementType, 'Element Type')];
            case "Pair":
                return [new SimpleNode('PairType'), new TypeNode(t.first_type, 'First Type'), new TypeNode(t.second_type, 'Second Type')];
            case "Bls12_381G1Element":
                return [new SimpleNode('BLS12-381 G1 Element')];
            case "Bls12_381G2Element":
                return [new SimpleNode('BLS12-381 G2 Element')];
            case "Bls12_381MlResult":
                return [new SimpleNode('BLS12-381 Miller Loop Result')];
            case "Data":
                return [new SimpleNode('PlutusData')];
            default:
                return [new SimpleNode(`Unknown type: ${(t as any).type}`)];
        }
    }
}

export class BuiltinRuntimeNode implements UplcNode {
    constructor(private runtime: BuiltinRuntime) {}
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(`Builtin Runtime (${this.runtime.args.length} args)`, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('symbol-method');
        item.contextValue = 'uplcNode';
        return item;
    }
    getChildren(): UplcNode[] {
        return [
            new SimpleNode(`Function: ${this.runtime.fun}`),
            new SimpleNode(`Forces: ${this.runtime.forces}`),
            new SimpleNode(`Arity: ${this.runtime.arity}`),
            ...this.runtime.args.map((arg, i) => new ValueNode(arg, `Arg ${i}`))
        ];
    }
}

export class BuiltinRuntimeNodeLazy implements UplcNode {
    constructor(
        public runtime: BuiltinRuntimeLazy | LazyLoadableBuiltinRuntime,
        public path: string[] = [],
        public dataSource: 'machineState' | 'context' | 'env' = 'machineState',
        private sessionController?: any
    ) {}
    
    getTreeItem(): vscode.TreeItem {
        if (!isLoaded(this.runtime)) {
            // Use _type and _kind to build informative label
            const typeInfo = this.runtime as { _type: string; _kind: string; _length?: number | null };
            let displayLabel = 'Builtin Runtime';
            if (typeInfo._type && typeInfo._kind) {
                displayLabel = `Builtin Runtime (${typeInfo._type}: ${typeInfo._kind})`;
            } else if (typeInfo._kind) {
                displayLabel = `Builtin Runtime (${typeInfo._kind})`;
            }
            const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);
            item.iconPath = new vscode.ThemeIcon('symbol-method');
            item.contextValue = 'uplcNode';
            return item;
        }
        
        const loadedRuntime = this.runtime as BuiltinRuntimeLazy;
        const item = new vscode.TreeItem(`Builtin Runtime (${loadedRuntime.args.length} args)`, vscode.TreeItemCollapsibleState.Collapsed);
        item.iconPath = new vscode.ThemeIcon('symbol-method');
        item.contextValue = 'uplcNode';
        return item;
    }
    
    getChildren(): UplcNode[] | Promise<UplcNode[]> {
        if (!isLoaded(this.runtime)) {
            const typeInfo = this.runtime as { _type: string; _kind: string; _length?: number | null };
            
            // If we have SessionController, create LoadableLazyNode that will load data
            if (this.sessionController && this.path.length > 0) {
                const loadFn = async (path: string[], dataSource: string) => {
                    const pathJson = JSON.stringify(path);
                    switch (dataSource) {
                        case 'machineState':
                            return await this.sessionController.getMachineStateLazy(pathJson, false);
                        case 'context':
                            return await this.sessionController.getMachineContextLazy(pathJson, false);
                        case 'env':
                            return await this.sessionController.getCurrentEnvLazy(pathJson, false);
                    }
                };
                
                const loadableNode = new LoadableLazyNode(
                    'Builtin Runtime',
                    this.path,
                    this.dataSource,
                    typeInfo,
                    loadFn
                );
                return loadableNode.getChildren();
            }
            
            return [new SimpleNode('Data not loaded')];
        }
        
        const loadedRuntime = this.runtime as BuiltinRuntimeLazy;
        return [
            new SimpleNode(`Function: ${loadedRuntime.fun}`),
            new SimpleNode(`Forces: ${loadedRuntime.forces}`),
            new SimpleNode(`Arity: ${loadedRuntime.arity}`),
            ...loadedRuntime.args.map((arg, i) => new ValueNodeLazy(
                arg, 
                `Arg ${i}`,
                [...this.path, 'args', String(i)],
                this.dataSource,
                this.sessionController
            ))
        ];
    }
}

export class TermNode implements UplcNode {
    constructor(private term: Term, private label: string = 'Term') {}
    getTreeItem(): vscode.TreeItem {
        const termType = this.term.term_type;
        const displayLabel = this.getLabel();
        const item = new vscode.TreeItem(displayLabel, this.hasChildren() ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        
        let iconName: string = 'symbol-misc';
        switch(termType) {
            case "Var": 
                iconName = 'symbol-variable';
                break;
            case "Lambda": 
                iconName = 'symbol-function';
                break;
            case "Apply": 
                iconName = 'activate-breakpoints';
                break;
            case "Constant": 
                iconName = 'symbol-constant';
                break;
            case "Delay": 
                iconName = 'debug-pause';
                break;
            case "Force": 
                iconName = 'debug-continue';
                break;
            case "Builtin": 
                iconName = 'symbol-module';
                break;
            case "Error": 
                iconName = 'error';
                break;
            case "Constr": 
                iconName = 'symbol-class';
                break;
            case "Case": 
                iconName = 'symbol-enum';
                break;
        }
        item.iconPath = new vscode.ThemeIcon(iconName);
        item.contextValue = 'uplcNode';
        return item;
    }

    private getLabel(): string {
        const termType = this.term.term_type;
        let displayLabel = `${this.label} (${termType})`;
        
        switch(termType) {
            case "Var":
                displayLabel = `${this.label}: ${this.term.name}`;
                break;
            case "Lambda":
                displayLabel = `${this.label} (λ ${this.term.parameterName})`;
                break;
            case "Builtin":
                displayLabel = `${this.label} (${this.term.fun})`;
                break;
            case "Constr":
                displayLabel = `${this.label} (Constr tag: ${this.term.constructorTag})`;
                break;
        }
        
        return displayLabel;
    }

    private hasChildren(): boolean {
        const termType = this.term.term_type;
        return termType === "Lambda" || termType === "Apply" || termType === "Delay" || 
               termType === "Force" || termType === "Constr" || termType === "Case" || 
               termType === "Constant";
    }

    getChildren(): UplcNode[] {
        const t = this.term;
        switch (t.term_type) {
            case "Var":
                return [];
            case "Delay":
                return [new TermNode(t.term, 'Delayed term')];
            case "Lambda":
                return [
                    new SimpleNode(`Parameter: ${t.parameterName}`),
                    new TermNode(t.body, 'Body')
                ];
            case "Apply":
                return [
                    new TermNode(t.function, 'Function'),
                    new TermNode(t.argument, 'Argument')
                ];
            case "Constant":
                return [new ConstantNode(t.constant, 'Constant')];
            case "Force":
                return [new TermNode(t.term, 'Forced term')];
            case "Error":
                return [];
            case "Builtin":
                return [new SimpleNode(`Builtin: ${t.fun}`)];
            case "Constr":
                return [
                    new SimpleNode(`Constructor tag: ${t.constructorTag}`),
                    ...t.fields.map((f, i) => new TermNode(f, `Field ${i}`))
                ];
            case "Case":
                return [
                    new TermNode(t.constr, 'Constr to match'),
                    ...t.branches.map((b, i) => new TermNode(b, `Branch ${i}`))
                ];
        }
    }
}

export class TermNodeLazy implements UplcNode {
    constructor(
        public term: TermLazy | LazyLoadableTerm, 
        private label: string = 'Term',
        public path: string[] = [],
        public dataSource: 'machineState' | 'context' | 'env' = 'machineState',
        private sessionController?: any
    ) {}
    
    getTreeItem(): vscode.TreeItem {
        if (!isLoaded(this.term)) {
            // Use _type and _kind to build informative label
            const typeInfo = this.term as { _type: string; _kind: string; _length?: number | null };
            let displayLabel = this.label;
            if (typeInfo._type && typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._type}: ${typeInfo._kind})`;
            } else if (typeInfo._kind) {
                displayLabel = `${this.label} (${typeInfo._kind})`;
            }
            const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);
            item.iconPath = new vscode.ThemeIcon('symbol-misc');
            item.contextValue = 'uplcNode';
            return item;
        }
        
        const loadedTerm = this.term as TermLazy;
        const termType = loadedTerm.term_type;
        const displayLabel = this.getLabel(loadedTerm);
        const item = new vscode.TreeItem(displayLabel, this.hasChildren(loadedTerm) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        
        let iconName: string = 'symbol-misc';
        switch(termType) {
            case "Var": 
                iconName = 'symbol-variable';
                break;
            case "Lambda": 
                iconName = 'symbol-function';
                break;
            case "Apply": 
                iconName = 'activate-breakpoints';
                break;
            case "Constant": 
                iconName = 'symbol-constant';
                break;
            case "Delay": 
                iconName = 'debug-pause';
                break;
            case "Force": 
                iconName = 'debug-continue';
                break;
            case "Builtin": 
                iconName = 'symbol-module';
                break;
            case "Error": 
                iconName = 'error';
                break;
            case "Constr": 
                iconName = 'symbol-class';
                break;
            case "Case": 
                iconName = 'symbol-enum';
                break;
        }
        item.iconPath = new vscode.ThemeIcon(iconName);
        item.contextValue = 'uplcNode';
        return item;
    }

    private getLabel(term: TermLazy): string {
        const termType = term.term_type;
        let displayLabel = `${this.label} (${termType})`;
        
        switch(termType) {
            case "Var":
                displayLabel = `${this.label}: ${term.name}`;
                break;
            case "Lambda":
                displayLabel = `${this.label} (λ ${term.parameterName})`;
                break;
            case "Builtin":
                displayLabel = `${this.label} (${term.fun})`;
                break;
            case "Constr":
                displayLabel = `${this.label} (Constr tag: ${term.constructorTag})`;
                break;
        }
        
        return displayLabel;
    }

    private hasChildren(term: TermLazy): boolean {
        const termType = term.term_type;
        return termType === "Lambda" || termType === "Apply" || termType === "Delay" || 
               termType === "Force" || termType === "Constr" || termType === "Case" || 
               termType === "Constant";
    }

    getChildren(): UplcNode[] | Promise<UplcNode[]> {
        if (!isLoaded(this.term)) {
            const typeInfo = this.term as { _type: string; _kind: string; _length?: number | null };
            
            // If we have SessionController, create LoadableLazyNode that will load data
            if (this.sessionController && this.path.length > 0) {
                const loadFn = async (path: string[], dataSource: string) => {
                    const pathJson = JSON.stringify(path);
                    switch (dataSource) {
                        case 'machineState':
                            return await this.sessionController.getMachineStateLazy(pathJson, false);
                        case 'context':
                            return await this.sessionController.getMachineContextLazy(pathJson, false);
                        case 'env':
                            return await this.sessionController.getCurrentEnvLazy(pathJson, false);
                    }
                };
                
                const loadableNode = new LoadableLazyNode(
                    this.label,
                    this.path,
                    this.dataSource,
                    typeInfo,
                    loadFn,
                    this.sessionController
                );
                return loadableNode.getChildren();
            }
            
            return [new SimpleNode('Data not loaded')];
        }
        
        const t = this.term as TermLazy;
        switch (t.term_type) {
            case "Var":
                return [];
            case "Delay":
                return [new TermNodeLazy(t.term, 'Delayed term')];
            case "Lambda":
                return [
                    new SimpleNode(`Parameter: ${t.parameterName}`),
                    new TermNodeLazy(t.body, 'Body')
                ];
            case "Apply":
                return [
                    new TermNodeLazy(t.function, 'Function'),
                    new TermNodeLazy(t.argument, 'Argument')
                ];
            case "Constant":
                return [new ConstantNodeLazy(t.constant, 'Constant')];
            case "Force":
                return [new TermNodeLazy(t.term, 'Forced term')];
            case "Error":
                return [];
            case "Builtin":
                return [new SimpleNode(`Builtin: ${t.fun}`)];
            case "Constr":
                return [
                    new SimpleNode(`Constructor tag: ${t.constructorTag}`),
                    ...t.fields.map((f, i) => new TermNodeLazy(f, `Field ${i}`))
                ];
            case "Case":
                return [
                    new TermNodeLazy(t.constr, 'Constr to match'),
                    ...t.branches.map((b, i) => new TermNodeLazy(b, `Branch ${i}`))
                ];
        }
    }
}