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
 * Utility function to measure execution time of async functions
 */
async function measureExecutionTime<T>(
  functionName: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    console.log(`[Timing] ${functionName} executed in ${executionTime.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    console.error(`[Timing] ${functionName} failed after ${executionTime.toFixed(2)}ms:`, error);
    throw error;
  }
}

async function noMeasureExecutionTime<T>(functionName: string, fn: () => Promise<T>): Promise<T> {
  return await fn();
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
  public onExecutionComplete: ((result: ExecutionStatus) => void) | undefined;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    const startTime = performance.now();
    try {
      // Initialize the worker
      const workerPath = path.join(__dirname, 'wasm-worker-host-runner.js');
      this.worker = new Worker(workerPath);

      // Handle messages from worker
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

      const endTime = performance.now();
      const executionTime = endTime - startTime;
      console.log(`[Timing] initWorker executed in ${executionTime.toFixed(2)}ms`);
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      console.error(`[Timing] initWorker failed after ${executionTime.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  private handleWorkerEvent(event: WorkerEvent, transferList?: readonly TransferListItem[]) {
    console.log(`[Host] Received event from worker: ${event.eventName}`, event.data);
    
    // Since runUntilBreakpoint is now on host, we shouldn't receive these events from worker
    // But we keep the handlers for any other potential events
    switch (event.eventName) {
      case 'ready':
        console.log('[Host] Worker is ready');
        break;
      default:
        console.warn(`[Host] Unknown event from worker: ${event.eventName}`);
    }
  }

  private handleWorkerResponse(response: WorkerResponse, transferList?: readonly TransferListItem[]) {
    const pending = this.pendingRequests.get(response.id);
    if (pending) {
      this.pendingRequests.delete(response.id);
      if (response.error) {
        pending.reject(new Error(response.error));
      } else {
        // Check if result is an ArrayBuffer (either from transferList or direct)
        if (response.result instanceof ArrayBuffer) {
          try {
            const parsedResult = parseJsonFromBuffer(response.result);
            // console.log(`[Host] Successfully parsed ArrayBuffer to:`, typeof parsedResult);
            pending.resolve(parsedResult);
          } catch (error) {
            console.error('[Host] Failed to parse JSON from ArrayBuffer:', error);
            pending.reject(new Error('Failed to parse worker response'));
          }
        } else if (response.result && typeof response.result === 'object' && 'statusBuffer' in response.result) {
          // Handle stepAndGetStatus response
          try {
            const { termId, statusBuffer } = response.result;
            const status = parseJsonFromBuffer(statusBuffer);
            // console.log(`[Host] Successfully parsed stepAndGetStatus response:`, { termId, statusType: status.status_type });
            pending.resolve({ termId, status });
          } catch (error) {
            console.error('[Host] Failed to parse status from ArrayBuffer:', error);
            pending.reject(new Error('Failed to parse worker response'));
          }
        } else {
          // Regular response (strings, numbers, arrays, etc.)
          console.log(`[Host] Processing regular response:`, typeof response.result);
          pending.resolve(response.result);
        }
      }
    }
  }

  private async callWorker(method: string, ...args: any[]): Promise<any> {
    return await noMeasureExecutionTime(`callWorker.${method}`, async () => {
      if (!this.worker) {
        throw new Error('Worker not initialized');
      }

      return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substr(2, 9);
        this.pendingRequests.set(id, { resolve, reject });
        
        const message: WorkerMessage = { id, method, args };
        this.worker!.postMessage(message);
      });
    });
  }

  // IDebuggerEngine implementation
  async getRequiredUtxos(script: string): Promise<UtxoReference[]> {
    return await noMeasureExecutionTime('getRequiredUtxos', async () => {
      const result = await this.callWorker('getRequiredUtxos', script);
      // The result is already parsed in handleWorkerResponse
      return result as UtxoReference[];
    });
  }

  async openTransaction(context: DebuggerContext): Promise<void> {
    return await noMeasureExecutionTime('openTransaction', () => 
      this.callWorker('openTransaction', context)
    );
  }

  async getRedeemers(): Promise<string[]> {
    return await noMeasureExecutionTime('getRedeemers', () => 
      this.callWorker('getRedeemers')
    );
  }

  async getTransactionId(): Promise<string> {
    return await noMeasureExecutionTime('getTransactionId', () => 
      this.callWorker('getTransactionId')
    );
  }

  async initDebugSession(redeemer: string): Promise<string> {
    return await noMeasureExecutionTime('initDebugSession', async () => {
      const sessionId = await this.callWorker('initDebugSession', redeemer);
      this.currentSessionId = sessionId;
      return sessionId;
    });
  }

  async terminateDebugging(sessionId: string): Promise<void> {
    return await noMeasureExecutionTime('terminateDebugging', async () => {
      this.needStop = true;
      this.isPaused = false;
      
      // Wait for the current execution to complete
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
    });
  }

  async getTxScriptContext(sessionId: string): Promise<ScriptContext> {
    return await noMeasureExecutionTime('getTxScriptContext', async () => {
      const result = await this.callWorker('getTxScriptContext', sessionId);
      // The result is already parsed in handleWorkerResponse
      return result;
    });
  }

  async getRedeemer(sessionId: string): Promise<string> {
    return await noMeasureExecutionTime('getRedeemer', () => 
      this.callWorker('getRedeemer', sessionId)
    );
  }

  async getPlutusCoreVersion(sessionId: string): Promise<string> {
    return await noMeasureExecutionTime('getPlutusCoreVersion', () => 
      this.callWorker('getPlutusCoreVersion', sessionId)
    );
  }

  async getPlutusLanguageVersion(sessionId: string): Promise<string | undefined> {
    return await noMeasureExecutionTime('getPlutusLanguageVersion', () => 
      this.callWorker('getPlutusLanguageVersion', sessionId)
    );
  }

  async getScriptHash(sessionId: string): Promise<string> {
    return await noMeasureExecutionTime('getScriptHash', () => 
      this.callWorker('getScriptHash', sessionId)
    );
  }

  async getMachineContext(sessionId: string): Promise<MachineContext[]> {
    return await noMeasureExecutionTime('getMachineContext', async () => {
      if (this.isExecuting) {
        return [];
      }
      const result = await this.callWorker('getMachineContext', sessionId);
      // The result is already parsed in handleWorkerResponse
      return result as MachineContext[];
    });
  }

  async getLogs(sessionId: string): Promise<string[]> {
    return await noMeasureExecutionTime('getLogs', async () => {
      if (this.isExecuting) {
        return [];
      }
      const result = await this.callWorker('getLogs', sessionId);
      // The result is already parsed in handleWorkerResponse
      return result as string[];
    });
  }

  async getMachineState(sessionId: string): Promise<MachineState | undefined> {
    return await noMeasureExecutionTime('getMachineState', async () => {
      if (this.isExecuting) {
        return undefined;
      }
      const result = await this.callWorker('getMachineState', sessionId);
      // The result is already parsed in handleWorkerResponse
      return result as MachineState;
    });
  }

  async getBudget(sessionId: string): Promise<Budget | undefined> {
    return await noMeasureExecutionTime('getBudget', async () => {
      if (this.isExecuting) {
        return undefined;
      }
      const result = await this.callWorker('getBudget', sessionId);
      // The result is already parsed in handleWorkerResponse
      return result as Budget;
    });
  }

  async getScript(sessionId: string): Promise<Term | undefined> {
    return await noMeasureExecutionTime('getScript', async () => {
      const result = await this.callWorker('getScript', sessionId);
      // The result is already parsed in handleWorkerResponse
      return result as Term;
    });
  }

  async getCurrentTermId(sessionId: string): Promise<number | undefined> {
    return await noMeasureExecutionTime('getCurrentTermId', async () => {
      if (this.isExecuting) {
        return undefined;
      }
      return await this.callWorker('getCurrentTermId', sessionId);
    });
  }

  async getCurrentEnv(sessionId: string): Promise<Env | undefined> {
    return await noMeasureExecutionTime('getCurrentEnv', async () => {
      if (this.isExecuting) {
        return undefined;
      }
      const result = await this.callWorker('getCurrentEnv', sessionId);
      // The result is already parsed in handleWorkerResponse
      return result as Env;
    });
  }

  async start(sessionId: string): Promise<void> {
    return await noMeasureExecutionTime('start', async () => {
      console.log('[Host] Starting execution');
      
      // Check if already executing
      if (this.isExecuting) {
        console.log('[Host] Execution already in progress, skipping start');
        return;
      }
      
      this.needStop = false;
      this.isPaused = false;

      // Start continuous execution on the host
      this.runUntilBreakpointPromise = this.runUntilBreakpoint();
    });
  }

  async continue(sessionId: string): Promise<void> {
    return await noMeasureExecutionTime('continue', async () => {
      console.log('[Host] Continue called', { isPaused: this.isPaused });
      this.needStop = false;
      if (!this.isPaused) {
        return this.start(sessionId);
      }

      // Check if already executing
      if (this.isExecuting) {
        console.log('[Host] Execution already in progress, skipping continue');
        return;
      }

      this.isPaused = false;
      this.runUntilBreakpointPromise = this.runUntilBreakpoint();
    });
  }

  async step(sessionId: string): Promise<void> {
    return await noMeasureExecutionTime('step', () => 
      this.callWorker('step', sessionId)
    );
  }

  async stop(sessionId: string): Promise<void> {
    return await noMeasureExecutionTime('stop', async () => {
      console.log('[Host] Stop requested');
      this.needStop = true;
      this.isPaused = false;
      
      // Wait for the current execution to complete
      if (this.runUntilBreakpointPromise) {
        try {
          await this.runUntilBreakpointPromise;
        } catch (error) {
          console.error('[Host] Error waiting for execution to stop:', error);
        }
      }
      
      await this.callWorker('stop', sessionId);
      
      // Notify listeners
      if (this.onStop) {
        this.onStop();
      }
    });
  }

  async pause(sessionId: string): Promise<void> {
    return await noMeasureExecutionTime('pause', async () => {
      console.log('[Host] Pause requested');
      if (!this.isPaused) {
        this.isPaused = true;
        this.needStop = true;
        
        // Wait for the current execution to complete
        if (this.runUntilBreakpointPromise) {
          try {
            await this.runUntilBreakpointPromise;
          } catch (error) {
            console.error('[Host] Error waiting for execution to pause:', error);
          }
        }
        
        // Notify listeners
        if (this.onPause) {
          this.onPause();
        }
      }
    });
  }

  async setBreakpointsList(sessionId: string, breakpoints: number[]): Promise<void> {
    return await noMeasureExecutionTime('setBreakpointsList', () => {
      this.breakpoints = [...breakpoints];
      return Promise.resolve();
    });
  }

  /**
   * Run execution until breakpoint or completion
   * This now runs on the host instead of in the worker
   */
  private async runUntilBreakpoint(): Promise<void> {
    return await noMeasureExecutionTime('runUntilBreakpoint', async () => {
      const runId = Date.now(); // Unique ID for this run instance
      console.log(`[Host] runUntilBreakpoint started (runId: ${runId})`);
      
      if (!this.currentSessionId) {
        console.log('[Host] No current session, exiting runUntilBreakpoint');
        return;
      }

      this.isExecuting = true;
      let stepCount = 0;
      
      try {
        // Run steps until we hit a breakpoint, pause, or completion
        while (!this.needStop) {
          try {
            stepCount++;
            if (stepCount % 100 === 0) {
              console.log(`[Host] Executed ${stepCount} steps, still running...`);
            }
            
            // Execute single step through worker
            const stepResult = await this.callWorker('stepAndGetStatus', this.currentSessionId);
            
            if (!stepResult) {
              console.error('[Host] No step result received');
              break;
            }

            const { termId, status } = stepResult;
            // The status is already parsed in handleWorkerResponse

            // Check if we hit a breakpoint
            if (this.breakpoints.includes(termId)) {
              console.log(`[Host] Hit breakpoint at term ID: ${termId}`);
              this.isPaused = true;
              this.isExecuting = false;

              // Notify listeners about breakpoint hit
              if (this.onBreakpoint) {
                this.onBreakpoint(termId);
              }
              break;
            }

            // Check for execution errors
            if (status.status_type === 'Error') {
              console.error('[Host] Execution error:', status.message);
            }

            // Check if execution completed
            if (status.status_type === 'Done' || status.status_type === 'Error') {
              console.log(`[Host] Execution completed with status: ${status.status_type}, total steps: ${stepCount}`);
              this.needStop = true;

              // Notify listeners about execution completion
              if (this.onExecutionComplete) {
                this.onExecutionComplete(status);
              }
              break;
            }

            // Add a small delay to prevent blocking the main thread
            await new Promise(resolve => setTimeout(resolve, 1));
          } catch (error) {
            console.error('[Host] Error during execution:', error);
            console.error('[Host] Error occurred at step:', stepCount);
            this.needStop = true;
            this.isPaused = false;

            // Notify listeners about stop due to error
            if (this.onExecutionComplete) {
              this.onExecutionComplete({
                status_type: 'Error',
                message: error instanceof Error ? error.message : 'Unknown error',
              });
            }
            break;
          }
        }
      } finally {
        this.isExecuting = false;
        this.runUntilBreakpointPromise = undefined;
      }
      
      console.log(`[Host] runUntilBreakpoint ended (runId: ${runId}). Steps executed: ${stepCount}, isPaused: ${this.isPaused}`);
    });
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
    const startTime = performance.now();
    try {
      this.onStop = handlers.onStop;
      this.onPause = handlers.onPause;
      this.onBreakpoint = handlers.onBreakpoint;
      this.onExecutionComplete = handlers.onExecutionComplete;
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      console.log(`[Timing] setEventHandlers executed in ${executionTime.toFixed(2)}ms`);
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      console.error(`[Timing] setEventHandlers failed after ${executionTime.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * Clear all event handlers
   */
  clearEventHandlers(): void {
    const startTime = performance.now();
    try {
      this.onStop = undefined;
      this.onPause = undefined;
      this.onBreakpoint = undefined;
      this.onExecutionComplete = undefined;
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      console.log(`[Timing] clearEventHandlers executed in ${executionTime.toFixed(2)}ms`);
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      console.error(`[Timing] clearEventHandlers failed after ${executionTime.toFixed(2)}ms:`, error);
      throw error;
    }
  }

  /**
   * Check if we're at a breakpoint
   */
  async isAtBreakpoint(): Promise<boolean> {
    return await noMeasureExecutionTime('isAtBreakpoint', async () => {
      try {
        return await this.callWorker('isAtBreakpoint');
      } catch (error) {
        return false;
      }
    });
  }

  /**
   * Cleanup worker when done
   */
  dispose(): void {
    const startTime = performance.now();
    try {
      if (this.worker) {
        this.worker.terminate();
        this.worker = undefined;
      }
      this.pendingRequests.clear();
      this.runUntilBreakpointPromise = undefined;
      this.isExecuting = false;
      
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      console.log(`[Timing] dispose executed in ${executionTime.toFixed(2)}ms`);
    } catch (error) {
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      console.error(`[Timing] dispose failed after ${executionTime.toFixed(2)}ms:`, error);
      throw error;
    }
  }
}
