use uplc::{
    ast::{Term, Constant, NamedDeBruijn, Type},
};
use std::collections::HashSet;
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use crate::plutus_data::SerializablePlutusData;
use crate::lazy_loading::{LazyLoadable, LazyLoadableConstant, LazyLoadableTermOrId, LazyLoadableTerm, LazyLoadableData, LazyLoadConfig};
use crate::value::{from_uplc_constant_lazy, should_load_field, advance_config};

// BLS serialization constants
const BLS12_381_G1_COMPRESSED_SIZE: usize = 48;
const BLS12_381_G2_COMPRESSED_SIZE: usize = 96;
const BLS12_381_G1_SERIALIZED_SIZE: usize = 96;
const BLS12_381_G2_SERIALIZED_SIZE: usize = 192;
const BLS12_381_FP12_SIZE: usize = 576;

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "type")]
pub enum EitherTermOrId {
    #[serde(rename = "Term")]
    Term {
        term: SerializableTerm,
    },
    #[serde(rename = "Id")]
    Id {
        id: i32,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "term_type")]
pub enum SerializableTerm {
    #[serde(rename = "Var")]
    Var {
        id: i32,
        name: String,
    },
    #[serde(rename = "Delay")]
    Delay {
        id: i32,
        term: Box<SerializableTerm>,
    },
    #[serde(rename = "Lambda")]
    Lambda {
        id: i32,
        #[serde(rename = "parameterName")]
        parameter_name: String,
        body: Box<SerializableTerm>,
    },
    #[serde(rename = "Apply")]
    Apply {
        id: i32,
        function: Box<SerializableTerm>,
        argument: Box<SerializableTerm>,
    },
    #[serde(rename = "Constant")]
    Constant {
        id: i32,
        constant: SerializableConstant,
    },
    #[serde(rename = "Force")]
    Force {
        id: i32,
        term: Box<SerializableTerm>,
    },
    #[serde(rename = "Error")]
    Error {
        id: i32,
    },
    #[serde(rename = "Builtin")]
    Builtin {
        id: i32,
        fun: String,
    },
    #[serde(rename = "Constr")]
    Constr {
        id: i32,
        #[serde(rename = "constructorTag")]
        constructor_tag: usize,
        fields: Vec<SerializableTerm>,
    },
    #[serde(rename = "Case")]
    Case {
        id: i32,
        constr: Box<SerializableTerm>,
        branches: Vec<SerializableTerm>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "type")]
pub enum SerializableConstant {
    #[serde(rename = "Integer")]
    Integer { value: String },
    #[serde(rename = "ByteString")]
    ByteString { value: String },
    #[serde(rename = "String")]
    String { value: String },
    #[serde(rename = "Bool")]
    Bool { value: bool },
    #[serde(rename = "Unit")]
    Unit,
    #[serde(rename = "ProtoList")]
    ProtoList { 
        #[serde(rename = "elementType")]
        element_type: SerializableType, 
        values: Vec<SerializableConstant> 
    },
    #[serde(rename = "ProtoPair")]
    ProtoPair { 
        #[serde(rename = "first_type")]
        first_type: SerializableType, 
        #[serde(rename = "second_type")]
        second_type: SerializableType,
        #[serde(rename = "first_element")]
        first_element: Box<SerializableConstant>,
        #[serde(rename = "second_element")]
        second_element: Box<SerializableConstant>
    },
    #[serde(rename = "Data")]
    Data { 
        data: SerializablePlutusData
    },
    #[serde(rename = "Bls12_381G1Element")]
    Bls12_381G1Element { 
        #[serde(rename = "serialized")]
        serialized: String, // hex-encoded full point (96 bytes)
    },
    #[serde(rename = "Bls12_381G2Element")]
    Bls12_381G2Element { 
        #[serde(rename = "serialized")]
        serialized: String, // hex-encoded full point (192 bytes)
    },
    #[serde(rename = "Bls12_381MlResult")]
    Bls12_381MlResult { 
        #[serde(rename = "bytes")]
        bytes: String, // hex-encoded Fp12 element (576 bytes)
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "type")]
pub enum SerializableType {
    #[serde(rename = "Bool")]
    Bool,
    #[serde(rename = "Integer")]
    Integer,
    #[serde(rename = "String")]
    String,
    #[serde(rename = "ByteString")]
    ByteString,
    #[serde(rename = "Unit")]
    Unit,
    #[serde(rename = "List")]
    List { 
        #[serde(rename = "elementType")]
        element_type: Box<SerializableType> 
    },
    #[serde(rename = "Pair")]
    Pair { 
        #[serde(rename = "first_type")]
        first_type: Box<SerializableType>, 
        #[serde(rename = "second_type")]
        second_type: Box<SerializableType> 
    },
    #[serde(rename = "Data")]
    Data,
    #[serde(rename = "Bls12_381G1Element")]
    Bls12_381G1Element,
    #[serde(rename = "Bls12_381G2Element")]
    Bls12_381G2Element,
    #[serde(rename = "Bls12_381MlResult")]
    Bls12_381MlResult,
}

