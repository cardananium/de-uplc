use crate::{
    serializer::{term_to_either_term_or_id, EitherTermOrId},
    value::{SerializableEnv, SerializableValue},
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "context_type")]
pub enum SerializableMachineContext {
    #[serde(rename = "FrameAwaitArg")]
    FrameAwaitArg { value: SerializableValue },
    #[serde(rename = "FrameAwaitFunTerm")]
    FrameAwaitFunTerm {
        env: SerializableEnv,
        term: EitherTermOrId,
    },
    #[serde(rename = "FrameAwaitFunValue")]
    FrameAwaitFunValue { value: SerializableValue },
    #[serde(rename = "FrameForce")]
    FrameForce,
    #[serde(rename = "FrameConstr")]
    FrameConstr {
        env: SerializableEnv,
        tag: usize,
        terms: Vec<EitherTermOrId>,
        values: Vec<SerializableValue>,
        term_id: i32,
    },
    #[serde(rename = "FrameCases")]
    FrameCases {
        env: SerializableEnv,
        terms: Vec<EitherTermOrId>,
    },
    #[serde(rename = "NoFrame")]
    NoFrame,
}

impl SerializableMachineContext {
    /// Convert a UPLC Context to a serializable format
    pub fn from_uplc_context(context: &uplc::machine::Context) -> Self {
        Self::from_uplc_context_with_ids(context, &HashSet::new())
    }

    /// Convert a UPLC Context to a serializable format with term ID optimization
    pub fn from_uplc_context_with_ids(
        context: &uplc::machine::Context,
        term_ids: &HashSet<i32>,
    ) -> Self {
        match context {
            uplc::machine::Context::FrameAwaitArg(value, ..) => {
                SerializableMachineContext::FrameAwaitArg {
                    value: SerializableValue::from_uplc_value_with_ids(value, term_ids),
                }
            }
            uplc::machine::Context::FrameAwaitFunTerm(env, term, ..) => {
                SerializableMachineContext::FrameAwaitFunTerm {
                    env: SerializableEnv::from_uplc_env_with_ids(env, term_ids),
                    term: term_to_either_term_or_id(term, term_ids),
                }
            }
            uplc::machine::Context::FrameAwaitFunValue(value, ..) => {
                SerializableMachineContext::FrameAwaitFunValue {
                    value: SerializableValue::from_uplc_value_with_ids(value, term_ids),
                }
            }
            uplc::machine::Context::FrameForce(..) => SerializableMachineContext::FrameForce,
            uplc::machine::Context::FrameConstr(env, tag, terms, values, .., term_id) => {
                SerializableMachineContext::FrameConstr {
                    env: SerializableEnv::from_uplc_env_with_ids(env, term_ids),
                    tag: *tag,
                    terms: terms
                        .iter()
                        .map(|term| term_to_either_term_or_id(term, term_ids))
                        .collect(),
                    values: values
                        .iter()
                        .map(|value| SerializableValue::from_uplc_value_with_ids(value, term_ids))
                        .collect(),
                    term_id: *term_id as i32,
                }
            }
            uplc::machine::Context::FrameCases(env, terms, ..) => {
                SerializableMachineContext::FrameCases {
                    env: SerializableEnv::from_uplc_env_with_ids(env, term_ids),
                    terms: terms
                        .iter()
                        .map(|term| term_to_either_term_or_id(term, term_ids))
                        .collect(),
                }
            }
            uplc::machine::Context::NoFrame => SerializableMachineContext::NoFrame,
        }
    }
}

/// Convert a UPLC Context to JSON string
pub fn context_to_json(context: &uplc::machine::Context) -> Result<String, serde_json::Error> {
    let serializable_context = SerializableMachineContext::from_uplc_context(context);
    serde_json::to_string_pretty(&serializable_context)
}
