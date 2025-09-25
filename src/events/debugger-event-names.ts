export namespace DebuggerControlEventNames {
    export const AWAITING_ACTION_RESPONSE = "deuplc.awaitingActionResponse";
    export const START_DEBUGGING = "deuplc.startDebugging";
    export const STOP_DEBUGGING = "deuplc.stopDebugging";
    export const PAUSE_DEBUGGING = "deuplc.pauseDebugging";
    export const DEBUGGER_CAUGHT_BREAKPOINT = "deuplc.debuggerCaughtBreakpoint";
    export const DEBUGGER_CAUGHT_ERROR = "deuplc.debuggerCaughtError";
    export const DEBUGGER_CAUGHT_FINISHED = "deuplc.debuggerCaughtFinished";
    export const RESUME_DEBUGGING = "deuplc.resumeDebugging";
    export const STEP_DEBUGGING = "deuplc.stepIntoDebugging";
    export const CONTINUE_DEBUGGING = "deuplc.continueDebugging";
    export const RESET_DEBUGGING_SESSION = "deuplc.resetDebuggingSession";
    export const FINISHED_DEBUGGING = "deuplc.finishedDebugging";
    export const DEBUGGER_ERROR = "deuplc.debuggerError";
}

export namespace ExtensionActionEventNames {
    export const SELECT_REDEEMER = "deuplc.selectRedeemer";
    export const OPEN_NEW_TRANSACTION = "deuplc.openNewTransaction";
    export const ERROR_OCCURRED = "deuplc.errorOccurred";

    export const BREAKPOINT_LIST_UPDATED = "deuplc.breakpointListUpdated";

    export const RESET_DEBUGGER = "deuplc.resetDebugger";
    export const SHOW_UPLC_ELEMENT = "deuplc.showUplcElement";
    export const SHOW_SCRIPT_CONTEXT = "deuplc.showScriptContext";
    export const SHOW_SCRIPT = "deuplc.showScript";
}