/// Helper function to convert a term to EitherTermOrId based on whether its ID is in the set
pub fn term_to_either_term_or_id(term: &Term<NamedDeBruijn>, term_ids: &HashSet<i32>) -> EitherTermOrId {
    let term_id = match term {
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

    if term_ids.contains(&term_id) {
        EitherTermOrId::Id {
            id: term_id,
        }
    } else {
        EitherTermOrId::Term {
            term: SerializableTerm::from_uplc_term(term),
        }
    }
}

impl SerializableTerm {
    /// Convert a UPLC Term<NamedDeBruijn> to a serializable format
    pub fn from_uplc_term(term: &Term<NamedDeBruijn>) -> Self {
        match term {
            Term::Var { name, uniq_id } => SerializableTerm::Var {
                id: *uniq_id as i32,
                name: name.text.clone(),
            },
            Term::Delay { body, uniq_id } => SerializableTerm::Delay {
                id: *uniq_id as i32,
                term: Box::new(Self::from_uplc_term(body)),
            },
            Term::Lambda { parameter_name, body, uniq_id } => SerializableTerm::Lambda {
                id: *uniq_id as i32,
                parameter_name: parameter_name.text.clone(),
                body: Box::new(Self::from_uplc_term(body)),
            },
            Term::Apply { function, argument, uniq_id } => SerializableTerm::Apply {
                id: *uniq_id as i32,
                function: Box::new(Self::from_uplc_term(function)),
                argument: Box::new(Self::from_uplc_term(argument)),
            },
            Term::Constant { value, uniq_id } => SerializableTerm::Constant {
                id: *uniq_id as i32,
                constant: SerializableConstant::from_uplc_constant(value),
            },
            Term::Force { body, uniq_id } => SerializableTerm::Force {
                id: *uniq_id as i32,
                term: Box::new(Self::from_uplc_term(body)),
            },
            Term::Error { uniq_id } => SerializableTerm::Error {
                id: *uniq_id as i32,
            },
            Term::Builtin { fun, uniq_id } => SerializableTerm::Builtin {
                id: *uniq_id as i32,
                fun: format!("{:?}", fun),
            },
            Term::Constr { tag, fields, uniq_id } => SerializableTerm::Constr {
                id: *uniq_id as i32,
                constructor_tag: *tag,
                fields: fields.iter().map(|field| Self::from_uplc_term(field)).collect(),
            },
            Term::Case { constr, branches, uniq_id } => SerializableTerm::Case {
                id: *uniq_id as i32,
                constr: Box::new(Self::from_uplc_term(constr)),
                branches: branches.iter().map(|branch| Self::from_uplc_term(branch)).collect(),
            },
        }
    }
}

impl SerializableConstant {
    pub fn from_uplc_constant(constant: &Constant) -> Self {
        match constant {
            Constant::Integer(i) => SerializableConstant::Integer {
                value: i.to_string(),
            },
            Constant::ByteString(bytes) => SerializableConstant::ByteString {
                value: hex::encode(bytes),
            },
            Constant::String(s) => SerializableConstant::String {
                value: s.clone(),
            },
            Constant::Bool(b) => SerializableConstant::Bool {
                value: *b,
            },
            Constant::Unit => SerializableConstant::Unit,
            Constant::ProtoList(element_type, values) => SerializableConstant::ProtoList {
                element_type: SerializableType::from_uplc_type(element_type),
                values: values.iter().map(|v| Self::from_uplc_constant(v)).collect(),
            },
            Constant::ProtoPair(first_type, second_type, first_element, second_element) => {
                SerializableConstant::ProtoPair {
                    first_type: SerializableType::from_uplc_type(first_type),
                    second_type: SerializableType::from_uplc_type(second_type),
                    first_element: Box::new(Self::from_uplc_constant(first_element)),
                    second_element: Box::new(Self::from_uplc_constant(second_element)),
                }
            },
            Constant::Data(data) => SerializableConstant::Data {
                data: SerializablePlutusData::from_pallas(data),
            },
            Constant::Bls12_381G1Element(element) => SerializableConstant::Bls12_381G1Element {
                serialized: serialize_bls_g1_element_full(element),
            },
            Constant::Bls12_381G2Element(element) => SerializableConstant::Bls12_381G2Element {
                serialized: serialize_bls_g2_element_full(element),
            },
            Constant::Bls12_381MlResult(result) => SerializableConstant::Bls12_381MlResult {
                bytes: serialize_bls_fp12_element(result),
            },
        }
    }
}

impl SerializableType {
    pub fn from_uplc_type(uplc_type: &Type) -> Self {
        match uplc_type {
            Type::Bool => SerializableType::Bool,
            Type::Integer => SerializableType::Integer,
            Type::String => SerializableType::String,
            Type::ByteString => SerializableType::ByteString,
            Type::Unit => SerializableType::Unit,
            Type::List(element_type) => SerializableType::List {
                element_type: Box::new(Self::from_uplc_type(element_type)),
            },
            Type::Pair(first_type, second_type) => SerializableType::Pair {
                first_type: Box::new(Self::from_uplc_type(first_type)),
                second_type: Box::new(Self::from_uplc_type(second_type)),
            },
            Type::Data => SerializableType::Data,
            Type::Bls12_381G1Element => SerializableType::Bls12_381G1Element,
            Type::Bls12_381G2Element => SerializableType::Bls12_381G2Element,
            Type::Bls12_381MlResult => SerializableType::Bls12_381MlResult,
        }
    }
}

// === COMPRESSED SERIALIZATION FUNCTIONS (for optional use) ===

/// Serialize BLS G1 element to compressed hex string (48 bytes)
pub fn serialize_bls_g1_element_compressed(element: &blst::blst_p1) -> String {
    unsafe {
        let mut buffer = [0u8; BLS12_381_G1_COMPRESSED_SIZE];
        blst::blst_p1_compress(buffer.as_mut_ptr(), element);
        hex::encode(buffer)
    }
}

/// Serialize BLS G2 element to compressed hex string (96 bytes)
pub fn serialize_bls_g2_element_compressed(element: &blst::blst_p2) -> String {
    unsafe {
        let mut buffer = [0u8; BLS12_381_G2_COMPRESSED_SIZE];
        blst::blst_p2_compress(buffer.as_mut_ptr(), element);
        hex::encode(buffer)
    }
}

// === FULL SERIALIZATION FUNCTIONS (used by default) ===

/// Serialize BLS G1 element to full hex string (96 bytes)
fn serialize_bls_g1_element_full(element: &blst::blst_p1) -> String {
    unsafe {
        let mut buffer = [0u8; BLS12_381_G1_SERIALIZED_SIZE];
        blst::blst_p1_serialize(buffer.as_mut_ptr(), element);
        hex::encode(buffer)
    }
}

/// Serialize BLS G2 element to full hex string (192 bytes)
fn serialize_bls_g2_element_full(element: &blst::blst_p2) -> String {
    unsafe {
        let mut buffer = [0u8; BLS12_381_G2_SERIALIZED_SIZE];
        blst::blst_p2_serialize(buffer.as_mut_ptr(), element);
        hex::encode(buffer)
    }
}

/// Serialize BLS Fp12 element to hex string (576 bytes)
fn serialize_bls_fp12_element(element: &blst::blst_fp12) -> String {
    unsafe {
        let mut buffer = [0u8; BLS12_381_FP12_SIZE];
        blst::blst_bendian_from_fp12(buffer.as_mut_ptr(), element);
        hex::encode(buffer)
    }
}

// Lazy loading versions

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "type")]
pub enum EitherTermOrIdLazy {
    #[serde(rename = "Term")]
    Term {
        term: LazyLoadableTerm,
    },
    #[serde(rename = "Id")]
    Id {
        id: i32,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "term_type")]
