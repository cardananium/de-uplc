use serde::{Deserialize, Serialize};
use schemars::JsonSchema;

/// Base wrapper type that supports lazy loading for complex data structures
/// When depth is 0, only type information is included
/// When depth > 0, actual data is loaded up to the specified depth
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum LazyLoadable<T> {
    /// Fully loaded data
    Loaded(T),
    /// Only type information, no actual data
    TypeOnly {
        #[serde(rename = "_type")]
        type_name: String,
        #[serde(rename = "_kind")]
        kind: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "_length")]
        length: Option<usize>,
    },
}

impl<T> LazyLoadable<T> {
    pub fn type_only(type_name: String, kind: String, length: Option<usize>) -> Self {
        LazyLoadable::TypeOnly {
            type_name,
            kind,
            length,
        }
    }

    pub fn map<U, F: FnOnce(T) -> U>(self, f: F) -> LazyLoadable<U> {
        match self {
            LazyLoadable::Loaded(value) => LazyLoadable::Loaded(f(value)),
            LazyLoadable::TypeOnly { type_name, kind, length } => {
                LazyLoadable::TypeOnly { type_name, kind, length }
            }
        }
    }
}

/// Trait for types that support lazy loading
pub trait SupportsLazyLoading {
    /// Get type information for this value
    fn get_type_info(&self) -> (String, String, Option<usize>);
}

