import { Constant } from "./constant";
import { DefaultFunction } from "./builtins";

export interface VarTerm {
    term_type: "Var";
    term_name: string;
    name: string;
}

export interface DelayTerm {
    term_type: "Delay";
    term_name: string;
    term: BaseTerm;
}

export interface LambdaTerm {
    term_type: "Lambda";
    term_name: string;
    parameterName: string;
    body: BaseTerm;
}

export interface ApplyTerm {
    term_type: "Apply";
    term_name: string;
    function: BaseTerm;
    argument: BaseTerm;
}

export interface ConstantTerm {
    term_type: "Constant";
    term_name: string;
    constant: Constant;
}

export interface ForceTerm {
    term_type: "Force";
    term_name: string;
    term: BaseTerm;
}

export interface ErrorTerm {
    term_type: "Error";
    term_name: string;
}

export interface BuiltinTerm {
    term_type: "Builtin";
    term_name: string;
    fun: DefaultFunction;
}

export interface ConstrTerm {
    term_type: "Constr";
    term_name: string;
    constructorTag: number;
    fields: BaseTerm[];
}

export interface CaseTerm {
    term_type: "Case";
    term_name: string;
    constr: BaseTerm;
    branches: BaseTerm[];
}

// Объединенный тип для базовых термов
export type BaseTerm =
    | VarTerm
    | DelayTerm
    | LambdaTerm
    | ApplyTerm
    | ConstantTerm
    | ForceTerm
    | ErrorTerm
    | BuiltinTerm
    | ConstrTerm
    | CaseTerm;

// Интерфейсы с id
export interface VarTermWithId extends VarTerm {
    id: string;
}

export interface DelayTermWithId extends Omit<DelayTerm, 'term'> {
    id: string;
    term: TermWithId;
}

export interface LambdaTermWithId extends Omit<LambdaTerm, 'body'> {
    id: string;
    body: TermWithId;
}

export interface ApplyTermWithId extends Omit<ApplyTerm, 'function' | 'argument'> {
    id: string;
    function: TermWithId;
    argument: TermWithId;
}

export interface ConstantTermWithId extends ConstantTerm {
    id: string;
}

export interface ForceTermWithId extends Omit<ForceTerm, 'term'> {
    id: string;
    term: TermWithId;
}

export interface ErrorTermWithId extends ErrorTerm {
    id: string;
}

export interface BuiltinTermWithId extends BuiltinTerm {
    id: string;
}

export interface ConstrTermWithId extends Omit<ConstrTerm, 'fields'> {
    id: string;
    fields: TermWithId[];
}

export interface CaseTermWithId extends Omit<CaseTerm, 'constr' | 'branches'> {
    id: string;
    constr: TermWithId;
    branches: TermWithId[];
}

export type TermWithId =
    | VarTermWithId
    | DelayTermWithId
    | LambdaTermWithId
    | ApplyTermWithId
    | ConstantTermWithId
    | ForceTermWithId
    | ErrorTermWithId
    | BuiltinTermWithId
    | ConstrTermWithId
    | CaseTermWithId;

export function convertToBaseTerm(term: TermWithId): BaseTerm {
    const { id, ...baseFields } = term;

    switch (term.term_type) {
        case "Var":
            return baseFields as VarTerm;

        case "Delay":
            return {
                ...baseFields,
                term: convertToBaseTerm(term.term)
            } as DelayTerm;

        case "Lambda":
            return {
                ...baseFields,
                body: convertToBaseTerm(term.body)
            } as LambdaTerm;

        case "Apply":
            return {
                ...baseFields,
                function: convertToBaseTerm(term.function),
                argument: convertToBaseTerm(term.argument)
            } as ApplyTerm;

        case "Constant":
            return baseFields as ConstantTerm;

        case "Force":
            return {
                ...baseFields,
                term: convertToBaseTerm(term.term)
            } as ForceTerm;

        case "Error":
            return baseFields as ErrorTerm;

        case "Builtin":
            return baseFields as BuiltinTerm;

        case "Constr":
            return {
                ...baseFields,
                fields: term.fields.map(field => convertToBaseTerm(field))
            } as ConstrTerm;

        case "Case":
            return {
                ...baseFields,
                constr: convertToBaseTerm(term.constr),
                branches: term.branches.map(branch => convertToBaseTerm(branch))
            } as CaseTerm;
    }
}