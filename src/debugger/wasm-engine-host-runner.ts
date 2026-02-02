import { Worker, TransferListItem } from 'worker_threads';
import { Budget, DebuggerContext, UtxoReference } from "../common";
import {
  MachineContext,
  MachineState,
  Term,
  Env,
  ExecutionStatus,
  ScriptContext,
} from "../debugger-types";
import { IDebuggerEngine } from "./debugger-engine.interface";
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
  transferables?: TransferListItem[];
}

interface WorkerEvent {
  type: 'event';
  eventName: string;
  data?: any;
  transferables?: TransferListItem[];
}

/**
 * Helper function to parse JSON from ArrayBuffer
 */
function parseJsonFromBuffer(buffer: ArrayBuffer): any {
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(buffer);
  return JSON.parse(jsonString);
}

export class WasmEngineHostRunner implements IDebuggerEngine {
  private worker: Worker | undefined;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  private breakpoints: number[] = [];
  private needStop: boolean = false;
  private isPaused: boolean = false;
  private currentSessionId: string = "";
  private runUntilBreakpointPromise: Promise<void> | undefined;
  private isExecuting: boolean = false;

  // Event handlers
  public onStop: (() => void) | undefined;
  public onPause: (() => void) | undefined;
  public onBreakpoint: ((termId: number) => void) | undefined;
  public onExecutionComplete: ((result: ExecutionStatus, termId: number) => void) | undefined;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    const workerPath = path.join(__dirname, 'wasm-worker-host-runner.js');
    this.worker = new Worker(workerPath);

    this.worker.on('message', (message: WorkerResponse | WorkerEvent, transferList?: readonly TransferListItem[]) => {
      if ((message as WorkerEvent).type === 'event') {
        this.handleWorkerEvent(message as WorkerEvent, transferList);
      } else {
        this.handleWorkerResponse(message as WorkerResponse, transferList);
      }
    });

