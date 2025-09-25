import { Worker } from 'worker_threads';
import { Budget, DebuggerContext, UtxoReference } from '../common';
import {
  MachineContext,
  MachineState,
  Term,
  Env,
  ExecutionStatus,
} from '../debugger-types';
import { IDebuggerEngine } from './debugger-engine.interface';
import * as path from 'path';

interface WorkerMessage {
  id: string;
  method: string;
  args: any[];
}

interface WorkerResponse {
  id: string;
  result?: any;
  error?: string;
}

interface WorkerEvent {
  type: 'event';
  eventName: string;
  data?: any;
}

export class WasmDebuggerEngineWorker implements IDebuggerEngine {
  private worker: Worker | undefined;
  private messageId = 0;
  private pendingCalls = new Map<string, { resolve: Function; reject: Function }>();
  private workerReady = false;
  private workerReadyPromise: Promise<void>;
  private workerReadyResolve!: () => void;

  // Event handlers
  public onStop: (() => void) | undefined;
  public onPause: (() => void) | undefined;
  public onBreakpoint: ((termId: number) => void) | undefined;
  public onExecutionComplete: ((result: ExecutionStatus) => void) | undefined;

  constructor() {
    this.workerReadyPromise = new Promise(resolve => {
      this.workerReadyResolve = resolve;
    });
    this.initializeWorker();
  }

  private initializeWorker() {
    console.log('[WasmDebuggerEngineWorker] Initializing worker thread...');
    
    // Create worker with 64MB stack size
    // Use require.resolve to get the correct path in webpack bundle
    let workerPath: string;
    try {
      // For webpack, the worker file will be in the same directory
      workerPath = path.join(__dirname, 'wasm-worker.js');
      console.log('[WasmDebuggerEngineWorker] Worker path:', workerPath);
    } catch (e) {
      console.error('[WasmDebuggerEngineWorker] Failed to resolve worker path:', e);
      throw e;
    }

    this.worker = new Worker(workerPath, {
      workerData: {},
      resourceLimits: {
        stackSizeMb: 1024 // 1GB
      }
    });

    // Handle messages from worker
    this.worker.on('message', (message: WorkerResponse | WorkerEvent | { type: 'ready' }) => {
      console.log('[WasmDebuggerEngineWorker] Received message from worker:', message);
      if ('type' in message) {
        if (message.type === 'ready') {
          console.log('[WasmDebuggerEngineWorker] Worker is ready');
          this.workerReady = true;
          this.workerReadyResolve();
        } else if (message.type === 'event') {
          this.handleWorkerEvent(message);
        }
      } else {
        this.handleWorkerResponse(message);
      }
    });

    // Handle worker errors
    this.worker.on('error', error => {
      console.error('[WasmDebuggerEngineWorker] Worker error:', error);
      this.rejectAllPending(error);
    });

    // Handle worker exit
    this.worker.on('exit', code => {
      console.log(`[WasmDebuggerEngineWorker] Worker exited with code ${code}`);
      if (code !== 0) {
        console.error(`[WasmDebuggerEngineWorker] Worker stopped with exit code ${code}`);
        this.rejectAllPending(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  }

  private async ensureWorkerReady() {
    if (!this.workerReady) {
      await this.workerReadyPromise;
    }
  }

  private handleWorkerResponse(response: WorkerResponse) {
    const pending = this.pendingCalls.get(response.id);
    if (pending) {
      this.pendingCalls.delete(response.id);
      if (response.error) {
        pending.reject(new Error(response.error));
      } else {
        pending.resolve(response.result);
      }
    }
  }

  private handleWorkerEvent(event: WorkerEvent) {
    switch (event.eventName) {
      case 'stop':
        if (this.onStop) this.onStop();
        break;
      case 'pause':
        if (this.onPause) this.onPause();
        break;
      case 'breakpoint':
        if (this.onBreakpoint) this.onBreakpoint(event.data);
        break;
      case 'executionComplete':
        if (this.onExecutionComplete) this.onExecutionComplete(event.data);
        break;
    }
  }

  private rejectAllPending(error: Error) {
    for (const pending of this.pendingCalls.values()) {
      pending.reject(error);
    }
    this.pendingCalls.clear();
  }

  private async callWorker<T>(method: string, ...args: any[]): Promise<T> {
    console.log(`[WasmDebuggerEngineWorker] Calling worker method: ${method}`);
    await this.ensureWorkerReady();

    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = (this.messageId++).toString();
    
    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });
      
      const message: WorkerMessage = { id, method, args };
      console.log(`[WasmDebuggerEngineWorker] Sending message to worker:`, { id, method });
      this.worker!.postMessage(message);
      
      // Add timeout for debugging
      setTimeout(() => {
        if (this.pendingCalls.has(id)) {
          console.error(`[WasmDebuggerEngineWorker] Call to ${method} timed out after 1800s`);
          this.pendingCalls.delete(id);
          reject(new Error(`Worker call to ${method} timed out`));
        }
      }, 1800000);
    });
  }

