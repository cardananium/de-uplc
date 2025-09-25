use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use pallas_primitives::{
    conway::{TransactionInput, TransactionOutput},
    alonzo::Value,
};
use pallas_addresses::Address;
use uplc::tx::ResolvedInput;

/// Error type for UTXO conversion
#[derive(Debug, Clone, thiserror::Error)]
pub enum UtxoConversionError {
    #[error("Invalid transaction hash: {0}")]
    InvalidTxHash(String),
    #[error("Invalid address: {0}")]
    InvalidAddress(String),
    #[error("Invalid lovelace amount: {0}")]
    InvalidLovelaceAmount(String),
    #[error("Invalid asset amount: {0}")]
    InvalidAssetAmount(String),
    #[error("Invalid policy ID: {0}")]
    InvalidPolicyId(String),
    #[error("Invalid asset name: {0}")]
    InvalidAssetName(String),
    #[error("Invalid datum hash: {0}")]
    InvalidDatumHash(String),
    #[error("Invalid inline datum: {0}")]
    InvalidInlineDatum(String),
    #[error("Invalid reference script: {0}")]
    InvalidReferenceScript(String),
    #[error("Multiasset conversion error: {0}")]
    MultiassetConversion(String),
}

/// Script type for reference scripts
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
pub enum ScriptType {
    PlutusV1,
    PlutusV2,
    PlutusV3,
    NativeScript,
}

/// Reference script information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceScript {
    pub r#type: ScriptType,
    pub script: String,
}

/// Value containing lovelace and optional native assets
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UtxoValue {
    pub lovelace: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assets: Option<HashMap<String, String>>,
}

/// UTXO output structure that matches TypeScript UtxoOutput interface
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UtxoOutput {
    pub tx_hash: String,
    pub output_index: u32,
    pub address: String,
    pub value: UtxoValue,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub datum_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inline_datum: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference_script: Option<ReferenceScript>,
}

impl UtxoOutput {
    /// Deserialize UtxoOutput from JSON string
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Serialize UtxoOutput to JSON string
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Serialize UtxoOutput to pretty JSON string
    pub fn to_json_pretty(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    /// Deserialize Vec<UtxoOutput> from JSON string
    pub fn vec_from_json(json: &str) -> Result<Vec<Self>, serde_json::Error> {
        serde_json::from_str(json)
    }

    /// Serialize Vec<UtxoOutput> to JSON string
    pub fn vec_to_json(utxos: &[Self]) -> Result<String, serde_json::Error> {
        serde_json::to_string(utxos)
    }
}

impl UtxoValue {
    /// Create new UtxoValue with only lovelace
    pub fn new_lovelace_only(lovelace: String) -> Self {
        Self {
            lovelace,
            assets: None,
        }
    }

    /// Create new UtxoValue with lovelace and assets
    pub fn new_with_assets(lovelace: String, assets: HashMap<String, String>) -> Self {
        let assets = if assets.is_empty() { None } else { Some(assets) };
        Self { lovelace, assets }
    }

    /// Get total number of different asset types (excluding ADA)
    pub fn asset_count(&self) -> usize {
        self.assets.as_ref().map_or(0, |assets| assets.len())
    }

    /// Check if this UTXO contains only ADA
    pub fn is_ada_only(&self) -> bool {
        self.assets.is_none() || self.assets.as_ref().unwrap().is_empty()
    }
}

impl TryFrom<UtxoOutput> for ResolvedInput {
    type Error = UtxoConversionError;

