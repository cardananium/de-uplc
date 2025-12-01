use de_uplc::{
    // Root schemas returned from DebuggerEngine and SessionController public API
    SerializableScriptContext,    // from get_tx_script_context()
    SerializableMachineContext,          // from get_machine_context()
    SerializableMachineState,     // from get_machine_state()
    SerializableTerm,             // from get_script()
    SerializableValue,            // from get_current_env()
    SerializableExecutionStatus,  // from step()
};
use de_uplc::budget::SerializableBudget; // from get_budget()
use de_uplc::machine_state::SerializableMachineStateLazy; // from get_machine_state_lazy()
use de_uplc::context::SerializableMachineContextLazy; // from get_machine_context_lazy()
use de_uplc::value::{SerializableValueLazy, SerializableEnvLazy}; // from get_current_env_lazy()

use schemars::schema_for;
use serde_json::{self, Value};
use std::fs;

/// Fix self-references in schema by replacing "$ref": "#" with "$ref": "#/$defs/TypeName"
/// This is needed because when a schema becomes a $def in another schema,
/// "$ref": "#" would incorrectly reference the parent schema instead of itself
fn fix_self_references(value: &mut Value, type_name: &str) {
    match value {
        Value::Object(map) => {
            // Check if this is a $ref to root
            if let Some(Value::String(ref_str)) = map.get("$ref") {
                if ref_str == "#" {
                    // Replace with reference to $defs
                    map.insert("$ref".to_string(), Value::String(format!("#/$defs/{}", type_name)));
                }
            }
            
            // Recursively process all nested values
            for (_, v) in map.iter_mut() {
                fix_self_references(v, type_name);
            }
        }
        Value::Array(arr) => {
            for item in arr.iter_mut() {
                fix_self_references(item, type_name);
            }
        }
        _ => {}
    }
}