// Define concrete lazy loadable types for JSON schemas
// These are designed to prevent the LazyLoadable2, LazyLoadable3, etc. naming issue

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(untagged)]
pub enum LazyLoadableValue {
    Loaded(crate::value::SerializableValueLazy),
    TypeOnly {
        #[serde(rename = "_type")]
        type_name: String,
        #[serde(rename = "_kind")]
        kind: String,
        #[serde(rename = "_length")]
        length: Option<usize>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(untagged)]
pub enum LazyLoadableConstant {
    Loaded(crate::serializer::SerializableConstantLazy),
    TypeOnly {
        #[serde(rename = "_type")]
        type_name: String,
        #[serde(rename = "_kind")]
        kind: String,
        #[serde(rename = "_length")]
        length: Option<usize>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(untagged)]
pub enum LazyLoadableTermOrId {
    Loaded(crate::serializer::EitherTermOrIdLazy),
    TypeOnly {
        #[serde(rename = "_type")]
        type_name: String,
        #[serde(rename = "_kind")]
        kind: String,
        #[serde(rename = "_length")]
        length: Option<usize>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(untagged)]
pub enum LazyLoadableEnv {
    Loaded(crate::value::SerializableEnvLazy),
    TypeOnly {
        #[serde(rename = "_type")]
        type_name: String,
        #[serde(rename = "_kind")]
        kind: String,
        #[serde(rename = "_length")]
        length: Option<usize>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(untagged)]
pub enum LazyLoadableContext {
    Loaded(crate::context::SerializableMachineContextLazy),
    TypeOnly {
        #[serde(rename = "_type")]
        type_name: String,
        #[serde(rename = "_kind")]
        kind: String,
        #[serde(rename = "_length")]
        length: Option<usize>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(untagged)]
pub enum LazyLoadableBuiltinRuntime {
    Loaded(crate::value::SerializableBuiltinRuntimeLazy),
    TypeOnly {
        #[serde(rename = "_type")]
        type_name: String,
        #[serde(rename = "_kind")]
        kind: String,
        #[serde(rename = "_length")]
        length: Option<usize>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(untagged)]
pub enum LazyLoadableTerm {
    Loaded(crate::serializer::SerializableTermLazy),
    TypeOnly {
        #[serde(rename = "_type")]
        type_name: String,
        #[serde(rename = "_kind")]
        kind: String,
        #[serde(rename = "_length")]
        length: Option<usize>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(untagged)]
pub enum LazyLoadableData {
    Loaded(crate::plutus_data::SerializablePlutusData),
    TypeOnly {
        #[serde(rename = "_type")]
        type_name: String,
        #[serde(rename = "_kind")]
        kind: String,
        #[serde(rename = "_length")]
        length: Option<usize>,
    },
}

// Special types for Box<T> variants used in recursive structures

// Conversion implementations from LazyLoadable<T> to concrete enum types
impl From<LazyLoadable<crate::value::SerializableValueLazy>> for LazyLoadableValue {
    fn from(lazy: LazyLoadable<crate::value::SerializableValueLazy>) -> Self {
        match lazy {
            LazyLoadable::Loaded(v) => LazyLoadableValue::Loaded(v),
            LazyLoadable::TypeOnly { type_name, kind, length } => {
                LazyLoadableValue::TypeOnly { type_name, kind, length }
            }
        }
    }
}

impl From<LazyLoadable<crate::serializer::SerializableConstantLazy>> for LazyLoadableConstant {
    fn from(lazy: LazyLoadable<crate::serializer::SerializableConstantLazy>) -> Self {
        match lazy {
            LazyLoadable::Loaded(v) => LazyLoadableConstant::Loaded(v),
            LazyLoadable::TypeOnly { type_name, kind, length } => {
                LazyLoadableConstant::TypeOnly { type_name, kind, length }
            }
        }
    }
}

impl From<LazyLoadable<crate::serializer::EitherTermOrIdLazy>> for LazyLoadableTermOrId {
    fn from(lazy: LazyLoadable<crate::serializer::EitherTermOrIdLazy>) -> Self {
        match lazy {
            LazyLoadable::Loaded(v) => LazyLoadableTermOrId::Loaded(v),
            LazyLoadable::TypeOnly { type_name, kind, length } => {
                LazyLoadableTermOrId::TypeOnly { type_name, kind, length }
            }
        }
    }
}

impl From<LazyLoadable<crate::value::SerializableEnvLazy>> for LazyLoadableEnv {
    fn from(lazy: LazyLoadable<crate::value::SerializableEnvLazy>) -> Self {
        match lazy {
            LazyLoadable::Loaded(v) => LazyLoadableEnv::Loaded(v),
            LazyLoadable::TypeOnly { type_name, kind, length } => {
                LazyLoadableEnv::TypeOnly { type_name, kind, length }
            }
        }
    }
}

impl From<LazyLoadable<crate::context::SerializableMachineContextLazy>> for LazyLoadableContext {
    fn from(lazy: LazyLoadable<crate::context::SerializableMachineContextLazy>) -> Self {
        match lazy {
            LazyLoadable::Loaded(v) => LazyLoadableContext::Loaded(v),
            LazyLoadable::TypeOnly { type_name, kind, length } => {
                LazyLoadableContext::TypeOnly { type_name, kind, length }
            }
        }
    }
}

impl From<LazyLoadable<crate::value::SerializableBuiltinRuntimeLazy>> for LazyLoadableBuiltinRuntime {
    fn from(lazy: LazyLoadable<crate::value::SerializableBuiltinRuntimeLazy>) -> Self {
        match lazy {
            LazyLoadable::Loaded(v) => LazyLoadableBuiltinRuntime::Loaded(v),
            LazyLoadable::TypeOnly { type_name, kind, length } => {
                LazyLoadableBuiltinRuntime::TypeOnly { type_name, kind, length }
            }
        }
    }
}

impl From<LazyLoadable<crate::serializer::SerializableTermLazy>> for LazyLoadableTerm {
    fn from(lazy: LazyLoadable<crate::serializer::SerializableTermLazy>) -> Self {
        match lazy {
            LazyLoadable::Loaded(v) => LazyLoadableTerm::Loaded(v),
            LazyLoadable::TypeOnly { type_name, kind, length } => {
                LazyLoadableTerm::TypeOnly { type_name, kind, length }
            }
        }
    }
}

impl From<LazyLoadable<crate::plutus_data::SerializablePlutusData>> for LazyLoadableData {
    fn from(lazy: LazyLoadable<crate::plutus_data::SerializablePlutusData>) -> Self {
        match lazy {
            LazyLoadable::Loaded(v) => LazyLoadableData::Loaded(v),
            LazyLoadable::TypeOnly { type_name, kind, length } => {
                LazyLoadableData::TypeOnly { type_name, kind, length }
            }
        }
    }
}


/// Configuration for lazy loading
#[derive(Debug, Clone)]
pub struct LazyLoadConfig {
    /// Path to the specific element to load
    pub path: Vec<PathSegment>,
    /// If true, return the full object at the path
    /// If false, return only the object at the path + children 1 level deep
    pub return_full_object: bool,
}

/// Represents a segment in the path
#[derive(Debug, Clone, PartialEq)]
pub enum PathSegment {
    /// Named field in a struct/object
    Field(String),
    /// Index in an array/vector
    Index(usize),
}

/// Trait for types that can be navigated using a path
pub trait NavigablePath {
    /// The output type when navigating
    type Output;
    
    /// Navigate to a specific element using the given path
    fn navigate(&self, path: &[PathSegment]) -> NavigationResult<Self::Output>;
}

/// Result of a navigation operation
#[derive(Debug)]
pub enum NavigationResult<T> {
    /// Successfully found the target element
    Found(T),
    /// Path is invalid for this structure
    InvalidPath(String),
    /// Navigation incomplete - need to go deeper
    Incomplete,
}

impl<T> NavigationResult<T> {
    pub fn map<U, F: FnOnce(T) -> U>(self, f: F) -> NavigationResult<U> {
        match self {
            NavigationResult::Found(value) => NavigationResult::Found(f(value)),
            NavigationResult::InvalidPath(err) => NavigationResult::InvalidPath(err),
            NavigationResult::Incomplete => NavigationResult::Incomplete,
        }
    }
}