pub enum SerializableTermLazy {
    #[serde(rename = "Var")]
    Var {
        id: i32,
        name: String,
    },
    #[serde(rename = "Delay")]
    Delay {
        id: i32,
        term: Box<LazyLoadableTerm>,
    },
    #[serde(rename = "Lambda")]
    Lambda {
        id: i32,
        #[serde(rename = "parameterName")]
        parameter_name: String,
        body: Box<LazyLoadableTerm>,
    },
    #[serde(rename = "Apply")]
    Apply {
        id: i32,
        function: Box<LazyLoadableTerm>,
        argument: Box<LazyLoadableTerm>,
    },
    #[serde(rename = "Constant")]
    Constant {
        id: i32,
        constant: LazyLoadableConstant,
    },
    #[serde(rename = "Force")]
    Force {
        id: i32,
        term: Box<LazyLoadableTerm>,
    },
    #[serde(rename = "Error")]
    Error {
        id: i32,
    },
    #[serde(rename = "Builtin")]
    Builtin {
        id: i32,
        fun: String,
    },
    #[serde(rename = "Constr")]
    Constr {
        id: i32,
        #[serde(rename = "constructorTag")]
        constructor_tag: usize,
        fields: Vec<LazyLoadableTerm>,
    },
    #[serde(rename = "Case")]
    Case {
        id: i32,
        constr: Box<LazyLoadableTerm>,
        branches: Vec<LazyLoadableTerm>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "type")]
