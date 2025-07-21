import { BuiltinRuntime, Constant, MachineContext, Term, Value } from "../debugger-types";

export type AnyUplcData = 
    | BuiltinRuntime
    | Value
    | Value[]
    | Term
    | Term[]
    | Constant 
    | Constant[] 
    | MachineContext;