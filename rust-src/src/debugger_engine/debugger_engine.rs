use crate::wasm_tools::{wasm_bindgen, JsError};
use pallas_primitives::{
    conway::{Language, MintedTx, Redeemer},
    Fragment,
};
use std::collections::HashMap;
use uplc::{
    ast::{FakeNamedDeBruijn, NamedDeBruijn, Program},
    machine::cost_model::{initialize_cost_model, CostModel, ExBudget},
    tx::{
        iter_redeemers, redeemer_tag_to_string,
        script_context::{
            find_script, PlutusScript, ScriptContext, TxInfo, TxInfoV1, TxInfoV2, TxInfoV3,
        },
        to_plutus_data::ToPlutusData,
        DataLookupTable, ResolvedInput, SlotConfig,
    },
    PlutusData,
};
use uuid::Uuid;

use super::SessionController;
use crate::debugger_engine::DebuggerError;
use crate::protocol_params::ProtocolParameters;
use crate::utxo::UtxoOutput;

const SLOT_CONFIG_MAINNET: SlotConfig = SlotConfig {
    zero_time: 1596059091000, // Shelley era start
    zero_slot: 4492800,       // Shelley era start slot
    slot_length: 1000,        // 1 second per slot
};

const SLOT_CONFIG_PREPROD: SlotConfig = SlotConfig {
    zero_time: 1654041600000 + 1728000000, // Shelley era start
    zero_slot: 0,                          // Shelley era start slot
    slot_length: 1000,                     // 1 second per slot
};

const SLOT_CONFIG_PREVIEW: SlotConfig = SlotConfig {
    zero_time: 1666656000000, // Shelley era start
    zero_slot: 0,             // Shelley era start slot
    slot_length: 1000,        // 1 second per slot
};

// Conversion from DebuggerError to JsError
impl From<DebuggerError> for JsError {
    fn from(error: DebuggerError) -> Self {
        JsError::from_str(&error.to_string())
    }
}

// Conversion from UtxoConversionError to JsError
impl From<crate::utxo::UtxoConversionError> for JsError {
    fn from(error: crate::utxo::UtxoConversionError) -> Self {
        JsError::from_str(&error.to_string())
    }
}

#[wasm_bindgen]
#[derive(Debug)]
pub struct DebuggerEngine {
    v1_context: Option<TxInfo>,
    v2_context: Option<TxInfo>,
    v3_context: Option<TxInfo>,
    transaction_id: String,
    protocol_params: ProtocolParameters,
    sessions_id: Option<String>,

    redeemers: HashMap<String, Redeemer>,
    redeemer_scripts: HashMap<String, (PlutusScript, Option<PlutusData>)>,
}