pub enum SerializableConstantLazy {
    #[serde(rename = "Integer")]
    Integer { value: String },
    #[serde(rename = "ByteString")]
    ByteString { value: String },
    #[serde(rename = "String")]
    String { value: String },
    #[serde(rename = "Bool")]
    Bool { value: bool },
    #[serde(rename = "Unit")]
    Unit,
    #[serde(rename = "ProtoList")]
    ProtoList { 
        #[serde(rename = "elementType")]
        element_type: SerializableType, 
        values: Vec<LazyLoadableConstant> 
    },
    #[serde(rename = "ProtoPair")]
    ProtoPair { 
        #[serde(rename = "first_type")]
        first_type: SerializableType, 
        #[serde(rename = "second_type")]
        second_type: SerializableType,
        #[serde(rename = "first_element")]
        first_element: Box<LazyLoadableConstant>,
        #[serde(rename = "second_element")]
        second_element: Box<LazyLoadableConstant>
    },
    #[serde(rename = "Data")]
    Data { 
        data: LazyLoadableData
    },
    #[serde(rename = "Bls12_381G1Element")]
    Bls12_381G1Element { 
        #[serde(rename = "serialized")]
        serialized: String,
    },
    #[serde(rename = "Bls12_381G2Element")]
    Bls12_381G2Element { 
        #[serde(rename = "serialized")]
        serialized: String,
    },
    #[serde(rename = "Bls12_381MlResult")]
    Bls12_381MlResult { 
        #[serde(rename = "bytes")]
        bytes: String,
    },
}

