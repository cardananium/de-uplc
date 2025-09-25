use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use std::collections::HashMap;
use crate::SerializableStakeCredential;

use super::basic_types::SerializableRational;
use super::basic_types::SerializableExUnits;

use super::utils::{hash_to_hex, address_from_bytes, address_to_bech32};
use pallas_primitives::conway;

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "voter_type")]
pub enum SerializableVoter {
    #[serde(rename = "ConstitutionalCommitteeScript")]
    ConstitutionalCommitteeScript { hash: String },
    #[serde(rename = "ConstitutionalCommitteeKey")]
    ConstitutionalCommitteeKey { hash: String },
    #[serde(rename = "DRepScript")]
    DRepScript { hash: String },
    #[serde(rename = "DRepKey")]
    DRepKey { hash: String },
    #[serde(rename = "StakePoolKey")]
    StakePoolKey { hash: String },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableProposalProcedure {
    pub deposit: u64,
    pub reward_account: String,
    pub gov_action: SerializableGovAction,
    pub anchor: SerializableAnchor,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "action_type")]
pub enum SerializableGovAction {
    #[serde(rename = "ParameterChange")]
    ParameterChange {
        gov_action_id: Option<SerializableGovActionId>,
        protocol_params_update: Box<SerializableProtocolParamsUpdate>,
        policy_hash: Option<String>,
    },
    #[serde(rename = "HardForkInitiation")]
    HardForkInitiation {
        gov_action_id: Option<SerializableGovActionId>,
        protocol_version: SerializableProtocolVersion,
    },
    #[serde(rename = "TreasuryWithdrawals")]
    TreasuryWithdrawals {
        withdrawals: HashMap<String, u64>,
        policy_hash: Option<String>,
    },
    #[serde(rename = "NoConfidence")]
    NoConfidence {
        gov_action_id: Option<SerializableGovActionId>,
    },
    #[serde(rename = "UpdateCommittee")]
    UpdateCommittee {
        gov_action_id: Option<SerializableGovActionId>,
        members_to_remove: Vec<SerializableStakeCredential>,
        members_to_add: HashMap<SerializableStakeCredential, u64>,
        quorum_threshold: SerializableRational,
    },
    #[serde(rename = "NewConstitution")]
    NewConstitution {
        gov_action_id: Option<SerializableGovActionId>,
        constitution: SerializableConstitution,
    },
    #[serde(rename = "Information")]
    Information,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableGovActionId {
    pub transaction_id: String,
    pub action_index: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableProtocolParamsUpdate {
    // Fee parameters
    pub minfee_a: Option<u64>,
    pub minfee_b: Option<u64>,

    // Block and transaction size limits
    pub max_block_body_size: Option<u64>,
    pub max_transaction_size: Option<u64>,
    pub max_block_header_size: Option<u64>,

    // Deposits
    pub key_deposit: Option<u64>,
    pub pool_deposit: Option<u64>,

    // Epochs and pools
    pub maximum_epoch: Option<u64>,
    pub desired_number_of_stake_pools: Option<u64>,
    pub pool_pledge_influence: Option<SerializableRational>,
    pub expansion_rate: Option<SerializableRational>,
    pub treasury_growth_rate: Option<SerializableRational>,

    // Pool parameters
    pub min_pool_cost: Option<u64>,

    // UTxO and scripts
    pub ada_per_utxo_byte: Option<u64>,
    pub cost_models_for_script_languages: Option<SerializableCostModels>,
    pub execution_costs: Option<SerializableExUnitPrices>,
    pub max_tx_ex_units: Option<SerializableExUnits>,
    pub max_block_ex_units: Option<SerializableExUnits>,
    pub max_value_size: Option<u64>,

    // Collateral
    pub collateral_percentage: Option<u64>,
    pub max_collateral_inputs: Option<u64>,

    // Conway era governance parameters
    pub pool_voting_thresholds: Option<SerializablePoolVotingThresholds>,
    pub drep_voting_thresholds: Option<SerializableDRepVotingThresholds>,
    pub min_committee_size: Option<u64>,
    pub committee_term_limit: Option<u64>,
    pub governance_action_validity_period: Option<u64>,
    pub governance_action_deposit: Option<u64>,
    pub drep_deposit: Option<u64>,
    pub drep_inactivity_period: Option<u64>,
    pub minfee_refscript_cost_per_byte: Option<SerializableRational>,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableCostModels {
    pub plutus_v1: Option<Vec<i64>>,
    pub plutus_v2: Option<Vec<i64>>,
    pub plutus_v3: Option<Vec<i64>>,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableExUnitPrices {
    pub mem_price: SerializableRational,
    pub step_price: SerializableRational,
}


#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableProtocolVersion {
    pub major: u64,
    pub minor: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableConstitution {
    pub anchor: SerializableAnchor,
    pub guardrail_script: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableAnchor {
    pub url: String,
    pub data_hash: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableVotingProcedure {
    pub vote: SerializableVote,
    pub anchor: Option<SerializableAnchor>,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "vote_type")]
pub enum SerializableVote {
    #[serde(rename = "No")]
    No,
    #[serde(rename = "Yes")]
    Yes,
    #[serde(rename = "Abstain")]
    Abstain,
}

// Additional Conway governance types
#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializablePoolVotingThresholds {
    pub motion_no_confidence: SerializableRational,
    pub committee_normal: SerializableRational,
    pub committee_no_confidence: SerializableRational,
    pub hard_fork_initiation: SerializableRational,
    pub security_voting_threshold: SerializableRational,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializableDRepVotingThresholds {
    pub motion_no_confidence: SerializableRational,
    pub committee_normal: SerializableRational,
    pub committee_no_confidence: SerializableRational,
    pub update_constitution: SerializableRational,
    pub hard_fork_initiation: SerializableRational,
    pub pp_network_group: SerializableRational,
    pub pp_economic_group: SerializableRational,
    pub pp_technical_group: SerializableRational,
    pub pp_governance_group: SerializableRational,
    pub treasury_withdrawal: SerializableRational,
}

// Anchor mapper
impl From<conway::Anchor> for SerializableAnchor {
    fn from(anchor: conway::Anchor) -> Self {
        SerializableAnchor {
            url: anchor.url,
            data_hash: hash_to_hex(&anchor.content_hash),
        }
    }
}

// Vote mapper
impl From<conway::Vote> for SerializableVote {
    fn from(vote: conway::Vote) -> Self {
        match vote {
            conway::Vote::No => SerializableVote::No,
            conway::Vote::Yes => SerializableVote::Yes,
            conway::Vote::Abstain => SerializableVote::Abstain,
        }
    }
}

// Voter mapper
impl From<conway::Voter> for SerializableVoter {
    fn from(voter: conway::Voter) -> Self {
        match voter {
            conway::Voter::ConstitutionalCommitteeScript(hash) => {
                SerializableVoter::ConstitutionalCommitteeScript {
                    hash: hash_to_hex(&hash),
                }
            }
            conway::Voter::ConstitutionalCommitteeKey(hash) => {
                SerializableVoter::ConstitutionalCommitteeKey {
                    hash: hash_to_hex(&hash),
                }
            }
            conway::Voter::DRepScript(hash) => {
                SerializableVoter::DRepScript {
                    hash: hash_to_hex(&hash),
                }
            }
            conway::Voter::DRepKey(hash) => {
                SerializableVoter::DRepKey {
                    hash: hash_to_hex(&hash),
                }
            }
            conway::Voter::StakePoolKey(hash) => {
                SerializableVoter::StakePoolKey {
                    hash: hash_to_hex(&hash),
                }
            }
        }
    }
}

// VotingProcedure mapper
impl From<conway::VotingProcedure> for SerializableVotingProcedure {
    fn from(proc: conway::VotingProcedure) -> Self {
        SerializableVotingProcedure {
            vote: proc.vote.into(),
            anchor: match proc.anchor {
                pallas_codec::utils::Nullable::Some(a) => Some(a.into()),
                pallas_codec::utils::Nullable::Null => None,
                pallas_codec::utils::Nullable::Undefined => None,
            },
        }
    }
}

// ProposalProcedure mapper
impl From<conway::ProposalProcedure> for SerializableProposalProcedure {
    fn from(proc: conway::ProposalProcedure) -> Self {
        SerializableProposalProcedure {
            deposit: proc.deposit,
            reward_account: {
                let addr = address_from_bytes(proc.reward_account.as_ref()).unwrap();
                address_to_bech32(&addr).unwrap_or_else(|_| hex::encode(proc.reward_account.as_ref() as &[u8]))
            },
            gov_action: proc.gov_action.into(),
            anchor: proc.anchor.into(),
        }
    }
}

// ProtocolVersion mapper
impl From<pallas_primitives::ProtocolVersion> for SerializableProtocolVersion {
    fn from((major, minor): pallas_primitives::ProtocolVersion) -> Self {
        SerializableProtocolVersion { major, minor }
    }
}

// Constitution mapper
impl From<conway::Constitution> for SerializableConstitution {
    fn from(constitution: conway::Constitution) -> Self {
        SerializableConstitution {
            anchor: constitution.anchor.into(),
            guardrail_script: nullable_to_option(constitution.guardrail_script, |h| hash_to_hex(&h)),
        }
    }
}

// GovActionId mapper
impl From<conway::GovActionId> for SerializableGovActionId {
    fn from(id: conway::GovActionId) -> Self {
        SerializableGovActionId {
            transaction_id: hash_to_hex(&id.transaction_id),
            action_index: id.action_index,
        }
    }
}

// Helper function to convert Nullable to Option
fn nullable_to_option<T: Clone, U>(nullable: pallas_codec::utils::Nullable<T>, f: impl FnOnce(T) -> U) -> Option<U> {
    match nullable {
        pallas_codec::utils::Nullable::Some(t) => Some(f(t)),
        pallas_codec::utils::Nullable::Null => None,
        pallas_codec::utils::Nullable::Undefined => None,
    }
}

// Add more mappers for related types
impl From<conway::PoolVotingThresholds> for SerializablePoolVotingThresholds {
    fn from(thresholds: conway::PoolVotingThresholds) -> Self {
        SerializablePoolVotingThresholds {
            motion_no_confidence: thresholds.motion_no_confidence.into(),
            committee_normal: thresholds.committee_normal.into(), 
            committee_no_confidence: thresholds.committee_no_confidence.into(),
            hard_fork_initiation: thresholds.hard_fork_initiation.into(),
            security_voting_threshold: thresholds.security_voting_threshold.into(),
        }
    }
}

impl From<conway::DRepVotingThresholds> for SerializableDRepVotingThresholds {
    fn from(thresholds: conway::DRepVotingThresholds) -> Self {
        SerializableDRepVotingThresholds {
            motion_no_confidence: thresholds.motion_no_confidence.into(),
            committee_normal: thresholds.committee_normal.into(),
            committee_no_confidence: thresholds.committee_no_confidence.into(),
            update_constitution: thresholds.update_constitution.into(),
            hard_fork_initiation: thresholds.hard_fork_initiation.into(),
            pp_network_group: thresholds.pp_network_group.into(),
            pp_economic_group: thresholds.pp_economic_group.into(),
            pp_technical_group: thresholds.pp_technical_group.into(),
            pp_governance_group: thresholds.pp_governance_group.into(),
            treasury_withdrawal: thresholds.treasury_withdrawal.into(),
        }
    }
}

impl From<conway::CostModels> for SerializableCostModels {
    fn from(models: conway::CostModels) -> Self {
        SerializableCostModels {
            plutus_v1: models.plutus_v1.clone(),
            plutus_v2: models.plutus_v2.clone(),
            plutus_v3: models.plutus_v3.clone(),
        }
    }
}

impl From<conway::ExUnitPrices> for SerializableExUnitPrices {
    fn from(prices: conway::ExUnitPrices) -> Self {
        SerializableExUnitPrices {
            mem_price: prices.mem_price.into(),
            step_price: prices.step_price.into(),
        }
    }
}

// ProtocolParamUpdate mapper
impl From<conway::ProtocolParamUpdate> for SerializableProtocolParamsUpdate {
    fn from(update: conway::ProtocolParamUpdate) -> Self {
        SerializableProtocolParamsUpdate {
            minfee_a: update.minfee_a,
            minfee_b: update.minfee_b,
            max_block_body_size: update.max_block_body_size,
            max_transaction_size: update.max_transaction_size,
            max_block_header_size: update.max_block_header_size,
            key_deposit: update.key_deposit,
            pool_deposit: update.pool_deposit,
            maximum_epoch: update.maximum_epoch,
            desired_number_of_stake_pools: update.desired_number_of_stake_pools,
            pool_pledge_influence: update.pool_pledge_influence.map(|r| r.into()),
            expansion_rate: update.expansion_rate.map(|r| r.into()),
            treasury_growth_rate: update.treasury_growth_rate.map(|r| r.into()),
            min_pool_cost: update.min_pool_cost,
            ada_per_utxo_byte: update.ada_per_utxo_byte,
            cost_models_for_script_languages: update.cost_models_for_script_languages.map(|m| m.into()),
            execution_costs: update.execution_costs.map(|e| e.into()),
            max_tx_ex_units: update.max_tx_ex_units.map(|e| e.into()),
            max_block_ex_units: update.max_block_ex_units.map(|e| e.into()),
            max_value_size: update.max_value_size,
            collateral_percentage: update.collateral_percentage,
            max_collateral_inputs: update.max_collateral_inputs,
            pool_voting_thresholds: update.pool_voting_thresholds.map(|t| t.into()),
            drep_voting_thresholds: update.drep_voting_thresholds.map(|t| t.into()),
            min_committee_size: update.min_committee_size,
            committee_term_limit: update.committee_term_limit,
            governance_action_validity_period: update.governance_action_validity_period,
            governance_action_deposit: update.governance_action_deposit,
            drep_deposit: update.drep_deposit,
            drep_inactivity_period: update.drep_inactivity_period,
            minfee_refscript_cost_per_byte: update.minfee_refscript_cost_per_byte.map(|r| r.into()),
        }
    }
}

// GovAction mapper
impl From<conway::GovAction> for SerializableGovAction {
    fn from(action: conway::GovAction) -> Self {
        match action {
            conway::GovAction::ParameterChange(prev_id, updates, guardrail_script) => {
                SerializableGovAction::ParameterChange {
                    gov_action_id: nullable_to_option(prev_id, |id| id.into()),
                    protocol_params_update: Box::new((*updates).into()),
                    policy_hash: nullable_to_option(guardrail_script, |s| hash_to_hex(&s)),
                }
            }
            conway::GovAction::HardForkInitiation(prev_id, version) => {
                SerializableGovAction::HardForkInitiation {
                    gov_action_id: nullable_to_option(prev_id, |id| id.into()),
                    protocol_version: SerializableProtocolVersion {
                        major: version.0,
                        minor: version.1,
                    },
                }
            }
            conway::GovAction::TreasuryWithdrawals(withdrawals, guardrail_script) => {
                SerializableGovAction::TreasuryWithdrawals {
                    withdrawals: withdrawals.iter().map(|(c, q)| {
                        let addr = address_from_bytes(c.as_ref()).unwrap();
                        (address_to_bech32(&addr).unwrap_or_else(|_| hex::encode(c.as_ref() as &[u8])), *q)
                    }).collect(),
                    policy_hash: nullable_to_option(guardrail_script, |s| hash_to_hex(&s)),
                }
            }
            conway::GovAction::NoConfidence(prev_id) => {
                SerializableGovAction::NoConfidence {
                    gov_action_id: nullable_to_option(prev_id, |id| id.into()),
                }
            }
            conway::GovAction::UpdateCommittee(prev_id, removed, added, new_quorum) => {
                SerializableGovAction::UpdateCommittee {
                    gov_action_id: nullable_to_option(prev_id, |id| id.into()),
                    members_to_remove: removed.iter().map(|c| c.clone().into()).collect(),
                    members_to_add: added.iter().map(|(c, q)| (c.clone().into(), *q)).collect(),
                    quorum_threshold: SerializableRational {
                        numerator: new_quorum.numerator,
                        denominator: new_quorum.denominator,
                    },
                }
            }
            conway::GovAction::NewConstitution(prev_id, constitution) => {
                SerializableGovAction::NewConstitution {
                    gov_action_id: nullable_to_option(prev_id, |id| id.into()),
                    constitution: constitution.into(),
                }
            }
            conway::GovAction::Information => SerializableGovAction::Information,
        }
    }
} 