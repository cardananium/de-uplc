import { Budget } from "../common";
import { Env, MachineContext, MachineState, Term } from "../debugger-types";
import { IDebuggerEngine } from "./debugger-engine.interface";

export class SessionController {

    constructor(
        private sessionId: string,
        private debuggerEngine: IDebuggerEngine
    ) {
    }

    public async getTxScriptContext(): Promise<any> {
        return this.debuggerEngine.getTxScriptContext(this.sessionId);
    }

    public async setBreakpoints(breakpoints: number[]) {
        return this.debuggerEngine.setBreakpointsList(this.sessionId, breakpoints);
    }

    public async getRedeemer(): Promise<string> {
        return this.debuggerEngine.getRedeemer(this.sessionId);
    }
    
    public async getPlutusCoreVersion(): Promise<string> {
        return this.debuggerEngine.getPlutusCoreVersion(this.sessionId);
    }

    public async getPlutusLanguageVersion(): Promise<string | undefined> {
        return this.debuggerEngine.getPlutusLanguageVersion(this.sessionId);
    }

    public async getScriptHash(): Promise<string> {
        return this.debuggerEngine.getScriptHash(this.sessionId);
    }

    public async getMachineContext(): Promise<MachineContext[]> {
        return this.debuggerEngine.getMachineContext(this.sessionId);
    }

    public async getLogs(): Promise<string[]> {
        return this.debuggerEngine.getLogs(this.sessionId);
    }

    public async getMachineState(): Promise<MachineState | undefined> {
        return this.debuggerEngine.getMachineState(this.sessionId);
    }

    public async getBudget(): Promise<Budget | undefined> {
        return this.debuggerEngine.getBudget(this.sessionId);
    }

    public async getScript(): Promise<Term | undefined> {
        return this.debuggerEngine.getScript(this.sessionId);
    }

    public async getCurrentTermId(): Promise<number | undefined> {
        return this.debuggerEngine.getCurrentTermId(this.sessionId);
    }

    public async getCurrentEnv(): Promise<Env | undefined> {
        return this.debuggerEngine.getCurrentEnv(this.sessionId);
    }

    public async start() {
        return this.debuggerEngine.start(this.sessionId);
    }

    public async continue() {
        return this.debuggerEngine.continue(this.sessionId);
    }

    public async step() {
        return this.debuggerEngine.step(this.sessionId);
    }

    public async stop() {
        return this.debuggerEngine.stop(this.sessionId);
    }

    public async pause() {
        return this.debuggerEngine.pause(this.sessionId);
    }

    public async setBreakpointsList(breakpoints: number[]) {
        return this.debuggerEngine.setBreakpointsList(this.sessionId, breakpoints);
    }
}