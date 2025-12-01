use crate::{
    lazy_loading::{LazyLoadConfig, NavigationResult, PathSegment},
    value::{navigate_to_value, navigate_to_env_lazy, SerializableEnv, navigate_to_value_from_env},
    context::navigate_context_to_any,
    serializer::navigate_to_term_lazy,
    SerializableMachineState,
    debugger_engine::DebuggerError,
    wasm_tools::JsError,
};
use std::collections::HashSet;
use uplc::machine::MachineState;
use uplc::manual_machine::ManualMachine;

/// Implementation of lazy loading API for SessionController
pub struct LazySessionApi;

impl LazySessionApi {
    /// Get machine state with lazy loading support
    /// 
    /// # Arguments
    /// * `machine` - The machine to get state from
    /// * `term_ids` - Set of term IDs for optimization
    /// * `path` - Path segments to navigate to specific element
    /// * `return_full_object` - If true, returns full object at path; if false, returns object with children 1 level deep only
    pub fn get_machine_state_lazy(
        machine: &ManualMachine,
        term_ids: &HashSet<i32>,
        path: Vec<PathSegment>,
        return_full_object: bool,
    ) -> Result<String, JsError> {
        let state = machine.current_state();
        
        // If no path specified, return the top-level state
        if path.is_empty() {
            let config = LazyLoadConfig {
                path: vec![],
                return_full_object,
            };
            let lazy_state = SerializableMachineState::from_uplc_machine_state_lazy(state, term_ids, &config);
            return Ok(serde_json::to_string(&lazy_state)
                .map_err(|e| DebuggerError::MachineError(e.to_string()))?);
        }
        
        // Navigate to the specific element
        let result = match (state, path.first().unwrap()) {
            (MachineState::Return(_context, value), PathSegment::Field(field)) if field == "value" => {
                navigate_to_value(value, &path[1..], term_ids, return_full_object)
                    .map(|v| serde_json::to_value(v))
            }
            (MachineState::Return(context, _), PathSegment::Field(field)) if field == "context" => {
                navigate_context_to_any(context, &path[1..], term_ids, return_full_object)
                    .map(|v| Ok(v))
            }
            (MachineState::Compute(_context, env, _term), PathSegment::Field(field)) if field == "env" => {
                // If path continues after 'env', navigate to values inside env
                if path.len() > 1 {
                    navigate_to_value_from_env(env, &path[1..], term_ids, return_full_object)
                        .map(|v| serde_json::to_value(v))
                } else {
                    // Just return the env itself
                match navigate_to_env_lazy(env, &path[1..], term_ids, return_full_object) {
                    NavigationResult::Found(env_lazy) => NavigationResult::Found(serde_json::to_value(env_lazy)),
                    NavigationResult::InvalidPath(msg) => NavigationResult::InvalidPath(msg),
                    NavigationResult::Incomplete => NavigationResult::Incomplete,
                }
            }
            }
            (MachineState::Compute(context, _, _), PathSegment::Field(field)) if field == "context" => {
                navigate_context_to_any(context, &path[1..], term_ids, return_full_object)
                    .map(|v| Ok(v))
            }
            (MachineState::Compute(_, _, term), PathSegment::Field(field)) if field == "term" => {
                navigate_to_term_lazy(term, &path[1..], term_ids, return_full_object)
                    .map(|v| serde_json::to_value(v))
            }
            (MachineState::Done(term), PathSegment::Field(field)) if field == "term" => {
                navigate_to_term_lazy(term, &path[1..], term_ids, return_full_object)
                    .map(|v| serde_json::to_value(v))
            }
            _ => NavigationResult::InvalidPath(format!("Invalid path for machine state: {:?}", path))
        };
        
        match result {
            NavigationResult::Found(value) => {
                Ok(value.map_err(|e| DebuggerError::MachineError(format!("Serialization error: {}", e)))
                    .and_then(|v| serde_json::to_string(&v).map_err(|e| DebuggerError::MachineError(e.to_string())))?)
            }
            NavigationResult::InvalidPath(msg) => Err(DebuggerError::MachineError(msg))?,
            NavigationResult::Incomplete => Err(DebuggerError::MachineError("Path incomplete".to_string()))?,
        }
    }

