// import { Budget, DebuggerContext, UtxoReference } from "../common";
// import { MachineContext, MachineState, Term, Env, ScriptContext } from "../debugger-types";
// import { IDebuggerEngine } from "./debugger-engine.interface";

// export class MockDebuggerEngine implements IDebuggerEngine {

//   private sessions: Map<string, SessionData> = new Map();
//   private nextSessionId = 1;

//   private generateSessionId(): string {
//     return `session_${this.nextSessionId++}`;
//   }

//   getRequiredUtxos(script: string): Promise<UtxoReference[]> {
//     return Promise.resolve([]);
//   }

//   // Methods from DebuggerManager
//   public async openTransaction(context: DebuggerContext): Promise<void> {
//     // Mock implementation - no actual processing needed
//   }

//   public async getRedeemers(): Promise<string[]> {
//     return ["Spend:0", "Spend:1", "Certificate:0"];
//   }

//   public async getTransactionId(): Promise<string> {
//     return "0x1234567890abcdef";
//   }

//   public async initDebugSession(redeemer: string): Promise<string> {
//     const sessionId = this.generateSessionId();
//     this.sessions.set(sessionId, new SessionData(redeemer));
//     return sessionId;
//   }

//   public async terminateDebugging(sessionId: string): Promise<void> {
//     const session = this.sessions.get(sessionId);
//     if (session) {
//       // Stop parallel process and wait for its completion
//       session.stopParallelProcess();
//       await session.waitForParallelProcessToStop();
//     }
//     this.sessions.delete(sessionId);
//   }

//   // Methods from SessionController (with sessionId parameter)
//   public async getTxScriptContext(sessionId: string): Promise<ScriptContext> {
//     this.validateSession(sessionId);
//     return {
//       script_context_version: 'V1V2',
//       purpose: {
//         purpose_type: 'Spending',
//         utxo_ref: {
//           transaction_id: "1ab2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f6789",
//           index: 0,
//         },
//       },
//       tx_info: {
//         V1: {
//           id: "3abc4def5678901234567890abcdef1234567890abcdef12",
//           inputs: [
//             {
//               out_ref: {
//                 transaction_id: "1ab2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f6789",
//                 index: 0,
//               },
//               resolved: {
//                 address:
//                   "addr1qxy2k8hrkqeqmnapqx7jvg9rc0gkrmgatx4yjk9k9kxnvnq7m8a9fu9x7dzkq9amgqv12v5hz42zc7qlf3kz7df4m4mass8nafx",
//                 output_format: 'Legacy',
//                 value: {
//                   value_type: 'Multiasset',
//                   coin: 1000000,
//                   assets: [
//                     {
//                       policy_id: "b0d07d45fe9514f80213f4020e5a6124145bbe626841cde717cb38a7",
//                       tokens: [
//                         {
//                           asset_name: "65727756d",
//                           quantity: 50,
//                         },
//                       ],
//                     },
//                     {
//                       policy_id: "c0ffd7cb14cf0cba9c862d0aac0d96ceeeec28c9e5bf7e7f6a1d538d",
//                       tokens: [
//                         {
//                           asset_name: "426974366f696e",
//                           quantity: 100,
//                         },
//                       ],
//                     },
//                   ],
//                 },
//               },
//             },
//           ],
//           outputs: [
//             {
//               address:
//                 "addr1qxbphkx6acpnf7275k6vs3fkppzxk7zsxw2wuwqafy788txxm8a9fu9x7dzkq9amgvf2v5hz42zc7glf3kz7df4m4masfjx5p7",
//               output_format: 'Legacy',
//               value: {
//                 value_type: 'Multiasset',
//                 coin: 500000,
//                 assets: [
//                   {
//                     policy_id: "b0d07d45fe9514f80213f4020e5a6124145bbe626841cde717cb38a7",
//                     tokens: [
//                       {
//                         asset_name: "65727756d",
//                         quantity: 25,
//                       },
//                     ],
//                   },
//                 ],
//               },
//             },
//           ],
//           fee: {
//             value_type: 'Coin',
//             amount: 180000,
//           },
//           mint: {
//             mint_value: [
//               {
//                 policy_id: "d9312da562da182b02322fd8acb536f37eb9d29fba7c49dc12784d0f446e775d",
//                 tokens: [
//                   {
//                     asset_name: "616b656e",
//                     quantity: 1000,
//                   },
//                 ],
//               },
//             ],
//           },
//           certificates: [
//             {
//               certificate_type: "StakeRegistration",
//               stake_credential: {
//                 credential_type: 'KeyHash',
//                 hash: "e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2",
//               },
//             },
//           ],
//           valid_range: {
//             lower_bound: 41000000,
//             upper_bound: 42000000,
//           },
//           signatories: [
//             "a1b2c34de5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
//             "b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
//           ],
//           data: [
//             [
//               // Simple integer PlutusData
//               { Int: "42" },
//               // Constructor with fields
//               {
//                 type: 'Constr',
//                 tag: 0,
//                 fields: [
//                   { Int: "123" },
//                   { type: 'BoundedBytes', value: "48656c6c6f20576f726c6421" },
//                   {
//                     type: 'Array',
//                     values: [
//                       { Int: "1" },
//                       { Int: "2" },
//                       { Int: "3" },
//                     ],
//                   },
//                 ],
//               },
//             ],
//           ],
//           withdrawals: [
//             [
//               {
//                 credential_type: 'KeyHash',
//                 hash: "xy2k8hrkqeqmnapqx7jvg9rc0gkrmgstx4yjk9k9kxnvnq7m8a9fu9x7dzkq9amgqv12v5hz42zc7qlf3kz7df4m4mass8nafx",
//               },
//               1000000,
//             ],
//           ],
//           redeemers: [
//             [
//               {
//                 type: 'Constr',
//                 tag: 0,
//                 fields: [
//                   { Int: "1" },
//                   { type: 'BoundedBytes', value: "deadbeef" },
//                   {
//                     type: 'Map',
//                     key_value_pairs: [
//                       {
//                         key: { type: 'BoundedBytes', value: "72656465656d6572" },
//                         value: { Int: "42" },
//                       },
//                     ],
//                   },
//                 ],
//               },
//               {
//                 mem: 1000000,
//                 steps: 700000,
//               },
//             ],
//           ],
//         },
//       },
//     };
//   }