    fn try_from(utxo: UtxoOutput) -> Result<Self, Self::Error> {
        use pallas_codec::utils::CborWrap;
        use pallas_primitives::conway;
        use std::collections::HashMap;
        
        // Parse transaction hash
        let tx_hash_str = &utxo.tx_hash;
        let tx_hash = hex::decode(tx_hash_str)
            .map_err(|e| UtxoConversionError::InvalidTxHash(format!("{}: {}", tx_hash_str, e)))?;
        let tx_hash_len = tx_hash.len();
        let tx_hash_array: [u8; 32] = tx_hash.try_into()
            .map_err(|_| UtxoConversionError::InvalidTxHash(format!("Invalid length: expected 32 bytes, got {}", tx_hash_len)))?;

        // Create transaction input
        let input = TransactionInput {
            transaction_id: tx_hash_array.into(),
            index: utxo.output_index as u64,
        };

        // Parse address - using raw bytes directly
        let address_bytes = if utxo.address.starts_with("addr") || utxo.address.starts_with("stake") {
            Address::from_bech32(&utxo.address)
                .map(|addr| addr.to_vec())
                .map_err(|e| UtxoConversionError::InvalidAddress(format!("{}: {}", utxo.address, e)))?
        } else {
            hex::decode(&utxo.address)
                .map_err(|e| UtxoConversionError::InvalidAddress(format!("{}: {}", utxo.address, e)))?
        };

        // Convert value with multi-assets support
        let lovelace = utxo.value.lovelace.parse::<u64>()
            .map_err(|e| UtxoConversionError::InvalidLovelaceAmount(format!("{}: {}", utxo.value.lovelace, e)))?;
        
        let value = if let Some(assets) = &utxo.value.assets {
            // Create multiasset value using HashMap approach
            let mut multiasset_map = HashMap::new();
            
            for (asset_id, amount_str) in assets {
                let amount = amount_str.parse::<u64>()
                    .map_err(|e| UtxoConversionError::InvalidAssetAmount(format!("{}: {}", amount_str, e)))?;
                
                // Parse policy_id.asset_name format
                let dot_pos = asset_id.find('.')
                    .ok_or_else(|| UtxoConversionError::InvalidPolicyId(format!("Invalid asset ID format: {}", asset_id)))?;
                
                let policy_id_hex = &asset_id[..dot_pos];
                let asset_name_hex = if dot_pos < asset_id.len() {
                    &asset_id[dot_pos + 1..]
                } else {
                    ""
                };
                
                let policy_id_bytes = hex::decode(policy_id_hex)
                    .map_err(|e| UtxoConversionError::InvalidPolicyId(format!("{}: {}", policy_id_hex, e)))?;
                let asset_name_bytes = if !asset_name_hex.is_empty() {
                    hex::decode(asset_name_hex)
                } else {
                    Ok(vec![0u8])
                }
                    .map_err(|e| UtxoConversionError::InvalidAssetName(format!("{}: {}", asset_name_hex, e)))?;
                
                let policy_id_len = policy_id_bytes.len();
                let policy_id_array: [u8; 28] = policy_id_bytes.try_into()
                    .map_err(|_| UtxoConversionError::InvalidPolicyId(format!("Invalid policy ID length: expected 28 bytes, got {}", policy_id_len)))?;
                let policy_id: [u8; 28] = policy_id_array;
                let asset_name = asset_name_bytes.into();
                
                // Get or create token map for this policy
                let token_map = multiasset_map.entry(policy_id.into())
                    .or_insert_with(HashMap::new);
                
                // Convert amount to PositiveCoin
                let positive_amount = pallas_codec::utils::PositiveCoin::try_from(amount)
                    .map_err(|e| UtxoConversionError::InvalidAssetAmount(format!("Cannot convert {} to PositiveCoin: {}", amount, e)))?;
                token_map.insert(asset_name, positive_amount);
            }
            
            if multiasset_map.is_empty() {
                conway::Value::Coin(lovelace)
            } else {
                // Convert HashMap to NonEmptyKeyValuePairs
                let multiasset_vec: Vec<_> = multiasset_map.into_iter()
                    .map(|(policy_id, token_map)| {
                        let tokens_vec: Vec<_> = token_map.into_iter().collect();
                        // Create NonEmptyKeyValuePairs from Vec
                        let tokens = pallas_codec::utils::NonEmptyKeyValuePairs::try_from(tokens_vec)
                            .map_err(|e| UtxoConversionError::MultiassetConversion(format!("Failed to create token pairs: {}", e)))?;
                        Ok((policy_id, tokens))
                    })
                    .collect::<Result<Vec<_>, UtxoConversionError>>()?;
                
                let multiasset = pallas_codec::utils::NonEmptyKeyValuePairs::try_from(multiasset_vec)
                    .map_err(|e| UtxoConversionError::MultiassetConversion(format!("Failed to create multiasset: {}", e)))?;
                
                conway::Value::Multiasset(lovelace, multiasset)
            }
        } else {
            conway::Value::Coin(lovelace)
        };

        // Determine if we need PostAlonzo output
        let has_inline_datum = utxo.inline_datum.is_some();
        let has_script_ref = utxo.reference_script.is_some();

        let output = if has_inline_datum || has_script_ref {
            // Create PostAlonzo output (Babbage era)
            let datum_option = if let Some(inline_datum_hex) = &utxo.inline_datum {
                // Parse inline datum from hex
                let datum_bytes = hex::decode(inline_datum_hex)
                    .map_err(|e| UtxoConversionError::InvalidInlineDatum(format!("{}: {}", inline_datum_hex, e)))?;
                    
                // Try to decode CBOR PlutusData
                let plutus_data = match pallas_codec::minicbor::decode::<conway::PlutusData>(&datum_bytes) {
                    Ok(plutus_data) => plutus_data,
                    Err(_) => {
                        // Fallback: create BoundedBytes PlutusData
                        conway::PlutusData::BoundedBytes(datum_bytes.into())
                    }
                };
                Some(conway::DatumOption::Data(CborWrap(plutus_data)))
            } else if let Some(datum_hash_hex) = &utxo.datum_hash {
                // Parse datum hash
                let hash_bytes = hex::decode(datum_hash_hex)
                    .map_err(|e| UtxoConversionError::InvalidDatumHash(format!("{}: {}", datum_hash_hex, e)))?;
                let hash_len = hash_bytes.len();
                let hash_array: [u8; 32] = hash_bytes.try_into()
                    .map_err(|_| UtxoConversionError::InvalidDatumHash(format!("Invalid hash length: expected 32 bytes, got {}", hash_len)))?;
                Some(conway::DatumOption::Hash(hash_array.into()))
            } else {
                None
            };

            let script_ref = if let Some(ref_script) = &utxo.reference_script {
                // Parse reference script
                let script_bytes = hex::decode(&ref_script.script)
                    .map_err(|e| UtxoConversionError::InvalidReferenceScript(format!("{}: {}", ref_script.script, e)))?;
                    
                let pseudo_script = match ref_script.r#type {
                    ScriptType::PlutusV1 => {
                        // Create PlutusScript using Bytes wrapper
                        let script = conway::PlutusScript::<1>(script_bytes.into());
                        conway::PseudoScript::PlutusV1Script(script)
                    }
                    ScriptType::PlutusV2 => {
                        let script = conway::PlutusScript::<2>(script_bytes.into());
                        conway::PseudoScript::PlutusV2Script(script)
                    }
                    ScriptType::PlutusV3 => {
                        let script = conway::PlutusScript::<3>(script_bytes.into());
                        conway::PseudoScript::PlutusV3Script(script)
                    }
                    ScriptType::NativeScript => {
                        // Try to decode native script from CBOR
                        match pallas_codec::minicbor::decode::<conway::NativeScript>(&script_bytes) {
                            Ok(native_script) => conway::PseudoScript::NativeScript(native_script),
                            Err(e) => {
                                return Err(UtxoConversionError::InvalidReferenceScript(
                                    format!("Failed to decode native script: {}", e)
                                ));
                            }
                        }
                    }
                };
                Some(CborWrap(pseudo_script))
            } else {
                None
            };

            TransactionOutput::PostAlonzo(conway::PostAlonzoTransactionOutput {
                address: address_bytes.into(),
                value,
                datum_option,
                script_ref,
            })
        } else {
            // Legacy output with datum hash only
            let datum_hash = if let Some(h) = utxo.datum_hash {
                let hash_bytes = hex::decode(&h)
                    .map_err(|e| UtxoConversionError::InvalidDatumHash(format!("{}: {}", h, e)))?;
                let hash_len = hash_bytes.len();
                let hash_array: [u8; 32] = hash_bytes.try_into()
                    .map_err(|_| UtxoConversionError::InvalidDatumHash(format!("Invalid hash length: expected 32 bytes, got {}", hash_len)))?;
                Some(hash_array.into())
            } else {
                None
            };

            // Convert conway::Value to uplc::Value for Legacy output
            let uplc_value = convert_conway_to_uplc_value(value);

            TransactionOutput::Legacy(pallas_primitives::alonzo::TransactionOutput {
                address: address_bytes.into(),
                amount: uplc_value,
                datum_hash,
            })
        };

