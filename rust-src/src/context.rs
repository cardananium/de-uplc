use crate::{
    SerializableValue, lazy_loading::{LazyLoadConfig, LazyLoadable, LazyLoadableEnv, LazyLoadableTermOrId, LazyLoadableValue, PathSegment, SupportsLazyLoading}, serializer::{EitherTermOrId, term_to_either_term_or_id}, value::SerializableEnv
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

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "context_type")]
pub enum SerializableMachineContextLazy {
    #[serde(rename = "FrameAwaitArg")]
    FrameAwaitArg { value: LazyLoadableValue },
    #[serde(rename = "FrameAwaitFunTerm")]
    FrameAwaitFunTerm {
        env: LazyLoadableEnv,
        term: LazyLoadableTermOrId,
    },
    #[serde(rename = "FrameAwaitFunValue")]
    FrameAwaitFunValue { value: LazyLoadableValue },
    #[serde(rename = "FrameForce")]
    FrameForce,
    #[serde(rename = "FrameConstr")]
    FrameConstr {
        env: LazyLoadableEnv,
        tag: usize,
        terms: Vec<LazyLoadableTermOrId>,
        values: Vec<LazyLoadableValue>,
        term_id: i32,
    },
    #[serde(rename = "FrameCases")]
    FrameCases {
        env: LazyLoadableEnv,
        terms: Vec<LazyLoadableTermOrId>,
    },
    #[serde(rename = "NoFrame")]
    NoFrame,
}

impl SupportsLazyLoading for SerializableMachineContext {
    fn get_type_info(&self) -> (String, String, Option<usize>) {
        match self {
            SerializableMachineContext::FrameAwaitArg { .. } => {
                ("FrameAwaitArg".to_string(), "Awaiting argument".to_string(), None)
            }
            SerializableMachineContext::FrameAwaitFunTerm { .. } => {
                ("FrameAwaitFunTerm".to_string(), "Awaiting function term".to_string(), None)
            }
            SerializableMachineContext::FrameAwaitFunValue { .. } => {
                ("FrameAwaitFunValue".to_string(), "Awaiting function value".to_string(), None)
            }
            SerializableMachineContext::FrameForce => {
                ("FrameForce".to_string(), "Force frame".to_string(), None)
            }
            SerializableMachineContext::FrameConstr { tag, values, terms, .. } => {
                ("FrameConstr".to_string(), 
                 format!("Constructor #{} ({} values, {} terms)", tag, values.len(), terms.len()), 
                 None)
            }
            SerializableMachineContext::FrameCases { terms, .. } => {
                ("FrameCases".to_string(), 
                 format!("Case branches ({})", terms.len()), 
                 Some(terms.len()))
            }
            SerializableMachineContext::NoFrame => {
                ("NoFrame".to_string(), "No frame".to_string(), None)
            }
        }
    }
}

impl SerializableMachineContext {
    pub fn from_uplc_context_lazy(
        context: &uplc::machine::Context,
        term_ids: &HashSet<i32>,
        config: &LazyLoadConfig
    ) -> SerializableMachineContextLazy {
        use uplc::machine::Context;
        
        match context {
            Context::FrameAwaitArg(value, ..) => {
                let lazy_value = if should_load_field(&config.path, "value") || config.return_full_object {
                    let value_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        advance_config(config, "value")
                    };
                    LazyLoadableValue::Loaded(crate::value::from_uplc_value_lazy(value, term_ids, &value_config))
                } else {
                    crate::value::get_value_type_only_new(value)
                };
                SerializableMachineContextLazy::FrameAwaitArg { value: lazy_value }
            }
            Context::FrameAwaitFunTerm(env, term, ..) => {
                let lazy_env = if should_load_field(&config.path, "env") || config.return_full_object {
                    let env_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        advance_config(config, "env")
                    };
                    LazyLoadableEnv::Loaded(SerializableEnv::from_uplc_env_lazy(env, term_ids, &env_config))
                } else {
                    LazyLoadableEnv::TypeOnly {
                        type_name: "Env".to_string(), 
                        kind: format!("Environment ({} values)", env.len()), 
                        length: Some(env.len())
                    }
                };
                
                let lazy_term = if should_load_field(&config.path, "term") || config.return_full_object {
                    let term_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        advance_config(config, "term")
                    };
                    LazyLoadableTermOrId::Loaded(crate::value::term_to_either_term_or_id_lazy(term, term_ids, &term_config))
                } else {
                    LazyLoadableTermOrId::TypeOnly { type_name: "Term".to_string(), kind: "Term".to_string(), length: None }
                };
                