//   public async getRedeemer(sessionId: string): Promise<string> {
//     const session = this.validateSession(sessionId);
//     return session.redeemer;
//   }

//   public async getPlutusCoreVersion(sessionId: string): Promise<string> {
//     this.validateSession(sessionId);
//     return "1.0.3";
//   }

//   public async getPlutusLanguageVersion(
//     sessionId: string
//   ): Promise<string | undefined> {
//     this.validateSession(sessionId);
//     return "v3";
//   }

//   public async getScriptHash(sessionId: string): Promise<string> {
//     this.validateSession(sessionId);
//     return "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
//   }

//   public async getMachineContext(sessionId: string): Promise<MachineContext[]> {
//     this.validateSession(sessionId);
//     return [
//       // Example of FrameAwaitArg - waiting for an argument to be evaluated
//       {
//         context_type: "FrameAwaitArg",
//         value: {
//           value_type: "Con",
//           constant: {
//             type: "Data",
//             data: {
//               type: "Constr",
//               tag: 1,
//               fields: [
//                 { Int: "999" },
//                 { type: "BoundedBytes", value: "deadbeef" },
//               ],
//               any_constructor: null,
//             },
//           },
//         },
//       },

//       // Example of FrameAwaitFunTerm - waiting for a function term to be evaluated
//       {
//         context_type: "FrameAwaitFunTerm",
//         env: {
//           values: [
//             {
//               value_type: "Con",
//               constant: {
//                 type: "Data",
//                 data: {
//                   type: "Map",
//                   key_value_pairs: [
//                     {
//                       key: { type: "BoundedBytes", value: "6b6579" },
//                       value: { Int: "123" },
//                     },
//                     {
//                       key: { Int: "42" },
//                       value: {
//                         type: "Array",
//                         values: [{ Int: "1" }, { Int: "2" }, { Int: "3" }],
//                       },
//                     },
//                   ],
//                 },
//               },
//             },
//           ],
//         },
//         term: {
//           term_type: "Var",
//           name: "x",
//           id: 0,
//         },
//       },

//       // Example of FrameAwaitFunValue - waiting for a function value to be evaluated
//       {
//         context_type: "FrameAwaitFunValue",
//         value: {
//           value_type: "Lambda",
//           parameterName: "param",
//           body: {
//             term_type: "Var",
//             name: "param",
//             id: 1,
//           },
//           env: {
//             values: [],
//           },
//           term_id: 200,
//         },
//       },

//       // Example of FrameForce - forcing a delayed computation
//       {
//         context_type: "FrameForce",
//       },

//       // Example of FrameConstr - constructor frame with remaining terms and evaluated values
//       {
//         context_type: "FrameConstr",
//         env: {
//           values: [],
//         },
//         tag: 1,
//         term_id: 300,
//         terms: [
//           {
//             term_type: "Constant",
//             constant: { type: "Bool", value: true },
//             id: 2,
//           },
//         ],
//         values: [
//           {
//             value_type: "Con",
//             constant: { type: "Integer", value: "123" },
//           },
//         ],
//       },

//       // Example of FrameCases - case analysis frame with branches
//       {
//         context_type: "FrameCases",
//         env: {
//           values: [
//             {
//               value_type: "Constr",
//               tag: 0,
//               fields: [],
//               term_id: 302,
//             },
//           ],
//         },
//         terms: [
//           {
//             term_type: "Constant",
//             constant: { type: "String", value: "first branch" },
//             id: 3,
//           },
//           {
//             term_type: "Constant",
//             constant: { type: "String", value: "second branch" },
//             id: 4,
//           },
//         ],
//       },
//     ];
//   }

//   public async getLogs(sessionId: string): Promise<string[]> {
//     this.validateSession(sessionId);
//     return [
//       "Log example 1",
//       "Log example 2",
//       "Log example 3",
//       "Very loooooong log. 1234567890123456789012345678901234567890123456789012345678901234567890123456789ABCABC",
//     ];
//   }

//   public async getMachineState(sessionId: string): Promise<MachineState> {
//     this.validateSession(sessionId);
//     return {
//       machine_state_type: "Return",
//       value: {
//         value_type: "Constr",
//         tag: 0,
//         fields: [],
//         term_id: 100,
//       },
//       context: {
//         context_type: "NoFrame",
//       },
//     };
//   }