        Ok(ResolvedInput { input, output })
    }
}

// Helper function to convert conway::Value to uplc::Value
fn convert_conway_to_uplc_value(value: pallas_primitives::conway::Value) -> Value {
    match value {
        pallas_primitives::conway::Value::Coin(lovelace) => Value::Coin(lovelace),
        pallas_primitives::conway::Value::Multiasset(lovelace, multiasset) => {
            // Convert conway multiasset to uplc multiasset
            let mut uplc_multiasset = Vec::new();
            
            for (policy_id, tokens) in multiasset.iter() {
                let mut token_map = Vec::new();
                for (asset_name, amount) in tokens.iter() {
                    // Convert PositiveCoin to u64
                    let amount_u64: u64 = (*amount).into();
                    token_map.push((asset_name.clone(), amount_u64));
                }
                // Create KeyValuePairs from Vec
                let tokens_kvp: pallas_codec::utils::KeyValuePairs<_, _> = token_map.into();
                uplc_multiasset.push((*policy_id, tokens_kvp));
            }
            
            // Convert to KeyValuePairs
            let uplc_multiasset_pairs: pallas_codec::utils::KeyValuePairs<_, _> = uplc_multiasset.into();
            Value::Multiasset(lovelace, uplc_multiasset_pairs)
        }
    }
}