import { BuiltinRuntime, DefaultFunction } from "./builtins";
import { Constant, IntegerNumber, Name } from "./constant";
import { TermWithId } from "./term";

export type Env = Value[];

export type Value =
    | { tag: "Con", constant: Constant }
    | { tag: "Delay", term: TermWithId, env: Env }
    | { tag: "Lambda", parameterName: Name, body: TermWithId, env: Env }
    | { tag: "Builtin", fun: DefaultFunction, runtime: BuiltinRuntime }
    | { tag: "Constr", constructorTag: IntegerNumber, fields: Value[] };