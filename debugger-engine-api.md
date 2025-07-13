# Debugger Engine API Reference

This document describes the API for the `IDebuggerEngine` interface, which provides methods for debugging UPLC (Untyped Plutus Core) scripts.

## Overview

The `IDebuggerEngine` interface combines transaction management, session control, and debugging operations into a unified API. It manages debugging sessions for UPLC scripts and provides comprehensive debugging capabilities.

## API Methods

### Transaction Management

#### `openTransaction(script: string): Promise<void>`
Opens a transaction for debugging with the provided script.

**Parameters:**
- `script` (string): The UPLC script to debug

**Returns:** `Promise<void>`

#### `getRedeemers(): Promise<string[]>`
Retrieves all available redeemers for the current transaction.

**Returns:** `Promise<string[]>` - Array of redeemer identifiers

#### `getTransactionId(): Promise<string>`
Gets the unique identifier for the current transaction.

**Returns:** `Promise<string>` - Transaction ID

#### `initDebugSession(redeemer: string): Promise<string>`
Initializes a new debug session for the specified redeemer.

**Parameters:**
- `redeemer` (string): The redeemer to debug

**Returns:** `Promise<string>` - Session ID for the created debug session

#### `terminateDebugging(sessionId: string): Promise<void>`
Terminates an active debugging session.

**Parameters:**
- `sessionId` (string): The session ID to terminate

**Returns:** `Promise<void>`

### Session Information

#### `getTxScriptContext(sessionId: string): Promise<any>`
Retrieves the transaction script context for the specified session.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<any>` - Script context object

#### `getRedeemer(sessionId: string): Promise<string>`
Gets the redeemer associated with the debug session.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<string>` - Redeemer value

#### `getPlutusCoreVersion(sessionId: string): Promise<string>`
Retrieves the Plutus Core version for the session.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<string>` - Plutus Core version

#### `getPlutusLanguageVersion(sessionId: string): Promise<string | undefined>`
Gets the Plutus language version for the session.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<string | undefined>` - Plutus language version or undefined

#### `getScriptHash(sessionId: string): Promise<string>`
Retrieves the hash of the script being debugged.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<string>` - Script hash

### Runtime Information

#### `getMachineContext(sessionId: string): Promise<Context[]>`
Gets the current machine context stack.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<Context[]>` - Array of context objects

#### `getLogs(sessionId: string): Promise<string[]>`
Retrieves debug logs for the session.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<string[]>` - Array of log messages

#### `getMachineState(sessionId: string): Promise<MachineState>`
Gets the current state of the UPLC machine.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<MachineState>` - Current machine state

#### `getBudget(sessionId: string): Promise<Budget>`
Retrieves the current execution budget information.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<Budget>` - Budget object with execution costs

#### `getScript(sessionId: string): Promise<TermWithId>`
Gets the script term with ID annotations.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<TermWithId>` - Script term with ID

#### `getCurrentTermId(sessionId: string): Promise<string>`
Retrieves the ID of the currently executing term.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<string>` - Current term ID

#### `getCurrentEnv(sessionId: string): Promise<Value[]>`
Gets the current environment values.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<Value[]>` - Array of environment values

### Debugging Controls

#### `start(sessionId: string): Promise<void>`
Starts or resumes execution of the debug session.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<void>`

#### `continue(sessionId: string): Promise<void>`
Continues execution until the next breakpoint or completion.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<void>`

#### `step(sessionId: string): Promise<void>`
Executes a single step in the debugging session.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<void>`

#### `stop(sessionId: string): Promise<void>`
Stops the execution of the debug session.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<void>`

#### `pause(sessionId: string): Promise<void>`
Pauses the execution of the debug session.

**Parameters:**
- `sessionId` (string): The session ID

**Returns:** `Promise<void>`

#### `setBreakpointsList(sessionId: string, breakpoints: string[]): Promise<void>`
Sets the list of breakpoints for the debug session.

**Parameters:**
- `sessionId` (string): The session ID
- `breakpoints` (string[]): Array of breakpoint identifiers

**Returns:** `Promise<void>`

## Types

This API references several custom types:
- `Budget`: Execution budget information
- `Context`: Machine context data
- `MachineState`: Current state of the UPLC machine
- `TermWithId`: Script term with ID annotations
- `Value`: Runtime values in the environment 