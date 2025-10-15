use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use crate::plutus_data::SerializablePlutusData;
use super::utils::{hash_to_hex, bytes_to_hex, address_to_bech32, address_from_bytes};
use super::script_types::SerializableScriptPurpose;
use pallas_primitives::{conway, alonzo, babbage};
use uplc::tx::{to_plutus_data::MintValue, script_context::{ScriptPurpose, TimeRange}};

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableTxInInfo {
    pub out_ref: SerializableTransactionInput,
    pub resolved: SerializableTransactionOutput,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableTransactionInput {
    pub transaction_id: String,
    pub index: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "output_format")]
pub enum SerializableTransactionOutput {
    #[serde(rename = "Legacy")]
    Legacy {
        address: String,
        value: SerializableCardanoValue,
    },
    #[serde(rename = "PostAlonzo")]
    PostAlonzo {
        address: String,
        value: SerializableCardanoValue,
        datum_option: Option<SerializableDatumOption>,
        script_ref: Option<SerializableScriptRef>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "datum_type")]
pub enum SerializableDatumOption {
    #[serde(rename = "Hash")]
    Hash { hash: String },
    #[serde(rename = "Data")]
    Data { data: SerializablePlutusData },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "script_type")]
pub enum SerializableScriptRef {
    #[serde(rename = "NativeScript")]
    NativeScript { script: String },
    #[serde(rename = "PlutusV1Script")]
    PlutusV1Script { script: String },
    #[serde(rename = "PlutusV2Script")]
    PlutusV2Script { script: String },
    #[serde(rename = "PlutusV3Script")]
    PlutusV3Script { script: String },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "value_type")]
pub enum SerializableCardanoValue {
    #[serde(rename = "Coin")]
    Coin { amount: u64 },
    #[serde(rename = "Multiasset")]
    Multiasset {
        coin: u64,
        assets: Vec<SerializableAsset>,
    },
}

impl SerializableCardanoValue {
    /// Create a simple coin value
    pub fn coin(amount: u64) -> Self {
        SerializableCardanoValue::Coin { amount }
    }

    /// Create a multiasset value
    pub fn multiasset(coin: u64, assets: Vec<SerializableAsset>) -> Self {
        SerializableCardanoValue::Multiasset { coin, assets }
    }

