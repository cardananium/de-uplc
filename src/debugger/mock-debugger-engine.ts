import { Budget } from "../common";
import { Context } from "../uplc-models/context";
import { MachineState } from "../uplc-models/machine-state";
import { TermWithId } from "../uplc-models/term";
import { Value } from "../uplc-models/value";
import { IDebuggerEngine } from "./debugger-engine.interface";

export class MockDebuggerEngine implements IDebuggerEngine {
    private sessions: Map<string, SessionData> = new Map();
    private nextSessionId = 1;

    private generateSessionId(): string {
        return `session_${this.nextSessionId++}`;
    }

    // Methods from DebuggerManager
    public async openTransaction(script: string): Promise<void> {
        // Mock implementation - no actual processing needed
    }

    public async getRedeemers(): Promise<string[]> {
        return [
            "Spend:0",
            "Spend:1",
            "Certificate:0"
        ];
    }

    public async getTransactionId(): Promise<string> {
        return "0x1234567890abcdef";
    }

    public async initDebugSession(redeemer: string): Promise<string> {
        const sessionId = this.generateSessionId();
        this.sessions.set(sessionId, new SessionData(redeemer));
        return sessionId;
    }

    public async terminateDebugging(sessionId: string): Promise<void> {
        this.sessions.delete(sessionId);
    }

    // Methods from SessionController (with sessionId parameter)
    public async getTxScriptContext(sessionId: string): Promise<any> {
        this.validateSession(sessionId);
        return {
            "inputs": [
              {
                "out_ref": {
                  "tx_id": "1ab2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f6789",
                  "output_index": 0
                },
                "resolved": {
                  "address": "addr1qxy2k8hrkqeqmnapqx7jvg9rc0gkrmgatx4yjk9k9kxnvnq7m8a9fu9x7dzkq9amgqv12v5hz42zc7qlf3kz7df4m4mass8nafx",
                  "value": {
                    "coin": 1000000,
                    "assets": {
                      "b0d07d45fe9514f80213f4020e5a6124145bbe626841cde717cb38a7e75746865727756d": 50,
                      "c0ffd7cb14cf0cba9c862d0aac0d96ceeeec28c9e5bf7e7f6a1d538d426974366f696e": 100
                    }
                  },
                  "datum_hash": "ab12cd34ef56gh78ij90kl12mn34op56qr78st90uv12wx34yz56ab12cd34ef56"
                }
              }
            ],
            "outputs": [
              {
                "address": "addr1qxbphkx6acpnf7275k6vs3fkppzxk7zsxw2wuwqafy788txxm8a9fu9x7dzkq9amgvf2v5hz42zc7glf3kz7df4m4masfjx5p7",
                "value": {
                  "coin": 500000,
                  "assets": {
                    "b0d07d45fe9514f80213f4020e5a6124145bbe626841cde717cb38a7e75746865727756d": 25
                  }
                },
                "datum_hash": "ff34de5678ab90cd12ef34gh56ij78kl90mn12op34qr56st78uv90wx12yz34ab56"
              }
            ],
            "fee": {
              "coin": 180000
            },
            "mint": {
              "tokens": {
                "d9312da562da182b02322fd8acb536f37eb9d29fba7c49dc12784d0f446e775d616b656e": 1000
              }
            },
            "certificates": [
              {
                "type": "StakeRegistration",
                "stake_credential": "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2"
              }
            ],
            "withdrawals": [
              {
                "address": "addr1qxy2k8hrkqeqmnapqx7jvg9rc0gkrmgstx4yjk9k9kxnvnq7m8a9fu9x7dzkq9amgqv12v5hz42zc7qlf3kz7df4m4mass8nafx",
                "coin": 1000000
              }
            ],
            "valid_range": {
              "lower_bound": 41000000,
              "upper_bound": 42000000
            },
            "signatories": [
              "a1b2c34de5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
              "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
            ],
            "data": [
              "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2",
              {
                "constructor": 0,
                "fields": [
                  { "int": 42 },
                  { "bytes": "48656c6c6f20576f726c6421" }
                ]
              }
            ],
            "redeemers": [
              {
                "purpose": "Spend",
                "index": 0,
                "data": {
                  "constructor": 0,
                  "fields": [
                    { "int": 1 }
                  ]
                },
                "ex_units": {
                  "mem": 1000000,
                  "steps": 700000
                }
              }
            ],
            "id": "3abc4def5678901234567890abcdef1234567890abcdef12"
        };
    }

    public async getRedeemer(sessionId: string): Promise<string> {
        const session = this.validateSession(sessionId);
        return session.redeemer;
    }

    public async getPlutusCoreVersion(sessionId: string): Promise<string> {
        this.validateSession(sessionId);
        return "1.0.3";
    }

