import * as vscode from 'vscode';
import { SessionController } from './session-controller';
import { IDebuggerEngine } from './debugger-engine.interface';
import { MockDebuggerEngine } from './mock-debugger-engine';

export class DebuggerManager {

    private currentSession: SessionController | undefined;
    private debuggerEngine: IDebuggerEngine;

    constructor() {
        this.debuggerEngine = new MockDebuggerEngine();
    }

    public async openTransaction(script: string) {
        return this.debuggerEngine.openTransaction(script);
    }

    public async getRedeemers(): Promise<string[]> {
        return this.debuggerEngine.getRedeemers();
    }

    public async getTransactionId(): Promise<string> {
        return this.debuggerEngine.getTransactionId();
    }

    public async initDebugSession(redeemer: string): Promise<SessionController> {
        const sessionId = await this.debuggerEngine.initDebugSession(redeemer);
        this.currentSession = new SessionController(sessionId, this.debuggerEngine);
        return this.currentSession;
    }

    public async terminateDebugging() {
        if (this.currentSession) {
            await this.currentSession.stop();
            this.currentSession = undefined;
        }
    }
}