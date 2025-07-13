import { BuiltinRuntime } from "./builtins";
import { Constant } from "./constant";
import { Context } from "./context";
import { TermWithId } from "./term";
import { Value } from "./value";

export type AnyUplcData = 
    | BuiltinRuntime
    | Value
    | Value[]
    | TermWithId
    | TermWithId[]
    | Constant 
    | Constant[] 
    | Context;