//   public async getBudget(sessionId: string): Promise<Budget> {
//     const session = this.validateSession(sessionId);
//     return session.budget;
//   }

//   public async getScript(sessionId: string): Promise<Term> {
//     this.validateSession(sessionId);
//     return {
//       term_type: "Lambda",
//       parameterName: "datum",
//       id: 5,
//       body: {
//         term_type: "Case",
//         id: 6,
//         constr: {
//           term_type: "Constant",
//           constant: {
//             type: "Integer",
//             value: "1000",
//           },
//           id: 7,
//         },
//         branches: [
//           {
//             term_type: "Lambda",
//             parameterName: "redeemer",
//             id: 8,
//             body: {
//               term_type: "Lambda",
//               parameterName: "context",
//               id: 9,
//               body: {
//                 term_type: "Apply",
//                 id: 10,
//                 function: {
//                   term_type: "Apply",
//                   id: 11,
//                   function: {
//                     term_type: "Builtin",
//                     fun: "EqualsInteger",
//                     id: 12,
//                   },
//                   argument: {
//                     term_type: "Apply",
//                     id: 13,
//                     function: {
//                       term_type: "Builtin",
//                       fun: "UnConstrData",
//                       id: 14,
//                     },
//                     argument: {
//                       term_type: "Var",
//                       name: "datum",
//                       id: 15,
//                     },
//                   },
//                 },
//                 argument: {
//                   term_type: "Apply",
//                   id: 16,
//                   function: {
//                     term_type: "Builtin",
//                     fun: "ConstrData",
//                     id: 17,
//                   },
//                   argument: {
//                     term_type: "Apply",
//                     id: 18,
//                     function: {
//                       term_type: "Constant",
//                       constant: { type: "Integer", value: "1000" },
//                       id: 19,
//                     },
//                     argument: {
//                       term_type: "Apply",
//                       id: 20,
//                       function: {
//                         term_type: "Constant",
//                         constant: { type: "String", value: "validator_v2" },
//                         id: 21,
//                       },
//                       argument: {
//                         term_type: "Apply",
//                         id: 22,
//                         function: {
//                           term_type: "Constant",
//                           constant: { type: "Bool", value: true },
//                           id: 23,
//                         },
//                         argument: {
//                           term_type: "Apply",
//                           id: 24,
//                           function: {
//                             term_type: "Constant",
//                             constant: {
//                               type: "ByteString",
//                               value: "deadbeefcafebabe",
//                             },
//                             id: 25,
//                           },
//                           argument: {
//                             term_type: "Apply",
//                             id: 26,
//                             function: {
//                               term_type: "Constant",
//                               constant: {
//                                 type: "Data",
//                                 data: {
//                                   type: "Array",
//                                   values: [
//                                     { Int: "100" },
//                                     { Int: "200" },
//                                     { Int: "300" },
//                                     {
//                                       type: "BoundedBytes",
//                                       value: "48656c6c6f576f726c64",
//                                     },
//                                     {
//                                       type: "Constr",
//                                       tag: 2,
//                                       fields: [
//                                         { Int: "777" },
//                                         {
//                                           type: "BoundedBytes",
//                                           value: "abcdef123456",
//                                         },
//                                       ],
//                                       any_constructor: null,
//                                     },
//                                   ],
//                                 },
//                               },
//                               id: 27,
//                             },
//                             argument: {
//                               term_type: "Apply",
//                               id: 28,
//                               function: {
//                                 term_type: "Constant",
//                                 constant: {
//                                   type: "Data",
//                                   data: {
//                                     type: "Map",
//                                     key_value_pairs: [
//                                       {
//                                         key: {
//                                           type: "BoundedBytes",
//                                           value: "6b657930",
//                                         },
//                                         value: { Int: "500" },
//                                       },
//                                       {
//                                         key: {
//                                           type: "BoundedBytes",
//                                           value: "6b657931",
//                                         },
//                                         value: { Int: "600" },
//                                       },
//                                       {
//                                         key: { Int: "99" },
//                                         value: {
//                                           type: "BoundedBytes",
//                                           value: "737472696e675f76616c7565",
//                                         },
//                                       },
//                                     ],
//                                   },
//                                 },
//                                 id: 29,
//                               },
//                               argument: {
//                                 term_type: "Apply",
//                                 id: 30,
//                                 function: {
//                                   term_type: "Constant",
//                                   constant: {
//                                     type: "Data",
//                                     data: {
//                                       BigUInt:
//                                         "123456789abcdef0123456789abcdef",
//                                     },
//                                   },
//                                   id: 31,
//                                 },
//                                 argument: {
//                                   term_type: "Apply",
//                                   id: 32,
//                                   function: {
//                                     term_type: "Constant",

//                                     constant: {
//                                       type: "Data",
//                                       data: {
//                                         BigNInt:
//                                           "fedcba9876543210fedcba9876543210",
//                                       },
//                                     },
//                                     id: 33,
//                                   },
//                                   argument: {
//                                     term_type: "Apply",
//                                     id: 34,
//                                     function: {
//                                       term_type: "Constant",

