import { parentPort, TransferListItem } from 'worker_threads';
import * as wasm from 'de-uplc';
import { DebuggerContext } from '../common';

// Worker state
let engine: wasm.DebuggerEngine | undefined;
let currentSession: wasm.SessionController | undefined;
let currentRedeemer = '';

// Message types
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
 * Helper function to create Transferable objects from JSON strings
 */
function createTransferableFromJson(jsonString: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(jsonString).buffer;
}

/**
 * Helper function to measure and log execution time of WASM calls
 */
function withTiming<T>(methodName: string, operation: () => T): T {
  const startTime = performance.now();
  try {
    const result = operation();
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`[Worker] WASM call "${methodName}" completed in ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`[Worker] WASM call "${methodName}" failed after ${duration.toFixed(2)}ms`);
    throw error;
  }
}

function withoutTiming<T>(methodName: string, operation: () => T): T {
  return operation();
}

// Send response to main thread
function sendResponse(id: string, result?: any, error?: string, transferables?: TransferListItem[]) {
  console.log(`[Worker] Sending response for request ${id}`, { hasResult: result !== undefined, hasError: !!error, hasTransferables: !!transferables });
  const response: WorkerResponse = { id, result, error };
  
  if (transferables && transferables.length > 0) {
    parentPort?.postMessage(response, transferables);
  } else {
    parentPort?.postMessage(response);
  }
}

// Send event to main thread
function sendEvent(eventName: string, data?: any, transferables?: TransferListItem[]) {
  console.log(`[Worker] Sending event: ${eventName}`, data);
  const event: WorkerEvent = { type: 'event', eventName, data };
  
  if (transferables && transferables.length > 0) {
    parentPort?.postMessage(event, transferables);
  } else {
    parentPort?.postMessage(event);
  }
}

// Method handlers
const handlers: Record<string, (...args: any[]) => any> = {
  getRequiredUtxos: (script: string) => {
    try {
      return withoutTiming('get_required_utxos', () => {
        const requiredUtxosJson = wasm.get_required_utxos(script);
        // Return ArrayBuffer as Transferable
        const transferable = createTransferableFromJson(requiredUtxosJson);
        return { result: transferable, transferables: [transferable] };
      });
    } catch (error) {
      throw new Error(`Failed to get required UTXOs: ${error}`);
    }
  },

  openTransaction: (context: DebuggerContext) => {
    try {
      console.log('[Worker] Opening transaction');
      const utxosJson = context.utxos ? JSON.stringify(context.utxos) : '[]';
      const protocolParamsJson = context.protocolParams
        ? JSON.stringify(context.protocolParams)
        : '{}';
      const network = context.network ?? 'mainnet';

      withoutTiming('DebuggerEngine.new', () => {
        engine = wasm.DebuggerEngine.new(
          context.transaction,
          utxosJson,
          protocolParamsJson,
          network
        );
      });
    } catch (error) {
      throw new Error(`Failed to open transaction: ${error}`);
    }
  },

  getRedeemers: () => {
    return withoutTiming('get_redeemers', () => {
      return engine?.get_redeemers() ?? [];
    });
  },

  getTransactionId: () => {
    return withoutTiming('get_transaction_id', () => {
      return engine?.get_transaction_id() ?? '';
    });
  },

  initDebugSession: (redeemer: string) => {
    console.log(`[Worker] Initializing debug session for redeemer: ${redeemer}`);
    if (!engine) {
      throw new Error('Engine not initialized. Call openTransaction first.');
    }

    try {
      return withoutTiming('init_debug_session', () => {
        if(currentSession !== undefined) {
          let session_redeemer = withoutTiming('get_redeemer', () => currentSession!.get_redeemer());
          if(session_redeemer === redeemer) {
            withoutTiming('reset', () => currentSession!.reset());
          } else {
            currentSession = engine!.init_debug_session(redeemer);
          }
        } else {
          currentSession = engine!.init_debug_session(redeemer);
        }
        currentRedeemer = redeemer;
        console.log('[Worker] Debug session initialized successfully');
        return 'session';
      });
    } catch (error) {
      console.error('[Worker] Failed to initialize debug session:', error);
      throw new Error(`Failed to initialize debug session: ${error}`);
    }
  },

  terminateDebugging: (_sessionId: string) => {
    console.log('[Worker] Terminating debugging session');
    currentSession = undefined;
    currentRedeemer = '';
    console.log('[Worker] Session terminated');
  },

  getTxScriptContext: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_tx_script_context', () => {
        const contextJson = currentSession!.get_tx_script_context();
        // Return ArrayBuffer as Transferable
        const transferable = createTransferableFromJson(contextJson);
        return { result: transferable, transferables: [transferable] };
      });
    } catch (error) {
      throw new Error(`Failed to get script context: ${error}`);
    }
  },

  getRedeemer: (_sessionId: string) => {
    return currentRedeemer;
  },

  getPlutusCoreVersion: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_plutus_core_version', () => {
        return currentSession!.get_plutus_core_version();
      });
    } catch (error) {
      throw new Error(`Failed to get Plutus Core version: ${error}`);
    }
  },

  getPlutusLanguageVersion: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_plutus_language_version', () => {
        return currentSession!.get_plutus_language_version();
      });
    } catch (error) {
      throw new Error(`Failed to get Plutus language version: ${error}`);
    }
  },

  getScriptHash: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_script_hash', () => {
        return currentSession!.get_script_hash();
      });
    } catch (error) {
      throw new Error(`Failed to get script hash: ${error}`);
    }
  },

  getMachineContext: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_machine_context', () => {
        const contextJson = currentSession!.get_machine_context();
        // Return ArrayBuffer as Transferable
        const transferable = createTransferableFromJson(contextJson);
        return { result: transferable, transferables: [transferable] };
      });
    } catch (error) {
      throw new Error(`Failed to get machine context: ${error}`);
    }
  },

  getLogs: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_logs', () => {
        const logsJson = currentSession!.get_logs();
        // Return ArrayBuffer as Transferable
        const transferable = createTransferableFromJson(logsJson);
        return { result: transferable, transferables: [transferable] };
      });
    } catch (error) {
      throw new Error(`Failed to get logs: ${error}`);
    }
  },

  getMachineState: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_machine_state', () => {
        const stateJson = currentSession!.get_machine_state();
        // Return ArrayBuffer as Transferable
        const transferable = createTransferableFromJson(stateJson);
        return { result: transferable, transferables: [transferable] };
      });
    } catch (error) {
      throw new Error(`Failed to get machine state: ${error}`);
    }
  },

  getBudget: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_budget', () => {
        const budgetJson = currentSession!.get_budget();
        // Return ArrayBuffer as Transferable
        const transferable = createTransferableFromJson(budgetJson);
        return { result: transferable, transferables: [transferable] };
      });
    } catch (error) {
      throw new Error(`Failed to get budget: ${error}`);
    }
  },

  getScript: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_script', () => {
        const scriptJson = currentSession!.get_script();
        // Return ArrayBuffer as Transferable
        const transferable = createTransferableFromJson(scriptJson);
        return { result: transferable, transferables: [transferable] };
      });
    } catch (error) {
      throw new Error(`Failed to get script: ${error}`);
    }
  },

  getCurrentTermId: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_current_term_id', () => {
        const termId = currentSession!.get_current_term_id();
        return termId;
      });
    } catch (error) {
      throw new Error(`Failed to get current term ID: ${error}`);
    }
  },

  getCurrentEnv: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('get_current_env', () => {
        const envJson = currentSession!.get_current_env();
        // Return ArrayBuffer as Transferable
        const transferable = createTransferableFromJson(envJson);
        return { result: transferable, transferables: [transferable] };
      });
    } catch (error) {
      throw new Error(`Failed to get current environment: ${error}`);
    }
  },

  // Simple step operation
  step: (_sessionId: string) => {
    console.log('[Worker] Single step requested');
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      withoutTiming('step', () => {
        const result = currentSession!.step();
        console.log('[Worker] Step completed');
        return result;
      });
    } catch (error) {
      console.error('[Worker] Failed to step:', error);
      throw new Error(`Failed to step: ${error}`);
    }
  },

  // New method for host-based execution: step and return status
  stepAndGetStatus: (_sessionId: string) => {
    console.log('[Worker] Step and get status requested');
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return withoutTiming('step_and_get_status', () => {
        const result = currentSession!.step();
        const termId = withoutTiming('get_current_term_id_after_step', () => currentSession!.get_current_term_id());
        // Return ArrayBuffer as Transferable
        const transferable = createTransferableFromJson(result);
        return { result: { termId, statusBuffer: transferable }, transferables: [transferable] };
      });
    } catch (error) {
      console.error('[Worker] Failed to step and get status:', error);
      throw new Error(`Failed to step and get status: ${error}`);
    }
  },

  stop: (_sessionId: string) => {
    console.log('[Worker] Stop requested');
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      withoutTiming('stop', () => {
        console.log('[Worker] Stop completed');
      });
    } catch (error) {
      console.error('[Worker] Failed to stop:', error);
      throw new Error(`Failed to stop: ${error}`);
    }
  },
};

// Message handler
parentPort?.on('message', async (message: WorkerMessage) => {
  const { id, method, args } = message;
  console.log(`[Worker] Received message - method: ${method}, id: ${id}`);

  try {
    const handler = handlers[method];
    if (!handler) {
      console.error(`[Worker] Unknown method: ${method}`);
      throw new Error(`Unknown method: ${method}`);
    }

    console.log(`[Worker] Executing handler for method: ${method}`);
    const result = await handler(...args);
    console.log(`[Worker] Handler completed for method: ${method}`);
    
    // Check if result has transferables
    if (result && typeof result === 'object' && 'transferables' in result) {
      sendResponse(id, result.result, undefined, result.transferables);
    } else {
      sendResponse(id, result);
    }
  } catch (error: any) {
    console.error(`[Worker] Handler error for method ${method}:`, error);
    sendResponse(id, undefined, error.message || 'Unknown error');
  }
});

// Notify main thread that worker is ready
console.log('[Worker] Worker initialized and ready');
parentPort?.postMessage({ type: 'ready' });