    /// Get current environment with lazy loading support
    /// 
    /// # Arguments
    /// * `machine` - The machine to get env from
    /// * `term_ids` - Set of term IDs for optimization
    /// * `path` - Path segments to navigate to specific element
    /// * `return_full_object` - If true, returns full object at path; if false, returns object with children 1 level deep only
    pub fn get_current_env_lazy(
        machine: &ManualMachine,
        term_ids: &HashSet<i32>,
        path: Vec<PathSegment>,
        return_full_object: bool,
    ) -> Result<String, JsError> {
        match machine.current_state() {
            MachineState::Compute(_, env, _) => {
                // If path is empty, return the whole env
                if path.is_empty() {
                    let config = LazyLoadConfig {
                        path: vec![],
                        return_full_object,
                    };
                    let lazy_env = SerializableEnv::from_uplc_env_lazy(env, term_ids, &config);
                    Ok(serde_json::to_string(&lazy_env)
                        .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
                } else {
                    // Navigate to specific element
                    let result = if path.first() == Some(&PathSegment::Field("values".to_string())) || 
                                    matches!(path.first(), Some(PathSegment::Index(_))) {
                        // Navigating to a value
                        navigate_to_value_from_env(env, &path, term_ids, return_full_object)
                            .map(|v| serde_json::to_value(v))
                    } else {
                        NavigationResult::InvalidPath(format!("Invalid path for env: {:?}", path))
                    };
                    
                    match result {
                        NavigationResult::Found(value) => {
                            Ok(value.map_err(|e| DebuggerError::MachineError(format!("Serialization error: {}", e)))
                                .and_then(|v| serde_json::to_string(&v).map_err(|e| DebuggerError::MachineError(e.to_string())))?)
                        }
                        NavigationResult::InvalidPath(msg) => Err(DebuggerError::MachineError(msg))?,
                        NavigationResult::Incomplete => Err(DebuggerError::MachineError("Path incomplete".to_string()))?,
                    }
                }
            }
            _ => Ok(serde_json::to_string(&crate::value::SerializableEnvLazy { values: vec![] })
                .map_err(|e| DebuggerError::MachineError(e.to_string()))?),
        }
    }

    /// Get machine context with lazy loading support
    /// 
    /// # Arguments
    /// * `machine` - The machine to get contexts from
    /// * `term_ids` - Set of term IDs for optimization
    /// * `path` - Path segments to navigate to specific element (e.g., ["0", "env", "values", "2"])
    /// * `return_full_object` - If true, returns full object at path; if false, returns object with children 1 level deep only
    pub fn get_machine_context_lazy(
        machine: &ManualMachine,
        term_ids: &HashSet<i32>,
        path: Vec<PathSegment>,
        return_full_object: bool,
    ) -> Result<String, JsError> {
        use crate::SerializableMachineContext;
        
        let contexts = machine.collect_nested_contexts();
        
        // If path is empty, return all contexts
        if path.is_empty() {
            let config = LazyLoadConfig {
                path: vec![],
                return_full_object,
            };
            let lazy_contexts: Vec<_> = contexts
                .into_iter()
                .map(|ctx| SerializableMachineContext::from_uplc_context_lazy(&ctx, term_ids, &config))
                .collect();
            
            return Ok(serde_json::to_string(&lazy_contexts)
                .map_err(|e| DebuggerError::MachineError(e.to_string()))?);
        }
        
        // Navigate to specific element
        // First segment should be an index
        if let Some(PathSegment::Index(idx)) = path.first() {
            if let Some(context) = contexts.get(*idx) {
                let result = navigate_context_to_any(context, &path[1..], term_ids, return_full_object);
                
                match result {
                    NavigationResult::Found(value) => {
                        Ok(serde_json::to_string(&value)
                            .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
                    }
                    NavigationResult::InvalidPath(msg) => Err(DebuggerError::MachineError(msg))?,
                    NavigationResult::Incomplete => Err(DebuggerError::MachineError("Path incomplete".to_string()))?,
                }
            } else {
                Err(DebuggerError::MachineError(format!("Context index {} out of bounds", idx)))?  
            }
        } else {
            Err(DebuggerError::MachineError("First path segment must be an index for contexts".to_string()))?
        }
    }

    /// Parse path string from JSON array format
    pub fn parse_path(path_json: &str) -> Result<Vec<PathSegment>, JsError> {
        if path_json.trim().is_empty() || path_json == "[]" {
            return Ok(vec![]);
        }
        
        let path_array: Vec<String> = serde_json::from_str(path_json)
            .map_err(|e| DebuggerError::MachineError(format!("Invalid path format: {}", e)))?;
        
        let segments: Vec<PathSegment> = path_array
            .into_iter()
            .map(|s| {
                if let Ok(index) = s.parse::<usize>() {
                    PathSegment::Index(index)
                } else {
                    PathSegment::Field(s)
                }
            })
            .collect();
        
        Ok(segments)
    }
}
