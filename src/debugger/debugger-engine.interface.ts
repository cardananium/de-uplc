import { Budget } from "../common";
import { Context } from "../uplc-models/context";
import { MachineState } from "../uplc-models/machine-state";
import { TermWithId } from "../uplc-models/term";
import { Value } from "../uplc-models/value";

export interface IDebuggerEngine {
    // Methods from DebuggerManager
    openTransaction(script: string): Promise<void>;
    getRedeemers(): Promise<string[]>;
    getTransactionId(): Promise<string>;
    initDebugSession(redeemer: string): Promise<string>; // Returns session ID instead of SessionController
    terminateDebugging(sessionId: string): Promise<void>;

    // Methods from SessionController (with sessionId parameter)
    getTxScriptContext(sessionId: string): Promise<any>;
    getRedeemer(sessionId: string): Promise<string>;
    getPlutusCoreVersion(sessionId: string): Promise<string>;
    getPlutusLanguageVersion(sessionId: string): Promise<string | undefined>;
    getScriptHash(sessionId: string): Promise<string>;
    getMachineContext(sessionId: string): Promise<Context[]>;
    getLogs(sessionId: string): Promise<string[]>;
    getMachineState(sessionId: string): Promise<MachineState>;
    getBudget(sessionId: string): Promise<Budget>;
    getScript(sessionId: string): Promise<TermWithId>;
    getCurrentTermId(sessionId: string): Promise<string>;
    getCurrentEnv(sessionId: string): Promise<Value[]>;
    start(sessionId: string): Promise<void>;
    continue(sessionId: string): Promise<void>;
    step(sessionId: string): Promise<void>;
    stop(sessionId: string): Promise<void>;
    pause(sessionId: string): Promise<void>;
    setBreakpointsList(sessionId: string, breakpoints: string[]): Promise<void>;
} 