//                                       constant: {
//                                         type: "Data",
//                                         data: {
//                                           type: "Constr",
//                                           tag: 5,
//                                           fields: [
//                                             {
//                                               type: "Constr",
//                                               tag: 0,
//                                               fields: [
//                                                 { Int: "888" },
//                                                 {
//                                                   type: "BoundedBytes",
//                                                   value: "4e657374656444617461",
//                                                 },
//                                               ],
//                                               any_constructor: null,
//                                             },
//                                             {
//                                               type: "Array",
//                                               values: [
//                                                 { Int: "11" },
//                                                 { Int: "22" },
//                                                 { Int: "33" },
//                                               ],
//                                             },
//                                             {
//                                               type: "Map",
//                                               key_value_pairs: [
//                                                 {
//                                                   key: {
//                                                     type: "BoundedBytes",
//                                                     value:
//                                                       "6e65737465645f6b6579",
//                                                   },
//                                                   value: { Int: "12345" },
//                                                 },
//                                               ],
//                                             },
//                                           ],
//                                           any_constructor: null,
//                                         },
//                                       },
//                                       id: 35,
//                                     },
//                                     argument: {
//                                       term_type: "Apply",
//                                       id: 36,
//                                       function: {
//                                         term_type: "Constant",

//                                         constant: {
//                                           type: "Data",
//                                           data: {
//                                             type: "Constr",
//                                             tag: 150,
//                                             fields: [
//                                               {
//                                                 type: "BoundedBytes",
//                                                 value:
//                                                   "416e79436f6e737472756374",
//                                               },
//                                               { Int: "9999" },
//                                             ],
//                                             any_constructor: 150,
//                                           },
//                                         },
//                                         id: 37,
//                                       },
//                                       argument: {
//                                         term_type: "Apply",
//                                         id: 38,
//                                         function: {
//                                           term_type: "Constant",

//                                           constant: {
//                                             type: "Integer",
//                                             value: "42",
//                                           },
//                                           id: 39,
//                                         },
//                                         argument: {
//                                           term_type: "Apply",
//                                           id: 40,
//                                           function: {
//                                             term_type: "Constant",

//                                             constant: {
//                                               type: "ProtoList",
//                                               elementType: { type: "Integer" },
//                                               values: [
//                                                 { type: "Integer", value: "1" },
//                                                 { type: "Integer", value: "2" },
//                                                 { type: "Integer", value: "3" },
//                                                 {
//                                                   type: "Integer",
//                                                   value: "999",
//                                                 },
//                                                 {
//                                                   type: "Integer",
//                                                   value: "1000",
//                                                 },
//                                               ],
//                                             },
//                                             id: 41,
//                                           },
//                                           argument: {
//                                             term_type: "Apply",
//                                             id: 42,
//                                             function: {
//                                               term_type: "Constant",

//                                               constant: {
//                                                 type: "ProtoPair",
//                                                 first_type: { type: "String" },
//                                                 second_type: {
//                                                   type: "Integer",
//                                                 },
//                                                 first_element: {
//                                                   type: "String",
//                                                   value: "pair_key",
//                                                 },
//                                                 second_element: {
//                                                   type: "Integer",
//                                                   value: "12345",
//                                                 },
//                                               },
//                                               id: 43,
//                                             },
//                                             argument: {
//                                               term_type: "Apply",
//                                               id: 44,
//                                               function: {
//                                                 term_type: "Constant",

//                                                 constant: {
//                                                   type: "Bls12_381G1Element",
//                                                   serialized:
//                                                     "97f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb08b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1",
//                                                 },
//                                                 id: 45,
//                                               },
//                                               argument: {
//                                                 term_type: "Apply",
//                                                 id: 46,
//                                                 function: {
//                                                   term_type: "Constant",

//                                                   constant: {
//                                                     type: "ProtoList",
//                                                     elementType: {
//                                                       type: "Pair",
//                                                       first_type: {
//                                                         type: "String",
//                                                       },
//                                                       second_type: {
//                                                         type: "Integer",
//                                                       },
//                                                     },
//                                                     values: [
//                                                       {
//                                                         type: "ProtoPair",
//                                                         first_type: {
//                                                           type: "String",
//                                                         },
//                                                         second_type: {
//                                                           type: "Integer",
//                                                         },
//                                                         first_element: {
//                                                           type: "String",
//                                                           value: "name",
//                                                         },
//                                                         second_element: {
//                                                           type: "Integer",
//                                                           value: "100",
//                                                         },
//                                                       },
//                                                       {
//                                                         type: "ProtoPair",
//                                                         first_type: {
//                                                           type: "String",
//                                                         },
//                                                         second_type: {
//                                                           type: "Integer",
//                                                         },
//                                                         first_element: {
//                                                           type: "String",
//                                                           value: "age",
//                                                         },
//                                                         second_element: {
//                                                           type: "Integer",
//                                                           value: "25",
//                                                         },
//                                                       },
//                                                       {
//                                                         type: "ProtoPair",
//                                                         first_type: {
//                                                           type: "String",
//                                                         },
//                                                         second_type: {
//                                                           type: "Integer",
//                                                         },
//                                                         first_element: {
//                                                           type: "String",
//                                                           value: "score",
//                                                         },
//                                                         second_element: {
//                                                           type: "Integer",
//                                                           value: "95",
//                                                         },
//                                                       },
//                                                     ],
//                                                   },
//                                                   id: 47,
//                                                 },
//                                                 argument: {
//                                                   term_type: "Apply",
//                                                   id: 48,
//                                                   function: {
//                                                     term_type: "Constant",

