use serde::{Serialize, Deserialize};
use schemars::JsonSchema;
use super::governance::SerializableAnchor;
use super::basic_types::SerializableRational;

use super::utils::{hash_to_hex, bytes_to_hex};
use pallas_primitives::{conway, StakeCredential};
use pallas_codec::utils::Nullable;

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "certificate_type")]
pub enum SerializableCertificate {
    #[serde(rename = "StakeRegistration")]
    StakeRegistration {
        stake_credential: SerializableStakeCredential,
    },
    #[serde(rename = "StakeDeregistration")]
    StakeDeregistration {
        stake_credential: SerializableStakeCredential,
    },
    #[serde(rename = "StakeDelegation")]
    StakeDelegation {
        stake_credential: SerializableStakeCredential,
        pool_keyhash: String,
    },
    #[serde(rename = "PoolRegistration")]
    PoolRegistration {
        pool_params: SerializablePoolParams,
    },
    #[serde(rename = "PoolRetirement")]
    PoolRetirement {
        pool_keyhash: String,
        epoch: u64,
    },

    #[serde(rename = "Reg")]
    Reg {
        stake_credential: SerializableStakeCredential,
        deposit: u64,
    },
    #[serde(rename = "UnReg")]
    UnReg {
        stake_credential: SerializableStakeCredential,
        refund: u64,
    },
    #[serde(rename = "VoteDeleg")]
    VoteDeleg {
        stake_credential: SerializableStakeCredential,
        drep: SerializableDRep,
    },
    #[serde(rename = "StakeVoteDeleg")]
    StakeVoteDeleg {
        stake_credential: SerializableStakeCredential,
        pool_keyhash: String,
        drep: SerializableDRep,
    },
    #[serde(rename = "StakeRegDeleg")]
    StakeRegDeleg {
        stake_credential: SerializableStakeCredential,
        pool_keyhash: String,
        deposit: u64,
    },
    #[serde(rename = "VoteRegDeleg")]
    VoteRegDeleg {
        stake_credential: SerializableStakeCredential,
        drep: SerializableDRep,
        deposit: u64,
    },
    #[serde(rename = "StakeVoteRegDeleg")]
    StakeVoteRegDeleg {
        stake_credential: SerializableStakeCredential,
        pool_keyhash: String,
        drep: SerializableDRep,
        deposit: u64,
    },

    // Committee certificates
    #[serde(rename = "AuthCommitteeHot")]
    AuthCommitteeHot {
        committee_cold_credential: SerializableStakeCredential,
        committee_hot_credential: SerializableStakeCredential,
    },
    #[serde(rename = "ResignCommitteeCold")]
    ResignCommitteeCold {
        committee_cold_credential: SerializableStakeCredential,
        anchor: Option<SerializableAnchor>,
    },

    // DRep certificates
    #[serde(rename = "RegDRepCert")]
    RegDRepCert {
        drep_credential: SerializableStakeCredential,
        deposit: u64,
        anchor: Option<SerializableAnchor>,
    },
    #[serde(rename = "UnRegDRepCert")]
    UnRegDRepCert {
        drep_credential: SerializableStakeCredential,
        refund: u64,
    },
    #[serde(rename = "UpdateDRepCert")]
    UpdateDRepCert {
        drep_credential: SerializableStakeCredential,
        anchor: Option<SerializableAnchor>,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "drep_type")]
pub enum SerializableDRep {
    #[serde(rename = "Key")]
    Key { hash: String },
    #[serde(rename = "Script")]
    Script { hash: String },
    #[serde(rename = "Abstain")]
    Abstain,
    #[serde(rename = "NoConfidence")]
    NoConfidence,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema, Hash, PartialEq, Eq)]
