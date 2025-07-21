import { Budget } from "../common";
import { MachineContext, MachineState, Term, Env } from "../debugger-types";

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
    getMachineContext(sessionId: string): Promise<MachineContext[]>;
    getLogs(sessionId: string): Promise<string[]>;
    getMachineState(sessionId: string): Promise<MachineState>;
    getBudget(sessionId: string): Promise<Budget>;
    getScript(sessionId: string): Promise<Term>;
    getCurrentTermId(sessionId: string): Promise<string>;
    getCurrentEnv(sessionId: string): Promise<Env>;
    start(sessionId: string): Promise<void>;
    continue(sessionId: string): Promise<void>;
    step(sessionId: string): Promise<void>;
    stop(sessionId: string): Promise<void>;
    pause(sessionId: string): Promise<void>;
    setBreakpointsList(sessionId: string, breakpoints: string[]): Promise<void>;
} 