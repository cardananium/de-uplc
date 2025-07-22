export interface Breakpoint {
    id: number;
    line: number;
    active: boolean;
}

export interface Budget {
    exUnitsSpent: number;
    exUnitsAvailable: number;
    memoryUnitsSpent: number;
    memoryUnitsAvailable: number;
}

export type SessionState = "stopped" | "running" | "pause" | "empty";
