use uplc::{
    machine::runtime::BuiltinRuntime,
};
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use std::{rc::Rc, collections::HashSet};
use crate::serializer::{SerializableConstant, EitherTermOrId, term_to_either_term_or_id};

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