    this.worker.on('error', (error) => {
      console.error('Worker error:', error);
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker stopped with exit code ${code}`);
      }
    });
  }

  private handleWorkerEvent(event: WorkerEvent, _transferList?: readonly TransferListItem[]) {
    // Since runUntilBreakpoint is now on host, we shouldn't receive these events from worker
    if (event.eventName !== 'ready') {
      console.warn(`[Host] Unknown event from worker: ${event.eventName}`);
    }
  }

  private handleWorkerResponse(response: WorkerResponse, _transferList?: readonly TransferListItem[]) {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      if (response.error) {
        pending.reject(new Error(response.error));
      } else {
        if (response.result instanceof ArrayBuffer) {
          try {
            const parsedResult = parseJsonFromBuffer(response.result);
            pending.resolve(parsedResult);
          } catch (error) {
            console.error('[Host] Failed to parse JSON from ArrayBuffer:', error);
            pending.reject(new Error('Failed to parse worker response'));
          }
        } else {
          pending.resolve(response.result);
        }
      }
    }
  }

  private async callWorker(method: string, ...args: any[]): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substr(2, 9);
      this.pendingRequests.set(id, { resolve, reject });
      
      const message: WorkerMessage = { id, method, args };
      this.worker!.postMessage(message);
    });
  }

  // IDebuggerEngine implementation
  async getRequiredUtxos(script: string): Promise<UtxoReference[]> {
    const result = await this.callWorker('getRequiredUtxos', script);
    return result as UtxoReference[];
  }

  async openTransaction(context: DebuggerContext): Promise<void> {
    return this.callWorker('openTransaction', context);
  }

  async getRedeemers(): Promise<string[]> {
    return this.callWorker('getRedeemers');
  }

  async getTransactionId(): Promise<string> {
    return this.callWorker('getTransactionId');
  }

  async initDebugSession(redeemer: string): Promise<string> {
    const sessionId = await this.callWorker('initDebugSession', redeemer);
    this.currentSessionId = sessionId;
    return sessionId;
  }

  async terminateDebugging(sessionId: string): Promise<void> {
    this.needStop = true;
    this.isPaused = false;
    
    if (this.runUntilBreakpointPromise) {
      try {
        await this.runUntilBreakpointPromise;
      } catch (error) {
        console.error('[Host] Error waiting for execution to terminate:', error);
      }
    }
    
    this.currentSessionId = "";
    await this.callWorker('terminateDebugging', sessionId);
    this.clearEventHandlers();
  }

  async getTxScriptContext(sessionId: string): Promise<ScriptContext> {
    const result = await this.callWorker('getTxScriptContext', sessionId);
    return result;
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
    if (this.isExecuting) {
      return [];
    }
    const result = await this.callWorker('getMachineContext', sessionId);
    return result as MachineContext[];
  }

  async getLogs(sessionId: string): Promise<string[]> {
    if (this.isExecuting) {
      return [];
    }
    const result = await this.callWorker('getLogs', sessionId);
    return result as string[];
  }

  async getMachineState(sessionId: string): Promise<MachineState | undefined> {
    if (this.isExecuting) {
      return undefined;
    }
    const result = await this.callWorker('getMachineState', sessionId);
    return result as MachineState;
  }

  async getBudget(sessionId: string): Promise<Budget | undefined> {
    if (this.isExecuting) {
      return undefined;
    }
    const result = await this.callWorker('getBudget', sessionId);
    return result as Budget;
  }

  async getScript(sessionId: string): Promise<Term | undefined> {
    const result = await this.callWorker('getScript', sessionId);
    return result as Term;
  }

  async getCurrentTermId(sessionId: string): Promise<number | undefined> {
    if (this.isExecuting) {
      return undefined;
    }
    return await this.callWorker('getCurrentTermId', sessionId);
  }

  async getCurrentEnv(sessionId: string): Promise<Env | undefined> {
    if (this.isExecuting) {
      return undefined;
    }
    const result = await this.callWorker('getCurrentEnv', sessionId);
    return result as Env;
  }

  async getMachineStateLazy(sessionId: string, path: string, returnFullObject: boolean): Promise<any> {
    if (this.isExecuting) {
      return undefined;
    }
    const result = await this.callWorker('getMachineStateLazy', sessionId, path, returnFullObject);
    return result;
  }

  async getMachineContextLazy(sessionId: string, path: string, returnFullObject: boolean): Promise<any> {
    if (this.isExecuting) {
      return [];
    }
    const result = await this.callWorker('getMachineContextLazy', sessionId, path, returnFullObject);
    return result;
  }

  async getCurrentEnvLazy(sessionId: string, path: string, returnFullObject: boolean): Promise<any> {
    if (this.isExecuting) {
      return undefined;
    }
    const result = await this.callWorker('getCurrentEnvLazy', sessionId, path, returnFullObject);
    return result;
  }

  async start(_sessionId: string): Promise<void> {
    if (this.isExecuting) {
      return;
    }
    
    this.needStop = false;
    this.isPaused = false;
    this.runUntilBreakpointPromise = this.runUntilBreakpoint();
  }

  async continue(sessionId: string): Promise<void> {
    this.needStop = false;
    if (!this.isPaused) {
      return this.start(sessionId);
    }

    if (this.isExecuting) {
      return;
    }

    this.isPaused = false;
    this.runUntilBreakpointPromise = this.runUntilBreakpoint();
  }

  async step(sessionId: string): Promise<void> {
    return this.callWorker('step', sessionId);
  }

  async stop(sessionId: string): Promise<void> {
    this.needStop = true;
    this.isPaused = false;
    
    if (this.runUntilBreakpointPromise) {
      try {
        await this.runUntilBreakpointPromise;
      } catch (error) {
        console.error('[Host] Error waiting for execution to stop:', error);
      }
    }
    
    await this.callWorker('stop', sessionId);
    
    if (this.onStop) {
      this.onStop();
    }
  }

  async pause(_sessionId: string): Promise<void> {
    if (!this.isPaused) {
      this.isPaused = true;
      this.needStop = true;
      
      if (this.runUntilBreakpointPromise) {
        try {
          await this.runUntilBreakpointPromise;
        } catch (error) {
          console.error('[Host] Error waiting for execution to pause:', error);
        }
      }
      
      if (this.onPause) {
        this.onPause();
      }
    }
  }

  async setBreakpointsList(_sessionId: string, breakpoints: number[]): Promise<void> {
    this.breakpoints = [...breakpoints];
  }

  /**
   * Run execution until breakpoint or completion
   * This now runs on the host instead of in the worker
   */
  private async runUntilBreakpoint(): Promise<void> {
    if (!this.currentSessionId) {
      return;
    }

    this.isExecuting = true;
    
    try {
      while (!this.needStop) {
        try {
          const stepResult = await this.callWorker('stepAndGetStatus', this.currentSessionId);
          
          if (!stepResult) {
            console.error('[Host] No step result received');
            break;
          }

          const { termId, status } = stepResult;

          if (this.breakpoints.includes(termId)) {
            this.isPaused = true;
            this.isExecuting = false;

            if (this.onBreakpoint) {
              this.onBreakpoint(termId);
            }
            break;
          }

          if (status.status_type === 'Done' || status.status_type === 'Error') {
            this.needStop = true;

            if (this.onExecutionComplete) {
              this.onExecutionComplete(status, termId);
            }
            break;
          }

          await new Promise(resolve => setTimeout(resolve, 1));
        } catch (error) {
          console.error('[Host] Error during execution:', error);
          this.needStop = true;
          this.isPaused = false;

          if (this.onExecutionComplete) {
            this.onExecutionComplete({
              status_type: 'Error',
              message: error instanceof Error ? error.message : 'Unknown error',
            }, -1);
          }
          break;
        }
      }
    } finally {
      this.isExecuting = false;
      this.runUntilBreakpointPromise = undefined;
    }
  }

  /**
   * Set event handlers for debugging events
   */
  setEventHandlers(handlers: {
    onStop?: () => void;
    onPause?: () => void;
    onBreakpoint?: (termId: number) => void;
    onExecutionComplete?: (result: ExecutionStatus, termId: number) => void;
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
    try {
      return await this.callWorker('isAtBreakpoint');
    } catch (error) {
      return false;
    }
  }

  /**
   * Cleanup worker when done
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
    this.pendingRequests.clear();
    this.runUntilBreakpointPromise = undefined;
    this.isExecuting = false;
  }
}
