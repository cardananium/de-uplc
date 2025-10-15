use hex;
use pallas_addresses::Address;
use pallas_crypto::hash::Hash;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ConversionError {
    #[error("Invalid address format: {0}")]
    InvalidAddress(String),
    
    #[error("Missing required field: {0}")]
    MissingField(String),
    
    #[error("Invalid hex encoding: {0}")]
    InvalidHex(#[from] hex::FromHexError),
    
    #[error("Unsupported variant: {0}")]
    UnsupportedVariant(String),
    
    #[error("Pallas error: {0}")]
    PallasError(String),
}

pub fn hash_to_hex<const N: usize>(hash: &Hash<N>) -> String {
    hex::encode(hash)
}

pub fn bytes_to_hex(bytes: &[u8]) -> String {
    hex::encode(bytes)
}

pub fn address_to_bech32(address: &Address) -> Result<String, ConversionError> {
    address.to_bech32()
        .map_err(|e| ConversionError::InvalidAddress(e.to_string()))
}

pub fn address_from_bytes(bytes: &[u8]) -> Result<Address, ConversionError> {
    Address::from_bytes(bytes)
        .map_err(|e| ConversionError::InvalidAddress(e.to_string()))
} 