#[serde(tag = "credential_type")]
pub enum SerializableStakeCredential {
    #[serde(rename = "KeyHash")]
    KeyHash { hash: String },
    #[serde(rename = "ScriptHash")]
    ScriptHash { hash: String },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializablePoolParams {
    pub operator: String,
    pub vrf_keyhash: String,
    pub pledge: u64,
    pub cost: u64,
    pub margin: SerializableRational,
    pub reward_account: String,
    pub pool_owners: Vec<String>,
    pub relays: Vec<SerializableRelay>,
    pub pool_metadata: Option<SerializablePoolMetadata>,
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(tag = "relay_type")]
pub enum SerializableRelay {
    #[serde(rename = "SingleHostAddr")]
    SingleHostAddr {
        port: Option<u32>,
        ipv4: Option<String>,
        ipv6: Option<String>,
    },
    #[serde(rename = "SingleHostName")]
    SingleHostName {
        port: Option<u32>,
        hostname: String,
    },
    #[serde(rename = "MultiHostName")]
    MultiHostName {
        hostname: String,
    },
}

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
pub struct SerializablePoolMetadata {
    pub url: String,
    pub hash: String,
}

// StakeCredential mapper
impl From<StakeCredential> for SerializableStakeCredential {
    fn from(cred: StakeCredential) -> Self {
        match cred {
            StakeCredential::AddrKeyhash(hash) => SerializableStakeCredential::KeyHash {
                hash: hash_to_hex(&hash),
            },
            StakeCredential::ScriptHash(hash) => SerializableStakeCredential::ScriptHash {
                hash: hash_to_hex(&hash),
            },
        }
    }
}

// DRep mapper
impl From<conway::DRep> for SerializableDRep {
    fn from(drep: conway::DRep) -> Self {
        match drep {
            conway::DRep::Key(hash) => SerializableDRep::Key {
                hash: hash_to_hex(&hash),
            },
            conway::DRep::Script(hash) => SerializableDRep::Script {
                hash: hash_to_hex(&hash),
            },
            conway::DRep::Abstain => SerializableDRep::Abstain,
            conway::DRep::NoConfidence => SerializableDRep::NoConfidence,
        }
    }
}

// Relay mapper
impl From<pallas_primitives::Relay> for SerializableRelay {
    fn from(relay: pallas_primitives::Relay) -> Self {
        match relay {
            pallas_primitives::Relay::SingleHostAddr(port, ipv4, ipv6) => {
                SerializableRelay::SingleHostAddr {
                    port: match port {
                        Nullable::Some(p) => Some(p as u32),
                        Nullable::Null => None,
                        Nullable::Undefined => None,
                    },
                    ipv4: match ipv4 {
                        Nullable::Some(ip) => Some(bytes_to_hex(&ip)),
                        Nullable::Null => None,
                        Nullable::Undefined => None,
                    },
                    ipv6: match ipv6 {
                        Nullable::Some(ip) => Some(bytes_to_hex(&ip)),
                        Nullable::Null => None,
                        Nullable::Undefined => None,
                    },
                }
            }
            pallas_primitives::Relay::SingleHostName(port, hostname) => {
                SerializableRelay::SingleHostName {
                    port: match port {
                        Nullable::Some(p) => Some(p as u32),
                        Nullable::Null => None,
                        Nullable::Undefined => None,
                    },
                    hostname,
                }
            }
            pallas_primitives::Relay::MultiHostName(hostname) => {
                SerializableRelay::MultiHostName {
                    hostname,
                }
            }
        }
    }
}

// PoolMetadata mapper
impl From<pallas_primitives::PoolMetadata> for SerializablePoolMetadata {
    fn from(metadata: pallas_primitives::PoolMetadata) -> Self {
        SerializablePoolMetadata {
            url: metadata.url,
            hash: hash_to_hex(&metadata.hash),
        }
    }
}

// Certificate mapper
impl From<conway::Certificate> for SerializableCertificate {
    fn from(cert: conway::Certificate) -> Self {
        match cert {
            // Legacy certificate types
            conway::Certificate::StakeRegistration(cred) => {
                SerializableCertificate::StakeRegistration {
                    stake_credential: cred.into(),
                }
            }
            conway::Certificate::StakeDeregistration(cred) => {
                SerializableCertificate::StakeDeregistration {
                    stake_credential: cred.into(),
                }
            }
            conway::Certificate::StakeDelegation(cred, pool) => {
                SerializableCertificate::StakeDelegation {
                    stake_credential: cred.into(),
                    pool_keyhash: hash_to_hex(&pool),
                }
            }
            conway::Certificate::PoolRegistration { 
                operator, vrf_keyhash, pledge, cost, margin,
                reward_account, pool_owners, relays, pool_metadata 
            } => {
                SerializableCertificate::PoolRegistration {
                    pool_params: SerializablePoolParams {
                        operator: hash_to_hex(&operator),
                        vrf_keyhash: hash_to_hex(&vrf_keyhash),
                        pledge,
                        cost,
                        margin: margin.into(),
                        reward_account: bytes_to_hex(&reward_account),
                        pool_owners: pool_owners.iter().map(|o| hash_to_hex(o)).collect(),
                        relays: relays.iter().cloned().map(|r| r.into()).collect(),
                        pool_metadata: match pool_metadata {
                            Nullable::Some(m) => Some(m.into()),
                            Nullable::Null | Nullable::Undefined => None,
                        },
                    },
                }
            }
            conway::Certificate::PoolRetirement(pool, epoch) => {
                SerializableCertificate::PoolRetirement {
                    pool_keyhash: hash_to_hex(&pool),
                    epoch,
                }
            }
            // New Conway era certificates
            conway::Certificate::Reg(cred, coin) => {
                SerializableCertificate::Reg {
                    stake_credential: cred.into(),
                    deposit: coin,
                }
            }
            conway::Certificate::UnReg(cred, coin) => {
                SerializableCertificate::UnReg {
                    stake_credential: cred.into(),
                    refund: coin,
                }
            }
            conway::Certificate::VoteDeleg(cred, drep) => {
                SerializableCertificate::VoteDeleg {
                    stake_credential: cred.into(),
                    drep: drep.into(),
                }
            }
            conway::Certificate::StakeVoteDeleg(cred, pool, drep) => {
                SerializableCertificate::StakeVoteDeleg {
                    stake_credential: cred.into(),
                    pool_keyhash: hash_to_hex(&pool),
                    drep: drep.into(),
                }
            }
            conway::Certificate::StakeRegDeleg(cred, pool, coin) => {
                SerializableCertificate::StakeRegDeleg {
                    stake_credential: cred.into(),
                    pool_keyhash: hash_to_hex(&pool),
                    deposit: coin,
                }
            }
            conway::Certificate::VoteRegDeleg(cred, drep, coin) => {
                SerializableCertificate::VoteRegDeleg {
                    stake_credential: cred.into(),
                    drep: drep.into(),
                    deposit: coin,
                }
            }
            conway::Certificate::StakeVoteRegDeleg(cred, pool, drep, coin) => {
                SerializableCertificate::StakeVoteRegDeleg {
                    stake_credential: cred.into(),
                    pool_keyhash: hash_to_hex(&pool),
                    drep: drep.into(),
                    deposit: coin,
                }
            }
            // Committee certificates
            conway::Certificate::AuthCommitteeHot(cold, hot) => {
                SerializableCertificate::AuthCommitteeHot {
                    committee_cold_credential: cold.into(),
                    committee_hot_credential: hot.into(),
                }
            }
            conway::Certificate::ResignCommitteeCold(cold, anchor) => {
                SerializableCertificate::ResignCommitteeCold {
                    committee_cold_credential: cold.into(),
                    anchor: match anchor {
                        Nullable::Some(a) => Some(a.into()),
                        Nullable::Null | Nullable::Undefined => None,
                    },
                }
            }
            // DRep certificates
            conway::Certificate::RegDRepCert(cred, coin, anchor) => {
                SerializableCertificate::RegDRepCert {
                    drep_credential: cred.into(),
                    deposit: coin,
                    anchor: match anchor {
                        Nullable::Some(a) => Some(a.into()),
                        Nullable::Null | Nullable::Undefined => None,
                    },
                }
            }
            conway::Certificate::UnRegDRepCert(cred, coin) => {
                SerializableCertificate::UnRegDRepCert {
                    drep_credential: cred.into(),
                    refund: coin,
                }
            }
            conway::Certificate::UpdateDRepCert(cred, anchor) => {
                SerializableCertificate::UpdateDRepCert {
                    drep_credential: cred.into(),
                    anchor: match anchor {
                        Nullable::Some(a) => Some(a.into()),
                        Nullable::Null | Nullable::Undefined => None,
                    },
                }
            }
        }
    }
}

