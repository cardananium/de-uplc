pub mod serializer;
pub mod plutus_data;
pub mod value;
pub mod context;
pub mod machine_state;
pub mod utxo;
pub mod protocol_params;
pub mod script_context;
pub mod debugger_engine;
pub mod budget;
pub mod wasm_tools;
pub mod tx_utils;

#[cfg(test)]
mod tests;

// Re-export main functions and types for easy use
pub use serializer::{
    SerializableTerm, 
    SerializableConstant, 
    SerializableType,
    // BLS compressed serialization functions
    serialize_bls_g1_element_compressed,
    serialize_bls_g2_element_compressed,
};
pub use plutus_data::{
    SerializablePlutusData, 
    SerializableBigInt, 
    SerializableKeyValuePair
};
pub use value::{
    SerializableValue,
    SerializableEnv,
    SerializableBuiltinRuntime,
    value_to_json,
    value_to_json_value,
};
pub use context::{
    SerializableMachineContext,
    context_to_json,
};
pub use machine_state::{
    SerializableMachineState,
};
pub use utxo::{
    UtxoOutput,
    UtxoValue,
    ReferenceScript,
    ScriptType,
};
pub use protocol_params::{
    ProtocolParameters,
    ProtocolVersion,
    CostModels,
};
pub use script_context::{
    SerializableTxInfo,
    SerializableTxInfoV1,
    SerializableTxInfoV2,
    SerializableTxInfoV3,
    SerializableScriptContext,
    SerializableScriptInfo,
    SerializableScriptPurpose,
    SerializableTxInInfo,
    SerializableTransactionInput,
    SerializableTransactionOutput,
    SerializableDatumOption,
    SerializableTimeRange,
    SerializableCertificate,
    SerializableStakeCredential,
    SerializableVoter,
    SerializableVotingProcedure,
    SerializableRedeemer,
};
pub use debugger_engine::{
    DebuggerEngine,
    SessionController,
    Budget,
    DebuggerError,
    SerializableExecutionStatus,
};
pub use wasm_tools::{
    JsError,
    WasmResult,
    is_wasm_target,
};