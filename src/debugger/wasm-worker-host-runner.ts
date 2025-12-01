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

/**
 * Helper function to create Transferable objects from JSON strings
 */
function createTransferableFromJson(jsonString: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(jsonString).buffer;
}

// Send response to main thread
function sendResponse(id: string, result?: any, error?: string, transferables?: TransferListItem[]) {
  const response: WorkerResponse = { id, result, error };
  
  if (transferables && transferables.length > 0) {
    parentPort?.postMessage(response, transferables);
  } else {
    parentPort?.postMessage(response);
  }
}

// Method handlers
const handlers: Record<string, (...args: any[]) => any> = {
  getRequiredUtxos: (script: string) => {
    try {
      const requiredUtxosJson = wasm.get_required_utxos(script);
      const transferable = createTransferableFromJson(requiredUtxosJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get required UTXOs: ${error}`);
    }
  },

  openTransaction: (context: DebuggerContext) => {
    try {
      const utxosJson = context.utxos ? JSON.stringify(context.utxos) : '[]';
      const protocolParamsJson = context.protocolParams
        ? JSON.stringify(context.protocolParams)
        : '{}';
      const network = context.network ?? 'mainnet';

      engine = wasm.DebuggerEngine.new(
        context.transaction,
        utxosJson,
        protocolParamsJson,
        network
      );
    } catch (error) {
      throw new Error(`Failed to open transaction: ${error}`);
    }
  },

  getRedeemers: () => {
    return engine?.get_redeemers() ?? [];
  },

  getTransactionId: () => {
    return engine?.get_transaction_id() ?? '';
  },

  initDebugSession: (redeemer: string) => {
    if (!engine) {
      throw new Error('Engine not initialized. Call openTransaction first.');
    }

    try {
      if (currentSession !== undefined) {
        let session_redeemer = currentSession.get_redeemer();
        if (session_redeemer === redeemer) {
          currentSession.reset();
        } else {
          currentSession = engine.init_debug_session(redeemer);
        }
      } else {
        currentSession = engine.init_debug_session(redeemer);
      }
      currentRedeemer = redeemer;
      return 'session';
    } catch (error) {
      throw new Error(`Failed to initialize debug session: ${error}`);
    }
  },

  terminateDebugging: (_sessionId: string) => {
    currentSession = undefined;
    currentRedeemer = '';
  },

  getTxScriptContext: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const contextJson = currentSession.get_tx_script_context();
      const transferable = createTransferableFromJson(contextJson);
      return { result: transferable, transferables: [transferable] };
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
      return currentSession.get_plutus_core_version();
    } catch (error) {
      throw new Error(`Failed to get Plutus Core version: ${error}`);
    }
  },

  getPlutusLanguageVersion: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return currentSession.get_plutus_language_version();
    } catch (error) {
      throw new Error(`Failed to get Plutus language version: ${error}`);
    }
  },

  getScriptHash: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return currentSession.get_script_hash();
    } catch (error) {
      throw new Error(`Failed to get script hash: ${error}`);
    }
  },

  getMachineContext: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const contextJson = currentSession.get_machine_context();
      const transferable = createTransferableFromJson(contextJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get machine context: ${error}`);
    }
  },

  getLogs: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const logsJson = currentSession.get_logs();
      const transferable = createTransferableFromJson(logsJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get logs: ${error}`);
    }
  },

  getMachineState: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const stateJson = currentSession.get_machine_state();
      const transferable = createTransferableFromJson(stateJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get machine state: ${error}`);
    }
  },

  getBudget: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const budgetJson = currentSession.get_budget();
      const transferable = createTransferableFromJson(budgetJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get budget: ${error}`);
    }
  },

  getScript: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const scriptJson = currentSession.get_script();
      const transferable = createTransferableFromJson(scriptJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get script: ${error}`);
    }
  },

  getCurrentTermId: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return currentSession.get_current_term_id();
    } catch (error) {
      throw new Error(`Failed to get current term ID: ${error}`);
    }
  },

  getCurrentEnv: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const envJson = currentSession.get_current_env();
      const transferable = createTransferableFromJson(envJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get current environment: ${error}`);
    }
  },

  // Lazy loading methods
  getMachineStateLazy: (_sessionId: string, path: string, returnFullObject: boolean) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const stateJson = currentSession.get_machine_state_lazy(path, returnFullObject);
      const transferable = createTransferableFromJson(stateJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get machine state (lazy): ${error}`);
    }
  },

  getMachineContextLazy: (_sessionId: string, path: string, returnFullObject: boolean) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const contextJson = currentSession.get_machine_context_lazy(path, returnFullObject);
      const transferable = createTransferableFromJson(contextJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get machine context (lazy): ${error}`);
    }
  },

  getCurrentEnvLazy: (_sessionId: string, path: string, returnFullObject: boolean) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const envJson = currentSession.get_current_env_lazy(path, returnFullObject);
      const transferable = createTransferableFromJson(envJson);
      return { result: transferable, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to get current environment (lazy): ${error}`);
    }
  },

  // Simple step operation
  step: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      return currentSession.step();
    } catch (error) {
      throw new Error(`Failed to step: ${error}`);
    }
  },

  // New method for host-based execution: step and return status
  stepAndGetStatus: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
    try {
      const result = currentSession.step();
      const termId = currentSession.get_current_term_id();
      const transferable = createTransferableFromJson(result);
      return { result: { termId, statusBuffer: transferable }, transferables: [transferable] };
    } catch (error) {
      throw new Error(`Failed to step and get status: ${error}`);
    }
  },

  stop: (_sessionId: string) => {
    if (!currentSession) {
      throw new Error('No active session. Call initDebugSession first.');
    }
  },
};

// Message handler
parentPort?.on('message', async (message: WorkerMessage) => {
  const { id, method, args } = message;

  try {
    const handler = handlers[method];
    if (!handler) {
      throw new Error(`Unknown method: ${method}`);
    }

    const result = await handler(...args);
    
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
parentPort?.postMessage({ type: 'ready' });
