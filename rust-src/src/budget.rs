use serde::{Serialize, Deserialize};
use schemars::JsonSchema;

#[derive(Serialize, Deserialize, Debug, Clone, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub struct SerializableBudget {
    pub ex_units_spent: i64,
    pub ex_units_available: i64,
    pub memory_units_spent: i64,
    pub memory_units_available: i64,
}