                SerializableMachineContextLazy::FrameAwaitFunTerm {
                    env: lazy_env,
                    term: lazy_term,
                }
            }
            Context::FrameAwaitFunValue(value, ..) => {
                let lazy_value = if should_load_field(&config.path, "value") || config.return_full_object {
                    let value_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        advance_config(config, "value")
                    };
                    LazyLoadableValue::Loaded(crate::value::from_uplc_value_lazy(value, term_ids, &value_config))
                } else {
                    crate::value::get_value_type_only_new(value)
                };
                SerializableMachineContextLazy::FrameAwaitFunValue { value: lazy_value }
            }
            Context::FrameForce(..) => SerializableMachineContextLazy::FrameForce,
            Context::FrameConstr(env, tag, terms, values, .., term_id) => {
                let lazy_env = if should_load_field(&config.path, "env") || config.return_full_object {
                    let env_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        advance_config(config, "env")
                    };
                    LazyLoadableEnv::Loaded(SerializableEnv::from_uplc_env_lazy(env, term_ids, &env_config))
                } else {
                    LazyLoadableEnv::TypeOnly {
                        type_name: "Env".to_string(), 
                        kind: format!("Environment ({} values)", env.len()), 
                        length: Some(env.len())
                    }
                };
                
                let lazy_terms: Vec<LazyLoadableTermOrId> = crate::value::load_vec_lazy(&config.path, "terms", terms, |t| {
                    let term_config = LazyLoadConfig {
                        path: vec![],
                        return_full_object: config.return_full_object, // Inherit from parent
                    };
                    LazyLoadable::Loaded(crate::value::term_to_either_term_or_id_lazy(t, term_ids, &term_config))
                }, |_| LazyLoadable::type_only("Term".to_string(), "Term".to_string(), None))
                .into_iter().map(|l| LazyLoadableTermOrId::from(l)).collect();
                
                let lazy_values: Vec<LazyLoadableValue> = crate::value::load_vec_lazy(&config.path, "values", values, |v| {
                    let value_config = LazyLoadConfig {
                        path: vec![],
                        return_full_object: config.return_full_object, // Inherit from parent
                    };
                    LazyLoadable::Loaded(crate::value::from_uplc_value_lazy(v, term_ids, &value_config))
                }, |v| match crate::value::get_value_type_only_new(v) {
                    LazyLoadableValue::TypeOnly { type_name, kind, length } => LazyLoadable::TypeOnly { type_name, kind, length },
                    _ => unreachable!()
                })
                .into_iter().map(|l| LazyLoadableValue::from(l)).collect();
                
                SerializableMachineContextLazy::FrameConstr {
                    env: lazy_env,
                    tag: *tag,
                    terms: lazy_terms,
                    values: lazy_values,
                    term_id: *term_id as i32,
                }
            }
            Context::FrameCases(env, terms, ..) => {
                let lazy_env = if should_load_field(&config.path, "env") || config.return_full_object {
                    let env_config = if config.return_full_object {
                        LazyLoadConfig { path: vec![], return_full_object: true }
                    } else {
                        advance_config(config, "env")
                    };
                    LazyLoadableEnv::Loaded(SerializableEnv::from_uplc_env_lazy(env, term_ids, &env_config))
                } else {
                    LazyLoadableEnv::TypeOnly {
                        type_name: "Env".to_string(), 
                        kind: format!("Environment ({} values)", env.len()), 
                        length: Some(env.len())
                    }
                };
                
                let lazy_terms: Vec<LazyLoadableTermOrId> = crate::value::load_vec_lazy(&config.path, "terms", terms, |t| {
                    let term_config = LazyLoadConfig {
                        path: vec![],
                        return_full_object: config.return_full_object, // Inherit from parent
                    };
                    LazyLoadable::Loaded(crate::value::term_to_either_term_or_id_lazy(t, term_ids, &term_config))
                }, |_| LazyLoadable::type_only("Term".to_string(), "Term".to_string(), None))
                .into_iter().map(|l| LazyLoadableTermOrId::from(l)).collect();
                
                SerializableMachineContextLazy::FrameCases {
                    env: lazy_env,
                    terms: lazy_terms,
                }
            }
            Context::NoFrame => SerializableMachineContextLazy::NoFrame,
        }
    }
}

fn should_load_field(path: &[PathSegment], field_name: &str) -> bool {
    path.is_empty() || matches!(path.first(), Some(PathSegment::Field(name)) if name == field_name)
}