impl SerializableTermLazy {
    /// Convert a UPLC Term to a lazy-loadable serializable format
    pub fn from_uplc_term_lazy(
        term: &Term<NamedDeBruijn>,
        term_ids: &HashSet<i32>,
        config: &crate::lazy_loading::LazyLoadConfig
    ) -> Self {
        
        match term {
            Term::Var { name, uniq_id } => SerializableTermLazy::Var {
                id: *uniq_id as i32,
                name: name.text.clone(),
            },
            Term::Delay { body, uniq_id } => {
                let lazy_term = if should_load_field(&config.path, "term") || config.return_full_object {
                    let term_config = advance_config(config, "term");
                    Box::new(crate::lazy_loading::LazyLoadableTerm::Loaded(
                        Self::from_uplc_term_lazy(body, term_ids, &term_config)
                    ))
                } else {
                    Box::new(crate::lazy_loading::LazyLoadableTerm::TypeOnly {
                        type_name: "Term".to_string(),
                        kind: "Term".to_string(),
                        length: None,
                    })
                };
                SerializableTermLazy::Delay {
                    id: *uniq_id as i32,
                    term: lazy_term,
                }
            }
            Term::Lambda { parameter_name, body, uniq_id } => {
                let lazy_body = if should_load_field(&config.path, "body") || config.return_full_object {
                    let body_config = advance_config(config, "body");
                    Box::new(crate::lazy_loading::LazyLoadableTerm::Loaded(
                        Self::from_uplc_term_lazy(body, term_ids, &body_config)
                    ))
                } else {
                    Box::new(crate::lazy_loading::LazyLoadableTerm::TypeOnly {
                        type_name: "Term".to_string(),
                        kind: "Term".to_string(),
                        length: None,
                    })
                };
                SerializableTermLazy::Lambda {
                    id: *uniq_id as i32,
                    parameter_name: parameter_name.text.clone(),
                    body: lazy_body,
                }
            }
            Term::Apply { function, argument, uniq_id } => {
                let lazy_function = if should_load_field(&config.path, "function") || config.return_full_object {
                    let fn_config = advance_config(config, "function");
                    Box::new(crate::lazy_loading::LazyLoadableTerm::Loaded(
                        Self::from_uplc_term_lazy(function, term_ids, &fn_config)
                    ))
                } else {
                    Box::new(crate::lazy_loading::LazyLoadableTerm::TypeOnly {
                        type_name: "Term".to_string(),
                        kind: "Term".to_string(),
                        length: None,
                    })
                };
                
                let lazy_argument = if should_load_field(&config.path, "argument") || config.return_full_object {
                    let arg_config = advance_config(config, "argument");
                    Box::new(crate::lazy_loading::LazyLoadableTerm::Loaded(
                        Self::from_uplc_term_lazy(argument, term_ids, &arg_config)
                    ))
                } else {
                    Box::new(crate::lazy_loading::LazyLoadableTerm::TypeOnly {
                        type_name: "Term".to_string(),
                        kind: "Term".to_string(),
                        length: None,
                    })
                };
                
                SerializableTermLazy::Apply {
                    id: *uniq_id as i32,
                    function: lazy_function,
                    argument: lazy_argument,
                }
            }
            Term::Constant { value, uniq_id } => {
                let lazy_constant = if should_load_field(&config.path, "constant") || config.return_full_object {
                    let const_config = advance_config(config, "constant");
                    crate::lazy_loading::LazyLoadableConstant::Loaded(
                        from_uplc_constant_lazy(value, term_ids, &const_config)
                    )
                } else {
                    crate::lazy_loading::LazyLoadableConstant::TypeOnly {
                        type_name: "Constant".to_string(),
                        kind: "Constant".to_string(),
                        length: None,
                    }
                };
                SerializableTermLazy::Constant {
                    id: *uniq_id as i32,
                    constant: lazy_constant,
                }
            }
            Term::Force { body, uniq_id } => {
                let lazy_term = if should_load_field(&config.path, "term") || config.return_full_object {
                    let term_config = advance_config(config, "term");
                    Box::new(crate::lazy_loading::LazyLoadableTerm::Loaded(
                        Self::from_uplc_term_lazy(body, term_ids, &term_config)
                    ))
                } else {
                    Box::new(crate::lazy_loading::LazyLoadableTerm::TypeOnly {
                        type_name: "Term".to_string(),
                        kind: "Term".to_string(),
                        length: None,
                    })
                };
                SerializableTermLazy::Force {
                    id: *uniq_id as i32,
                    term: lazy_term,
                }
            }
            Term::Error { uniq_id } => SerializableTermLazy::Error {
                id: *uniq_id as i32,
            },
            Term::Builtin { fun, uniq_id } => SerializableTermLazy::Builtin {
                id: *uniq_id as i32,
                fun: format!("{:?}", fun),
            },
            Term::Constr { tag, fields, uniq_id } => {
                let lazy_fields: Vec<_> = fields.iter().enumerate().map(|(_i, field)| {
                    if should_load_field(&config.path, "fields") || config.return_full_object {
                        let field_config = crate::lazy_loading::LazyLoadConfig {
                            path: if config.path.first() == Some(&crate::lazy_loading::PathSegment::Field("fields".to_string())) {
                                config.path[2..].to_vec()
                            } else {
                                vec![]
                            },
                            return_full_object: config.return_full_object,
                        };
                        crate::lazy_loading::LazyLoadableTerm::Loaded(
                            Self::from_uplc_term_lazy(field, term_ids, &field_config)
                        )
                    } else {
                        crate::lazy_loading::LazyLoadableTerm::TypeOnly {
                            type_name: "Term".to_string(),
                            kind: "Term".to_string(),
                            length: None,
                        }
                    }
                }).collect();
                
                SerializableTermLazy::Constr {
                    id: *uniq_id as i32,
                    constructor_tag: *tag,
                    fields: lazy_fields,
                }
            }
            Term::Case { constr, branches, uniq_id } => {
                let lazy_constr = if should_load_field(&config.path, "constr") || config.return_full_object {
                    let constr_config = advance_config(config, "constr");
                    Box::new(crate::lazy_loading::LazyLoadableTerm::Loaded(
                        Self::from_uplc_term_lazy(constr, term_ids, &constr_config)
                    ))
                } else {
                    Box::new(crate::lazy_loading::LazyLoadableTerm::TypeOnly {
                        type_name: "Term".to_string(),
                        kind: "Term".to_string(),
                        length: None,
                    })
                };
                
                let lazy_branches: Vec<_> = branches.iter().enumerate().map(|(_i, branch)| {
                    if should_load_field(&config.path, "branches") || config.return_full_object {
                        let branch_config = crate::lazy_loading::LazyLoadConfig {
                            path: if config.path.first() == Some(&crate::lazy_loading::PathSegment::Field("branches".to_string())) {
                                config.path[2..].to_vec()
                            } else {
                                vec![]
                            },
                            return_full_object: config.return_full_object,
                        };
                        crate::lazy_loading::LazyLoadableTerm::Loaded(
                            Self::from_uplc_term_lazy(branch, term_ids, &branch_config)
                        )
                    } else {
                        crate::lazy_loading::LazyLoadableTerm::TypeOnly {
                            type_name: "Term".to_string(),
                            kind: "Term".to_string(),
                            length: None,
                        }
                    }
                }).collect();
                
                SerializableTermLazy::Case {
                    id: *uniq_id as i32,
                    constr: lazy_constr,
                    branches: lazy_branches,
                }
            }
        }
    }
}