#[wasm_bindgen]
impl DebuggerEngine {
    pub(crate) fn new_internal(
        tx_hex: &str,
        utxos: Vec<UtxoOutput>,
        protocol_params: ProtocolParameters,
        network: &str,
    ) -> Result<Self, JsError> {
        let network = network.to_lowercase().trim().to_string();
        let slot_config = if network == "mainnet" {
            SLOT_CONFIG_MAINNET
        } else if network == "preprod" {
            SLOT_CONFIG_PREPROD
        } else if network == "preview" {
            SLOT_CONFIG_PREVIEW
        } else {
            return Err(JsError::from_str("Invalid network"));
        };

        // Parse transaction from hex
        let tx_bytes =
            hex::decode(tx_hex).map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?;

        let tx = MintedTx::decode_fragment(&tx_bytes)
            .map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?;

        // Calculate transaction ID using hash_transaction
        let tx_body_bytes = tx
            .transaction_body
            .encode_fragment()
            .map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?;
        let tx_hash = pallas_crypto::hash::Hasher::<256>::hash(&tx_body_bytes);
        let tx_id = hex::encode(tx_hash);

        // Convert UtxoOutput to ResolvedInput
        let resolved_inputs: Vec<ResolvedInput> = utxos
            .into_iter()
            .map(|utxo| utxo.try_into())
            .collect::<Result<Vec<_>, _>>()?;

        // Create data lookup table
        let lookup_table = DataLookupTable::from_transaction(&tx, &resolved_inputs);

        let redeemers = tx.transaction_witness_set.redeemer.as_ref().ok_or(
            DebuggerError::TransactionParseError("No redeemers in transaction".to_string()),
        )?;
        let mut redeemers_map = HashMap::new();
        let mut redeemer_scripts = HashMap::new();

        for (key, data, ex_units) in iter_redeemers(redeemers) {
            let redeemer_key = format!("{}:{}", redeemer_tag_to_string(&key.tag), key.index);
            redeemers_map.insert(
                redeemer_key.clone(),
                Redeemer {
                    tag: key.tag,
                    index: key.index,
                    data: data.clone(),
                    ex_units,
                },
            );

            let (script, datum) = find_script(
                &redeemers_map[&redeemer_key],
                &tx,
                &resolved_inputs,
                &lookup_table,
            )
            .map_err(|e| {
                println!("Error {:?}", e);
                e
            })
            .map_err(|_| DebuggerError::ScriptNotFound(redeemer_key.to_string()))?;
            redeemer_scripts.insert(redeemer_key, (script, datum));
        }

        let has_v1_script_redeemer = redeemer_scripts.values().any(|(script, _)| {
            matches!(script, PlutusScript::V1(_))
        });

        let has_v2_script_redeemer = redeemer_scripts.values().any(|(script, _)| {
            matches!(script, PlutusScript::V2(_))
        });

        let has_v3_script_redeemer = redeemer_scripts.values().any(|(script, _)| {
            matches!(script, PlutusScript::V3(_))
        });

        let v1_context = if has_v1_script_redeemer {
            Some(TxInfoV1::from_transaction(&tx, &resolved_inputs, &slot_config)
                .map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?)
        } else {
            None
        };

        let v2_context = if has_v2_script_redeemer {
            Some(TxInfoV2::from_transaction(&tx, &resolved_inputs, &slot_config)
                .map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?)
        } else {
            None
        };

        let v3_context = if has_v3_script_redeemer {
            Some(TxInfoV3::from_transaction(&tx, &resolved_inputs, &slot_config)
                .map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?)
        } else {
            None
        };

        Ok(DebuggerEngine {
            v1_context,
            v2_context,
            v3_context,
            transaction_id: tx_id,
            protocol_params,
            sessions_id: None,
            redeemers: redeemers_map,
            redeemer_scripts,
        })
    }

    pub fn new(
        tx_hex: &str,
        utxos_json: &str,
        protocol_params_json: &str,
        network: &str,
    ) -> Result<Self, JsError> {
        let utxos = serde_json::from_str::<Vec<UtxoOutput>>(utxos_json)
            .map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?;

        let protocol_params = serde_json::from_str::<ProtocolParameters>(protocol_params_json)
            .map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?;

        Self::new_internal(tx_hex, utxos, protocol_params, network)
    }

    /// Gets list of available redeemers in the transaction
    pub fn get_redeemers(&self) -> Result<Vec<String>, JsError> {
        Ok(self.redeemers.keys().cloned().collect())
    }

    /// Gets the transaction ID
    pub fn get_transaction_id(&self) -> Result<String, JsError> {
        Ok(self.transaction_id.clone())
    }

