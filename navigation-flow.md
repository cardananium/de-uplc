# UPLC Debugger Navigation Flow

## Overview

The UPLC Debugger is a VS Code extension that provides comprehensive debugging capabilities for UPLC (Untyped Plutus Core) scripts within Cardano transactions. This document outlines the complete navigation flow from initial setup to advanced debugging operations.

## Table of Contents

1. [Extension Setup & Configuration](#extension-setup--configuration)
2. [Initial Launch Flow](#initial-launch-flow)
3. [Transaction Input Flow](#transaction-input-flow)
4. [Script Selection & Preparation](#script-selection--preparation)
5. [Debugging Session Management](#debugging-session-management)
6. [Navigation & Inspection](#navigation--inspection)
7. [Breakpoint Management](#breakpoint-management)
8. [Advanced Features](#advanced-features)
9. [Error Handling & Recovery](#error-handling--recovery)
10. [State Management](#state-management)

---

## Extension Setup & Configuration

### 1.1 Initial Installation & Activation

**Flow:** Extension Installation → Activation → Configuration

1. **Extension Installation**
   - User installs the extension from discribution source like github relases.
   - Extension activates automatically when VS Code starts
   - Sidebar icon appears in the Activity Bar (UPLC Debugger)

2. **First-time Configuration**
   - User clicks on UPLC Debugger icon in Activity Bar
   - Configuration panel opens with settings options
   - **Key Configuration Options:**
     - **Cardano Data Provider API Key**: Required for transaction data retrieval

3. **Configuration UI Elements**
   - Settings accessible via VS Code Settings (Ctrl+,)
   - Extension-specific settings under "UPLC Debugger"
   - Validation indicators for required fields (API key)

### 1.2 Sidebar Structure

The sidebar contains the following sections (from top to bottom):

1. **Main Controls Panel** (WebView)
   - Debugger control buttons
   - Script information display
   - Budget monitoring

2. **Machine Context** (Tree View)
   - Current execution context
   - Variable bindings
   - Stack information

3. **Machine State** (Tree View)
   - Current machine state
   - Execution flags
   - Memory usage

4. **Environments** (Tree View)
   - Environment variables (UPLC equivalent of variables)
   - Value bindings
   - Scope information

5. **Logs** (Tree View)
   - Execution logs
   - Debug messages
   - Error information

6. **Breakpoints** (Tree View)
   - Active breakpoints
   - Breakpoint status
   - Quick toggle controls

---

## Initial Launch Flow

### 2.1 Extension Startup

**Flow:** VS Code Launch → Extension Activation → UI Initialization

1. **Extension Activation**
   - `activate()` function called
   - Core services initialized:
     - `DebuggerManager`
     - `TabManager`
     - `EventBridge`
     - Tree data providers
     - Webview panel provider

2. **UI State Initialization**
   - Sidebar shows "empty" state
   - All debugging controls disabled
   - Transaction input area displayed prominently
   - Configuration validation checks run

3. **User Welcome Flow**
   - If first time: Configuration prompts appear
   - If API key missing: Warning notification
   - Help tooltip shows expected transaction hex format

### 2.2 Empty State Presentation

**Visual State:** Clean, minimal interface focusing on transaction input

- **Main Controls Panel**: Transaction hex input field with "Open Transaction" button
- **Tree Views**: Empty with placeholder text
- **Status**: "No transaction loaded" indicator
- **Available Actions**: 
  - Transaction hex input
  - Settings access
  - Help documentation

---

## Transaction Input Flow

### 3.1 Transaction Hex Input Dialog

**Flow:** User Action → Dialog → Validation → Processing

1. **Input Trigger**
   - User clicks "Open Transaction" button in main controls

2. **Input Dialog**
   - Modal dialog opens with:
     - Large text area for transaction hex

3. **Input Validation**
   - Hex format validation
   - Tracsaction structure validation (is it possible deserialize it or not)

4. **Processing Flow**
   - User submits valid transaction hex
   - Extension calls `debuggerManager.openTransaction(script)`
   - Transaction is parsed
   - Available redeemers are extracted
   - UI transitions to "transaction loaded" state

### 3.2 Transaction Data Retrieval

**Flow:** Hex Input → API Call → Data Processing → UI Update

1. **API Integration**
   - Uses configured Cardano Data Provider API
   - Retrieves complete utxo data
   - Identifies redeemers and script contexts

2. **Data Processing**
   - Script extraction
   - Redeemer identification
   - Context preparation

3. **UI Update**
   - Main controls show transaction info
   - Redeemer dropdown populated
   - Script information displayed
   - "Ready to debug" state achieved

---

## Script Selection & Preparation

### 4.1 Redeemer Selection

**Flow:** Transaction Loaded → Redeemer Selection → Script Loading

1. **Redeemer Dropdown Population**
   - Dropdown shows all available redeemers
   - Format: "Redeemer [index] - [purpose]" (e.g., "Redeemer 0 - Spend")
   - Each redeemer includes context information

2. **Selection Process**
   - User selects redeemer from dropdown
   - Confirmation dialog if session exists: "Are you sure? Debugging session will be stopped."
   - Script loading begins automatically

3. **Script Loading**
   - `debuggerManager.initDebugSession(redeemer)` called
   - Session controller created
   - UPLC script loaded and parsed
   - UI transitions to "script loaded" state

### 4.2 Script Information Display

**Display Elements:**
- **Script Hash**: Truncated with full hash on hover
- **Plutus Language Version**: e.g., "V2", "V3"
- **Plutus Core Version**: e.g., "1.0.0"
- **Show Script Button**: Opens script in new tab or navigates to existing one.

### 4.3 Script Viewing

**Flow:** Show Script → Tab Creation → Syntax Highlighting

1. **Script Tab Creation**
   - New tab opens with UPLC script content
   - Custom syntax highlighting applied
   - Line numbers displayed
   - Breakpoint gutter available

2. **Script Content**
   - Formatted UPLC code
   - Syntax highlighting for terms, variables, and builtins
   - Collapsible sections for nested terms

---

## Debugging Session Management

### 5.1 Session States

The debugger operates in four distinct states:

1. **Empty State**
   - No transaction loaded
   - All controls disabled
   - Focus on transaction input

2. **Stopped State**
   - Transaction loaded, redeemer selected
   - Script ready for debugging
   - Start button enabled
   - Script and context inspection available

3. **Running State**
   - Script execution in progress
   - Pause and Stop buttons enabled
   - Step button disabled
   - Budget monitoring wating for pause.

4. **Paused State**
   - Execution halted (breakpoint or step)
   - All control buttons available
   - Full inspection capabilities
   - Environment and state visible

### 5.2 Debugging Controls

**Control Button Layout:**
```
[Start/Pause] [Step] [Refresh] [Stop] | [Show Context]
```

**Button Behaviors:**
- **Start/Pause**: Toggle between running and paused states
- **Step**: Execute single instruction (paused state only)
- **Refresh**: Reset session to beginning
- **Stop**: Terminate session, return to stopped state
- **Show Context**: Open transaction context in new tab

### 5.3 Session Lifecycle

**Flow:** Start → [Running/Paused] → Stop

1. **Session Start**
   - User clicks Start button
   - `currentSession.start()` called
   - UI shows running state
   - Budget monitoring wating for a pause.

2. **During Execution** (Infomation which shows on pause)
    - Budget state shows
    - Log messages appear
    - Breakpoint checks performed
    - Environment changes tracked

3. **Session Control**
   - Pause: Execution stops at current instruction
   - Step: Single instruction execution
   - Continue: Resume from current position
   - Stop: Complete termination

---

## Navigation & Inspection

### 6.1 Tree View Navigation

**Machine Context Tree:**
- Shows current execution context
- Expandable nodes for complex data
- Click to view details in new tab
- Context-sensitive actions

**Machine State Tree:**
- Current machine state
- Stack information
- Memory usage
- Execution flags

**Environments Tree:**
- "Variable" bindings (UPLC environments)
- Value representations
- Scope hierarchies
- Environment history

### 6.2 Tab Management

**Tab Types:**
1. **Term Viewer**: UPLC script with syntax highlighting
2. **UPLC Data Viewer**: JSON-formatted data structures
3. **Plain Text Viewer**: Raw text content
4. **Context Viewer**: Transaction context information

**Tab Features:**
- Breakpoint setting (F9 in Term Viewer)
- Syntax highlighting
- Search functionality
- Cross-reference navigation

### 6.3 Context Menu Actions

**Tree Item Context Menus:**
- **Show Node in Tab**: View detailed information
- **Remove Breakpoint**: Delete breakpoint
- **Toggle Breakpoint**: Enable/disable breakpoint

**Editor Context Menus:**
- **Toggle Breakpoint**: Set/remove breakpoint
- **Run to Cursor**: Execute until cursor position
- **Inspect Value**: Show value details

---

## Breakpoint Management

### 7.1 Breakpoint Types

**Supported Breakpoint Types:**
- **Line Breakpoints**: Set on specific UPLC terms
- **Conditional Breakpoints**: Break when condition met
- **Active/Inactive**: Toggle without removal

### 7.2 Breakpoint Operations

**Setting Breakpoints:**
1. **Via Gutter**: Right-click in editor click line number in Term Viewer -> "Toggle Term Breakpoint"
2. **Via Keyboard**: F9 in Term Viewer
3. **Via Context Menu**: Right-click in editor -> "Toggle Term Breakpoint"

**Breakpoint States:**
- **Active**: Will halt execution
- **Inactive**: Ignored during execution

### 7.3 Breakpoint UI

**Breakpoints Tree View:**
- Lists all breakpoints
- Shows active/inactive state
- Provides toggle controls
- Allows breakpoint removal

**Visual Indicators:**
- **Red dot**: Active breakpoint
- **Gray dot**: Inactive breakpoint
- **Hollow circle**: Possible location for breakpoint.

---

## Advanced Features

### 8.1 Budget Monitoring

**Budget Display:**
- **Ex Units**: Used/Available execution units
- **Memory Units**: Used/Available memory
- **Overspend Warning**: Red highlighting when exceeded

**Budget Updates:**
- Running state: Loading indicators
- Paused state: Actual values
- Stopped state: Hidden

### 8.2 Environment Inspection

**Environment Features:**
- **Value Inspection**: Detailed value representation

### 8.3 Log Management

**Log Features:**
- **UPLC Machine Logs**: Logs which is returned from UPLC machine.

---

## Error Handling & Recovery

### 9.1 Error Categories

**Configuration Errors:**
- Missing API key
- Connection failures

**Input Errors:**
- Invalid transaction hex

**Runtime Errors:**
- Script execution failures
- Budget exceeded

---

### 10 State Management


**State Transition Diagram:**
```
Empty → [Load Transaction] → Stopped
Stopped → [Start] → Running
Running → [Pause] → Paused
Paused → [Continue] → Running
Running/Paused → [Stop] → Stopped
Paused → [Reset] → Running (from beginning)
```

---

## Command Reference

### 11.1 VS Code Commands

| Command | Keyboard | Description |
|---------|----------|-------------|
| `deuplc.newSession` | - | Open new transaction dialog |
| `termViewer.toggleBreakpoint` | F9 | Toggle breakpoint in Term Viewer |
| `uplcTree.showNodeInTab` | - | Show tree node in new tab |
| `breakpointsTreeDataProvider.removeBreakpoint` | - | Remove selected breakpoint |

### 11.2 Sidebar Control Commands

| Action | Description |
|--------|-------------|
| `startSession` | Start debugging session |
| `pauseSession` | Pause execution |
| `continueSession` | Resume execution |
| `step` | Execute single instruction |
| `refresh` | Reset session |
| `stop` | Stop debugging session |
| `showContext` | Display transaction context |
| `showScript` | Open script in new tab |
| `changeRedeemer` | Switch to different redeemer |

---

## Integration Points

### 12.1 VS Code Integration

**Activity Bar:**
- Custom sidebar icon

**Command Palette:**
- All major commands available
- Search and keyboard shortcuts (Default for VS code)

**Settings:**
- Configuration through VS Code settings

### 12.2 External Integrations

**Cardano Data Provider:**
- Transaction data retrieval
- Network-specific endpoints (if it necessary)
- API key authentication
