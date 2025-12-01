import { Budget, DebuggerContext, UtxoReference } from "../common";
import { 
    MachineContext, MachineState, Term, Env, ScriptContext,
    MachineContextLazy, MachineStateLazy, EnvLazy, ValueLazy
} from "../debugger-types";

export interface IDebuggerEngine {

    // Methods from DebuggerManager
    openTransaction(context: DebuggerContext): Promise<void>;
    getRedeemers(): Promise<string[]>;
    getTransactionId(): Promise<string>;
    initDebugSession(redeemer: string): Promise<string>; // Returns session ID instead of SessionController
    terminateDebugging(sessionId: string): Promise<void>;
    getRequiredUtxos(script: string): Promise<UtxoReference[]>;

    // Methods from SessionController (with sessionId parameter)
    getTxScriptContext(sessionId: string): Promise<ScriptContext>;
    getRedeemer(sessionId: string): Promise<string>;
    getPlutusCoreVersion(sessionId: string): Promise<string>;
    getPlutusLanguageVersion(sessionId: string): Promise<string | undefined>;
    getScriptHash(sessionId: string): Promise<string>;
    getMachineContext(sessionId: string): Promise<MachineContext[]>;
    getLogs(sessionId: string): Promise<string[]>;
    getMachineState(sessionId: string): Promise<MachineState | undefined>;
    getBudget(sessionId: string): Promise<Budget | undefined>;
    getScript(sessionId: string): Promise<Term | undefined>;
    getCurrentTermId(sessionId: string): Promise<number | undefined>;
    getCurrentEnv(sessionId: string): Promise<Env | undefined>;
    
    // Lazy loading methods
    // Note: Return type depends on the path:
    // - getMachineStateLazy: MachineStateLazy (path=""), ValueLazy (path="value.*"), EnvLazy (path="env.*")
    // - getMachineContextLazy: MachineContextLazy[] (path=""), MachineContextLazy (path="[i]"), ValueLazy/EnvLazy (path="[i].field.*")
    // - getCurrentEnvLazy: EnvLazy (path=""), ValueLazy (path="values[i].*")
    getMachineStateLazy(sessionId: string, path: string, returnFullObject: boolean): Promise<MachineStateLazy | ValueLazy | EnvLazy>;
    getMachineContextLazy(sessionId: string, path: string, returnFullObject: boolean): Promise<MachineContextLazy[] | MachineContextLazy | ValueLazy | EnvLazy>;
    getCurrentEnvLazy(sessionId: string, path: string, returnFullObject: boolean): Promise<EnvLazy | ValueLazy>;
    
    start(sessionId: string): Promise<void>;
    continue(sessionId: string): Promise<void>;
    step(sessionId: string): Promise<void>;
    stop(sessionId: string): Promise<void>;
    pause(sessionId: string): Promise<void>;
    setBreakpointsList(sessionId: string, breakpoints: number[]): Promise<void>;
} 