  // IDebuggerEngine implementation
  async getRequiredUtxos(script: string): Promise<UtxoReference[]> {
    return this.callWorker('getRequiredUtxos', script);
  }

  async openTransaction(context: DebuggerContext): Promise<void> {
    console.log('[WasmDebuggerEngineWorker] openTransaction called with context:', context.transaction.substring(0, 100) + '...');
    return this.callWorker('openTransaction', context);
  }

  async getRedeemers(): Promise<string[]> {
    return this.callWorker('getRedeemers');
  }

  async getTransactionId(): Promise<string> {
    return this.callWorker('getTransactionId');
  }

  async initDebugSession(redeemer: string): Promise<string> {
    return this.callWorker('initDebugSession', redeemer);
  }

  async terminateDebugging(sessionId: string): Promise<void> {
    const result = await this.callWorker('terminateDebugging', sessionId);
    this.clearEventHandlers();
  }

  async getTxScriptContext(sessionId: string): Promise<any> {
    return this.callWorker('getTxScriptContext', sessionId);
  }

  async getRedeemer(sessionId: string): Promise<string> {
    return this.callWorker('getRedeemer', sessionId);
  }

  async getPlutusCoreVersion(sessionId: string): Promise<string> {
    return this.callWorker('getPlutusCoreVersion', sessionId);
  }

  async getPlutusLanguageVersion(sessionId: string): Promise<string | undefined> {
    return this.callWorker('getPlutusLanguageVersion', sessionId);
  }

  async getScriptHash(sessionId: string): Promise<string> {
    return this.callWorker('getScriptHash', sessionId);
  }

  async getMachineContext(sessionId: string): Promise<MachineContext[]> {
    return this.callWorker('getMachineContext', sessionId);
  }

  async getLogs(sessionId: string): Promise<string[]> {
    return this.callWorker('getLogs', sessionId);
  }

  async getMachineState(sessionId: string): Promise<MachineState> {
    return this.callWorker('getMachineState', sessionId);
  }

  async getBudget(sessionId: string): Promise<Budget> {
    return this.callWorker('getBudget', sessionId);
  }

  async getScript(sessionId: string): Promise<Term> {
    return this.callWorker('getScript', sessionId);
  }

  async getCurrentTermId(sessionId: string): Promise<number | undefined> {
    return this.callWorker('getCurrentTermId', sessionId);
  }

  async getCurrentEnv(sessionId: string): Promise<Env> {
    return this.callWorker('getCurrentEnv', sessionId);
  }

  async start(sessionId: string): Promise<void> {
    return this.callWorker('start', sessionId);
  }

  async continue(sessionId: string): Promise<void> {
    return this.callWorker('continue', sessionId);
  }

  async step(sessionId: string): Promise<void> {
    return this.callWorker('step', sessionId);
  }

  async stop(sessionId: string): Promise<void> {
    return this.callWorker('stop', sessionId);
  }

  async pause(sessionId: string): Promise<void> {
    return this.callWorker('pause', sessionId);
  }

  async setBreakpointsList(sessionId: string, breakpoints: number[]): Promise<void> {
    return this.callWorker('setBreakpointsList', sessionId, breakpoints);
  }

  /**
   * Set event handlers for debugging events
   */
  setEventHandlers(handlers: {
    onStop?: () => void;
    onPause?: () => void;
    onBreakpoint?: (termId: number) => void;
    onExecutionComplete?: (result: ExecutionStatus) => void;
  }): void {
    this.onStop = handlers.onStop;
    this.onPause = handlers.onPause;
    this.onBreakpoint = handlers.onBreakpoint;
    this.onExecutionComplete = handlers.onExecutionComplete;
  }

  /**
   * Clear all event handlers
   */
  clearEventHandlers(): void {
    this.onStop = undefined;
    this.onPause = undefined;
    this.onBreakpoint = undefined;
    this.onExecutionComplete = undefined;
  }

  /**
   * Check if we're at a breakpoint
   */
  async isAtBreakpoint(): Promise<boolean> {
    return this.callWorker('isAtBreakpoint');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = undefined;
    }
    this.pendingCalls.clear();
    this.clearEventHandlers();
  }
}