/// Navigate to a specific element within a term using path segments
pub fn navigate_to_term_lazy(
    term: &Term<NamedDeBruijn>,
    path: &[crate::lazy_loading::PathSegment],
    term_ids: &HashSet<i32>,
    return_full_object: bool
) -> crate::lazy_loading::NavigationResult<SerializableTermLazy> {
    use crate::lazy_loading::{NavigationResult, PathSegment, LazyLoadConfig};
    
    if path.is_empty() {
        // We're at the target term
        let config = LazyLoadConfig {
            path: vec![],
            return_full_object,
        };
        return NavigationResult::Found(SerializableTermLazy::from_uplc_term_lazy(term, term_ids, &config));
    }

    // Navigate based on the term type
    match (term, path.first().unwrap()) {
        // Delay: navigate to term
        (Term::Delay { body, .. }, PathSegment::Field(field_name)) if field_name == "term" => {
            navigate_to_term_lazy(body, &path[1..], term_ids, return_full_object)
        }
        // Lambda: navigate to body
        (Term::Lambda { body, .. }, PathSegment::Field(field_name)) if field_name == "body" => {
            navigate_to_term_lazy(body, &path[1..], term_ids, return_full_object)
        }
        // Apply: navigate to function or argument
        (Term::Apply { function, argument: _, .. }, PathSegment::Field(field_name)) if field_name == "function" => {
            navigate_to_term_lazy(function, &path[1..], term_ids, return_full_object)
        }
        (Term::Apply { function: _, argument, .. }, PathSegment::Field(field_name)) if field_name == "argument" => {
            navigate_to_term_lazy(argument, &path[1..], term_ids, return_full_object)
        }
        // Force: navigate to term
        (Term::Force { body, .. }, PathSegment::Field(field_name)) if field_name == "term" => {
            navigate_to_term_lazy(body, &path[1..], term_ids, return_full_object)
        }
        // Constr: navigate to fields by index
        (Term::Constr { fields, .. }, PathSegment::Field(field_name)) if field_name == "fields" => {
            if let Some(PathSegment::Index(idx)) = path.get(1) {
                if let Some(field) = fields.get(*idx) {
                    navigate_to_term_lazy(field, &path[2..], term_ids, return_full_object)
                } else {
                    NavigationResult::InvalidPath(format!("Index {} out of bounds in fields", idx))
                }
            } else {
                NavigationResult::InvalidPath("Expected index after 'fields'".to_string())
            }
        }
        // Case: navigate to constr or branches
        (Term::Case { constr, branches: _, .. }, PathSegment::Field(field_name)) if field_name == "constr" => {
            navigate_to_term_lazy(constr, &path[1..], term_ids, return_full_object)
        }
        (Term::Case { constr: _, branches, .. }, PathSegment::Field(field_name)) if field_name == "branches" => {
            if let Some(PathSegment::Index(idx)) = path.get(1) {
                if let Some(branch) = branches.get(*idx) {
                    navigate_to_term_lazy(branch, &path[2..], term_ids, return_full_object)
                } else {
                    NavigationResult::InvalidPath(format!("Index {} out of bounds in branches", idx))
                }
            } else {
                NavigationResult::InvalidPath("Expected index after 'branches'".to_string())
            }
        }
        // Constant: navigate to constant
        (Term::Constant { value, uniq_id }, PathSegment::Field(field_name)) if field_name == "constant" => {
            match navigate_to_constant_lazy(value, &path[1..], term_ids, return_full_object) {
                NavigationResult::Found(constant_lazy) => {
                    // Wrap constant in a Constant term
                    NavigationResult::Found(SerializableTermLazy::Constant {
                        id: *uniq_id as i32,
                        constant: crate::lazy_loading::LazyLoadableConstant::Loaded(constant_lazy),
                    })
                }
                NavigationResult::InvalidPath(msg) => NavigationResult::InvalidPath(msg),
                NavigationResult::Incomplete => NavigationResult::Incomplete,
            }
        }
        // Var, Error, Builtin are terminal nodes
        _ => NavigationResult::InvalidPath(format!("Cannot navigate path {:?} in term type", path))
    }
}