    public async getPlutusLanguageVersion(sessionId: string): Promise<string | undefined> {
        this.validateSession(sessionId);
        return "v3";
    }

    public async getScriptHash(sessionId: string): Promise<string> {
        this.validateSession(sessionId);
        return "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    }

    public async getMachineContext(sessionId: string): Promise<Context[]> {
        this.validateSession(sessionId);
        return [
            // Example of FrameAwaitArg - waiting for an argument to be evaluated
            {
                context_type: "FrameAwaitArg",
                value: {
                    tag: "Con",
                    constant: { type: "Integer", value: 42n }
                }
            },
            
            // Example of FrameAwaitFunTerm - waiting for a function term to be evaluated
            {
                context_type: "FrameAwaitFunTerm",
                env: [
                    {
                        tag: "Con",
                        constant: { type: "String", value: "example" }
                    }
                ],
                term: {
                    term_type: "Var",
                    term_name: "x",
                    name: "x",
                    id: "1"
                }
            },
            
            // Example of FrameAwaitFunValue - waiting for a function value to be evaluated
            {
                context_type: "FrameAwaitFunValue",
                value: {
                    tag: "Lambda",
                    parameterName: "param",
                    body: {
                        term_type: "Var",
                        term_name: "param",
                        name: "param",
                        id: "2"
                    },
                    env: []
                }
            },
            
            // Example of FrameForce - forcing a delayed computation
            {
                context_type: "FrameForce"
            },
            
            // Example of FrameConstr - constructor frame with remaining terms and evaluated values
            {
                context_type: "FrameConstr",
                env: [],
                constructorTag: 1,
                remainingTerms: [
                    {
                        term_type: "Constant",
                        term_name: "const1",
                        constant: { type: "Bool", value: true },
                        id: "3"
                    }
                ],
                evaluatedValues: [
                    {
                        tag: "Con",
                        constant: { type: "Integer", value: 123n }
                    }
                ]
            },
            
            // Example of FrameCases - case analysis frame with branches
            {
                context_type: "FrameCases",
                env: [
                    {
                        tag: "Constr",
                        constructorTag: 0n,
                        fields: []
                    }
                ],
                branches: [
                    {
                        term_type: "Constant",
                        term_name: "branch1",
                        constant: { type: "String", value: "first branch" },
                        id: "4"
                    },
                    {
                        term_type: "Constant",
                        term_name: "branch2", 
                        constant: { type: "String", value: "second branch" },
                        id: "5"
                    }
                ]
            }
        ];
    }

    public async getLogs(sessionId: string): Promise<string[]> {
        this.validateSession(sessionId);
        return [
            "Log example 1",
            "Log example 2",
            "Log example 3",
            "Very loooooong log. 1234567890123456789012345678901234567890123456789012345678901234567890123456789ABCABC"
        ];
    }

    public async getMachineState(sessionId: string): Promise<MachineState> {
        this.validateSession(sessionId);
        return { 
            tag: "Return",
            value: { 
                tag: "Constr",
                constructorTag: 0n,
                fields: []
            }
        };
    }

    public async getBudget(sessionId: string): Promise<Budget> {
        const session = this.validateSession(sessionId);
        return session.budget;
    }

    public async getScript(sessionId: string): Promise<TermWithId> {
        this.validateSession(sessionId);
        return {
            term_type: "Lambda",
            term_name: "validator_script",
            parameterName: "datum",
            body: {
                term_type: "Lambda",
                term_name: "redeemer_lambda",
                parameterName: "redeemer",
                body: {
                    term_type: "Lambda",
                    term_name: "context_lambda",
                    parameterName: "context",
                    body: {
                        term_type: "Apply",
                        term_name: "validate_transaction",
                        function: {
                            term_type: "Apply",
                            term_name: "check_signature",
                            function: {
                                term_type: "Builtin",
                                term_name: "equals_builtin",
                                fun: "EqualsInteger",
                                id: "script_equals"
                            },
                            argument: {
                                term_type: "Apply",
                                term_name: "extract_amount",
                                function: {
                                    term_type: "Builtin",
                                    term_name: "uncons_data",
                                    fun: "UnConstrData",
                                    id: "script_uncons"
                                },
                                argument: {
                                    term_type: "Var",
                                    term_name: "datum",
                                    name: "datum",
                                    id: "script_datum_var"
                                },
                                id: "script_extract"
                            },
                            id: "script_check_sig"
                        },
                        argument: {
                            term_type: "Constant",
                            term_name: "expected_amount",
                            constant: { type: "Integer", value: 1000000n },
                            id: "script_expected"
                        },
                        id: "script_validate"
                    },
                    id: "script_context_body"
                },
                id: "script_redeemer_body"
            },
            id: "script_root"
        };
    }

    public async getCurrentTermId(sessionId: string): Promise<string> {
        this.validateSession(sessionId);
        return "0";
    }

    public async getCurrentEnv(sessionId: string): Promise<Value[]> {
        this.validateSession(sessionId);
        return [
            {
                tag: "Con",
                constant: { type: "Integer", value: 42n }
            },
            {
                tag: "Con",
                constant: { type: "String", value: "hello_world" }
            },
            {
                tag: "Con",
                constant: { type: "Bool", value: true }
            },
            {
                tag: "Con",
                constant: { type: "ByteString", value: "48656c6c6f" }
            },
            {
                tag: "Con",
                constant: { 
                    type: "ProtoList", 
                    elementType: { type: "Integer" }, 
                    values: [
                        { type: "Integer", value: 1n },
                        { type: "Integer", value: 2n },
                        { type: "Integer", value: 3n }
                    ]
                }
            },
            
            {
                tag: "Lambda",
                parameterName: "x",
                body: {
                    term_type: "Apply",
                    term_name: "add_x",
                    function: {
                        term_type: "Builtin",
                        term_name: "add_builtin",
                        fun: "AddInteger",
                        id: "env_lambda_add"
                    },
                    argument: {
                        term_type: "Var",
                        term_name: "x",
                        name: "x",
                        id: "env_lambda_var"
                    },
                    id: "env_lambda_body"
                },
                env: []
            },
            
            {
                tag: "Delay",
                term: {
                    term_type: "Constant",
                    term_name: "delayed_const",
                    constant: { type: "Integer", value: 100n },
                    id: "env_delay_term"
                },
                env: []
            },
            
            {
                tag: "Builtin",
                fun: "AddInteger",
                runtime: {
                    args: [
                        {
                            tag: "Con",
                            constant: { type: "Integer", value: 10n }
                        }
                    ],
                    fun: "AddInteger",
                    current_forces: 0n,
                    arity: 2n,
                    function_force_count: 0n
                }
            },
            {
                tag: "Constr",
                constructorTag: 1n,
                fields: [
                    {
                        tag: "Con",
                        constant: { type: "String", value: "field1" }
                    },
                    {
                        tag: "Con",
                        constant: { type: "Integer", value: 999n }
                    }
                ]
            },
            {
                tag: "Constr",
                constructorTag: 0n,
                fields: []
            },
            {
                tag: "Constr",
                constructorTag: 2n,
                fields: [
                    {
                        tag: "Constr",
                        constructorTag: 0n,
                        fields: [
                            {
                                tag: "Con",
                                constant: { type: "Bool", value: false }
                            }
                        ]
                    },
                    {
                        tag: "Lambda",
                        parameterName: "y",
                        body: {
                            term_type: "Var",
                            term_name: "y",
                            name: "y",
                            id: "env_nested_lambda"
                        },
                        env: [
                            {
                                tag: "Con",
                                constant: { type: "Integer", value: 123n }
                            }
                        ]
                    }
                ]
            }
        ];
    }

    public async start(sessionId: string): Promise<void> {
        this.validateSession(sessionId);
        for (let i = 0; i < 1000000000; i++) {}
    }

    public async continue(sessionId: string): Promise<void> {
        this.validateSession(sessionId);
        for (let i = 0; i < 1000000000; i++) {}
    }

    public async step(sessionId: string): Promise<void> {
        const session = this.validateSession(sessionId);
        for (let i = 0; i < 1000000000; i++) {}
        session.budget.exUnitsSpent += 10;
        session.budget.memoryUnitsSpent += 15;
    }

    public async stop(sessionId: string): Promise<void> {
        const session = this.validateSession(sessionId);
        for (let i = 0; i < 1000000000; i++) {}
        session.budget.exUnitsSpent += 10;
        session.budget.memoryUnitsSpent += 15;
    }

    public async pause(sessionId: string): Promise<void> {
        this.validateSession(sessionId);
        for (let i = 0; i < 1000000000; i++) {}
    }

    public async setBreakpointsList(sessionId: string, breakpoints: string[]): Promise<void> {
        this.validateSession(sessionId);
        // Mock implementation - store breakpoints if needed
    }

    private validateSession(sessionId: string): SessionData {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        return session;
    }
}

class SessionData {
    public budget: Budget;
    public readonly redeemer: string;
    public isFinished: boolean = false;

    constructor(redeemer: string) {
        this.redeemer = redeemer;
        this.budget = {
            exUnitsSpent: 100,
            exUnitsAvailable: 50,
            memoryUnitsSpent: 0,
            memoryUnitsAvailable: 0
        };
    }
} 