//                                                     constant: {
//                                                       type: "ProtoList",
//                                                       elementType: {
//                                                         type: "List",
//                                                         elementType: {
//                                                           type: "Integer",
//                                                         },
//                                                       },
//                                                       values: [
//                                                         {
//                                                           type: "ProtoList",
//                                                           elementType: {
//                                                             type: "Integer",
//                                                           },
//                                                           values: [
//                                                             {
//                                                               type: "Integer",
//                                                               value: "1",
//                                                             },
//                                                             {
//                                                               type: "Integer",
//                                                               value: "2",
//                                                             },
//                                                             {
//                                                               type: "Integer",
//                                                               value: "3",
//                                                             },
//                                                           ],
//                                                         },
//                                                         {
//                                                           type: "ProtoList",
//                                                           elementType: {
//                                                             type: "Integer",
//                                                           },
//                                                           values: [
//                                                             {
//                                                               type: "Integer",
//                                                               value: "10",
//                                                             },
//                                                             {
//                                                               type: "Integer",
//                                                               value: "20",
//                                                             },
//                                                           ],
//                                                         },
//                                                         {
//                                                           type: "ProtoList",
//                                                           elementType: {
//                                                             type: "Integer",
//                                                           },
//                                                           values: [
//                                                             {
//                                                               type: "Integer",
//                                                               value: "100",
//                                                             },
//                                                             {
//                                                               type: "Integer",
//                                                               value: "200",
//                                                             },
//                                                             {
//                                                               type: "Integer",
//                                                               value: "300",
//                                                             },
//                                                             {
//                                                               type: "Integer",
//                                                               value: "400",
//                                                             },
//                                                           ],
//                                                         },
//                                                       ],
//                                                     },
//                                                     id: 49,
//                                                   },
//                                                   argument: {
//                                                     term_type: "Apply",
//                                                     id: 50,
//                                                     function: {
//                                                       term_type: "Constant",

//                                                       constant: {
//                                                         type: "ProtoPair",
//                                                         first_type: {
//                                                           type: "List",
//                                                           elementType: {
//                                                             type: "String",
//                                                           },
//                                                         },
//                                                         second_type: {
//                                                           type: "List",
//                                                           elementType: {
//                                                             type: "Integer",
//                                                           },
//                                                         },
//                                                         first_element: {
//                                                           type: "ProtoList",
//                                                           elementType: {
//                                                             type: "String",
//                                                           },
//                                                           values: [
//                                                             {
//                                                               type: "String",
//                                                               value: "apple",
//                                                             },
//                                                             {
//                                                               type: "String",
//                                                               value: "banana",
//                                                             },
//                                                             {
//                                                               type: "String",
//                                                               value: "orange",
//                                                             },
//                                                           ],
//                                                         },
//                                                         second_element: {
//                                                           type: "ProtoList",
//                                                           elementType: {
//                                                             type: "Integer",
//                                                           },
//                                                           values: [
//                                                             {
//                                                               type: "Integer",
//                                                               value: "50",
//                                                             },
//                                                             {
//                                                               type: "Integer",
//                                                               value: "30",
//                                                             },
//                                                             {
//                                                               type: "Integer",
//                                                               value: "45",
//                                                             },
//                                                           ],
//                                                         },
//                                                       },
//                                                       id: 51,
//                                                     },
//                                                     argument: {
//                                                       term_type: "Apply",
//                                                       id: 52,
//                                                       function: {
//                                                         term_type: "Constant",

//                                                         constant: {
//                                                           type: "ProtoPair",
//                                                           first_type: {
//                                                             type: "Pair",
//                                                             first_type: {
//                                                               type: "String",
//                                                             },
//                                                             second_type: {
//                                                               type: "Integer",
//                                                             },
//                                                           },
//                                                           second_type: {
//                                                             type: "Pair",
//                                                             first_type: {
//                                                               type: "Bool",
//                                                             },
//                                                             second_type: {
//                                                               type: "ByteString",
//                                                             },
//                                                           },
//                                                           first_element: {
//                                                             type: "ProtoPair",
//                                                             first_type: {
//                                                               type: "String",
//                                                             },
//                                                             second_type: {
//                                                               type: "Integer",
//                                                             },
//                                                             first_element: {
//                                                               type: "String",
//                                                               value:
//                                                                 "nested_key",
//                                                             },
//                                                             second_element: {
//                                                               type: "Integer",
//                                                               value: "777",
//                                                             },
//                                                           },
//                                                           second_element: {
//                                                             type: "ProtoPair",
//                                                             first_type: {
//                                                               type: "Bool",
//                                                             },
//                                                             second_type: {
//                                                               type: "ByteString",
//                                                             },
//                                                             first_element: {
//                                                               type: "Bool",
//                                                               value: false,
//                                                             },
//                                                             second_element: {
//                                                               type: "ByteString",
//                                                               value:
//                                                                 "deadbeefcafe",
//                                                             },
//                                                           },
//                                                         },
//                                                         id: 53,
//                                                       },
//                                                       argument: {
//                                                         term_type: "Constant",