fn advance_config(config: &LazyLoadConfig, field_name: &str) -> LazyLoadConfig {
    let new_path = if matches!(config.path.first(), Some(PathSegment::Field(name)) if name == field_name) {
        config.path[1..].to_vec()
    } else {
        config.path.clone()
    };
    
    LazyLoadConfig {
        path: new_path,
        return_full_object: config.return_full_object,
    }
}

// Navigation functions for contexts

pub fn navigate_context_to_any(
    context: &uplc::machine::Context,
    path: &[PathSegment],
    term_ids: &HashSet<i32>,
    return_full_object: bool
) -> crate::lazy_loading::NavigationResult<serde_json::Value> {
    use crate::lazy_loading::NavigationResult;
    use uplc::machine::Context;
    
    if path.is_empty() {
        // Return the context itself
        let config = LazyLoadConfig {
            path: vec![],
            return_full_object,
        };
        let lazy_context = SerializableMachineContext::from_uplc_context_lazy(context, term_ids, &config);
        return NavigationResult::Found(
            serde_json::to_value(lazy_context).unwrap()
        );
    }
    
    // Navigate to specific fields
    match (context, path.first().unwrap()) {
        (Context::FrameAwaitArg(value, ..), PathSegment::Field(field)) if field == "value" => {
            crate::value::navigate_value_to_any(value, &path[1..], term_ids, return_full_object)
        }
        (Context::FrameAwaitFunTerm(env, ..), PathSegment::Field(field)) if field == "env" => {
            // If path continues after 'env', navigate to values inside env
            if path.len() > 1 {
                crate::value::navigate_to_value_from_env(env, &path[1..], term_ids, return_full_object)
                    .map(|v| serde_json::to_value(v).unwrap())
            } else {
                // Just return the env itself
            match crate::value::navigate_to_env_lazy(env, &path[1..], term_ids, return_full_object) {
                NavigationResult::Found(env) => NavigationResult::Found(serde_json::to_value(env).unwrap()),
                NavigationResult::InvalidPath(msg) => NavigationResult::InvalidPath(msg),
                NavigationResult::Incomplete => NavigationResult::Incomplete,
                }
            }
        }
        (Context::FrameAwaitFunValue(value, ..), PathSegment::Field(field)) if field == "value" => {
            crate::value::navigate_value_to_any(value, &path[1..], term_ids, return_full_object)
        }
        (Context::FrameConstr(_, _, _, values, ..), PathSegment::Field(field)) if field == "values" => {
            if let Some(PathSegment::Index(idx)) = path.get(1) {
                if let Some(value) = values.get(*idx) {
                    crate::value::navigate_value_to_any(value, &path[2..], term_ids, return_full_object)
                } else {
                    NavigationResult::InvalidPath(format!("Index {} out of bounds in values", idx))
                }
            } else {
                NavigationResult::InvalidPath("Expected index after 'values'".to_string())
            }
        }
        (Context::FrameConstr(env, ..), PathSegment::Field(field)) if field == "env" => {
            // If path continues after 'env', navigate to values inside env
            if path.len() > 1 {
                crate::value::navigate_to_value_from_env(env, &path[1..], term_ids, return_full_object)
                    .map(|v| serde_json::to_value(v).unwrap())
            } else {
                // Just return the env itself
            match crate::value::navigate_to_env_lazy(env, &path[1..], term_ids, return_full_object) {
                NavigationResult::Found(env) => NavigationResult::Found(serde_json::to_value(env).unwrap()),
                NavigationResult::InvalidPath(msg) => NavigationResult::InvalidPath(msg),
                NavigationResult::Incomplete => NavigationResult::Incomplete,
                }
            }
        }
        (Context::FrameCases(env, ..), PathSegment::Field(field)) if field == "env" => {
            // If path continues after 'env', navigate to values inside env
            if path.len() > 1 {
                crate::value::navigate_to_value_from_env(env, &path[1..], term_ids, return_full_object)
                    .map(|v| serde_json::to_value(v).unwrap())
            } else {
                // Just return the env itself
            match crate::value::navigate_to_env_lazy(env, &path[1..], term_ids, return_full_object) {
                NavigationResult::Found(env) => NavigationResult::Found(serde_json::to_value(env).unwrap()),
                NavigationResult::InvalidPath(msg) => NavigationResult::InvalidPath(msg),
                NavigationResult::Incomplete => NavigationResult::Incomplete,
                }
            }
        }
        _ => NavigationResult::InvalidPath(format!("Invalid path for context: {:?}", path))
    }
}


