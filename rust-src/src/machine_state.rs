use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use crate::{
    serializer::{EitherTermOrId, term_to_either_term_or_id},
    value::{SerializableValue, SerializableEnv},
    context::SerializableMachineContext,
};
use std::collections::HashSet;

#[derive(Serialize, Deserialize, Debug, JsonSchema)]
#[serde(tag = "machine_state_type")]
pub enum SerializableMachineState {
    #[serde(rename = "Return")]
    Return {
        context: SerializableMachineContext,
        value: SerializableValue,
    },
    #[serde(rename = "Compute")]
    Compute {
        context: SerializableMachineContext,
        env: SerializableEnv,
        term: EitherTermOrId,
    },
    #[serde(rename = "Done")]
    Done {
        term: EitherTermOrId,
    },
}

impl SerializableMachineState {
    /// Convert a UPLC MachineState to a serializable format
    pub fn from_uplc_machine_state(state: &uplc::machine::MachineState) -> Self {
        Self::from_uplc_machine_state_with_ids(state, &HashSet::new())
    }

    /// Convert a UPLC MachineState to a serializable format with term ID optimization
    pub fn from_uplc_machine_state_with_ids(state: &uplc::machine::MachineState, term_ids: &HashSet<i32>) -> Self {
        match state {
            uplc::machine::MachineState::Return(context, value) => {
                SerializableMachineState::Return {
                    context: SerializableMachineContext::from_uplc_context_with_ids(context, term_ids),
                    value: SerializableValue::from_uplc_value_with_ids(value, term_ids),
                }
            },
            uplc::machine::MachineState::Compute(context, env, term) => {
                SerializableMachineState::Compute {
                    context: SerializableMachineContext::from_uplc_context_with_ids(context, term_ids),
                    env: SerializableEnv::from_uplc_env_with_ids(env, term_ids),
                    term: term_to_either_term_or_id(term, term_ids),
                }
            },
            uplc::machine::MachineState::Done(term) => {
                SerializableMachineState::Done {
                    term: term_to_either_term_or_id(term, term_ids),
                }
            },
        }
}
}