    /// Initializes a new debug session for a specific redeemer
    pub fn init_debug_session(&mut self, redeemer_str: &str) -> Result<SessionController, JsError> {
        // Parse redeemer string to find the specific redeemer
        let parts: Vec<&str> = redeemer_str.split(":").collect();
        if parts.len() != 2 {
            return Err(JsError::from_str(&format!(
                "Redeemer not found: {}",
                redeemer_str
            )));
        }

        let redeemer = self
            .redeemers
            .get(redeemer_str)
            .ok_or(DebuggerError::RedeemerNotFound(redeemer_str.to_string()))?;

        let (script, datum) = self
            .redeemer_scripts
            .get(redeemer_str)
            .ok_or(DebuggerError::ScriptNotFound(redeemer_str.to_string()))?;

        let script_hash = compute_script_hash(script);

        let session_id = Uuid::new_v4().to_string();
        let language = match script {
            PlutusScript::V1(_) => Language::PlutusV1,
            PlutusScript::V2(_) => Language::PlutusV2,
            PlutusScript::V3(_) => Language::PlutusV3,
        };
        let cost_model = self.get_const_model(&language)?;
        let (program, script_context) = self.build_program(redeemer, script, datum.as_ref())?;
        let upper_bound_budget = ExBudget::max();
        let real_budget = ExBudget {
            mem: redeemer.ex_units.mem as i64,
            cpu: redeemer.ex_units.steps as i64,
        };

        self.sessions_id = Some(session_id.clone());

        SessionController::new(
            script_hash,
            session_id,
            language,
            program,
            script_context,
            cost_model,
            upper_bound_budget,
            real_budget,
            redeemer_str.to_string(),
        )
    }

    fn build_program(
        &self,
        redeemer: &Redeemer,
        script: &PlutusScript,
        datum: Option<&PlutusData>,
    ) -> Result<(Box<Program<NamedDeBruijn>>, ScriptContext), JsError> {
        let mut buffer = Vec::new();
        let initial_program = Program::<FakeNamedDeBruijn>::from_cbor(&script, &mut buffer)
            .map(Into::<Program<NamedDeBruijn>>::into)
            .map_err(|e| DebuggerError::ProgramBuildError(e.to_string()))?;

        let script_context = match script {
            PlutusScript::V1(_) => self
                .v1_context
                .as_ref()
                .map(|ctx| ctx.clone().into_script_context(redeemer, datum))
                .ok_or(DebuggerError::ScriptContextBuildError(format!(
                    "Failed to get script context for script: {:?}",
                    script
                ))),
            PlutusScript::V2(_) => self
                .v2_context
                .as_ref()
                .map(|ctx| ctx.clone().into_script_context(redeemer, datum))
                .ok_or(DebuggerError::ScriptContextBuildError(format!(
                    "Failed to get script context for script: {:?}",
                    script
                ))),
            PlutusScript::V3(_) => self
                .v3_context
                .as_ref()
                .map(|ctx| ctx.clone().into_script_context(redeemer, datum))
                .ok_or(DebuggerError::ScriptContextBuildError(format!(
                    "Failed to get script context for script: {:?}",
                    script
                ))),
        }?
        .ok_or(DebuggerError::ScriptContextBuildError(format!(
            "Failed to build script context for script: {:?}",
            script
        )))?;

        let program = match script_context {
            ScriptContext::V1V2 { .. } => if let Some(datum) = datum {
                initial_program.apply_data(datum.clone())
            } else {
                initial_program
            }
            .apply_data(redeemer.data.clone())
            .apply_data(script_context.to_plutus_data()),

            ScriptContext::V3 { .. } => initial_program.apply_data(script_context.to_plutus_data()),
        };

        Ok((Box::new(program), script_context))
    }

    fn get_const_model(&self, language: &Language) -> Result<CostModel, JsError> {
        let cost_models = self
            .protocol_params
            .cost_models
            .as_ref()
            .map(|cost_models| match language {
                Language::PlutusV1 => &cost_models.plutus_v1,
                Language::PlutusV2 => &cost_models.plutus_v2,
                Language::PlutusV3 => &cost_models.plutus_v3,
            })
            .into_iter()
            .flatten()
            .next()
            .ok_or(DebuggerError::TransactionParseError(format!(
                "No cost models in protocol parameters for language {:?}",
                language,
            )))?;

        let cost_models = initialize_cost_model(&language, cost_models);
        Ok(cost_models)
    }
}

fn compute_script_hash(script: &PlutusScript) -> String {
    use pallas_crypto::hash::Hasher;
    let script_hash = match script {
        PlutusScript::V1(script) => Hasher::<224>::hash_tagged(&script.0, 1),
        PlutusScript::V2(script) => Hasher::<224>::hash_tagged(&script.0, 2),
        PlutusScript::V3(script) => Hasher::<224>::hash_tagged(&script.0, 3),
    };
    hex::encode(script_hash)
}