/// Navigate to a specific element within a constant using path segments
pub fn navigate_to_constant_lazy(
    constant: &Constant,
    path: &[crate::lazy_loading::PathSegment],
    term_ids: &HashSet<i32>,
    return_full_object: bool
) -> crate::lazy_loading::NavigationResult<SerializableConstantLazy> {
    use crate::lazy_loading::{NavigationResult, PathSegment, LazyLoadConfig};
    
    if path.is_empty() {
        // We're at the target constant
        let config = LazyLoadConfig {
            path: vec![],
            return_full_object,
        };
        return NavigationResult::Found(from_uplc_constant_lazy(constant, term_ids, &config));
    }

    // Navigate based on the constant type
    match (constant, path.first().unwrap()) {
        // ProtoList: navigate to values by index
        (Constant::ProtoList(_, values), PathSegment::Field(field_name)) if field_name == "values" => {
            if let Some(PathSegment::Index(idx)) = path.get(1) {
                if let Some(value) = values.get(*idx) {
                    navigate_to_constant_lazy(value, &path[2..], term_ids, return_full_object)
                } else {
                    NavigationResult::InvalidPath(format!("Index {} out of bounds in constant list", idx))
                }
            } else {
                NavigationResult::InvalidPath("Expected index after 'values'".to_string())
            }
        }
        // ProtoPair: navigate to first_element or second_element
        (Constant::ProtoPair(_, _, first, _second), PathSegment::Field(field_name)) if field_name == "first_element" => {
            navigate_to_constant_lazy(first, &path[1..], term_ids, return_full_object)
        }
        (Constant::ProtoPair(_, _, _first, second), PathSegment::Field(field_name)) if field_name == "second_element" => {
            navigate_to_constant_lazy(second, &path[1..], term_ids, return_full_object)
        }
        // Terminal types: Integer, ByteString, String, Bool, Unit, BLS elements
        // These don't have sub-fields, so if path is not empty, it's an error
        (Constant::Integer(_), _) 
        | (Constant::ByteString(_), _) 
        | (Constant::String(_), _) 
        | (Constant::Bool(_), _) 
        | (Constant::Unit, _) 
        | (Constant::Bls12_381G1Element(_), _) 
        | (Constant::Bls12_381G2Element(_), _) 
        | (Constant::Bls12_381MlResult(_), _) 
        | (Constant::Data(_), _) => {
            // Path is not empty for a terminal type - this shouldn't happen in normal flow
            // Just return the constant itself
            let config = LazyLoadConfig {
                path: vec![],
                return_full_object,
            };
            NavigationResult::Found(from_uplc_constant_lazy(constant, term_ids, &config))
        }
        // Invalid path for constant type
        _ => NavigationResult::InvalidPath(format!("Invalid navigation path {:?} for constant", path))
    }
}