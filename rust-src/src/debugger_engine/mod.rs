pub mod debugger_engine;
pub mod session_controller;

pub use debugger_engine::{DebuggerEngine};
pub use session_controller::SessionController;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "status_type")]
pub enum SerializableExecutionStatus {
    #[serde(rename = "Ready")]
    Ready,
    #[serde(rename = "Done")]
    Done {
        result: crate::serializer::SerializableTerm,
    },
    #[serde(rename = "Error")]
    Error { message: String },
}

impl From<uplc::manual_machine::ExecutionStatus> for SerializableExecutionStatus {
    fn from(status: uplc::manual_machine::ExecutionStatus) -> Self {
        match status {
            uplc::manual_machine::ExecutionStatus::Ready => SerializableExecutionStatus::Ready,
            uplc::manual_machine::ExecutionStatus::Done(term) => {
                SerializableExecutionStatus::Done {
                    result: crate::serializer::SerializableTerm::from_uplc_term(&term),
                }
            }
            uplc::manual_machine::ExecutionStatus::Error(error) => {
                SerializableExecutionStatus::Error {
                    message: error.to_string(),
                }
            }
        }
    }
}

impl From<&uplc::manual_machine::ExecutionStatus> for SerializableExecutionStatus {
    fn from(status: &uplc::manual_machine::ExecutionStatus) -> Self {
        match status {
            uplc::manual_machine::ExecutionStatus::Ready => SerializableExecutionStatus::Ready,
            uplc::manual_machine::ExecutionStatus::Done(term) => {
                SerializableExecutionStatus::Done {
                    result: crate::serializer::SerializableTerm::from_uplc_term(term),
                }
            }
            uplc::manual_machine::ExecutionStatus::Error(error) => {
                SerializableExecutionStatus::Error {
                    message: error.to_string(),
                }
            }
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Budget {
    pub mem: i64,
    pub cpu: i64,
}

impl From<uplc::machine::cost_model::ExBudget> for Budget {
    fn from(ex_budget: uplc::machine::cost_model::ExBudget) -> Self {
        Budget {
            mem: ex_budget.mem,
            cpu: ex_budget.cpu,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum DebuggerError {
    #[error("Failed to parse transaction: {0}")]
    TransactionParseError(String),

    #[error("Failed to find redeemer: {0}")]
    RedeemerNotFound(String),

    #[error("Failed to find script: {0}")]
    ScriptNotFound(String),

    #[error("Failed to build script context: {0}")]
    ScriptContextBuildError(String),

    #[error("Failed to build program: {0}")]
    ProgramBuildError(String),

    #[error("Session not found: {0}")]
    SessionNotFound(String),

    #[error("Machine error: {0}")]
    MachineError(String),

    #[error("Invalid script context")]
    InvalidScriptContext,

    #[error("UTXO conversion error: {0}")]
    UtxoConversionError(#[from] crate::utxo::UtxoConversionError),

    #[error("IO Error: {0}")]
    IoError(#[from] std::io::Error),
}
