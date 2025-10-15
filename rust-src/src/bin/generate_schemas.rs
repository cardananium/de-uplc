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

use schemars::schema_for;
use serde_json;
use std::fs;

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

    // Create combined schema with all root types
    let combined = serde_json::json!({
        "title": "DE-UPLC Public API Root Schemas",
        "description": "Root JSON Schemas for types returned from DebuggerEngine and SessionController public API",
        "version": "1.0.0",
        "note": "These are the root schemas - all dependent types are automatically included in their definitions",
        "schemas": {
            "SerializableScriptContext": script_context_schema,
            "SerializableMachineContext": machine_context_schema,
            "SerializableMachineState": machine_state_schema,
            "SerializableBudget": budget_schema,
            "SerializableTerm": term_schema,
            "SerializableValue": value_schema,
            "SerializableExecutionStatus": execution_status_schema
        }
    });

    fs::write("schemas/combined_schema.json", serde_json::to_string_pretty(&combined)?)?;

    println!("Generated root JSON schemas successfully!");
    println!("Root schemas from public API:");
    println!("  - SerializableScriptContext (from get_tx_script_context)");
    println!("  - SerializableContext (from get_machine_context)");
    println!("  - SerializableMachineState (from get_machine_state)");
    println!("  - SerializableBudget (from get_budget)");
    println!("  - SerializableTerm (from get_script)");
    println!("  - SerializableValue (from get_current_env)");
    println!("  - SerializableExecutionStatus (from step)");
    println!("  Total: 7 root schemas + 1 combined");
    println!();
    println!("Note: All dependent types are automatically included in the schema definitions.");

    Ok(())
} 