import * as vscode from 'vscode';
import { SessionController } from './session-controller';
import { IDebuggerEngine } from './debugger-engine.interface';
import { DataProvider } from '../data-providers/data-provider.interface';
import { getOnlineProvider, getOfflineDataProvider, KoiosClient } from '../data-providers';
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
        this.attachEngineSubscriptions();
    }

    public async openTransaction(path: string) {
        const context = await this.readTransactionContext(path);
        const filledContext = await this.fillContextData(context);
        return this.debuggerEngine.openTransaction(filledContext);
    }

    private attachEngineSubscriptions() {
        const engine = this.debuggerEngine as WasmEngineHostRunner;
        engine.onBreakpoint = (termId: number) => {
            EventEmitter.debuggerCaughtBreakpoint(termId);
        };

        engine.onExecutionComplete = (result: ExecutionStatus) => {
            if (result.status_type === 'Done') {
                const term = (result as { status_type: 'Done'; result: Term }).result;
                EventEmitter.debuggerCaughtFinished(term);
            } else if (result.status_type === 'Error') {
                const message = (result as { status_type: 'Error'; message: string }).message;
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
                        customEndpoint: parsed.customEndpoint,
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

    /**
     * Fills missing data in DebuggerContext following this workflow:
     * 1. If DebuggerContext already has required data, don't fetch it
     * 2. If not, try to fetch from offline provider first
     * 3. If offline provider doesn't have it, fetch from koios provider
     */
    public async fillContextData(context: DebuggerContext): Promise<DebuggerContext> {
        const filledContext = { ...context };

        // Ensure network is selected before fetching any network-dependent data
        if (!filledContext.network) {
            const selected = await vscode.window.showQuickPick(
                [
                    { label: 'mainnet', description: 'Cardano Mainnet' },
                    { label: 'preprod', description: 'Preprod Testnet' },
                    { label: 'preview', description: 'Preview Testnet' },
                    { label: 'Custom URL...', description: 'Enter a custom Koios endpoint URL' }
                ],
                {
                    title: 'Select Network',
                    placeHolder: 'Choose the network to use for fetching UTXOs and protocol parameters',
                    ignoreFocusOut: true,
                }
            );

            if (!selected) {
                // User cancelled selection — require an explicit choice to proceed
                await vscode.window.showErrorMessage('Network selection is required to proceed.', { modal: true });
                throw new Error('Network selection cancelled by user');
            }

            if (selected.label === 'Custom URL...') {
                // Prompt user for custom Koios URL
                const customUrl = await vscode.window.showInputBox({
                    title: 'Enter Custom Koios URL',
                    placeHolder: 'https://your-koios-instance.com',
                    prompt: 'Enter the base URL of your Koios instance (without /api/v1)',
                    ignoreFocusOut: true,
                    validateInput: (value) => {
                        if (!value || value.trim().length === 0) {
                            return 'URL cannot be empty';
                        }
                        try {
                            const url = new URL(value);
                            if (!['http:', 'https:'].includes(url.protocol)) {
                                return 'URL must use http:// or https://';
                            }
                            return null;
                        } catch {
                            return 'Invalid URL format';
                        }
                    }
                });

                if (!customUrl) {
                    await vscode.window.showErrorMessage('Custom URL is required to proceed.', { modal: true });
                    throw new Error('Custom URL input cancelled by user');
                }

                // Store custom endpoint and use a default network for slot config
                // We'll use 'mainnet' as default, but the actual endpoint will be custom
                filledContext.network = 'mainnet';
                filledContext.customEndpoint = customUrl.trim();
            } else {
                filledContext.network = selected.label as Network;
            }
        }

        const network: Network = filledContext.network as Network;

        // Fill UTXOs if missing
        if (!filledContext.utxos) {
            try {
                const requiredUtxos = await this.debuggerEngine.getRequiredUtxos(context.transaction);
                if (requiredUtxos.length > 0) {
                    filledContext.utxos = await this.fetchUtxos(requiredUtxos, network, filledContext.customEndpoint);
                    
                    // Check if all required UTXOs were fetched
                    const fetchedUtxos = filledContext.utxos;
                    const missingUtxos = requiredUtxos.filter(utxo =>
                        !fetchedUtxos.find(u => u.txHash === utxo.txHash && u.outputIndex === utxo.outputIndex)
                    );
                    
                    if (missingUtxos.length > 0) {
                        throw new Error(`Failed to fetch ${missingUtxos.length} required UTXOs: ${missingUtxos.map(u => `${u.txHash}:${u.outputIndex}`).join(', ')}`);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch required UTXOs:', error);
                throw new Error(`Unable to fetch required UTXOs: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        // Fill protocol parameters if missing
        if (!filledContext.protocolParams) {
            try {
                filledContext.protocolParams = await this.fetchProtocolParameters(network, filledContext.customEndpoint);
                if (!filledContext.protocolParams) {
                    throw new Error('Protocol parameters are required but could not be fetched from any provider');
                }
            } catch (error) {
                console.error('Failed to fetch protocol parameters:', error);
                throw new Error(`Unable to fetch protocol parameters: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        return filledContext;
    }

    /**
     * Fetches UTXOs with fallback: offline provider first, then koios provider
     */
    private async fetchUtxos(requiredUtxos: UtxoReference[], network: Network, customEndpoint?: string): Promise<UtxoOutput[]> {
        // Create provider with custom endpoint if provided
        const dataProvider = customEndpoint ? this.createKoiosProviderWithCustomEndpoint(customEndpoint) : getOnlineProvider();
        const offlineDataProvider = getOfflineDataProvider();
        let utxos: UtxoOutput[] = [];
        let missingUtxos = [...requiredUtxos];

        // Try offline provider first
        try {
            utxos = await offlineDataProvider.getUtxoInfo(requiredUtxos, network);
            missingUtxos = requiredUtxos.filter(utxo =>
                !utxos.find(u => u.txHash === utxo.txHash && u.outputIndex === utxo.outputIndex)
            );
        } catch (error) {
            console.warn('Offline provider failed to fetch UTXOs:', error);
        }

        // If there are still missing UTXOs, try koios provider
        if (missingUtxos.length > 0) {
            try {
                const additionalUtxos = await dataProvider.getUtxoInfo(missingUtxos, network);
                utxos = [...utxos, ...additionalUtxos];
            } catch (error) {
                console.warn('Koios provider failed to fetch UTXOs:', error);
            }
        }

        return utxos;
    }

    /**
     * Fetches protocol parameters with fallback: offline provider first, then koios provider
     */
    private async fetchProtocolParameters(network: Network, customEndpoint?: string): Promise<ProtocolParameters | undefined> {
        // Create provider with custom endpoint if provided
        const dataProvider = customEndpoint ? this.createKoiosProviderWithCustomEndpoint(customEndpoint) : getOnlineProvider();
        const offlineDataProvider = getOfflineDataProvider();

        // Try offline provider first
        try {
            return await offlineDataProvider.getProtocolParameters(network);
        } catch (error) {
            console.warn('Offline provider failed to fetch protocol parameters:', error);
        }

        // If offline provider failed, try koios provider
        try {
            return await dataProvider.getProtocolParameters(network);
        } catch (error) {
            console.warn('Koios provider failed to fetch protocol parameters:', error);
            return undefined;
        }
    }

    /**
     * Creates a KoiosClient instance with a custom endpoint
     */
    private createKoiosProviderWithCustomEndpoint(customEndpoint: string): DataProvider {
        const cfg = vscode.workspace.getConfiguration('deuplc.providers');
        const apiKey = cfg.get<string>('koios.apiKey') || undefined;
        const timeout = cfg.get<number>('timeout') ?? 30000;
        const retryAttempts = cfg.get<number>('retryAttempts') ?? 3;
        
        return new KoiosClient({
            apiKey,
            timeout,
            retryAttempts,
            customEndpoint,
        });
    }
}
