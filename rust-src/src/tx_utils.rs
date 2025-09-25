use crate::{debugger_engine::DebuggerError, JsError};
use pallas_codec::minicbor;
use pallas_primitives::{conway::{MintedTx, PseudoScript, PseudoTransactionOutput}, KeepRaw};
use hex;
use serde::{Deserialize, Serialize};
use uplc::Fragment;
use crate::wasm_tools::wasm_bindgen;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UtxoReference {
    pub tx_hash: String,
    pub output_index: u32,
}

#[wasm_bindgen]
pub fn get_ref_script_bytes(tx_hex: &str, output_index: u32) -> Result<String, JsError> {
    let tx_bytes =
    hex::decode(tx_hex).map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?;

    let tx = MintedTx::decode_fragment(&tx_bytes)
        .map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?;

    let outputs = &tx.transaction_body.outputs;
    if output_index >= outputs.len() as u32 {
        return Ok("".to_string());
    }
    let output = outputs.get(output_index as usize).unwrap();
    let ref_script = match output {
        PseudoTransactionOutput::Legacy(_) => None,
        PseudoTransactionOutput::PostAlonzo(output) => output.script_ref.as_ref().map(|x| &x.0),
    };
    match &ref_script {
        Some(ref_script) => get_pseudo_script_bytes(ref_script),
        None => Ok("".to_string()),
    }
}

fn get_pseudo_script_bytes<T: minicbor::Encode<()>>(script: &PseudoScript<T>) -> Result<String, JsError> {
    match script {
        PseudoScript::NativeScript(script) => {
            let script_bytes = minicbor::to_vec(script).unwrap();
            Ok(hex::encode(script_bytes))
        }
        PseudoScript::PlutusV1Script(script) => {
            let script_bytes = minicbor::to_vec(script).unwrap();
            Ok(hex::encode(script_bytes))
        }
        PseudoScript::PlutusV2Script(script) => {
            let script_bytes = minicbor::to_vec(script).unwrap();
            Ok(hex::encode(script_bytes))
        }
        PseudoScript::PlutusV3Script(script) => {
            let script_bytes = minicbor::to_vec(script).unwrap();
            Ok(hex::encode(script_bytes))
        }
    }
}

#[wasm_bindgen]
pub fn get_required_utxos(tx_hex: &str) -> Result<String, JsError> {
    let tx_bytes =
    hex::decode(tx_hex).map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?;

    let tx = MintedTx::decode_fragment(&tx_bytes)
        .map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?;


    let mut utxo_refs = Vec::new();

    for input in tx.transaction_body.inputs.iter() {
        utxo_refs.push(UtxoReference {
            tx_hash: hex::encode(input.transaction_id),
            output_index: input.index as u32,
        });
    }

    if let Some(reference_inputs) = &tx.transaction_body.reference_inputs {
        for input in reference_inputs.iter() {
            utxo_refs.push(UtxoReference {
                tx_hash: hex::encode(input.transaction_id),
                output_index: input.index as u32,
            });
        }
    }

    if let Some(collateral_inputs) = &tx.transaction_body.collateral {
        for input in collateral_inputs.iter() {
            utxo_refs.push(UtxoReference {
                tx_hash: hex::encode(input.transaction_id),
                output_index: input.index as u32,
            });
        }
    }

    Ok(serde_json::to_string(&utxo_refs).map_err(|e| DebuggerError::TransactionParseError(e.to_string()))?)
}