//                                                         constant: {
//                                                           type: "Data",
//                                                           data: {
//                                                             type: "Constr",
//                                                             tag: 0,
//                                                             fields: [
//                                                               { Int: "42" },
//                                                               {
//                                                                 type: "BoundedBytes",
//                                                                 value:
//                                                                   "48656c6c6f",
//                                                               },
//                                                               {
//                                                                 type: "Array",
//                                                                 values: [
//                                                                   { Int: "1" },
//                                                                   { Int: "2" },
//                                                                 ],
//                                                               },
//                                                             ],
//                                                             any_constructor:
//                                                               null,
//                                                           },
//                                                         },
//                                                         id: 54,
//                                                       },
//                                                     },
//                                                   },
//                                                 },
//                                               },
//                                             },
//                                           },
//                                         },
//                                       },
//                                     },
//                                   },
//                                 },
//                               },
//                             },
//                           },
//                         },
//                       },
//                     },
//                   },
//                 },
//               },
//             },
//           },
//           {
//             term_type: "Lambda",
//             parameterName: "datum",
//             id: 55,
//             body: {
//               term_type: "Lambda",
//               parameterName: "redeemer",
//               id: 56,
//               body: {
//                 term_type: "Lambda",
//                 parameterName: "context",
//                 id: 57,
//                 body: {
//                   term_type: "Case",
//                   id: 58,
//                   constr: {
//                     term_type: "Constr",
//                     id: 59,
//                     constructorTag: 1,
//                     fields: [
//                       {
//                         term_type: "Force",
//                         id: 60,
//                         term: {
//                           term_type: "Delay",
//                           id: 61,
//                           term: {
//                             term_type: "Apply",
//                             id: 62,
//                             function: {
//                               term_type: "Builtin",
//                               fun: "EqualsInteger",
//                               id: 63,
//                             },
//                             argument: {
//                               term_type: "Constant",
//                               constant: { type: "Integer", value: "42" },
//                               id: 64,
//                             },
//                           },
//                         },
//                       },
//                       {
//                         term_type: "Var",
//                         name: "datum",
//                         id: 65,
//                       },
//                     ],
//                   },
//                   branches: [
//                     // Branch 0: Success case
//                     {
//                       term_type: "Constant",
//                       constant: { type: "Bool", value: true },
//                       id: 66,
//                     },
//                     // Branch 1: Error case
//                     {
//                       term_type: "Error",
//                       id: 67,
//                     },
//                     // Branch 2: Complex nested case with more examples
//                     {
//                       term_type: "Apply",
//                       id: 68,
//                       function: {
//                         term_type: "Force",
//                         id: 69,
//                         term: {
//                           term_type: "Delay",
//                           id: 70,
//                           term: {
//                             term_type: "Constr",
//                             id: 71,
//                             constructorTag: 0,
//                             fields: [
//                               {
//                                 term_type: "Constant",
//                                 constant: {
//                                   type: "String",
//                                   value: "nested_constructor",
//                                 },
//                                 id: 72,
//                               },
//                               {
//                                 term_type: "Apply",
//                                 id: 73,
//                                 function: {
//                                   term_type: "Builtin",
//                                   fun: "AddInteger",
//                                   id: 74,
//                                 },
//                                 argument: {
//                                   term_type: "Constant",
//                                   constant: { type: "Integer", value: "100" },
//                                   id: 75,
//                                 },
//                               },
//                             ],
//                           },
//                         },
//                       },
//                       argument: {
//                         term_type: "Case",
//                         id: 76,
//                         constr: {
//                           term_type: "Var",
//                           name: "redeemer",
//                           id: 77,
//                         },
//                         branches: [
//                           {
//                             term_type: "Constant",
//                             constant: { type: "ByteString", value: "deadbeef" },
//                             id: 78,
//                           },
//                           {
//                             term_type: "Error",
//                             id: 79,
//                           },
//                         ],
//                       },
//                     },
//                   ],
//                 },
//               },
//             },
//           },
//         ],
//       },
//     };
//   }

//   public async getCurrentTermId(sessionId: string): Promise<string> {
//     this.validateSession(sessionId);
//     return "0";
//   }

//   public async getCurrentEnv(sessionId: string): Promise<Env> {
//     this.validateSession(sessionId);
//     return {
//       values: [
//         {
//           value_type: "Con",
//           constant: { type: "Integer", value: "42" },
//         },
//         {
//           value_type: "Con",
//           constant: { type: "String", value: "hello_world" },
//         },
//         {
//           value_type: "Con",
//           constant: { type: "Bool", value: true },
//         },
//         {
//           value_type: "Con",
//           constant: { type: "ByteString", value: "48656c6c6f" },
//         },
//         {
//           value_type: "Con",
//           constant: {
//             type: "Data",
//             data: {
//               type: "Array",
//               values: [
//                 { Int: "1" },
//                 { Int: "2" },
//                 { Int: "3" },
//                 { type: "BoundedBytes", value: "48656c6c6f" },
//                 {
//                   type: "Constr",
//                   tag: 0,
//                   fields: [{ Int: "42" }],
//                   any_constructor: null,
//                 },
//               ],
//             },
//           },
//         },

//         {
//           value_type: "Lambda",
//           parameterName: "x",
//           body: {
//             term_type: "Apply",

//             function: {
//               term_type: "Builtin",

//               fun: "AddInteger",
//               id: 80,
//             },
//             argument: {
//               term_type: "Var",