    /// Get the ADA amount (coin)
    pub fn coin_amount(&self) -> u64 {
        match self {
            SerializableCardanoValue::Coin { amount } => *amount,
            SerializableCardanoValue::Multiasset { coin, .. } => *coin,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableAsset {
    pub policy_id: String,
    pub tokens: Vec<SerializableToken>,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableToken {
    pub asset_name: String,
    pub quantity: i64, // Can be negative for minting/burning
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableMintValue {
    pub mint_value: Vec<SerializableAsset>,
}

impl SerializableMintValue {
    /// Create empty mint value
    pub fn empty() -> Self {
        SerializableMintValue {
            mint_value: vec![],
        }
    }

    /// Check if mint value is empty
    pub fn is_empty(&self) -> bool {
        self.mint_value.is_empty()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableTimeRange {
    pub lower_bound: Option<u64>,
    pub upper_bound: Option<u64>,
}

impl SerializableTimeRange {
    /// Create an always valid time range
    pub fn always() -> Self {
        SerializableTimeRange {
            lower_bound: None,
            upper_bound: None,
        }
    }

    /// Create a time range that's valid from a specific time
    pub fn from(lower: u64) -> Self {
        SerializableTimeRange {
            lower_bound: Some(lower),
            upper_bound: None,
        }
    }

    /// Create a time range that's valid until a specific time
    pub fn to(upper: u64) -> Self {
        SerializableTimeRange {
            lower_bound: None,
            upper_bound: Some(upper),
        }
    }

    /// Create a time range between two times
    pub fn between(lower: u64, upper: u64) -> Self {
        SerializableTimeRange {
            lower_bound: Some(lower),
            upper_bound: Some(upper),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableRedeemer {
    pub tag: SerializableRedeemerTag,
    pub index: u32,
    pub data: SerializablePlutusData,
    pub ex_units: SerializableExUnits,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "tag")]
pub enum SerializableRedeemerTag {
    #[serde(rename = "Spend")]
    Spend,
    #[serde(rename = "Mint")]
    Mint,
    #[serde(rename = "Cert")]
    Cert,
    #[serde(rename = "Reward")]
    Reward,
    #[serde(rename = "Vote")]
    Vote,
    #[serde(rename = "Propose")]
    Propose,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableExUnits {
    pub mem: u64,
    pub steps: u64,
}

impl SerializableExUnits {
    /// Create new ExUnits
    pub fn new(mem: u64, steps: u64) -> Self {
        SerializableExUnits { mem, steps }
    }

    /// Create zero ExUnits
    pub fn zero() -> Self {
        SerializableExUnits { mem: 0, steps: 0 }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableRational {
    pub numerator: u64,
    pub denominator: u64,
}

// TransactionInput mappers
impl From<conway::TransactionInput> for SerializableTransactionInput {
    fn from(input: conway::TransactionInput) -> Self {
        SerializableTransactionInput {
            transaction_id: hash_to_hex(&input.transaction_id),
            index: input.index as u64,
        }
    }
}

// ExUnits mappers
impl From<pallas_primitives::ExUnits> for SerializableExUnits {
    fn from(units: pallas_primitives::ExUnits) -> Self {
        SerializableExUnits {
            mem: units.mem,
            steps: units.steps,
        }
    }
}

// Rational mappers
impl From<pallas_primitives::RationalNumber> for SerializableRational {
    fn from(rational: pallas_primitives::RationalNumber) -> Self {
        SerializableRational {
            numerator: rational.numerator,
            denominator: rational.denominator,
        }
    }
}

// Value mapper for alonzo (simpler structure)
impl From<alonzo::Value> for SerializableCardanoValue {
    fn from(value: alonzo::Value) -> Self {
        match value {
            alonzo::Value::Coin(c) => SerializableCardanoValue::Coin {
                amount: c
            },
            alonzo::Value::Multiasset(c, assets) => {
                let mut serializable_assets = Vec::new();
                for (policy_id, tokens) in assets.iter() {
                    let mut serializable_tokens = Vec::new();
                    for (asset_name, quantity) in tokens.iter() {
                        serializable_tokens.push(SerializableToken {
                            asset_name: bytes_to_hex(asset_name),
                            quantity: *quantity as i64,
                        });
                    }
                    serializable_assets.push(SerializableAsset {
                        policy_id: hash_to_hex(policy_id),
                        tokens: serializable_tokens,
                    });
                }
                SerializableCardanoValue::Multiasset {
                    coin: c,
                    assets: serializable_assets,
                }
            }
        }
    }
}

// Value mapper for conway (same structure as alonzo)
impl From<conway::Value> for SerializableCardanoValue {
    fn from(value: conway::Value) -> Self {
        match value {
            conway::Value::Coin(c) => SerializableCardanoValue::Coin {
                amount: c
            },
            conway::Value::Multiasset(c, assets) => {
                let mut serializable_assets = Vec::new();
                for (policy_id, tokens) in assets.iter() {
                    let mut serializable_tokens = Vec::new();
                    for (asset_name, quantity) in tokens.iter() {
                        serializable_tokens.push(SerializableToken {
                            asset_name: bytes_to_hex(asset_name),
                            quantity: u64::from(*quantity) as i64,
                        });
                    }
                    serializable_assets.push(SerializableAsset {
                        policy_id: hash_to_hex(policy_id),
                        tokens: serializable_tokens,
                    });
                }
                SerializableCardanoValue::Multiasset {
                    coin: c,
                    assets: serializable_assets,
                }
            }
        }
    }
}

// TransactionOutput mappers
impl From<conway::TransactionOutput> for SerializableTransactionOutput {
    fn from(output: conway::TransactionOutput) -> Self {
        match output {
            conway::TransactionOutput::Legacy(x) => {
                let address = address_from_bytes(x.address.as_ref()).unwrap();
                SerializableTransactionOutput::Legacy {
                    address: address_to_bech32(&address).unwrap_or_else(|_| hex::encode(x.address.as_ref() as &[u8])),
                    value: SerializableCardanoValue::from(x.amount),
                }
            }
            conway::TransactionOutput::PostAlonzo(x) => {
                let address = address_from_bytes(x.address.as_ref()).unwrap();
                SerializableTransactionOutput::PostAlonzo {
                    address: address_to_bech32(&address).unwrap_or_else(|_| hex::encode(x.address.as_ref() as &[u8])),
                    value: SerializableCardanoValue::from(x.value),
                    datum_option: x.datum_option.map(|d| d.into()),
                    script_ref: x.script_ref.map(|s| s.0.into()),
                }
            }
        }
    }
}

// ScriptRef mapper
impl From<conway::ScriptRef> for SerializableScriptRef {
    fn from(script_ref: conway::ScriptRef) -> Self {
        match script_ref {
            conway::PseudoScript::NativeScript(script) => {
                SerializableScriptRef::NativeScript {
                    script: hex::encode(pallas_codec::minicbor::to_vec(&script).unwrap_or_default()),
                }
            }
            conway::PseudoScript::PlutusV1Script(script) => {
                SerializableScriptRef::PlutusV1Script {
                    script: bytes_to_hex(&script.0),
                }
            }
            conway::PseudoScript::PlutusV2Script(script) => {
                SerializableScriptRef::PlutusV2Script {
                    script: bytes_to_hex(&script.0),
                }
            }
            conway::PseudoScript::PlutusV3Script(script) => {
                SerializableScriptRef::PlutusV3Script {
                    script: bytes_to_hex(&script.0),
                }
            }
        }
    }
}

// DatumOption mapper
impl From<babbage::DatumOption> for SerializableDatumOption {
    fn from(datum: babbage::DatumOption) -> Self {
        match datum {
            babbage::DatumOption::Hash(h) => SerializableDatumOption::Hash {
                hash: hash_to_hex(&h),
            },
            babbage::DatumOption::Data(d) => SerializableDatumOption::Data {
                data: (&d.0).into(),
            },
        }
    }
}

// Redeemer tag mappers
impl From<alonzo::RedeemerTag> for SerializableRedeemerTag {
    fn from(tag: alonzo::RedeemerTag) -> Self {
        match tag {
            alonzo::RedeemerTag::Spend => SerializableRedeemerTag::Spend,
            alonzo::RedeemerTag::Mint => SerializableRedeemerTag::Mint,
            alonzo::RedeemerTag::Cert => SerializableRedeemerTag::Cert,
            alonzo::RedeemerTag::Reward => SerializableRedeemerTag::Reward,
        }
    }
}

// Conway adds new redeemer tags
impl From<conway::RedeemerTag> for SerializableRedeemerTag {
    fn from(tag: conway::RedeemerTag) -> Self {
        match tag {
            conway::RedeemerTag::Spend => SerializableRedeemerTag::Spend,
            conway::RedeemerTag::Mint => SerializableRedeemerTag::Mint,
            conway::RedeemerTag::Cert => SerializableRedeemerTag::Cert,
            conway::RedeemerTag::Reward => SerializableRedeemerTag::Reward,
            conway::RedeemerTag::Vote => SerializableRedeemerTag::Vote,
            conway::RedeemerTag::Propose => SerializableRedeemerTag::Propose,
        }
    }
}

// Redeemer mapper
impl From<alonzo::Redeemer> for SerializableRedeemer {
    fn from(redeemer: alonzo::Redeemer) -> Self {
        SerializableRedeemer {
            tag: redeemer.tag.into(),
            index: redeemer.index,
            data: redeemer.data.into(),
            ex_units: redeemer.ex_units.into(),
        }
    }
}

// MintValue mapper (from Mint which is Multiasset<NonZeroInt>)
impl From<conway::Mint> for SerializableMintValue {
    fn from(mint: conway::Mint) -> Self {
        let mut mint_value = Vec::new();
        for (policy_id, tokens) in mint.iter() {
            let mut serializable_tokens = Vec::new();
            for (asset_name, quantity) in tokens.iter() {
                serializable_tokens.push(SerializableToken {
                    asset_name: bytes_to_hex(asset_name),
                    quantity: quantity.into(),
                });
            }
            mint_value.push(SerializableAsset {
                policy_id: hash_to_hex(policy_id),
                tokens: serializable_tokens,
            });
        }
        SerializableMintValue { mint_value }
    }
}

// Additional uplc mappers

// MintValue mapper (from uplc::tx::to_plutus_data::MintValue)
impl From<MintValue> for SerializableMintValue {
    fn from(mint_value: MintValue) -> Self {
        mint_value.mint_value.into()
    }
}

// TimeRange mapper (type alias in uplc) 
// Note: We'll need to check what TimeRange actually is - might be a tuple or struct
impl From<TimeRange> for SerializableTimeRange {
    fn from(time_range: TimeRange) -> Self {
        // TimeRange has lower_bound and upper_bound fields
        SerializableTimeRange {
            lower_bound: time_range.lower_bound,
            upper_bound: time_range.upper_bound,
        }
    }
}

// ScriptPurpose mapper (from uplc::tx::script_context::ScriptPurpose)
impl From<ScriptPurpose> for SerializableScriptPurpose {
    fn from(purpose: ScriptPurpose) -> Self {
        match purpose {
            ScriptPurpose::Minting(policy_id) => {
                SerializableScriptPurpose::Minting {
                    policy_id: hash_to_hex(&policy_id),
                }
            }
            ScriptPurpose::Spending(input, _) => {
                SerializableScriptPurpose::Spending {
                    utxo_ref: input.into(),
                }
            }
            ScriptPurpose::Rewarding(stake_credential) => {
                SerializableScriptPurpose::Rewarding {
                    stake_credential: stake_credential.into(),
                }
            }
            ScriptPurpose::Certifying(index, certificate) => {
                SerializableScriptPurpose::Certifying {
                    index,
                    certificate: certificate.into(),
                }
            }
            ScriptPurpose::Voting(voter) => {
                SerializableScriptPurpose::Voting {
                    voter: voter.into(),
                }
            }
            ScriptPurpose::Proposing(index, proposal) => {
                SerializableScriptPurpose::Proposing {
                    index,
                    proposal: proposal.into(),
                }
            }
        }
    }
}

// Conway Redeemer mapper
impl From<conway::Redeemer> for SerializableRedeemer {
    fn from(redeemer: conway::Redeemer) -> Self {
        SerializableRedeemer {
            tag: redeemer.tag.into(),
            index: redeemer.index,
            data: redeemer.data.into(),
            ex_units: redeemer.ex_units.into(),
        }
    }
}

// ScriptInfo mapper (from uplc::tx::script_context::ScriptInfo)
impl TryFrom<uplc::tx::script_context::ScriptInfo<Option<uplc::PlutusData>>> for super::script_types::SerializableScriptInfo 
{
    type Error = super::utils::ConversionError;

    fn try_from(script_info: uplc::tx::script_context::ScriptInfo<Option<uplc::PlutusData>>) -> Result<Self, Self::Error> {
        match script_info {
            uplc::tx::script_context::ScriptInfo::Minting(policy_id) => {
                Ok(super::script_types::SerializableScriptInfo::Minting {
                    policy_id: hash_to_hex(&policy_id),
                })
            }
            uplc::tx::script_context::ScriptInfo::Spending(input, datum) => {
                Ok(super::script_types::SerializableScriptInfo::Spending {
                    utxo_ref: input.into(),
                    datum: datum.map(|d| d.into()),
                })
            }
            uplc::tx::script_context::ScriptInfo::Rewarding(stake_credential) => {
                Ok(super::script_types::SerializableScriptInfo::Rewarding {
                    stake_credential: stake_credential.into(),
                })
            }
            uplc::tx::script_context::ScriptInfo::Certifying(index, certificate) => {
                Ok(super::script_types::SerializableScriptInfo::Certifying {
                    index,
                    certificate: certificate.into(),
                })
            }
            uplc::tx::script_context::ScriptInfo::Voting(voter) => {
                Ok(super::script_types::SerializableScriptInfo::Voting {
                    voter: voter.into(),
                })
            }
            uplc::tx::script_context::ScriptInfo::Proposing(index, proposal) => {
                Ok(super::script_types::SerializableScriptInfo::Proposing {
                    index,
                    proposal: proposal.into(),
                })
            }
        }
    }
}