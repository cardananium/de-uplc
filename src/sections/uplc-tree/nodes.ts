import * as vscode from 'vscode';
import { MachineState, BuiltinRuntime, Constant, Term, Type, Env, Value, MachineContext } from '../../debugger-types';

export interface UplcNode {
    getTreeItem(): vscode.TreeItem;
    getChildren(): UplcNode[];
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

export class MachineStateNode implements UplcNode {
    constructor(public state: MachineState) {}

    getTreeItem(): vscode.TreeItem {
        let label = `${this.state.machine_state_type}`;
        const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
        item.iconPath = new vscode.ThemeIcon('gear');
        item.contextValue = 'uplcNode';
        return item;
    }

    getChildren(): UplcNode[] {
        switch (this.state.machine_state_type) {
            case "Return":
                return [new ValueNode(this.state.value, 'Return value')];
            case "Compute":
                return [new TermNode(this.state.term, 'Term to compute')];
            case "Done":
                return [new TermNode(this.state.term, 'Computed term')];
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
                return [new EnvNode(this.context.env), new TermNode(this.context.term, 'Await Fun Term')];
            case "FrameAwaitFunValue":
                return [new ValueNode(this.context.value, 'Await Fun Value')];
            case "FrameForce":
                return [];
            case "FrameConstr":
                return [
                    new EnvNode(this.context.env),
                    new SimpleNode(`Constructor tag: ${this.context.tag}`),
                    ...this.context.terms.map((t, i) => new TermNode(t, `Remaining term ${i}`)),
                    ...this.context.values.map((v, i) => new ValueNode(v, `Evaluated value ${i}`))
                ];
            case "FrameCases":
                return [
                    new EnvNode(this.context.env),
                    ...this.context.terms.map((b, i) => new TermNode(b, `Branch ${i}`))
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
        return this.env.values.map((v, i) => new ValueNode(v, `Env[${i}]`));
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
                iconName = 'symbol-constructor';
                break;
            default:
                iconName = 'symbol-value';
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
                return [new TermNode(this.value.body, 'Delayed Term'), new EnvNode(this.value.env)];
            case "Lambda":
                return [
                    new SimpleNode(`Parameter: ${this.value.parameterName}`),
                    new TermNode(this.value.body, 'Body'),
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

export class ConstantNode implements UplcNode {
    constructor(private constant: Constant, private label: string = 'Constant') {}
    
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
            this.constant.type === "ProtoList" ? 'list-tree' :
            this.constant.type === "ProtoPair" ? 'symbol-struct' :
            this.constant.type === "Data" ? 'symbol-object' :
            this.constant.type === "Unit" ? 'symbol-misc' :
            'symbol-constant'
        );
        
        // Improved label display with actual values
        if (this.constant.type === "Integer") {
            item.label = `${this.label}: ${this.constant.value}`;
        } else if (this.constant.type === "String") {
            item.label = `${this.label}: "${this.constant.value}"`;
        } else if (this.constant.type === "Bool") {
            item.label = `${this.label}: ${this.constant.value}`;
        } else if (this.constant.type === "ByteString") {
            item.label = `${this.label}: 0x${this.constant.value}`;
        } else if (this.constant.type === "ProtoList") {
            item.label = `${this.label}: List[${this.constant.elementType.type}] (${this.constant.values.length} items)`;
        } else if (this.constant.type === "ProtoPair") {
            item.label = `${this.label}: Pair<${this.constant.first_type.type}, ${this.constant.second_type.type}>`;
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
                iconName = 'list-tree';
                break;
            case "Pair":
                iconName = 'symbol-struct';
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
                return [
                    new SimpleNode('PairType'),
                    new TypeNode(t.first_type, 'First Type'),
                    new TypeNode(t.second_type, 'Second Type')
                ];
            case "Data":
                return [new SimpleNode('DataType')];
            case "Bls12_381G1Element":
                return [new SimpleNode('Bls12_381G1ElementType')];
            case "Bls12_381G2Element":
                return [new SimpleNode('Bls12_381G2ElementType')];
            case "Bls12_381MlResult":
                return [new SimpleNode('Bls12_381MlResultType')];
        }
    }
}

export class TermNode implements UplcNode {
    constructor(private term: Term, private label: string = 'Term') {}
    getTreeItem(): vscode.TreeItem {
        // Create more informative labels based on term type
        let displayLabel = this.label;
        if (this.term.term_type === "Var") {
            displayLabel = `${this.label} (${this.term.term_type}: ${this.term.name})`;
        } else if (this.term.term_type === "Lambda") {
            displayLabel = `${this.label} (${this.term.term_type}: ${this.term.parameterName})`;
        } else if (this.term.term_type === "Builtin") {
            displayLabel = `${this.label} (${this.term.term_type}: ${this.term.fun})`;
        } else if (this.term.term_type === "Constr") {
            displayLabel = `${this.label} (${this.term.term_type}: tag=${this.term.constructorTag})`;
        } else {
            displayLabel = `${this.label} (${this.term.term_type})`;
        }
        
        const item = new vscode.TreeItem(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);
        
        let iconName: string;
        switch (this.term.term_type) {
            case "Var":
                iconName = 'symbol-variable';
                break;
            case "Delay":
                iconName = 'debug-pause';
                break;
            case "Lambda":
                iconName = 'symbol-function';
                break;
            case "Apply":
                iconName = 'arrow-right';
                break;
            case "Constant":
                iconName = 'symbol-constant';
                break;
            case "Force":
                iconName = 'play';
                break;
            case "Error":
                iconName = 'error';
                break;
            case "Builtin":
                iconName = 'symbol-module';
                break;
            case "Constr":
                iconName = 'symbol-constructor';
                break;
            case "Case":
                iconName = 'symbol-enum';
                break;
            default:
                iconName = 'symbol-misc';
        }
        
        item.iconPath = new vscode.ThemeIcon(iconName);
        item.contextValue = 'uplcNode';
        return item;
    }
    getChildren(): UplcNode[] {
        switch (this.term.term_type) {
            case "Var":
                return [new SimpleNode(`Var: ${this.term.name}`)];
            case "Delay":
                return [new TermNode(this.term.term, 'Delayed Term')];
            case "Lambda":
                return [
                    new SimpleNode(`Parameter: ${this.term.parameterName}`),
                    new TermNode(this.term.body, 'Body')
                ];
            case "Apply":
                return [
                    new TermNode(this.term.function, 'Function'),
                    new TermNode(this.term.argument, 'Argument')
                ];
            case "Constant":
                return [new ConstantNode(this.term.constant)];
            case "Force":
                return [new TermNode(this.term.term, 'Forced Term')];
            case "Error":
                return [new SimpleNode('ErrorTerm')];
            case "Builtin":
                return [new SimpleNode(`Builtin: ${this.term.fun}`)];
            case "Constr":
                return [
                    new SimpleNode(`Constructor Tag: ${this.term.constructorTag}`),
                    ...this.term.fields.map((f, i) => new TermNode(f, `Field ${i}`))
                ];
            case "Case":
                return [
                    new TermNode(this.term.constr, 'Constr to match'),
                    ...this.term.branches.map((b, i) => new TermNode(b, `Branch ${i}`))
                ];
        }
    }
}

export class BuiltinRuntimeNode implements UplcNode {
    constructor(private runtime: BuiltinRuntime) {}
    getTreeItem(): vscode.TreeItem {
        const item = new vscode.TreeItem(
            `BuiltinRuntime: ${this.runtime.fun} (${this.runtime.args.length}/${this.runtime.arity} args)`, 
            vscode.TreeItemCollapsibleState.Collapsed
        );
        item.iconPath = new vscode.ThemeIcon('vm');
        item.contextValue = 'uplcNode';
        return item;
    }
    getChildren(): UplcNode[] {
        const nodes: UplcNode[] = [];
        nodes.push(new SimpleNode(`Function: ${this.runtime.fun}`));
        nodes.push(new SimpleNode(`Current Forces: ${this.runtime.forces}`));
        nodes.push(new SimpleNode(`Arity: ${this.runtime.arity}`));
        nodes.push(new SimpleNode(`Function Force Count: ${this.runtime.forces}`));
        this.runtime.args.forEach((arg, i) => nodes.push(new ValueNode(arg, `Arg ${i}`)));
        return nodes;
    }
}