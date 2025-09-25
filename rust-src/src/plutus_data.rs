use serde::{Serialize, Deserialize};
use serde_json::Value;
use schemars::JsonSchema;
use pallas_primitives::PlutusData as PallasPlutusData;
use pallas_primitives::BigInt as PallasBigInt;

/// Serializable version of PlutusData that can be converted to/from JSON
#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "type")]
pub enum SerializablePlutusData {
    #[serde(rename = "Constr")]
    Constr {
        tag: u64,
        #[serde(rename = "any_constructor")]
        any_constructor: Option<u64>,
        fields: Vec<SerializablePlutusData>,
    },
    #[serde(rename = "Map")]
    Map {
        #[serde(rename = "key_value_pairs")]
        key_value_pairs: Vec<SerializableKeyValuePair>,
    },
    #[serde(rename = "BigInt")]
    BigInt(SerializableBigInt),
    #[serde(rename = "BoundedBytes")]
    BoundedBytes {
        value: String, // hex-encoded
    },
    #[serde(rename = "Array")]
    Array {
        values: Vec<SerializablePlutusData>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableKeyValuePair {
    pub key: SerializablePlutusData,
    pub value: SerializablePlutusData,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub enum SerializableBigInt {
    #[serde(rename = "Int")]
    Int(String), // string representation of the integer
    #[serde(rename = "BigUInt")]
    BigUInt(String), // hex-encoded bytes
    #[serde(rename = "BigNInt")]
    BigNInt(String), // hex-encoded bytes
}

impl SerializablePlutusData {
    /// Convert from Pallas PlutusData to our serializable version
    pub fn from_pallas(data: &PallasPlutusData) -> Self {
        match data {
            PallasPlutusData::Constr(constr) => {
                SerializablePlutusData::Constr {
                    tag: constr.tag,
                    any_constructor: constr.any_constructor,
                    fields: constr.fields.iter()
                        .map(|field| Self::from_pallas(field))
                        .collect(),
                }
            },
            PallasPlutusData::Map(map) => {
                SerializablePlutusData::Map {
                    key_value_pairs: map.iter()
                        .map(|(key, value)| SerializableKeyValuePair {
                            key: Self::from_pallas(key),
                            value: Self::from_pallas(value),
                        })
                        .collect(),
                }
            },
            PallasPlutusData::BigInt(big_int) => {
                SerializablePlutusData::BigInt(SerializableBigInt::from_pallas(big_int))
            },
            PallasPlutusData::BoundedBytes(bytes) => {
                SerializablePlutusData::BoundedBytes {
                    value: hex::encode(bytes.as_slice()),
                }
            },
            PallasPlutusData::Array(array) => {
                SerializablePlutusData::Array {
                    values: array.iter()
                        .map(|item| Self::from_pallas(item))
                        .collect(),
                }
            },
        }
    }

    /// Convert to JSON Value
    pub fn to_json_value(&self) -> Result<Value, serde_json::Error> {
        serde_json::to_value(self)
    }

    /// Convert to JSON string
    pub fn to_json_string(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Convert from JSON string
    pub fn from_json_string(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

impl SerializableBigInt {
    fn from_pallas(big_int: &PallasBigInt) -> Self {
        use num_bigint::{BigInt as NumBigInt, Sign as NumSign};
        match big_int {
            PallasBigInt::Int(int_val) => {
                SerializableBigInt::Int(int_val.to_string())
            },
            PallasBigInt::BigUInt(bytes) => {
                SerializableBigInt::BigUInt(NumBigInt::from_bytes_be(NumSign::Plus, bytes.as_slice()).to_string())
            },
            PallasBigInt::BigNInt(bytes) => {
                SerializableBigInt::BigNInt(NumBigInt::from_bytes_be(NumSign::Plus, bytes.as_slice()).to_string())
            },
        }
    }
}

/// Utility functions for working with PlutusData
impl SerializablePlutusData {
    /// Create a simple integer PlutusData
    pub fn integer(value: i64) -> Self {
        SerializablePlutusData::BigInt(SerializableBigInt::Int(value.to_string()))
    }

    /// Create a bytes PlutusData from hex string
    pub fn bytes_from_hex(hex: &str) -> Result<Self, hex::FromHexError> {
        // Validate hex string
        hex::decode(hex)?;
        Ok(SerializablePlutusData::BoundedBytes {
            value: hex.to_string(),
        })
    }

    /// Create a constructor PlutusData
    pub fn constructor(tag: u64, fields: Vec<SerializablePlutusData>) -> Self {
        SerializablePlutusData::Constr {
            tag,
            any_constructor: None,
            fields,
        }
    }

    /// Create an array PlutusData
    pub fn array(values: Vec<SerializablePlutusData>) -> Self {
        SerializablePlutusData::Array { values }
    }

    /// Create a map PlutusData
    pub fn map(pairs: Vec<(SerializablePlutusData, SerializablePlutusData)>) -> Self {
        SerializablePlutusData::Map {
            key_value_pairs: pairs.into_iter()
                .map(|(key, value)| SerializableKeyValuePair { key, value })
                .collect(),
        }
    }
}

// From trait implementation for easier conversion
impl From<PallasPlutusData> for SerializablePlutusData {
    fn from(data: PallasPlutusData) -> Self {
        Self::from_pallas(&data)
    }
}

impl From<&PallasPlutusData> for SerializablePlutusData {
    fn from(data: &PallasPlutusData) -> Self {
        Self::from_pallas(data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_integer_serialization() {
        let data = SerializablePlutusData::integer(42);
        let json = data.to_json_string().unwrap();
        println!("Integer PlutusData JSON: {}", json);
        
        assert!(json.contains("\"type\": \"BigInt\""));
        assert!(json.contains("\"Int\": \"42\""));
    }

    #[test]
    fn test_bytes_serialization() {
        let data = SerializablePlutusData::bytes_from_hex("deadbeef").unwrap();
        let json = data.to_json_string().unwrap();
        println!("Bytes PlutusData JSON: {}", json);
        
        assert!(json.contains("\"type\": \"BoundedBytes\""));
        assert!(json.contains("\"value\": \"deadbeef\""));
    }

    #[test]
    fn test_constructor_serialization() {
        let fields = vec![
            SerializablePlutusData::integer(1),
            SerializablePlutusData::integer(2),
        ];
        let data = SerializablePlutusData::constructor(0, fields);
        let json = data.to_json_string().unwrap();
        println!("Constructor PlutusData JSON: {}", json);
        
        assert!(json.contains("\"type\": \"Constr\""));
        assert!(json.contains("\"tag\": 0"));
        assert!(json.contains("\"fields\""));
    }

    #[test]
    fn test_array_serialization() {
        let values = vec![
            SerializablePlutusData::integer(1),
            SerializablePlutusData::integer(2),
            SerializablePlutusData::integer(3),
        ];
        let data = SerializablePlutusData::array(values);
        let json = data.to_json_string().unwrap();
        println!("Array PlutusData JSON: {}", json);
        
        assert!(json.contains("\"type\": \"Array\""));
        assert!(json.contains("\"values\""));
    }

    #[test]
    fn test_map_serialization() {
        let pairs = vec![
            (SerializablePlutusData::integer(1), SerializablePlutusData::integer(10)),
            (SerializablePlutusData::integer(2), SerializablePlutusData::integer(20)),
        ];
        let data = SerializablePlutusData::map(pairs);
        let json = data.to_json_string().unwrap();
        println!("Map PlutusData JSON: {}", json);
        
        assert!(json.contains("\"type\": \"Map\""));
        assert!(json.contains("\"key_value_pairs\""));
    }

    #[test]
    fn test_nested_data_serialization() {
        // Create a complex nested structure
        let inner_array = SerializablePlutusData::array(vec![
            SerializablePlutusData::integer(1),
            SerializablePlutusData::integer(2),
        ]);
        
        let constructor = SerializablePlutusData::constructor(0, vec![
            inner_array,
            SerializablePlutusData::bytes_from_hex("cafe").unwrap(),
        ]);
        
        let json = constructor.to_json_string().unwrap();
        println!("Nested PlutusData JSON: {}", json);
        
        assert!(json.contains("\"type\": \"Constr\""));
        assert!(json.contains("\"type\": \"Array\""));
        assert!(json.contains("\"type\": \"BoundedBytes\""));
    }
} 