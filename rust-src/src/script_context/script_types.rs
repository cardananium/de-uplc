use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use crate::plutus_data::SerializablePlutusData;
use uplc::tx::script_context::ScriptContext;
use super::utils::ConversionError;

use super::basic_types::SerializableTransactionInput;
use super::certificates::SerializableStakeCredential;
use super::governance::{SerializableVoter, SerializableProposalProcedure};

use super::certificates::SerializableCertificate;

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "purpose_type")]
pub enum SerializableScriptPurpose {
    #[serde(rename = "Minting")]
    Minting { policy_id: String },
    #[serde(rename = "Spending")]
    Spending { utxo_ref: SerializableTransactionInput },
    #[serde(rename = "Rewarding")]
    Rewarding { stake_credential: SerializableStakeCredential },
    #[serde(rename = "Certifying")]
    Certifying {
        index: usize,
        certificate: SerializableCertificate,
    },
    #[serde(rename = "Voting")]
    Voting { voter: SerializableVoter },
    #[serde(rename = "Proposing")]
    Proposing {
        index: usize,
        proposal: SerializableProposalProcedure,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "script_info_type")]
pub enum SerializableScriptInfo {
    #[serde(rename = "Minting")]
    Minting { policy_id: String },
    #[serde(rename = "Spending")]
    Spending {
        utxo_ref: SerializableTransactionInput,
        datum: Option<SerializablePlutusData>,
    },
    #[serde(rename = "Rewarding")]
    Rewarding { stake_credential: SerializableStakeCredential },
    #[serde(rename = "Certifying")]
    Certifying {
        index: usize,
        certificate: SerializableCertificate,
    },
    #[serde(rename = "Voting")]
    Voting { voter: SerializableVoter },
    #[serde(rename = "Proposing")]
    Proposing {
        index: usize,
        proposal: SerializableProposalProcedure,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "script_context_version")]
pub enum SerializableScriptContext {
    #[serde(rename = "V1V2")]
    V1V2 {
        tx_info: Box<super::tx_info::SerializableTxInfo>,
        purpose: Box<SerializableScriptPurpose>,
    },
    #[serde(rename = "V3")]
    V3 {
        tx_info: Box<super::tx_info::SerializableTxInfo>,
        redeemer: SerializablePlutusData,
        purpose: Box<SerializableScriptInfo>,
    },
}

impl TryFrom<ScriptContext> for SerializableScriptContext {
    type Error = ConversionError;

    fn try_from(context: ScriptContext) -> Result<Self, Self::Error> {
        match context {
            ScriptContext::V1V2 { tx_info, purpose } => Ok(SerializableScriptContext::V1V2 {
                tx_info: Box::new((*tx_info).try_into()?),
                purpose: Box::new((*purpose).into()),
            }),
            ScriptContext::V3 { tx_info, redeemer, purpose } => Ok(SerializableScriptContext::V3 {
                tx_info: Box::new((*tx_info).try_into()?),
                redeemer: redeemer.into(),
                purpose: Box::new((*purpose).try_into()?),
            }),
        }
    }
} 

impl TryFrom<&ScriptContext> for SerializableScriptContext {
    type Error = ConversionError;

    fn try_from(context: &ScriptContext) -> Result<Self, Self::Error> {
        match context {
            ScriptContext::V1V2 { tx_info, purpose } => Ok(SerializableScriptContext::V1V2 {
                tx_info: Box::new((*tx_info.clone()).try_into()?),
                purpose: Box::new((*purpose.clone()).into()),
            }),
            ScriptContext::V3 { tx_info, redeemer, purpose } => Ok(SerializableScriptContext::V3 {
                tx_info: Box::new((*tx_info.clone()).try_into()?),
                redeemer: redeemer.clone().into(),
                purpose: Box::new((*purpose.clone()).try_into()?),
            }),
        }
    }
} 