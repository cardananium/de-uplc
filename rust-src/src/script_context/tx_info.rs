use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use crate::script_context::{
    basic_types::*, certificates::*, governance::*, script_types::*
};
use crate::plutus_data::SerializablePlutusData;
use super::utils::{hash_to_hex, address_to_bech32, ConversionError};
use pallas_primitives::conway;
use pallas_codec::utils::KeyValuePairs;
use uplc::tx::script_context::{TxInfo, TxInfoV1, TxInfoV2, TxInfoV3, TxInInfo};

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableTxInfoV1 {
    pub inputs: Vec<SerializableTxInInfo>,
    pub outputs: Vec<SerializableTransactionOutput>,
    pub fee: SerializableCardanoValue,
    pub mint: SerializableMintValue,
    pub certificates: Vec<SerializableCertificate>,
    pub withdrawals: Vec<(String, u64)>, // Address -> Coin
    pub valid_range: SerializableTimeRange,
    pub signatories: Vec<String>, // AddrKeyhash
    pub data: Vec<(String, SerializablePlutusData)>, // DatumHash -> PlutusData
    pub redeemers: Vec<(SerializableScriptPurpose, SerializableRedeemer)>,
    pub id: String, // Transaction hash
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableTxInfoV2 {
    pub inputs: Vec<SerializableTxInInfo>,
    pub reference_inputs: Vec<SerializableTxInInfo>,
    pub outputs: Vec<SerializableTransactionOutput>,
    pub fee: SerializableCardanoValue,
    pub mint: SerializableMintValue,
    pub certificates: Vec<SerializableCertificate>,
    pub withdrawals: Vec<(String, u64)>, // Address -> Coin
    pub valid_range: SerializableTimeRange,
    pub signatories: Vec<String>, // AddrKeyhash
    pub data: Vec<(String, SerializablePlutusData)>, // DatumHash -> PlutusData
    pub redeemers: Vec<(SerializableScriptPurpose, SerializableRedeemer)>,
    pub id: String, // Transaction hash
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableTxInfoV3 {
    pub inputs: Vec<SerializableTxInInfo>,
    pub reference_inputs: Vec<SerializableTxInInfo>,
    pub outputs: Vec<SerializableTransactionOutput>,
    pub fee: u64, // Just Coin in V3
    pub mint: SerializableMintValue,
    pub certificates: Vec<SerializableCertificate>,
    pub withdrawals: Vec<(String, u64)>, // Address -> Coin
    pub valid_range: SerializableTimeRange,
    pub signatories: Vec<String>, // AddrKeyhash
    pub data: Vec<(String, SerializablePlutusData)>, // DatumHash -> PlutusData
    pub redeemers: Vec<(SerializableScriptPurpose, SerializableRedeemer)>,
    pub id: String, // Transaction hash
    pub votes: Vec<(SerializableVoter, Vec<(SerializableGovActionId, SerializableVotingProcedure)>)>,
    pub proposal_procedures: Vec<SerializableProposalProcedure>,
    pub current_treasury_amount: Option<u64>,
    pub treasury_donation: Option<u64>,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub enum SerializableTxInfo {
    V1(SerializableTxInfoV1),
    V2(SerializableTxInfoV2),
    V3(SerializableTxInfoV3),
}

// Helper function to convert TxInInfo
fn convert_tx_in_info(tx_in_info: &TxInInfo) -> Result<SerializableTxInInfo, ConversionError> {
    Ok(SerializableTxInInfo {
        out_ref: tx_in_info.out_ref.clone().into(),
        resolved: tx_in_info.resolved.clone().into(),
    })
}

// Helper function to convert KeyValuePairs to Vec<(String, u64)> for withdrawals
fn convert_withdrawals(withdrawals: &Vec<(pallas_addresses::Address, conway::Coin)>) -> Result<Vec<(String, u64)>, ConversionError> {
    withdrawals.iter()
        .map(|(addr, coin)| {
            let addr_str = address_to_bech32(addr)?;
            Ok((addr_str, *coin))
        })
        .collect()
}

// Helper function to convert data
fn convert_data(data: &Vec<(conway::DatumHash, conway::PlutusData)>) -> Vec<(String, SerializablePlutusData)> {
    data.iter()
        .map(|(hash, data)| (hash_to_hex(hash), data.clone().into()))
        .collect()
}

// Helper function to convert redeemers
fn convert_redeemers(redeemers: &KeyValuePairs<uplc::tx::script_context::ScriptPurpose, conway::Redeemer>) 
    -> Vec<(SerializableScriptPurpose, SerializableRedeemer)> {
    redeemers.iter()
        .map(|(purpose, redeemer)| (purpose.clone().into(), redeemer.clone().into()))
        .collect()
}

// Convert uplc TxInfoV1 to SerializableTxInfoV1
impl TryFrom<TxInfoV1> for SerializableTxInfoV1 {
    type Error = ConversionError;

    fn try_from(tx_info: TxInfoV1) -> Result<Self, Self::Error> {
        let inputs: Result<Vec<_>, _> = tx_info.inputs.iter()
            .map(convert_tx_in_info)
            .collect();

        let outputs = tx_info.outputs.iter()
            .map(|output| output.clone().into())
            .collect();

        let withdrawals = convert_withdrawals(&tx_info.withdrawals)?;
        let data = convert_data(&tx_info.data);
        let redeemers = convert_redeemers(&tx_info.redeemers);

        Ok(SerializableTxInfoV1 {
            inputs: inputs?,
            outputs,
            fee: tx_info.fee.into(),
            mint: tx_info.mint.into(),
            certificates: tx_info.certificates.iter().map(|c| c.clone().into()).collect(),
            withdrawals,
            valid_range: tx_info.valid_range.into(),
            signatories: tx_info.signatories.iter().map(hash_to_hex).collect(),
            data,
            redeemers,
            id: hash_to_hex(&tx_info.id),
        })
    }
}

// Convert uplc TxInfoV2 to SerializableTxInfoV2
impl TryFrom<TxInfoV2> for SerializableTxInfoV2 {
    type Error = ConversionError;

    fn try_from(tx_info: TxInfoV2) -> Result<Self, Self::Error> {
        let inputs: Result<Vec<_>, _> = tx_info.inputs.iter()
            .map(convert_tx_in_info)
            .collect();

        let reference_inputs: Result<Vec<_>, _> = tx_info.reference_inputs.iter()
            .map(convert_tx_in_info)
            .collect();

        let outputs = tx_info.outputs.iter()
            .map(|output| output.clone().into())
            .collect();

        let withdrawals = convert_withdrawals(&tx_info.withdrawals.iter().cloned().collect())?;
        let data = convert_data(&tx_info.data.iter().cloned().collect());
        let redeemers = convert_redeemers(&tx_info.redeemers);

        Ok(SerializableTxInfoV2 {
            inputs: inputs?,
            reference_inputs: reference_inputs?,
            outputs,
            fee: tx_info.fee.into(),
            mint: tx_info.mint.into(),
            certificates: tx_info.certificates.iter().map(|c| c.clone().into()).collect(),
            withdrawals,
            valid_range: tx_info.valid_range.into(),
            signatories: tx_info.signatories.iter().map(hash_to_hex).collect(),
            data,
            redeemers,
            id: hash_to_hex(&tx_info.id),
        })
    }
}

// Convert uplc TxInfoV3 to SerializableTxInfoV3
impl TryFrom<TxInfoV3> for SerializableTxInfoV3 {
    type Error = ConversionError;

    fn try_from(tx_info: TxInfoV3) -> Result<Self, Self::Error> {
        let inputs: Result<Vec<_>, _> = tx_info.inputs.iter()
            .map(convert_tx_in_info)
            .collect();

        let reference_inputs: Result<Vec<_>, _> = tx_info.reference_inputs.iter()
            .map(convert_tx_in_info)
            .collect();

        let outputs = tx_info.outputs.iter()
            .map(|output| output.clone().into())
            .collect();

        let withdrawals = convert_withdrawals(&tx_info.withdrawals.iter().cloned().collect())?;
        let data = convert_data(&tx_info.data.iter().cloned().collect());
        let redeemers = convert_redeemers(&tx_info.redeemers);

        // Convert votes
        let votes: Vec<_> = tx_info.votes.iter()
            .map(|(voter, vote_map)| {
                let vote_procedures: Vec<_> = vote_map.iter()
                    .map(|(action_id, procedure)| (action_id.clone().into(), procedure.clone().into()))
                    .collect();
                (voter.clone().into(), vote_procedures)
            })
            .collect();

        Ok(SerializableTxInfoV3 {
            inputs: inputs?,
            reference_inputs: reference_inputs?,
            outputs,
            fee: tx_info.fee,
            mint: tx_info.mint.into(),
            certificates: tx_info.certificates.iter().map(|c| c.clone().into()).collect(),
            withdrawals,
            valid_range: tx_info.valid_range.into(),
            signatories: tx_info.signatories.iter().map(hash_to_hex).collect(),
            data,
            redeemers,
            id: hash_to_hex(&tx_info.id),
            votes,
            proposal_procedures: tx_info.proposal_procedures.iter().map(|p| p.clone().into()).collect(),
            current_treasury_amount: tx_info.current_treasury_amount,
            treasury_donation: tx_info.treasury_donation.map(|v| v.into()),
        })
    }
}

// Convert uplc TxInfo enum to SerializableTxInfo
impl TryFrom<TxInfo> for SerializableTxInfo {
    type Error = ConversionError;

    fn try_from(tx_info: TxInfo) -> Result<Self, Self::Error> {
        match tx_info {
            TxInfo::V1(v1) => Ok(SerializableTxInfo::V1(v1.try_into()?)),
            TxInfo::V2(v2) => Ok(SerializableTxInfo::V2(v2.try_into()?)),
            TxInfo::V3(v3) => Ok(SerializableTxInfo::V3(v3.try_into()?)),
        }
    }
} 