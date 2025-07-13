import { TermWithId } from "./term";
import { Value } from "./value";

export type MachineState =
    | { tag: "Return", value: Value }
    | { tag: "Compute", term: TermWithId }
    | { tag: "Done", term: TermWithId };