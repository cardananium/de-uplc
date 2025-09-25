use uplc::{
    ast::{Term, Constant, NamedDeBruijn, Type},
};
use std::collections::HashSet;
use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use crate::plutus_data::SerializablePlutusData;

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