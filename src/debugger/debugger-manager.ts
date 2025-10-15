import * as vscode from 'vscode';
import { SessionController } from './session-controller';
import { IDebuggerEngine } from './debugger-engine.interface';

import { DebuggerContext, Network, UtxoOutput, UtxoReference, ProtocolParameters } from '../common';
import { EventEmitter } from '../events/event-emitter';
import { ExecutionStatus, Term } from '../debugger-types';
import { WasmDebuggerEngineWorker } from './wasm-engine-worker';
import { WasmEngineHostRunner } from './wasm-engine-host-runner';


export class DebuggerManager {

    private currentSession: SessionController | undefined;
    private debuggerEngine: IDebuggerEngine;

    constructor() {
        this.debuggerEngine = new WasmEngineHostRunner();
        console.log('DebuggerManager constructor: WasmDebuggerEngine');
        this.attachEngineSubscriptions();
    }

    public async openTransaction(path: string) {
        const context = await this.readTransactionContext(path);
        return this.debuggerEngine.openTransaction(context);
    }

    private attachEngineSubscriptions() {
        const engine = this.debuggerEngine as WasmEngineHostRunner;
        engine.onBreakpoint = (termId: number) => {
            EventEmitter.debuggerCaughtBreakpoint(termId);
        };

        engine.onExecutionComplete = (result: ExecutionStatus) => {
            console.log('[DebuggerManager] Execution completed with status:', result.status_type, result);

            if (result.status_type === 'Done') {
                const term = (result as { status_type: 'Done'; result: Term }).result;
                console.log('[DebuggerManager] Successful execution, showing result');
                EventEmitter.debuggerCaughtFinished(term);
            } else if (result.status_type === 'Error') {
                const message = (result as { status_type: 'Error'; message: string }).message;
                console.log('[DebuggerManager] Execution error:', message);
                EventEmitter.debuggerCaughtError(message);
            } else {
                console.warn('[DebuggerManager] Unexpected execution status:', result);
                EventEmitter.debuggerCaughtError(`Unexpected execution status: ${JSON.stringify(result)}`);
            }
        };
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

    public async setBreakpoints(breakpoints: number[]) {
        if (this.currentSession) {
            await this.currentSession.setBreakpointsList(breakpoints);
        }
    }

    private async readTransactionContext(path: string): Promise<DebuggerContext> {
        const fs = require('fs').promises;

        try {
            const content = await fs.readFile(path, 'utf8');

            // Try to parse as JSON first (DebuggerContext)
            try {
                const parsed = JSON.parse(content);

                // Check if it's a valid DebuggerContext
                if (parsed && typeof parsed === 'object' && 'transaction' in parsed) {
                    return {
                        utxos: parsed.utxos,
                        protocolParams: parsed.protocolParams,
                        network: parsed.network,
                        transaction: parsed.transaction
                    } as DebuggerContext;
                }
            } catch (jsonError) {
                // Not valid JSON, continue to try other formats
            }

            // Check if it's a hex string (starts with common hex prefixes or contains only hex chars)
            const trimmedContent = content.trim();
            const hexPattern = /^(0x)?[0-9a-fA-F]+$/;

            if (hexPattern.test(trimmedContent)) {
                // It's a hex string, use it as the transaction
                const transaction = trimmedContent.startsWith('0x') ? trimmedContent.slice(2) : trimmedContent;
                return {
                    utxos: undefined,
                    protocolParams: undefined,
                    network: undefined,
                    transaction: transaction
                };
            }

            // If not hex, treat as raw transaction bytes/text
            return {
                utxos: undefined,
                protocolParams: undefined,
                network: undefined,
                transaction: trimmedContent
            };

        } catch (error) {
            throw new Error(`Failed to read transaction file: ${error}`);
        }
    }
}