//               name: "x",
//               id: 81,
//             },
//             id: 82,
//           },
//           env: {
//             values: [],
//           },
//           term_id: 955,
//         },

//         {
//           value_type: "Delay",
//           body: {
//             term_type: "Constant",
//             constant: { type: "Integer", value: "100" },
//             id: 83,
//           },
//           env: {
//             values: [],
//           },
//           term_id: 965,
//         },

//         {
//           value_type: "Builtin",
//           fun: "AddInteger",
//           runtime: {
//             args: [
//               {
//                 value_type: "Con",
//                 constant: { type: "Integer", value: "10" },
//               },
//             ],
//             fun: "AddInteger",
//             forces: 0,
//             arity: 2,
//           },
//           term_id: 975,
//         },
//         {
//           value_type: "Constr",
//           tag: 1,
//           fields: [
//             {
//               value_type: "Con",
//               constant: { type: "String", value: "field1" },
//             },
//             {
//               value_type: "Con",
//               constant: { type: "Integer", value: "999" },
//             },
//           ],
//           term_id: 980,
//         },
//         {
//           value_type: "Con",
//           constant: {
//             type: "Data",
//             data: {
//               BigUInt: "1234567890abcdef1234567890abcdef",
//             },
//           },
//         },
//         {
//           value_type: "Con",
//           constant: {
//             type: "Data",
//             data: {
//               type: "Constr",
//               tag: 102,
//               fields: [
//                 { type: "BoundedBytes", value: "cafebabe" },
//                 { BigNInt: "fedcba0987654321" },
//                 {
//                   type: "Map",
//                   key_value_pairs: [
//                     {
//                       key: { type: "BoundedBytes", value: "6b6579313233" },
//                       value: { Int: "999" },
//                     },
//                   ],
//                 },
//               ],
//               any_constructor: 102,
//             },
//           },
//         },
//         {
//           value_type: "Constr",
//           tag: 2,
//           fields: [
//             {
//               value_type: "Constr",
//               tag: 0,
//               fields: [
//                 {
//                   value_type: "Con",
//                   constant: { type: "Bool", value: false },
//                 },
//               ],
//               term_id: 1050,
//             },
//             {
//               value_type: "Lambda",
//               parameterName: "y",
//               body: {
//                 term_type: "Var",
//                 name: "y",
//                 id: 84,
//               },
//               env: {
//                 values: [
//                   {
//                     value_type: "Con",
//                     constant: { type: "Integer", value: "123" },
//                   },
//                 ],
//               },
//               term_id: 1051,
//             },
//           ],
//           term_id: 1046,
//         },
//         // UnsignedInteger constant
//         {
//           value_type: "Con",
//           constant: { type: "Integer", value: "42" },
//         },
//         // Simple ProtoList constant
//         {
//           value_type: "Con",
//           constant: {
//             type: "ProtoList",
//             elementType: { type: "Integer" },
//             values: [
//               { type: "Integer", value: "1" },
//               { type: "Integer", value: "2" },
//               { type: "Integer", value: "3" },
//               { type: "Integer", value: "999" },
//               { type: "Integer", value: "1000" },
//             ],
//           },
//         },
//         // Simple ProtoPair constant
//         {
//           value_type: "Con",
//           constant: {
//             type: "ProtoPair",
//             first_type: { type: "String" },
//             second_type: { type: "Integer" },
//             first_element: { type: "String", value: "pair_key" },
//             second_element: { type: "Integer", value: "12345" },
//           },
//         },
//         // Bls12_381G1Element constant
//         {
//           value_type: "Con",
//           constant: {
//             type: "Bls12_381G1Element",
//             serialized:
//               "97f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb08b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1",
//           },
//         },
//         // List of Pairs constant
//         {
//           value_type: "Con",
//           constant: {
//             type: "ProtoList",
//             elementType: {
//               type: "Pair",
//               first_type: { type: "String" },
//               second_type: { type: "Integer" },
//             },
//             values: [
//               {
//                 type: "ProtoPair",
//                 first_type: { type: "String" },
//                 second_type: { type: "Integer" },
//                 first_element: { type: "String", value: "name" },
//                 second_element: { type: "Integer", value: "100" },
//               },
//               {
//                 type: "ProtoPair",
//                 first_type: { type: "String" },
//                 second_type: { type: "Integer" },
//                 first_element: { type: "String", value: "age" },
//                 second_element: { type: "Integer", value: "25" },
//               },
//               {
//                 type: "ProtoPair",
//                 first_type: { type: "String" },
//                 second_type: { type: "Integer" },
//                 first_element: { type: "String", value: "score" },
//                 second_element: { type: "Integer", value: "95" },
//               },
//             ],
//           },
//         },
//         // List of Lists constant
//         {
//           value_type: "Con",
//           constant: {
//             type: "ProtoList",
//             elementType: {
//               type: "List",
//               elementType: { type: "Integer" },
//             },
//             values: [
//               {
//                 type: "ProtoList",
//                 elementType: { type: "Integer" },
//                 values: [
//                   { type: "Integer", value: "1" },
//                   { type: "Integer", value: "2" },
//                   { type: "Integer", value: "3" },
//                 ],
//               },
//               {
//                 type: "ProtoList",
//                 elementType: { type: "Integer" },
//                 values: [
//                   { type: "Integer", value: "10" },
//                   { type: "Integer", value: "20" },
//                 ],
//               },
//               {
//                 type: "ProtoList",
//                 elementType: { type: "Integer" },
//                 values: [
//                   { type: "Integer", value: "100" },
//                   { type: "Integer", value: "200" },
//                   { type: "Integer", value: "300" },
//                   { type: "Integer", value: "400" },
//                 ],
//               },
//             ],
//           },
//         },
//         // Pair of Lists constant
//         {
//           value_type: "Con",
//           constant: {
//             type: "ProtoPair",
//             first_type: {
//               type: "List",
//               elementType: { type: "String" },
//             },
//             second_type: {
//               type: "List",
//               elementType: { type: "Integer" },
//             },
//             first_element: {
//               type: "ProtoList",
//               elementType: { type: "String" },
//               values: [
//                 { type: "String", value: "apple" },
//                 { type: "String", value: "banana" },
//                 { type: "String", value: "orange" },
//               ],
//             },
//             second_element: {
//               type: "ProtoList",
//               elementType: { type: "Integer" },
//               values: [
//                 { type: "Integer", value: "50" },
//                 { type: "Integer", value: "30" },
//                 { type: "Integer", value: "45" },
//               ],
//             },
//           },
//         },
//         // Nested Pair constant
//         {
//           value_type: "Con",
//           constant: {
//             type: "ProtoPair",
//             first_type: {
//               type: "Pair",
//               first_type: { type: "String" },
//               second_type: { type: "Integer" },
//             },
//             second_type: {
//               type: "Pair",
//               first_type: { type: "Bool" },
//               second_type: { type: "ByteString" },
//             },
//             first_element: {
//               type: "ProtoPair",
//               first_type: { type: "String" },
//               second_type: { type: "Integer" },
//               first_element: { type: "String", value: "nested_key" },
//               second_element: { type: "Integer", value: "777" },
//             },
//             second_element: {
//               type: "ProtoPair",
//               first_type: { type: "Bool" },
//               second_type: { type: "ByteString" },
//               first_element: { type: "Bool", value: false },
//               second_element: { type: "ByteString", value: "deadbeefcafe" },
//             },
//           },
//         },
//       ],
//     };
//   }

