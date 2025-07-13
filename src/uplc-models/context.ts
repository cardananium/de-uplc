import { TermWithId } from "./term";
import { Env, Value } from "./value";

export type Context =
    | { context_type: "FrameAwaitArg", value: Value }
    | { context_type: "FrameAwaitFunTerm", env: Env, term: TermWithId }
    | { context_type: "FrameAwaitFunValue", value: Value }
    | { context_type: "FrameForce" }
    | { context_type: "FrameConstr", env: Env, constructorTag: number, remainingTerms: TermWithId[], evaluatedValues: Value[] }
    | { context_type: "FrameCases", env: Env, branches: TermWithId[] }
    | { context_type: "NoFrame" };
