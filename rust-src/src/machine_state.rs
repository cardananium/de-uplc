use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use crate::{
    serializer::{EitherTermOrId, term_to_either_term_or_id},
    value::{SerializableValue, SerializableEnv},
    context::{SerializableMachineContext},
    lazy_loading::{LazyLoadableValue, LazyLoadableTermOrId, LazyLoadableEnv, LazyLoadableContext, LazyLoadConfig, SupportsLazyLoading},
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

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "machine_state_type")]
pub enum SerializableMachineStateLazy {
    #[serde(rename = "Return")]
    Return {
        context: LazyLoadableContext,
        value: LazyLoadableValue,
    },
    #[serde(rename = "Compute")]
    Compute {
        context: LazyLoadableContext,
        env: LazyLoadableEnv,
        term: LazyLoadableTermOrId,
    },
    #[serde(rename = "Done")]
    Done {
        term: LazyLoadableTermOrId,
    },
}

impl SupportsLazyLoading for SerializableMachineState {
    fn get_type_info(&self) -> (String, String, Option<usize>) {
        match self {
            SerializableMachineState::Return { .. } => {
                ("Return".to_string(), "Return state".to_string(), None)
            }
            SerializableMachineState::Compute { .. } => {
                ("Compute".to_string(), "Compute state".to_string(), None)
            }
            SerializableMachineState::Done { .. } => {
                ("Done".to_string(), "Done state".to_string(), None)
            }
        }
    }
}

impl SerializableMachineState {
    pub fn from_uplc_machine_state_lazy(
        state: &uplc::machine::MachineState,
        term_ids: &HashSet<i32>,
        config: &LazyLoadConfig
    ) -> SerializableMachineStateLazy {
        match state {
            uplc::machine::MachineState::Return(context, value) => {
                let lazy_context = if crate::value::should_load_field(&config.path, "context") || config.return_full_object {
                    let context_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        crate::value::advance_config(config, "context")
                    };
                    LazyLoadableContext::Loaded(SerializableMachineContext::from_uplc_context_lazy(context, term_ids, &context_config))
                } else {
                    LazyLoadableContext::TypeOnly {
                        type_name: "Context".to_string(),
                        kind: "Machine context".to_string(),
                        length: None
                    }
                };
                
                let lazy_value = if crate::value::should_load_field(&config.path, "value") || config.return_full_object {
                    let value_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        crate::value::advance_config(config, "value")
                    };
                    LazyLoadableValue::Loaded(crate::value::from_uplc_value_lazy(value, term_ids, &value_config))
                } else {
                    crate::value::get_value_type_only_new(value)
                };
                
                SerializableMachineStateLazy::Return {
                    context: lazy_context,
                    value: lazy_value,
                }
            }
            uplc::machine::MachineState::Compute(context, env, term) => {
                let lazy_context = if crate::value::should_load_field(&config.path, "context") || config.return_full_object {
                    let context_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        crate::value::advance_config(config, "context")
                    };
                    LazyLoadableContext::Loaded(SerializableMachineContext::from_uplc_context_lazy(context, term_ids, &context_config))
                } else {
                    LazyLoadableContext::TypeOnly {
                        type_name: "Context".to_string(),
                        kind: "Machine context".to_string(),
                        length: None
                    }
                };
                
                let lazy_env = if crate::value::should_load_field(&config.path, "env") || config.return_full_object {
                    let env_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        crate::value::advance_config(config, "env")
                    };
                    LazyLoadableEnv::Loaded(SerializableEnv::from_uplc_env_lazy(env, term_ids, &env_config))
                } else {
                    LazyLoadableEnv::TypeOnly {
                        type_name: "Env".to_string(),
                        kind: format!("Environment ({} values)", env.len()),
                        length: Some(env.len())
                    }
                };
                
                let lazy_term = if crate::value::should_load_field(&config.path, "term") || config.return_full_object {
                    let term_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        crate::value::advance_config(config, "term")
                    };
                    LazyLoadableTermOrId::Loaded(crate::value::term_to_either_term_or_id_lazy(term, term_ids, &term_config))
                } else {
                    LazyLoadableTermOrId::TypeOnly {
                        type_name: "Term".to_string(),
                        kind: "Term".to_string(),
                        length: None
                    }
                };
                
                SerializableMachineStateLazy::Compute {
                    context: lazy_context,
                    env: lazy_env,
                    term: lazy_term,
                }
            }
            uplc::machine::MachineState::Done(term) => {
                let lazy_term = if crate::value::should_load_field(&config.path, "term") || config.return_full_object {
                    let term_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        crate::value::advance_config(config, "term")
                    };
                    LazyLoadableTermOrId::Loaded(crate::value::term_to_either_term_or_id_lazy(term, term_ids, &term_config))
                } else {
                    LazyLoadableTermOrId::TypeOnly {
                        type_name: "Term".to_string(),
                        kind: "Term".to_string(),
                        length: None
                    }
                };
                
                SerializableMachineStateLazy::Done {
                    term: lazy_term,
                }
            }
        }
    }
}