//   public async start(sessionId: string): Promise<void> {
//     const session = this.validateSession(sessionId);
//     session.startParallelProcess();
//     session.budget.exUnitsSpent = 0;
//     session.budget.memoryUnitsSpent = 0;
//   }

//   public async continue(sessionId: string): Promise<void> {
//     const session = this.validateSession(sessionId);
//     session.startParallelProcess();
//   }

//   public async step(sessionId: string): Promise<void> {
//     const session = this.validateSession(sessionId);
//     for (let i = 0; i < 1000000000; i++) {}
//     session.budget.exUnitsSpent += 10;
//     session.budget.memoryUnitsSpent += 15;
//   }

//   public async stop(sessionId: string): Promise<void> {
//     const session = this.validateSession(sessionId);
    
//     // Stop parallel process on general stop
//     session.stopParallelProcess();
//     await session.waitForParallelProcessToStop();

//   }

//   public async pause(sessionId: string): Promise<void> {
//     const session = this.validateSession(sessionId);
//     session.stopParallelProcess();
//     await session.waitForParallelProcessToStop();
//   }

//   public async setBreakpointsList(
//     sessionId: string,
//     breakpoints: number[]
//   ): Promise<void> {
//     this.validateSession(sessionId);
//     // Mock implementation - store breakpoints if needed
//   }

//   public async stopParallelProcess(sessionId: string): Promise<void> {
//     const session = this.validateSession(sessionId);
//     session.stopParallelProcess();
//   }

//   private validateSession(sessionId: string): SessionData {
//     const session = this.sessions.get(sessionId);
//     if (!session) {
//       throw new Error(`Session ${sessionId} not found`);
//     }
//     return session;
//   }
// }

// class SessionData {
//   public budget: Budget;
//   public readonly redeemer: string;
//   public isFinished: boolean = false;
//   private shouldStopParallelProcess: boolean = false;
//   private parallelProcessPromise: Promise<void> | null = null;

//   constructor(redeemer: string) {
//     this.redeemer = redeemer;
//     this.budget = {
//       exUnitsSpent: 100,
//       exUnitsAvailable: 50,
//       memoryUnitsSpent: 0,
//       memoryUnitsAvailable: 0,
//     };
//   }

//   public startParallelProcess(): void {
//     this.shouldStopParallelProcess = false;
    
//     this.parallelProcessPromise = (async () => {
//       while (!this.shouldStopParallelProcess) {
//         for (let i = 0; i < 100000; i++) {
//           // Simple calculations for load
//           if (i % 10000 === 0) {
//             this.budget.exUnitsSpent += 1;
//             this.budget.memoryUnitsSpent += 1;
//           }
//         }
        
//         // Give other tasks a chance to execute
//         await new Promise(resolve => setTimeout(resolve, 0));
//       }
//     })();
//   }

//   public stopParallelProcess(): void {
//     this.shouldStopParallelProcess = true;
//   }

//   public async waitForParallelProcessToStop(): Promise<void> {
//     if (this.parallelProcessPromise) {
//       await this.parallelProcessPromise;
//       this.parallelProcessPromise = null;
//     }
//   }
// }
