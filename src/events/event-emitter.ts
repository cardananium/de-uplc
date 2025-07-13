import * as vscode from 'vscode';
import { Breakpoint } from '../common';
import { ExtensionActionEventNames, DebuggerControlEventNames } from './debugger-event-names';
import { AnyUplcData } from '../uplc-models/any-uplc';

export namespace EventEmitter {
    // Extension Action Events
    export const selectRedeemer = (redeemer: string) => {
        vscode.commands.executeCommand(ExtensionActionEventNames.SELECT_REDEEMER, redeemer);
    };

    export const openNewScript = () => {
        vscode.commands.executeCommand(ExtensionActionEventNames.OPEN_NEW_SCRIPT);
    };

    export const errorOccurred = (error: Error) => {
        vscode.commands.executeCommand(ExtensionActionEventNames.ERROR_OCCURRED, error);
    };

    // Debugger Control Events
    export const awaitingActionResponse = () => {
        vscode.commands.executeCommand(DebuggerControlEventNames.AWAITING_ACTION_RESPONSE);
    };

    export const startDebugging = (redeemer: string) => {
        vscode.commands.executeCommand(DebuggerControlEventNames.START_DEBUGGING, redeemer);
    };

    export const stopDebugging = () => {
        vscode.commands.executeCommand(DebuggerControlEventNames.STOP_DEBUGGING);
    };

    export const resetDebuggingSession = () => {
        vscode.commands.executeCommand(DebuggerControlEventNames.RESET_DEBUGGING_SESSION);
    };

    export const pauseDebugging = () => {
        vscode.commands.executeCommand(DebuggerControlEventNames.PAUSE_DEBUGGING);
    };

    export const showScriptContext = () => {
        vscode.commands.executeCommand(ExtensionActionEventNames.SHOW_SCRIPT_CONTEXT);
    };

    export const showScript = () => {
        vscode.commands.executeCommand(ExtensionActionEventNames.SHOW_SCRIPT);
    };


    export const resumeDebugging = () => {
        vscode.commands.executeCommand(DebuggerControlEventNames.RESUME_DEBUGGING);
    };


    export const stepDebugging = () => {
        vscode.commands.executeCommand(DebuggerControlEventNames.STEP_DEBUGGING);
    };

    export const continueDebugging = () => {
        vscode.commands.executeCommand(DebuggerControlEventNames.CONTINUE_DEBUGGING);
    };

    export const finishedDebugging = () => {
        vscode.commands.executeCommand(DebuggerControlEventNames.FINISHED_DEBUGGING);
    };

    export const debuggerError = (error: Error) => {
        vscode.commands.executeCommand(DebuggerControlEventNames.DEBUGGER_ERROR, error);
    };

    export const showUplcElement = (element: AnyUplcData) => {
        vscode.commands.executeCommand(ExtensionActionEventNames.SHOW_UPLC_ELEMENT, element);
    };
}