/// Fix self-references in a schema and all its $defs
fn fix_schema_and_defs(schema: &mut Value) -> Result<(), Box<dyn std::error::Error>> {
    // First, extract the title
    let title = if let Value::Object(obj) = schema {
        obj.get("title")
            .and_then(|v| v.as_str())
            .ok_or("Schema missing title")?
            .to_string()
    } else {
        return Err("Schema is not an object".into());
    };
    
    // Fix references in the root schema that point to itself
    fix_self_references(schema, &title);
    
    // Fix references in all $defs (now we can safely borrow again)
    if let Value::Object(obj) = schema {
        if let Some(Value::Object(defs)) = obj.get_mut("$defs") {
            for (def_name, def_value) in defs.iter_mut() {
                fix_self_references(def_value, def_name);
            }
        }
    }
    
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create schemas directory
    fs::create_dir_all("schemas")?;

    // Generate schemas for root types returned from public API
    
    // 1. SerializableScriptContext - returned from SessionController::get_tx_script_context()
    let script_context_schema = schema_for!(SerializableScriptContext);
    fs::write("schemas/SerializableScriptContext.json", serde_json::to_string_pretty(&script_context_schema)?)?;

    // 2. SerializableMachineContext - returned from SessionController::get_machine_context()
    let machine_context_schema = schema_for!(SerializableMachineContext);
    fs::write("schemas/SerializableMachineContext.json", serde_json::to_string_pretty(&machine_context_schema)?)?;

    // 3. SerializableMachineState - returned from SessionController::get_machine_state()
    let machine_state_schema = schema_for!(SerializableMachineState);
    fs::write("schemas/SerializableMachineState.json", serde_json::to_string_pretty(&machine_state_schema)?)?;

    // 4. SerializableBudget - returned from SessionController::get_budget()
    let budget_schema = schema_for!(SerializableBudget);
    fs::write("schemas/SerializableBudget.json", serde_json::to_string_pretty(&budget_schema)?)?;

    // 5. SerializableTerm - returned from SessionController::get_script()
    let term_schema = schema_for!(SerializableTerm);
    fs::write("schemas/SerializableTerm.json", serde_json::to_string_pretty(&term_schema)?)?;

    // 6. SerializableValue - returned from SessionController::get_current_env()
    let value_schema = schema_for!(SerializableValue);
    fs::write("schemas/SerializableValue.json", serde_json::to_string_pretty(&value_schema)?)?;

    // 7. SerializableExecutionStatus - returned from SessionController::step()
    let execution_status_schema = schema_for!(SerializableExecutionStatus);
    fs::write("schemas/SerializableExecutionStatus.json", serde_json::to_string_pretty(&execution_status_schema)?)?;

    // Lazy versions - returned from lazy API methods
    let machine_state_lazy_schema = schema_for!(SerializableMachineStateLazy);
    fs::write("schemas/SerializableMachineStateLazy.json", serde_json::to_string_pretty(&machine_state_lazy_schema)?)?;

    let machine_context_lazy_schema = schema_for!(SerializableMachineContextLazy);
    fs::write("schemas/SerializableMachineContextLazy.json", serde_json::to_string_pretty(&machine_context_lazy_schema)?)?;

    let value_lazy_schema = schema_for!(SerializableValueLazy);
    fs::write("schemas/SerializableValueLazy.json", serde_json::to_string_pretty(&value_lazy_schema)?)?;

    let env_lazy_schema = schema_for!(SerializableEnvLazy);
    fs::write("schemas/SerializableEnvLazy.json", serde_json::to_string_pretty(&env_lazy_schema)?)?;

    // Fix self-references in all schemas before combining them
    // Convert schemas to mutable JSON values
    let mut script_context_json = serde_json::to_value(&script_context_schema)?;
    let mut machine_context_json = serde_json::to_value(&machine_context_schema)?;
    let mut machine_state_json = serde_json::to_value(&machine_state_schema)?;
    let mut budget_json = serde_json::to_value(&budget_schema)?;
    let mut term_json = serde_json::to_value(&term_schema)?;
    let mut value_json = serde_json::to_value(&value_schema)?;
    let mut execution_status_json = serde_json::to_value(&execution_status_schema)?;
    let mut machine_state_lazy_json = serde_json::to_value(&machine_state_lazy_schema)?;
    let mut machine_context_lazy_json = serde_json::to_value(&machine_context_lazy_schema)?;
    let mut value_lazy_json = serde_json::to_value(&value_lazy_schema)?;
    let mut env_lazy_json = serde_json::to_value(&env_lazy_schema)?;

    // Apply fixes to each schema and their $defs
    fix_schema_and_defs(&mut script_context_json)?;
    fix_schema_and_defs(&mut machine_context_json)?;
    fix_schema_and_defs(&mut machine_state_json)?;
    fix_schema_and_defs(&mut budget_json)?;
    fix_schema_and_defs(&mut term_json)?;
    fix_schema_and_defs(&mut value_json)?;
    fix_schema_and_defs(&mut execution_status_json)?;
    fix_schema_and_defs(&mut machine_state_lazy_json)?;
    fix_schema_and_defs(&mut machine_context_lazy_json)?;
    fix_schema_and_defs(&mut value_lazy_json)?;
    fix_schema_and_defs(&mut env_lazy_json)?;

    // Create combined schema with all root types (using fixed JSON values)
    let combined = serde_json::json!({
        "title": "DE-UPLC Public API Root Schemas",
        "description": "Root JSON Schemas for types returned from DebuggerEngine and SessionController public API",
        "version": "1.0.0",
        "note": "These are the root schemas - all dependent types are automatically included in their definitions",
        "schemas": {
            "SerializableScriptContext": script_context_json,
            "SerializableMachineContext": machine_context_json,
            "SerializableMachineState": machine_state_json,
            "SerializableBudget": budget_json,
            "SerializableTerm": term_json,
            "SerializableValue": value_json,
            "SerializableExecutionStatus": execution_status_json,
            "SerializableMachineStateLazy": machine_state_lazy_json,
            "SerializableMachineContextLazy": machine_context_lazy_json,
            "SerializableValueLazy": value_lazy_json,
            "SerializableEnvLazy": env_lazy_json
        }
    });

    fs::write("schemas/combined_schema.json", serde_json::to_string_pretty(&combined)?)?;

    println!("Generated root JSON schemas successfully!");
    println!("Root schemas from public API:");
    println!("  - SerializableScriptContext (from get_tx_script_context)");
    println!("  - SerializableMachineContext (from get_machine_context)");
    println!("  - SerializableMachineState (from get_machine_state)");
    println!("  - SerializableBudget (from get_budget)");
    println!("  - SerializableTerm (from get_script)");
    println!("  - SerializableValue (from get_current_env)");
    println!("  - SerializableExecutionStatus (from step)");
    println!("  - SerializableMachineStateLazy (from get_machine_state_lazy)");
    println!("  - SerializableMachineContextLazy (from get_machine_context_lazy)");
    println!("  - SerializableValueLazy (from get_current_env_lazy)");
    println!("  - SerializableEnvLazy (from get_current_env_lazy)");
    println!("  Total: 11 root schemas + 1 combined");
    println!();
    println!("Note: All dependent types are automatically included in the schema definitions.");

    Ok(())
} 