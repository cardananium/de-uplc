use uplc::{
    machine::runtime::BuiltinRuntime,
    ast::{Term, NamedDeBruijn},
};
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use std::{rc::Rc, collections::HashSet};
use crate::serializer::{
    SerializableConstant, EitherTermOrId, term_to_either_term_or_id,
    SerializableConstantLazy, EitherTermOrIdLazy, SerializableTermLazy
};
use crate::lazy_loading::{LazyLoadable, LazyLoadableConstant, LazyLoadableTermOrId, LazyLoadableEnv, LazyLoadableValue, LazyLoadableBuiltinRuntime, LazyLoadableTerm, LazyLoadableData, SupportsLazyLoading, LazyLoadConfig, PathSegment, NavigablePath, NavigationResult};

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "value_type")]
pub enum SerializableValue {
    #[serde(rename = "Con")]
    Con {
        constant: SerializableConstant,
    },
    #[serde(rename = "Delay")]
    Delay {
        body: Box<EitherTermOrId>,
        env: SerializableEnv,
        term_id: i32,
    },
    #[serde(rename = "Lambda")]
    Lambda {
        #[serde(rename = "parameterName")]
        parameter_name: String,
        body: Box<EitherTermOrId>,
        env: SerializableEnv,
        term_id: i32,
    },
    #[serde(rename = "Builtin")]
    Builtin {
        fun: String,
        runtime: SerializableBuiltinRuntime,
        term_id: i32,
    },
    #[serde(rename = "Constr")]
    Constr {
        tag: usize,
        fields: Vec<SerializableValue>,
        term_id: i32,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableEnv {
    pub values: Vec<SerializableValue>,
}

/// Maximum number of elements to display when loading full object
/// to prevent performance issues with large environments
pub const MAX_FULL_OBJECT_ELEMENTS: usize = 10;

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableEnvLazy {
    pub values: Vec<LazyLoadableValue>,
    /// Number of elements displayed (M in "M of N")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub displayed_count: Option<usize>,
    /// Total number of elements in the environment (N in "M of N")
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_count: Option<usize>,
    /// Message to display when elements are truncated
    #[serde(skip_serializing_if = "Option::is_none")]
    pub truncation_message: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "value_type")]
pub enum SerializableValueLazy {
    #[serde(rename = "Con")]
    Con {
        constant: LazyLoadableConstant,
    },
    #[serde(rename = "Delay")]
    Delay {
        body: LazyLoadableTermOrId,
        env: LazyLoadableEnv,
        term_id: i32,
    },
    #[serde(rename = "Lambda")]
    Lambda {
        #[serde(rename = "parameterName")]
        parameter_name: String,
        body: LazyLoadableTermOrId,
        env: LazyLoadableEnv,
        term_id: i32,
    },
    #[serde(rename = "Builtin")]
    Builtin {
        fun: String,
        runtime: LazyLoadableBuiltinRuntime,
        term_id: i32,
    },
    #[serde(rename = "Constr")]
    Constr {
        tag: usize,
        fields: Vec<LazyLoadableValue>,
        term_id: i32,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableBuiltinRuntimeLazy {
    args: Vec<LazyLoadableValue>,
    fun: String,
    forces: u32,
    arity: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableBuiltinRuntime {
    args: Vec<SerializableValue>,
    fun: String,
    forces: u32,
    arity: u32,
}


impl SerializableValue {
    /// Convert a UPLC Value to a serializable format
    pub fn from_uplc_value(value: &uplc::machine::value::Value) -> Self {
        Self::from_uplc_value_with_ids(value, &HashSet::new())
    }

    /// Convert a UPLC Value to a serializable format with term ID optimization
    pub fn from_uplc_value_with_ids(value: &uplc::machine::value::Value, term_ids: &HashSet<i32>) -> Self {
        match value {
            uplc::machine::value::Value::Con(constant) => SerializableValue::Con {
                constant: SerializableConstant::from_uplc_constant(constant.as_ref()),
            },
            uplc::machine::value::Value::Delay { body, env, term_id } => SerializableValue::Delay {
                body: Box::new(term_to_either_term_or_id(body.as_ref(), term_ids)),
                env: SerializableEnv::from_uplc_env_with_ids(env, term_ids),
                term_id: *term_id as i32,
            },
            uplc::machine::value::Value::Lambda { parameter_name, body, env, term_id } => SerializableValue::Lambda {
                parameter_name: parameter_name.text.clone(),
                body: Box::new(term_to_either_term_or_id(body.as_ref(), term_ids)),
                env: SerializableEnv::from_uplc_env_with_ids(env, term_ids),
                term_id: *term_id as i32,
            },
            uplc::machine::value::Value::Builtin { fun, runtime, term_id } => SerializableValue::Builtin {
                fun: format!("{:?}", fun),
                runtime: SerializableBuiltinRuntime::from_uplc_runtime(runtime),
                term_id: *term_id as i32,
            },
            uplc::machine::value::Value::Constr { tag, fields, term_id } => SerializableValue::Constr {
                tag: *tag,
                fields: fields.iter().map(|field| Self::from_uplc_value_with_ids(field, term_ids)).collect(),
                term_id: *term_id as i32,
            },
        }
    }
}

impl SerializableEnv {
    pub fn from_uplc_env(env: &Rc<Vec<uplc::machine::value::Value>>) -> Self {
        Self::from_uplc_env_with_ids(env, &HashSet::new())
    }

    pub fn from_uplc_env_with_ids(env: &Rc<Vec<uplc::machine::value::Value>>, term_ids: &HashSet<i32>) -> Self {
        SerializableEnv {
            values: env.iter().map(|value| SerializableValue::from_uplc_value_with_ids(value, term_ids)).collect(),
        }
    }
}

impl SerializableBuiltinRuntime {
    fn from_uplc_runtime(runtime: &BuiltinRuntime) -> Self {
        SerializableBuiltinRuntime {
            args: runtime.args.iter().map(|value| SerializableValue::from_uplc_value(value)).collect(),
            fun: {
                let mut s = runtime.fun.to_string();
                if let Some(first_char) = s.chars().next() {
                    s.replace_range(0..first_char.len_utf8(), &first_char.to_uppercase().to_string());
                }
                s
        },
            forces: runtime.forces,
            arity: runtime.fun.arity() as u32,
        }
    }
}

/// Convert a UPLC Value to JSON string
pub fn value_to_json(value: &uplc::machine::value::Value) -> Result<String, serde_json::Error> {
    let serializable_value = SerializableValue::from_uplc_value(value);
    serde_json::to_string_pretty(&serializable_value)
}

/// Convert a UPLC Value to JSON Value
pub fn value_to_json_value(value: &uplc::machine::value::Value) -> Result<serde_json::Value, serde_json::Error> {
    let serializable_value = SerializableValue::from_uplc_value(value);
    serde_json::to_value(serializable_value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use uplc::{
        ast::Constant,
        machine::value::Value,
    };

    #[test]
    fn test_con_value_serialization() {
        let constant = Rc::new(Constant::Integer(42.into()));
        let value = Value::Con(constant);
        let json = value_to_json(&value).unwrap();
        println!("Con Value JSON: {}", json);
        
        assert!(json.contains("\"value_type\": \"Con\""));
        assert!(json.contains("\"type\": \"Integer\""));
        assert!(json.contains("\"value\": \"42\""));
    }

    #[test]
    fn test_constr_value_serialization() {
        let field1 = Value::Con(Rc::new(Constant::Integer(1.into())));
        let field2 = Value::Con(Rc::new(Constant::String("test".to_string())));
        let value = Value::Constr {
            tag: 5,
            fields: vec![field1, field2],
            term_id: 123,
        };
        let json = value_to_json(&value).unwrap();
        println!("Constr Value JSON: {}", json);
        
        assert!(json.contains("\"value_type\": \"Constr\""));
        assert!(json.contains("\"tag\": 5"));
        assert!(json.contains("\"fields\""));
        assert!(json.contains("\"term_id\": 123"));
    }

    #[test]
    fn test_builtin_value_serialization() {
        use uplc::{builtins::DefaultFunction, machine::runtime::BuiltinRuntime};
        
        let value = Value::Builtin {
            fun: DefaultFunction::AddInteger,
        runtime: BuiltinRuntime::new(DefaultFunction::AddInteger),
            term_id: 456,
        };
        let json = value_to_json(&value).unwrap();
        println!("Builtin Value JSON: {}", json);
        
        assert!(json.contains("\"value_type\": \"Builtin\""));
        assert!(json.contains("\"fun\": \"AddInteger\""));
        assert!(json.contains("\"term_id\": 456"));
    }

    #[test]
    fn test_builtin_runtime_serialization() {
        use uplc::{builtins::DefaultFunction, machine::runtime::BuiltinRuntime};
        
        let runtime = BuiltinRuntime::new(DefaultFunction::AddInteger);
        let value = Value::Builtin {
            fun: DefaultFunction::AddInteger,
            runtime,
            term_id: 789,
        };
        let json = value_to_json(&value).unwrap();
        println!("Builtin Runtime JSON: {}", json);
        
        assert!(json.contains("\"value_type\": \"Builtin\""));
        assert!(json.contains("\"fun\": \"AddInteger\""));
        assert!(json.contains("\"forces\": 0"));
        assert!(json.contains("\"args\": []"));
    }

    #[test]
    fn test_empty_env() {
        let env: Rc<Vec<Value>> = Rc::new(vec![]);
        let serializable_env = SerializableEnv::from_uplc_env(&env);
        let json = serde_json::to_string(&serializable_env).unwrap();
        println!("Empty Env JSON: {}", json);
        
        assert!(json.contains("\"values\":[]"));
    }

    #[test]
    fn test_env_with_values() {
        let val1 = Value::Con(Rc::new(Constant::Integer(1.into())));
        let val2 = Value::Con(Rc::new(Constant::Bool(true)));
        let env: Rc<Vec<Value>> = Rc::new(vec![val1, val2]);
        let serializable_env = SerializableEnv::from_uplc_env(&env);
        let json = serde_json::to_string(&serializable_env).unwrap();
        println!("Env with Values JSON: {}", json);
        
        assert!(json.contains("\"values\""));
        assert!(json.contains("\"Integer\""));
        assert!(json.contains("\"Bool\""));
    }
}

// Lazy loading implementations

impl SupportsLazyLoading for SerializableValue {
    fn get_type_info(&self) -> (String, String, Option<usize>) {
        match self {
            SerializableValue::Con { constant } => {
                ("Con".to_string(), format!("Constant: {:?}", constant), None)
            }
            SerializableValue::Delay { .. } => {
                ("Delay".to_string(), "Delayed computation".to_string(), None)
            }
            SerializableValue::Lambda { parameter_name, .. } => {
                ("Lambda".to_string(), format!("Function({})", parameter_name), None)
            }
            SerializableValue::Builtin { fun, .. } => {
                ("Builtin".to_string(), format!("Builtin: {}", fun), None)
            }
            SerializableValue::Constr { tag, fields, .. } => {
                ("Constr".to_string(), format!("Constructor #{}", tag), Some(fields.len()))
            }
        }
    }
}

impl NavigablePath for SerializableValue {
    type Output = SerializableValue;
    
    fn navigate(&self, path: &[PathSegment]) -> NavigationResult<Self::Output> {
        if path.is_empty() {
            return NavigationResult::Found(self.clone());
        }
        
        let Some((first, rest)) = path.split_first() else {
            return NavigationResult::InvalidPath("Empty path".to_string());
        };
        
        match (self, first) {
            (SerializableValue::Constr { fields, .. }, PathSegment::Index(idx)) => {
                match fields.get(*idx) {
                    Some(field) => field.navigate(rest),
                    None => NavigationResult::InvalidPath(format!("Index {} out of bounds", idx))
                }
            }
            (SerializableValue::Delay { env, .. }, PathSegment::Field(field)) if field == "env" => {
                // Navigate into env
                if let Some(PathSegment::Index(idx)) = rest.first() {
                    match env.values.get(*idx) {
                        Some(value) => value.navigate(&rest[1..]),
                        None => NavigationResult::InvalidPath(format!("Index {} out of bounds in env", idx))
                    }
                } else {
                    NavigationResult::InvalidPath("Expected index after env".to_string())
                }
            }
            (SerializableValue::Lambda { env, .. }, PathSegment::Field(field)) if field == "env" => {
                // Navigate into env
                if let Some(PathSegment::Index(idx)) = rest.first() {
                    match env.values.get(*idx) {
                        Some(value) => value.navigate(&rest[1..]),
                        None => NavigationResult::InvalidPath(format!("Index {} out of bounds in env", idx))
                    }
                } else {
                    NavigationResult::InvalidPath("Expected index after env".to_string())
                }
            }
            _ => NavigationResult::InvalidPath("Invalid path for this value type".to_string()),
        }
    }
}

impl SerializableEnv {
    pub fn from_uplc_env_lazy(
        env: &Rc<Vec<uplc::machine::value::Value>>, 
        term_ids: &HashSet<i32>,
        config: &LazyLoadConfig
    ) -> SerializableEnvLazy {
        let total_count = env.len();
        
        if config.return_full_object {
            // Full loading - load everything recursively, but limit to MAX_FULL_OBJECT_ELEMENTS
            let should_truncate = total_count > MAX_FULL_OBJECT_ELEMENTS;
            let elements_to_load = if should_truncate { MAX_FULL_OBJECT_ELEMENTS } else { total_count };
            
            let values: Vec<LazyLoadableValue> = env.iter()
                .take(elements_to_load)
                .map(|value| {
                    let full_config = LazyLoadConfig {
                        path: vec![],
                        return_full_object: true,
                    };
                    LazyLoadableValue::Loaded(from_uplc_value_lazy(value, term_ids, &full_config))
                })
                .collect();
            
            if should_truncate {
                SerializableEnvLazy {
                    values,
                    displayed_count: Some(elements_to_load),
                    total_count: Some(total_count),
                    truncation_message: Some(format!(
                        "Showing {} of {} elements. Use the left panel tree view to explore specific elements.",
                        elements_to_load, total_count
                    )),
                }
            } else {
                SerializableEnvLazy {
                    values,
                    displayed_count: None,
                    total_count: None,
                    truncation_message: None,
                }
            }
        } else {
            // Lazy loading based on path
            let values: Vec<LazyLoadableValue> = load_vec_lazy(
                &config.path,
                "", // Root level, no field name
                &env.iter().collect::<Vec<_>>(),
                |value| {
                    let inner_config = if config.path.len() == 1 {
                        // At target level, load with depth 1
                        LazyLoadConfig {
                            path: vec![],
                            return_full_object: config.return_full_object, // Inherit from parent
                        }
                    } else {
                        // Continue with remaining path
                        LazyLoadConfig {
                            path: config.path[1..].to_vec(),
                            return_full_object: config.return_full_object,
                        }
                    };
                    LazyLoadable::Loaded(from_uplc_value_lazy(value, term_ids, &inner_config))
                },
                |value| match get_value_type_only_new(value) {
                    LazyLoadableValue::TypeOnly { type_name, kind, length } => LazyLoadable::TypeOnly { type_name, kind, length },
                    _ => unreachable!()
                }
            )
            .into_iter()
            .map(|l| LazyLoadableValue::from(l))
            .collect();
            
            SerializableEnvLazy {
                values,
                displayed_count: None,
                total_count: None,
                truncation_message: None,
            }
        }
    }
}

fn get_value_type_only(value: &uplc::machine::value::Value) -> LazyLoadable<SerializableValue> {
    use uplc::machine::value::Value;
    
    let (type_name, kind, length) = match value {
        Value::Con(constant) => {
            let const_type = match constant.as_ref() {
                uplc::ast::Constant::Integer(_) => "Integer",
                uplc::ast::Constant::ByteString(_) => "ByteString",
                uplc::ast::Constant::String(_) => "String",
                uplc::ast::Constant::Bool(_) => "Bool",
                uplc::ast::Constant::Unit => "Unit",
                uplc::ast::Constant::ProtoList(_, _) => "ProtoList",
                uplc::ast::Constant::ProtoPair(_, _, _, _) => "ProtoPair",
                uplc::ast::Constant::Data(_) => "Data",
                _ => "Unknown",
            };
            ("Con".to_string(), const_type.to_string(), None)
        }
        Value::Delay { .. } => ("Delay".to_string(), "Delayed computation".to_string(), None),
        Value::Lambda { parameter_name, .. } => {
            ("Lambda".to_string(), format!("λ{}", parameter_name.text), None)
        }
        Value::Builtin { fun, .. } => {
            ("Builtin".to_string(), format!("{:?}", fun), None)
        }
        Value::Constr { tag, fields, .. } => {
            ("Constr".to_string(), format!("Constructor #{}", tag), Some(fields.len()))
        }
    };
    
    LazyLoadable::type_only(type_name, kind, length)
}

// New functions for lazy loading with nested LazyLoadable types

pub fn get_value_type_only_new(value: &uplc::machine::value::Value) -> LazyLoadableValue {
    use uplc::machine::value::Value;
    
    let (type_name, kind, length) = match value {
        Value::Con(constant) => {
            let const_type = match constant.as_ref() {
                uplc::ast::Constant::Integer(_) => "Integer",
                uplc::ast::Constant::ByteString(_) => "ByteString",
                uplc::ast::Constant::String(_) => "String",
                uplc::ast::Constant::Bool(_) => "Bool",
                uplc::ast::Constant::Unit => "Unit",
                uplc::ast::Constant::ProtoList(_, _) => "ProtoList",
                uplc::ast::Constant::ProtoPair(_, _, _, _) => "ProtoPair",
                uplc::ast::Constant::Data(_) => "Data",
                _ => "Unknown",
            };
            ("Con".to_string(), const_type.to_string(), None)
        }
        Value::Delay { .. } => ("Delay".to_string(), "Delayed computation".to_string(), None),
        Value::Lambda { parameter_name, .. } => {
            ("Lambda".to_string(), format!("λ{}", parameter_name.text), None)
        }
        Value::Builtin { fun, .. } => {
            ("Builtin".to_string(), format!("{:?}", fun), None)
        }
        Value::Constr { tag, fields, .. } => {
            ("Constr".to_string(), format!("Constructor #{}", tag), Some(fields.len()))
        }
    };
    
    LazyLoadableValue::TypeOnly { type_name, kind, length }
}

pub fn from_uplc_value_lazy(
    value: &uplc::machine::value::Value,
    term_ids: &HashSet<i32>,
    config: &LazyLoadConfig
) -> SerializableValueLazy {
    use uplc::machine::value::Value;
    
    match value {
        Value::Con(constant) => {
            let lazy_constant = if config.return_full_object || config.path.is_empty() {
                let const_config = if config.return_full_object {
                    // Load constant fully recursively
                    LazyLoadConfig { path: vec![], return_full_object: true }
                } else {
                    config.clone()
                };
                LazyLoadableConstant::Loaded(from_uplc_constant_lazy(constant.as_ref(), term_ids, &const_config))
            } else {
                match get_constant_type_only(constant.as_ref()) {
                    LazyLoadable::TypeOnly { type_name, kind, length } => LazyLoadableConstant::TypeOnly { type_name, kind, length },
                    _ => unreachable!()
                }
            };
            SerializableValueLazy::Con { constant: lazy_constant }
        }
        Value::Delay { body, env, term_id } => {
            let lazy_body = if should_load_field(&config.path, "body") || config.return_full_object {
                let body_config = if config.return_full_object {
                    LazyLoadConfig { path: vec![], return_full_object: true }
                } else {
                    advance_config(config, "body")
                };
                LazyLoadableTermOrId::Loaded(term_to_either_term_or_id_lazy(body.as_ref(), term_ids, &body_config))
            } else {
                LazyLoadableTermOrId::TypeOnly { type_name: "Term".to_string(), kind: "Term".to_string(), length: None }
            };
            
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
            
            SerializableValueLazy::Delay {
                body: lazy_body,
                env: lazy_env,
                term_id: *term_id as i32,
            }
        }
        Value::Lambda { parameter_name, body, env, term_id } => {
            let lazy_body = if should_load_field(&config.path, "body") || config.return_full_object {
                let body_config = if config.return_full_object {
                    LazyLoadConfig { path: vec![], return_full_object: true }
                } else {
                    advance_config(config, "body")
                };
                LazyLoadableTermOrId::Loaded(term_to_either_term_or_id_lazy(body.as_ref(), term_ids, &body_config))
            } else {
                LazyLoadableTermOrId::TypeOnly { type_name: "Term".to_string(), kind: "Term".to_string(), length: None }
            };
            
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
            
            SerializableValueLazy::Lambda {
                parameter_name: parameter_name.text.clone(),
                body: lazy_body,
                env: lazy_env,
                term_id: *term_id as i32,
            }
        }
        Value::Builtin { fun, runtime, term_id } => {
            let lazy_runtime = if should_load_field(&config.path, "runtime") || config.return_full_object {
                let runtime_config = if config.return_full_object {
                    // When returnFullObject is true, load everything recursively
                    LazyLoadConfig {
                        path: vec![],
                        return_full_object: true,
                    }
                } else {
                    advance_config(config, "runtime")
                };
                LazyLoadableBuiltinRuntime::Loaded(from_uplc_runtime_lazy(runtime, term_ids, &runtime_config))
            } else {
                LazyLoadableBuiltinRuntime::TypeOnly {
                    type_name: "BuiltinRuntime".to_string(),
                    kind: format!("{:?} runtime", fun),
                    length: None
                }
            };
            
            SerializableValueLazy::Builtin {
                fun: format!("{:?}", fun),
                runtime: lazy_runtime,
                term_id: *term_id as i32,
            }
        }
        Value::Constr { tag, fields, term_id } => {
            let lazy_fields: Vec<LazyLoadableValue> = if config.return_full_object {
                // Full loading - load all fields recursively
                fields.iter().map(|field| {
                    let full_config = LazyLoadConfig {
                        path: vec![],
                        return_full_object: true,
                    };
                    LazyLoadableValue::Loaded(from_uplc_value_lazy(field, term_ids, &full_config))
                }).collect()
            } else {
                // Lazy loading
                load_vec_lazy(
                    &config.path,
                    "fields",
                    fields,
                    |field| {
                        let field_config = if matches!(config.path.first(), Some(PathSegment::Field(f)) if f == "fields") {
                            LazyLoadConfig {
                                path: config.path[1..].to_vec(),
                                return_full_object: config.return_full_object,
                            }
                        } else {
                            LazyLoadConfig {
                                path: vec![],
                                return_full_object: config.return_full_object, // Inherit from parent
                            }
                        };
                        LazyLoadable::Loaded(from_uplc_value_lazy(field, term_ids, &field_config))
                    },
                    |field| match get_value_type_only_new(field) {
                        LazyLoadableValue::TypeOnly { type_name, kind, length } => LazyLoadable::TypeOnly { type_name, kind, length },
                        _ => unreachable!()
                    }
                )
                .into_iter()
                .map(|l| LazyLoadableValue::from(l))
                .collect()
            };
            
            SerializableValueLazy::Constr {
                tag: *tag,
                fields: lazy_fields,
                term_id: *term_id as i32,
            }
        }
    }
}

fn load_value_with_depth(
    value: &uplc::machine::value::Value,
    term_ids: &HashSet<i32>,
    depth: usize
) -> LazyLoadable<SerializableValue> {
    if depth == 0 {
        get_value_type_only(value)
    } else {
        // For depth 1, we load the value but with lazy children
        use uplc::machine::value::Value;
        
        let serializable = match value {
            Value::Constr { tag, fields, term_id } => {
                let lazy_fields = if depth > 1 {
                    fields.iter()
                        .map(|f| SerializableValue::from_uplc_value_with_ids(f, term_ids))
                        .collect()
                } else {
                    // At depth 1, show only type info for fields
                    vec![]
                };
                
                SerializableValue::Constr {
                    tag: *tag,
                    fields: lazy_fields,
                    term_id: *term_id as i32,
                }
            }
            Value::Delay { body, env, term_id } => {
                let lazy_env = if depth > 1 {
                    SerializableEnv::from_uplc_env_with_ids(env, term_ids)
                } else {
                    SerializableEnv { values: vec![] }
                };
                
                SerializableValue::Delay {
                    body: Box::new(term_to_either_term_or_id(body.as_ref(), term_ids)),
                    env: lazy_env,
                    term_id: *term_id as i32,
                }
            }
            Value::Lambda { parameter_name, body, env, term_id } => {
                let lazy_env = if depth > 1 {
                    SerializableEnv::from_uplc_env_with_ids(env, term_ids)
                } else {
                    SerializableEnv { values: vec![] }
                };
                
                SerializableValue::Lambda {
                    parameter_name: parameter_name.text.clone(),
                    body: Box::new(term_to_either_term_or_id(body.as_ref(), term_ids)),
                    env: lazy_env,
                    term_id: *term_id as i32,
                }
            }
            _ => SerializableValue::from_uplc_value_with_ids(value, term_ids),
        };
        
        LazyLoadable::Loaded(serializable)
    }
}

// Helper functions for lazy loading

pub fn should_load_field(path: &[PathSegment], field_name: &str) -> bool {
    path.is_empty() || matches!(path.first(), Some(PathSegment::Field(name)) if name == field_name)
}

pub fn advance_config(config: &LazyLoadConfig, field_name: &str) -> LazyLoadConfig {
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

pub fn load_vec_lazy<T, F, G, O>(
    path: &[PathSegment],
    field_name: &str,
    items: &[T],
    load_fn: F,
    type_fn: G,
) -> Vec<LazyLoadable<O>>
where
    F: Fn(&T) -> LazyLoadable<O>,
    G: Fn(&T) -> LazyLoadable<O>,
    O: Sized,
{
    if path.is_empty() {
        // At current level, load items with type info only
        items.iter().map(type_fn).collect()
    } else if field_name.is_empty() || matches!(path.first(), Some(PathSegment::Index(_))) {
        // Direct indexing at root level
        if let Some(PathSegment::Index(idx)) = path.first() {
            items.iter().enumerate().map(|(i, item)| {
                if i == *idx {
                    load_fn(item)
                } else {
                    type_fn(item)
                }
            }).collect()
        } else {
            items.iter().map(type_fn).collect()
        }
    } else if matches!(path.first(), Some(PathSegment::Field(name)) if name == field_name) {
        // Field is being accessed
        if let Some(PathSegment::Index(idx)) = path.get(1) {
            // Specific index in the field
            items.iter().enumerate().map(|(i, item)| {
                if i == *idx {
                    load_fn(item)
                } else {
                    type_fn(item)
                }
            }).collect()
        } else {
            // Just the field, load all with type info
            items.iter().map(type_fn).collect()
        }
    } else {
        // Not in path
        items.iter().map(type_fn).collect()
    }
}

fn get_constant_type_only(constant: &uplc::ast::Constant) -> LazyLoadable<SerializableConstantLazy> {
    let (type_name, kind, length) = match constant {
        uplc::ast::Constant::Integer(i) => ("Integer".to_string(), i.to_string(), None),
        uplc::ast::Constant::ByteString(bs) => ("ByteString".to_string(), format!("{} bytes", bs.len()), None),
        uplc::ast::Constant::String(s) => ("String".to_string(), format!("{} chars", s.len()), None),
        uplc::ast::Constant::Bool(b) => ("Bool".to_string(), b.to_string(), None),
        uplc::ast::Constant::Unit => ("Unit".to_string(), "()".to_string(), None),
        uplc::ast::Constant::ProtoList(_, list) => ("ProtoList".to_string(), format!("{} items", list.len()), Some(list.len())),
        uplc::ast::Constant::ProtoPair(_, _, _, _) => ("ProtoPair".to_string(), "Pair".to_string(), None),
        uplc::ast::Constant::Data(_) => ("Data".to_string(), "PlutusData".to_string(), None),
        uplc::ast::Constant::Bls12_381G1Element(_) => ("Bls12_381G1Element".to_string(), "G1 point".to_string(), None),
        uplc::ast::Constant::Bls12_381G2Element(_) => ("Bls12_381G2Element".to_string(), "G2 point".to_string(), None),
        uplc::ast::Constant::Bls12_381MlResult(_) => ("Bls12_381MlResult".to_string(), "ML result".to_string(), None),
    };
    
    LazyLoadable::type_only(type_name, kind, length)
}

pub fn from_uplc_constant_lazy(
    constant: &uplc::ast::Constant,
    _term_ids: &HashSet<i32>,
    config: &LazyLoadConfig
) -> SerializableConstantLazy {
    use uplc::ast::Constant;
    
    match constant {
        Constant::Integer(i) => SerializableConstantLazy::Integer { value: i.to_string() },
        Constant::ByteString(bs) => SerializableConstantLazy::ByteString { value: hex::encode(bs) },
        Constant::String(s) => SerializableConstantLazy::String { value: s.clone() },
        Constant::Bool(b) => SerializableConstantLazy::Bool { value: *b },
        Constant::Unit => SerializableConstantLazy::Unit,
        Constant::ProtoList(ty, list) => {
            let lazy_values = if config.return_full_object {
                // Load all values fully recursively
                list.iter().map(|item| {
                    let full_config = LazyLoadConfig {
                        path: vec![],
                        return_full_object: true,
                    };
                    LazyLoadable::Loaded(from_uplc_constant_lazy(item, _term_ids, &full_config))
                }).collect()
            } else {
                load_vec_lazy(
                    &config.path,
                    "values",
                    list,
                    |item| {
                        let item_config = if matches!(config.path.first(), Some(PathSegment::Field(f)) if f == "values") {
                            LazyLoadConfig {
                                path: config.path[1..].to_vec(),
                                return_full_object: config.return_full_object,
                            }
                        } else {
                            LazyLoadConfig {
                                path: vec![],
                                return_full_object: config.return_full_object, // Inherit from parent
                            }
                        };
                        LazyLoadable::Loaded(from_uplc_constant_lazy(item, _term_ids, &item_config))
                    },
                    |item| get_constant_type_only(item)
                )
            };
            
            SerializableConstantLazy::ProtoList {
                element_type: crate::serializer::SerializableType::from_uplc_type(ty),
                values: lazy_values.into_iter().map(|l| LazyLoadableConstant::from(l)).collect(),
            }
        }
        Constant::ProtoPair(ty1, ty2, first, second) => {
            let lazy_first = if should_load_field(&config.path, "first_element") || config.return_full_object {
                let first_config = if config.return_full_object {
                    LazyLoadConfig { path: vec![], return_full_object: true }
                } else {
                    advance_config(config, "first_element")
                };
                Box::new(LazyLoadableConstant::Loaded(from_uplc_constant_lazy(first.as_ref(), _term_ids, &first_config)))
            } else {
                Box::new(match get_constant_type_only(first.as_ref()) {
                    LazyLoadable::TypeOnly { type_name, kind, length } => 
                        LazyLoadableConstant::TypeOnly { type_name, kind, length },
                    _ => unreachable!()
                })
            };
            
            let lazy_second = if should_load_field(&config.path, "second_element") || config.return_full_object {
                let second_config = if config.return_full_object {
                    LazyLoadConfig { path: vec![], return_full_object: true }
                } else {
                    advance_config(config, "second_element")
                };
                Box::new(LazyLoadableConstant::Loaded(from_uplc_constant_lazy(second.as_ref(), _term_ids, &second_config)))
            } else {
                Box::new(match get_constant_type_only(second.as_ref()) {
                    LazyLoadable::TypeOnly { type_name, kind, length } => 
                        LazyLoadableConstant::TypeOnly { type_name, kind, length },
                    _ => unreachable!()
                })
            };
            
            SerializableConstantLazy::ProtoPair {
                first_type: crate::serializer::SerializableType::from_uplc_type(ty1),
                second_type: crate::serializer::SerializableType::from_uplc_type(ty2),
                first_element: lazy_first,
                second_element: lazy_second,
            }
        }
        Constant::Data(data) => {
            let lazy_data = if should_load_field(&config.path, "data") {
                LazyLoadable::Loaded(crate::plutus_data::SerializablePlutusData::from(data))
            } else {
                LazyLoadable::type_only(
                    "PlutusData".to_string(),
                    "Data".to_string(),
                    None
                )
            };
            
            SerializableConstantLazy::Data { data: LazyLoadableData::from(lazy_data) }
        }
        Constant::Bls12_381G1Element(elem) => SerializableConstantLazy::Bls12_381G1Element {
            serialized: crate::serializer::serialize_bls_g1_element_compressed(elem),
        },
        Constant::Bls12_381G2Element(elem) => SerializableConstantLazy::Bls12_381G2Element {
            serialized: crate::serializer::serialize_bls_g2_element_compressed(elem),
        },
        Constant::Bls12_381MlResult(elem) => SerializableConstantLazy::Bls12_381MlResult {
            bytes: hex::encode(unsafe {
                let mut buffer = [0u8; 576];
                blst::blst_bendian_from_fp12(buffer.as_mut_ptr(), elem.as_ref());
                buffer
            }),
        },
    }
}

fn from_uplc_runtime_lazy(
    runtime: &BuiltinRuntime,
    term_ids: &HashSet<i32>,
    config: &LazyLoadConfig
) -> SerializableBuiltinRuntimeLazy {
    let lazy_args = if config.return_full_object {
        // Load all args fully recursively
        runtime.args.iter().map(|arg| {
            let full_config = LazyLoadConfig {
                path: vec![],
                return_full_object: true,
            };
            LazyLoadable::Loaded(from_uplc_value_lazy(arg, term_ids, &full_config))
        }).collect()
    } else {
        load_vec_lazy(
            &config.path,
            "args",
            &runtime.args,
            |arg| {
                let arg_config = if matches!(config.path.first(), Some(PathSegment::Field(f)) if f == "args") {
                    LazyLoadConfig {
                        path: config.path[1..].to_vec(),
                        return_full_object: config.return_full_object,
                    }
                } else {
                    LazyLoadConfig {
                        path: vec![],
                        return_full_object: config.return_full_object, // Inherit from parent
                    }
                };
                LazyLoadable::Loaded(from_uplc_value_lazy(arg, term_ids, &arg_config))
            },
            |arg| match get_value_type_only_new(arg) {
                LazyLoadableValue::TypeOnly { type_name, kind, length } => LazyLoadable::TypeOnly { type_name, kind, length },
                _ => unreachable!()
            }
        )
    };
    
    SerializableBuiltinRuntimeLazy {
        args: lazy_args.into_iter().map(|l| LazyLoadableValue::from(l)).collect(),
        fun: runtime.fun.to_string(),
        forces: runtime.forces,
        arity: runtime.fun.arity() as u32,
    }
}

pub fn term_to_either_term_or_id_lazy(
    term: &Term<NamedDeBruijn>,
    term_ids: &HashSet<i32>,
    config: &LazyLoadConfig
) -> EitherTermOrIdLazy {
    let uniq_id = match term {
        Term::Var { uniq_id, .. }
        | Term::Delay { uniq_id, .. }
        | Term::Lambda { uniq_id, .. }
        | Term::Apply { uniq_id, .. }
        | Term::Constant { uniq_id, .. }
        | Term::Force { uniq_id, .. }
        | Term::Error { uniq_id, .. }
        | Term::Builtin { uniq_id, .. }
        | Term::Constr { uniq_id, .. }
        | Term::Case { uniq_id, .. } => *uniq_id as i32,
    };
    
    if term_ids.contains(&uniq_id) {
        EitherTermOrIdLazy::Id { id: uniq_id }
    } else {
        let lazy_term = if config.return_full_object || config.path.is_empty() {
            LazyLoadable::Loaded(from_uplc_term_lazy(term, term_ids, config))
        } else {
            LazyLoadable::type_only(
                "Term".to_string(),
                format!("Term ID: {}", uniq_id),
                None
            )
        };
        EitherTermOrIdLazy::Term { term: match lazy_term {
            LazyLoadable::Loaded(v) => LazyLoadableTerm::Loaded(v),
            LazyLoadable::TypeOnly { type_name, kind, length } => LazyLoadableTerm::TypeOnly { type_name, kind, length },
        } }
    }
}

fn from_uplc_term_lazy(
    _term: &Term<NamedDeBruijn>,
    _term_ids: &HashSet<i32>,
    _config: &LazyLoadConfig
) -> SerializableTermLazy {
    // TODO: Implement full term conversion
    // For now, return a simple var as placeholder
    SerializableTermLazy::Var {
        id: 0,
        name: "TODO".to_string(),
    }
}

// Extension methods for LazyLoadable are defined in lazy_loading.rs

// Navigation functions for extracting specific elements by path

/// Navigate to any element within a value, returning serde_json::Value
/// This can handle both value navigation and env navigation
pub fn navigate_value_to_any(
    value: &uplc::machine::value::Value,
    path: &[PathSegment],
    term_ids: &HashSet<i32>,
    return_full_object: bool
) -> NavigationResult<serde_json::Value> {
    use uplc::machine::value::Value;
    
    if path.is_empty() {
        // We're at the target value
        let config = LazyLoadConfig {
            path: vec![],
            return_full_object,
        };
        return NavigationResult::Found(
            serde_json::to_value(from_uplc_value_lazy(value, term_ids, &config)).unwrap()
        );
    }

    // Check if we're navigating to env
    match (value, path.first().unwrap()) {
        (Value::Lambda { env, .. }, PathSegment::Field(field_name)) if field_name == "env" => {
            if path.len() > 1 {
                // Continue navigating into env values
                navigate_to_value_from_env(env, &path[1..], term_ids, return_full_object)
                    .map(|v| serde_json::to_value(v).unwrap())
            } else {
                // Return the env itself
                navigate_to_env_lazy(env, &[], term_ids, return_full_object)
                    .map(|e| serde_json::to_value(e).unwrap())
            }
        }
        (Value::Delay { env, .. }, PathSegment::Field(field_name)) if field_name == "env" => {
            if path.len() > 1 {
                // Continue navigating into env values
                navigate_to_value_from_env(env, &path[1..], term_ids, return_full_object)
                    .map(|v| serde_json::to_value(v).unwrap())
            } else {
                // Return the env itself
                navigate_to_env_lazy(env, &[], term_ids, return_full_object)
                    .map(|e| serde_json::to_value(e).unwrap())
            }
        }
        _ => {
            // Regular value navigation
            navigate_to_value(value, path, term_ids, return_full_object)
                .map(|v| serde_json::to_value(v).unwrap())
        }
    }
}

pub fn navigate_to_value(
    value: &uplc::machine::value::Value,
    path: &[PathSegment],
    term_ids: &HashSet<i32>,
    return_full_object: bool
) -> NavigationResult<SerializableValueLazy> {
    if path.is_empty() {
        // We're at the target
        let config = LazyLoadConfig {
            path: vec![],
            return_full_object,
        };
        return NavigationResult::Found(from_uplc_value_lazy(value, term_ids, &config));
    }

    // Navigate based on the value type
    use uplc::machine::value::Value;
    
    match (value, path.first().unwrap()) {
        (Value::Con(constant), PathSegment::Field(field_name)) if field_name == "constant" => {
            // Navigate to constant - need to import navigate_to_constant_lazy from serializer
            use crate::serializer::navigate_to_constant_lazy;
            match navigate_to_constant_lazy(constant, &path[1..], term_ids, return_full_object) {
                NavigationResult::Found(constant_lazy) => {
                    // Wrap constant in a Con value
                    NavigationResult::Found(SerializableValueLazy::Con {
                        constant: crate::lazy_loading::LazyLoadableConstant::Loaded(constant_lazy),
                    })
                }
                NavigationResult::InvalidPath(msg) => NavigationResult::InvalidPath(msg),
                NavigationResult::Incomplete => NavigationResult::Incomplete,
            }
        }
        (Value::Constr { fields, .. }, PathSegment::Field(field_name)) if field_name == "fields" => {
            if let Some(PathSegment::Index(idx)) = path.get(1) {
                if let Some(field) = fields.get(*idx) {
                    navigate_to_value(field, &path[2..], term_ids, return_full_object)
                } else {
                    NavigationResult::InvalidPath(format!("Index {} out of bounds", idx))
                }
            } else {
                NavigationResult::InvalidPath("Expected index after 'fields'".to_string())
            }
        }
        (Value::Lambda { body, .. }, PathSegment::Field(field_name)) if field_name == "body" => {
            // Validate path through term navigation
            use crate::serializer::navigate_to_term_lazy;
            match navigate_to_term_lazy(body, &path[1..], term_ids, return_full_object) {
                NavigationResult::Found(_) => {
                    // Path is valid but leads to Term, not Value
                    NavigationResult::InvalidPath("Body is a Term, cannot return as Value".to_string())
                }
                NavigationResult::InvalidPath(msg) => NavigationResult::InvalidPath(msg),
                NavigationResult::Incomplete => NavigationResult::Incomplete,
            }
        }
        (Value::Lambda { env, .. }, PathSegment::Field(field_name)) if field_name == "env" => {
            navigate_to_env(env, &path[1..], term_ids, return_full_object)
        }
        (Value::Delay { body, .. }, PathSegment::Field(field_name)) if field_name == "body" => {
            // Validate path through term navigation
            use crate::serializer::navigate_to_term_lazy;
            match navigate_to_term_lazy(body, &path[1..], term_ids, return_full_object) {
                NavigationResult::Found(_) => {
                    // Path is valid but leads to Term, not Value
                    NavigationResult::InvalidPath("Body is a Term, cannot return as Value".to_string())
                }
                NavigationResult::InvalidPath(msg) => NavigationResult::InvalidPath(msg),
                NavigationResult::Incomplete => NavigationResult::Incomplete,
            }
        }
        (Value::Delay { env, .. }, PathSegment::Field(field_name)) if field_name == "env" => {
            navigate_to_env(env, &path[1..], term_ids, return_full_object)
        }
        (Value::Builtin { runtime, .. }, PathSegment::Field(field_name)) if field_name == "runtime" => {
            navigate_to_runtime(runtime, &path[1..], term_ids, return_full_object)
        }
        // For any other path that doesn't match above patterns
        _ => NavigationResult::InvalidPath(format!("Cannot navigate path {:?} in value type", path))
      }
}

/// Navigate to a specific element within a BuiltinRuntime
pub fn navigate_to_runtime(
    runtime: &uplc::machine::runtime::BuiltinRuntime,
    path: &[PathSegment],
    term_ids: &HashSet<i32>,
    return_full_object: bool
) -> NavigationResult<SerializableValueLazy> {
    if path.is_empty() {
        // Return the runtime as a value (wrap it)
        // Actually, BuiltinRuntime is not a Value, so we can't return it directly
        // This path shouldn't be reached in normal flow
        return NavigationResult::InvalidPath("Cannot return runtime as value".to_string());
    }

    // Navigate to args
    match path.first().unwrap() {
        PathSegment::Field(field_name) if field_name == "args" => {
            if let Some(PathSegment::Index(idx)) = path.get(1) {
                if let Some(arg) = runtime.args.get(*idx) {
                    navigate_to_value(arg, &path[2..], term_ids, return_full_object)
                } else {
                    NavigationResult::InvalidPath(format!("Index {} out of bounds in runtime args", idx))
                }
            } else {
                NavigationResult::InvalidPath("Expected index after 'args'".to_string())
            }
        }
        _ => NavigationResult::InvalidPath(format!("Cannot navigate path {:?} in runtime", path))
    }
}

pub fn navigate_to_env(
    env: &Rc<Vec<uplc::machine::value::Value>>,
    path: &[PathSegment],
    term_ids: &HashSet<i32>,
    return_full_object: bool
) -> NavigationResult<SerializableValueLazy> {
    if path.is_empty() {
        // Return the whole env as a special case
        return NavigationResult::InvalidPath("Cannot return env as a value".to_string());
    }

    match path.first().unwrap() {
        PathSegment::Field(field_name) if field_name == "values" => {
            if let Some(PathSegment::Index(idx)) = path.get(1) {
                if let Some(value) = env.get(*idx) {
                    navigate_to_value(value, &path[2..], term_ids, return_full_object)
                } else {
                    NavigationResult::InvalidPath(format!("Index {} out of bounds in env", idx))
                }
            } else {
                NavigationResult::InvalidPath("Expected index after 'values'".to_string())
            }
        }
        PathSegment::Index(idx) => {
            // Direct indexing into env
            if let Some(value) = env.get(*idx) {
                navigate_to_value(value, &path[1..], term_ids, return_full_object)
            } else {
                NavigationResult::InvalidPath(format!("Index {} out of bounds in env", idx))
            }
        }
        _ => NavigationResult::InvalidPath(format!("Invalid path segment for env: {:?}", path))
    }
}

pub fn navigate_to_env_lazy(
    env: &Rc<Vec<uplc::machine::value::Value>>,
    path: &[PathSegment],
    term_ids: &HashSet<i32>,
    return_full_object: bool
) -> NavigationResult<SerializableEnvLazy> {
    if path.is_empty() {
        // Return the env at current level
        let config = LazyLoadConfig {
            path: vec![],
            return_full_object,
        };
        return NavigationResult::Found(SerializableEnv::from_uplc_env_lazy(env, term_ids, &config));
    }

    // For non-empty paths, we need to navigate to a value
    match navigate_to_value_from_env(env, path, term_ids, return_full_object) {
        NavigationResult::Found(_) => NavigationResult::InvalidPath("Path leads to a value, not an env".to_string()),
        other => other.map(|_| SerializableEnvLazy { 
            values: vec![],
            displayed_count: None,
            total_count: None,
            truncation_message: None,
        }) // This shouldn't happen
    }
}

pub fn navigate_to_value_from_env(
    env: &Rc<Vec<uplc::machine::value::Value>>,
    path: &[PathSegment],
    term_ids: &HashSet<i32>,
    return_full_object: bool
) -> NavigationResult<SerializableValueLazy> {
    match path.first().unwrap() {
        PathSegment::Field(field_name) if field_name == "values" => {
            if let Some(PathSegment::Index(idx)) = path.get(1) {
                if let Some(value) = env.get(*idx) {
                    navigate_to_value(value, &path[2..], term_ids, return_full_object)
                } else {
                    NavigationResult::InvalidPath(format!("Index {} out of bounds in env", idx))
                }
            } else {
                NavigationResult::InvalidPath("Expected index after 'values'".to_string())
            }
        }
        PathSegment::Index(idx) => {
            if let Some(value) = env.get(*idx) {
                navigate_to_value(value, &path[1..], term_ids, return_full_object)
            } else {
                NavigationResult::InvalidPath(format!("Index {} out of bounds in env", idx))
            }
        }
        _ => NavigationResult::InvalidPath(format!("Invalid path segment for env: {:?}", path))
    }
} 