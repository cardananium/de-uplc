use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Protocol version information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolVersion {
    pub major: u32,
    pub minor: u32,
}

/// Plutus cost models with arrays of numbers instead of maps
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub struct CostModels {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plutus_v1: Option<Vec<i64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plutus_v2: Option<Vec<i64>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plutus_v3: Option<Vec<i64>>,
}

/// Protocol parameters structure that matches TypeScript ProtocolParameters interface
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolParameters {
    // Basic fee parameters
    pub min_fee_a: u64,
    pub min_fee_b: u64,
    
    // Size limits
    pub max_tx_size: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_block_size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_bh_size: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_val_size: Option<String>,
    
    // Economic parameters
    pub key_deposit: String,
    pub pool_deposit: String,
    pub min_pool_cost: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_utxo_value: Option<String>,
    pub utxo_cost_per_word: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub coins_per_utxo_size: Option<String>,
    
    // Execution limits
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tx_ex_mem: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tx_ex_steps: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_block_ex_mem: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_block_ex_steps: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_collateral_inputs: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collateral_percent: Option<u32>,
    
    // Plutus cost models and pricing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_models: Option<CostModels>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_mem: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub price_step: Option<f64>,
    
    // Protocol version
    pub protocol_version: ProtocolVersion,
    
    // Epoch and governance parameters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub epoch_no: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_epoch: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub optimal_pool_count: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub influence: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub monetary_expand_rate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub treasury_growth_rate: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decentralisation: Option<f64>,
    
    // Additional metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_entropy: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_hash: Option<String>,
    
    // Additional fields for flexibility
    #[serde(flatten)]
    pub additional_fields: HashMap<String, serde_json::Value>,
}

impl ProtocolParameters {
    /// Deserialize ProtocolParameters from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Serialize ProtocolParameters to JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Serialize ProtocolParameters to pretty JSON string
    pub fn to_json_pretty(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }
}

impl CostModels {
    /// Create new CostModels with all versions
    pub fn new(
        plutus_v1: Option<Vec<i64>>,
        plutus_v2: Option<Vec<i64>>,
        plutus_v3: Option<Vec<i64>>,
    ) -> Self {
        Self {
            plutus_v1,
            plutus_v2,
            plutus_v3,
        }
    }

    /// Check if any cost models are present
    pub fn has_any_models(&self) -> bool {
        self.plutus_v1.is_some() || self.plutus_v2.is_some() || self.plutus_v3.is_some()
    }

    /// Get total number of cost model parameters across all versions
    pub fn total_param_count(&self) -> usize {
        let v1_count = self.plutus_v1.as_ref().map_or(0, |v| v.len());
        let v2_count = self.plutus_v2.as_ref().map_or(0, |v| v.len());
        let v3_count = self.plutus_v3.as_ref().map_or(0, |v| v.len());
        v1_count + v2_count + v3_count
    }
}

impl ProtocolVersion {
    /// Create new protocol version
    pub fn new(major: u32, minor: u32) -> Self {
        Self { major, minor }
    }

    /// Format as string "major.minor"
    pub fn to_string(&self) -> String {
        format!("{}.{}", self.major, self.minor)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_parameters_serialization() {
        let params = ProtocolParameters {
            min_fee_a: 44,
            min_fee_b: 155381,
            max_tx_size: 16384,
            max_block_size: Some(65536),
            max_bh_size: Some(1100),
            max_val_size: Some("5000".to_string()),
            key_deposit: "2000000".to_string(),
            pool_deposit: "500000000".to_string(),
            min_pool_cost: "340000000".to_string(),
            min_utxo_value: Some("1000000".to_string()),
            utxo_cost_per_word: 4310,
            coins_per_utxo_size: Some("4310".to_string()),
            max_tx_ex_mem: Some("14000000".to_string()),
            max_tx_ex_steps: Some("10000000000".to_string()),
            max_block_ex_mem: Some("62000000".to_string()),
            max_block_ex_steps: Some("40000000000".to_string()),
            max_collateral_inputs: Some(3),
            collateral_percent: Some(150),
            cost_models: Some(CostModels::new(
                Some(vec![100, 200, 300]),
                Some(vec![400, 500, 600]),
                None,
            )),
            price_mem: Some(0.0577),
            price_step: Some(0.0000721),
            protocol_version: ProtocolVersion::new(8, 0),
            epoch_no: Some(365),
            max_epoch: Some(18),
            optimal_pool_count: Some(500),
            influence: Some(0.3),
            monetary_expand_rate: Some(0.003),
            treasury_growth_rate: Some(0.2),
            decentralisation: Some(0.0),
            extra_entropy: None,
            nonce: Some("nonce_value".to_string()),
            block_hash: Some("block_hash_value".to_string()),
            additional_fields: HashMap::new(),
        };

        let json = params.to_json().unwrap();
        let deserialized = ProtocolParameters::from_json(&json).unwrap();
        
        assert_eq!(params.min_fee_a, deserialized.min_fee_a);
        assert_eq!(params.min_fee_b, deserialized.min_fee_b);
        assert_eq!(params.protocol_version, deserialized.protocol_version);
    }

    #[test]
    fn test_cost_models() {
        let cost_models = CostModels::new(
            Some(vec![1, 2, 3, 4, 5]),
            Some(vec![10, 20, 30]),
            None,
        );

        assert!(cost_models.has_any_models());
        assert_eq!(cost_models.total_param_count(), 8);

        let json = serde_json::to_string(&cost_models).unwrap();
        let deserialized: CostModels = serde_json::from_str(&json).unwrap();
        
        assert_eq!(cost_models, deserialized);
    }

    #[test]
    fn test_protocol_version() {
        let version = ProtocolVersion::new(8, 1);
        assert_eq!(version.to_string(), "8.1");

        let json = serde_json::to_string(&version).unwrap();
        let deserialized: ProtocolVersion = serde_json::from_str(&json).unwrap();
        
        assert_eq!(version, deserialized);
    }

    #[test]
    fn test_minimal_protocol_parameters() {
        let minimal_params = ProtocolParameters {
            min_fee_a: 44,
            min_fee_b: 155381,
            max_tx_size: 16384,
            max_block_size: None,
            max_bh_size: None,
            max_val_size: None,
            key_deposit: "2000000".to_string(),
            pool_deposit: "500000000".to_string(),
            min_pool_cost: "340000000".to_string(),
            min_utxo_value: None,
            utxo_cost_per_word: 4310,
            coins_per_utxo_size: None,
            max_tx_ex_mem: None,
            max_tx_ex_steps: None,
            max_block_ex_mem: None,
            max_block_ex_steps: None,
            max_collateral_inputs: None,
            collateral_percent: None,
            cost_models: None,
            price_mem: None,
            price_step: None,
            protocol_version: ProtocolVersion::new(7, 0),
            epoch_no: None,
            max_epoch: None,
            optimal_pool_count: None,
            influence: None,
            monetary_expand_rate: None,
            treasury_growth_rate: None,
            decentralisation: None,
            extra_entropy: None,
            nonce: None,
            block_hash: None,
            additional_fields: HashMap::new(),
        };

        let json = minimal_params.to_json().unwrap();
        let deserialized = ProtocolParameters::from_json(&json).unwrap();
        
        assert_eq!(minimal_params.min_fee_a, deserialized.min_fee_a);
        assert_eq!(minimal_params.protocol_version, deserialized.protocol_version);
    }
} 