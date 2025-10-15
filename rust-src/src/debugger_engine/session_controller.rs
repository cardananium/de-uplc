use std::collections::HashSet;

use crate::budget::SerializableBudget;
use crate::debugger_engine::{DebuggerError};
use crate::wasm_tools::JsError;
use crate::{SerializableEnv, SerializableExecutionStatus, SerializableMachineContext, SerializableMachineState, SerializableScriptContext, SerializableTerm};
use pallas_primitives::conway::Language;
use uplc::{
    ast::{NamedDeBruijn, Program, Term},
    machine::{
        cost_model::{CostModel, ExBudget},
        value::Value,
        MachineState,
    },
    manual_machine::ManualMachine,
    tx::script_context::ScriptContext,
};

use crate::wasm_tools::wasm_bindgen;

const DEFAULT_SLIPPAGE: u32 = 1;

#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct SessionController {
    redeemer: String,
    session_id: String,
    machine: Box<ManualMachine>,
    language: Language,
    real_budget: ExBudget,
    image_budget: ExBudget,
    script_hash: String,
    last_error: Option<String>,
    program_version: (usize, usize, usize),
    entry_term: Box<Term<NamedDeBruijn>>,
    context: ScriptContext,
    cost_model: CostModel,
    term_ids: HashSet<i32>,
    version: u64,
}

#[wasm_bindgen]
impl SessionController {
    pub(crate) fn new(
        script_hash: String,
        session_id: String,
        language: Language,
        program: Box<Program<NamedDeBruijn>>,
        script_context: ScriptContext,
        cost_model: CostModel,
        upper_bound_budget: ExBudget,
        real_budget: ExBudget,
        redeemer: String,
    ) -> Result<Self, JsError> {
        let program_version = program.version;
        let entry_term = Box::new(program.term);
        let machine = Box::new(ManualMachine::new(
            language.clone(),
            cost_model.clone(),
            upper_bound_budget.clone(),
            DEFAULT_SLIPPAGE,
            (*entry_term).clone(),
        )
        .map_err(|e| {
            DebuggerError::MachineError(format!("Failed to create manual machine: {:?}", e))
        })?);

        let mut term_ids = HashSet::new();
        collect_term_ids(&entry_term, &mut term_ids);

        Ok(SessionController {
            script_hash,
            session_id,
            machine,
            language,
            real_budget,
            image_budget: upper_bound_budget,
            last_error: None,
            program_version,
            redeemer,
            entry_term,
            context: script_context,
            cost_model,
            term_ids,
            version: 0,
        })
    }

    pub(crate) fn get_session_id(&self) -> &str {
        &self.session_id
    }

    pub fn get_tx_script_context(&self) -> Result<String, JsError> {
        let context = &self.context;
        let serializable_context: SerializableScriptContext = context
            .try_into()
            .map_err(|e| DebuggerError::MachineError(format!("Failed to convert script context to serializable: {:?}", e)))?;
        Ok(serde_json::to_string(&serializable_context)
            .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
    }

    pub(crate) fn get_tx_script_context_inner(&self) -> Result<SerializableScriptContext, JsError> {
        let context = &self.context;
        let serializable_context: SerializableScriptContext = context
            .try_into()
            .map_err(|e| DebuggerError::MachineError(format!("Failed to convert script context to serializable: {:?}", e)))?;
        Ok(serializable_context)
    }

    /// Gets the Plutus Core version
    pub fn get_plutus_core_version(&self) -> Result<String, JsError> {
        Ok(format!(
            "{}.{}.{}",
            self.program_version.0, self.program_version.1, self.program_version.2
        ))
    }

    /// Gets the Plutus language version
    pub fn get_plutus_language_version(&self) -> Result<Option<String>, JsError> {
        let version = match self.language {
            Language::PlutusV1 => "V1",
            Language::PlutusV2 => "V2",
            Language::PlutusV3 => "V3",
        };
        Ok(Some(version.to_string()))
    }

    pub fn get_script_hash(&self) -> Result<String, JsError> {
        Ok(self.script_hash.clone())
    }

    pub fn get_machine_context(&self) -> Result<String, JsError> {
        let contexts = self.get_machine_context_inner()?;
        Ok(serde_json::to_string(&contexts)
            .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
    }

    pub(crate) fn get_machine_context_inner(&self) -> Result<Vec<SerializableMachineContext>, JsError> {
        let contexts = self.machine.collect_nested_contexts();
        let serializable_contexts: Vec<_> = contexts
            .into_iter()
            .map(|ctx| SerializableMachineContext::from_uplc_context_with_ids(&ctx, &self.term_ids))
            .collect();
        Ok(serializable_contexts)
    }

    pub fn get_logs(&self) -> Result<String, JsError> {
        let traces = self.get_logs_inner()?;
        Ok(serde_json::to_string(&traces)
            .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
    }

    pub(crate) fn get_logs_inner(&self) -> Result<Vec<String>, JsError> {
        let traces = self.machine
            .traces
            .iter()
            .map(|trace| trace.to_string())
            .collect::<Vec<String>>();
        Ok(traces)
    }

    pub fn get_machine_state(&self) -> Result<String, JsError> {
        let state = self.get_machine_state_inner()?;
        Ok(serde_json::to_string(&state)
            .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
    }

    pub(crate) fn get_machine_state_inner(&self) -> Result<SerializableMachineState, JsError> {
        let state = self.machine.current_state();
        let serializable_state = SerializableMachineState::from_uplc_machine_state_with_ids(state, &self.term_ids);
        Ok(serializable_state)
    }

    pub fn get_budget(&self) -> Result<String, JsError> {
        let budget = self.get_budget_inner()?;
        Ok(serde_json::to_string(&budget)
            .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
    }
    
    pub(crate) fn get_budget_inner(&self) -> Result<SerializableBudget, JsError> {
        let spent_budget = self.machine.ex_budget;
        let real_budget = self.real_budget;
        let image_budget = self.image_budget.clone();
        let cpu_diff = image_budget.cpu - spent_budget.cpu;
        let mem_diff = image_budget.mem - spent_budget.mem;
        let budget = SerializableBudget {
            ex_units_spent: cpu_diff,
            ex_units_available: real_budget.cpu,
            memory_units_spent: mem_diff,
            memory_units_available: real_budget.mem,
        };
        Ok(budget)
    }

    pub fn get_script(&self) -> Result<String, JsError> {
        let script = self.get_script_inner()?;
        Ok(serde_json::to_string(&script)
            .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
    }

    pub(crate) fn get_script_inner(&self) -> Result<SerializableTerm, JsError> {
        let term = self.entry_term.as_ref();
        let serializable_term = SerializableTerm::from_uplc_term(term);
        Ok(serializable_term)
    }

    pub fn get_current_term_id(&self) -> Result<i32, JsError> {
        match self.machine.current_state() {
            MachineState::Compute(_, _, term) => match term {
                Term::Var { uniq_id, .. }
                | Term::Delay { uniq_id, .. }
                | Term::Lambda { uniq_id, .. }
                | Term::Apply { uniq_id, .. }
                | Term::Constant { uniq_id, .. }
                | Term::Force { uniq_id, .. }
                | Term::Error { uniq_id, .. }
                | Term::Builtin { uniq_id, .. }
                | Term::Constr { uniq_id, .. }
                | Term::Case { uniq_id, .. } => Ok(*uniq_id as i32),
            },
            _ => Ok(-1),
        }
    }

    pub(crate) fn get_current_env_inner(&self) -> Result<SerializableEnv, JsError> {
        match self.machine.current_state() {
            MachineState::Compute(_, env, _)
            | MachineState::Return(_, Value::Lambda { env, .. })
            | MachineState::Return(_, Value::Delay { env, .. }) => {
                let serializable_env: SerializableEnv = SerializableEnv::from_uplc_env_with_ids(env, &self.term_ids);
                Ok(serializable_env)
            }
            _ => Ok(SerializableEnv {
                values: vec![],
            }),
        }
    }

    pub fn get_redeemer(&self) -> Result<String, JsError> {
        Ok(self.redeemer.clone())
    }

    pub fn get_current_env(&self) -> Result<String, JsError> {
        let env = self.get_current_env_inner()?;
        Ok(serde_json::to_string(&env)
            .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
    }

    fn step_inner(&mut self) -> Result<SerializableExecutionStatus, JsError> {
        self.version += 1;
        let status: &uplc::manual_machine::ExecutionStatus = self.machine.step();
        let serializable_status: SerializableExecutionStatus = status.into();
        Ok(serializable_status)
    }

    pub fn step(&mut self) -> Result<String, JsError> {
        let status = self.step_inner()?;
        Ok(serde_json::to_string(&status)
            .map_err(|e| DebuggerError::MachineError(e.to_string()))?)
    }

    /// Resets the session program back to its initial state
    pub fn reset(&mut self) -> Result<(), JsError> {
        self.version += 1;
        
        // Create a new machine with the original entry term and initial budget
        let new_machine = ManualMachine::new(
            self.language.clone(),
            self.cost_model.clone(),
            self.image_budget.clone(),
            DEFAULT_SLIPPAGE,
            (*self.entry_term).clone(),
        )
        .map_err(|e| {
            DebuggerError::MachineError(format!("Failed to reset manual machine: {:?}", e))
        })?;

        // Replace the current machine with the new one
        self.machine = Box::new(new_machine);
        
        // Clear any last error
        self.last_error = None;

        Ok(())
    }

    pub fn get_last_error(&self) -> Option<String> {
        self.last_error.clone()
    }

    /// Gets the current version number of the session controller
    pub fn get_version(&self) -> u64 {
        self.version
    }
}


fn collect_term_ids(term: &Term<NamedDeBruijn>, term_ids: &mut HashSet<i32>) {
    // First, collect the current term's ID
    let uniq_id = match term {
        Term::Var { uniq_id, .. }
        | Term::Delay { uniq_id, .. }
        | Term::Lambda { uniq_id, .. }
        | Term::Apply { uniq_id, .. }
        | Term::Constant { uniq_id, .. }
        | Term::Force { uniq_id, .. }
        | Term::Error { uniq_id, .. }
        | Term::Builtin { uniq_id, .. }
        | Term::Constr { uniq_id, .. }
        | Term::Case { uniq_id, .. } => *uniq_id as i32,
    };
    
    term_ids.insert(uniq_id);
    
    // Then recursively collect IDs from nested terms
    match term {
        Term::Delay { body, .. } => {
            collect_term_ids(body, term_ids);
        }
        Term::Lambda { body, .. } => {
            collect_term_ids(body, term_ids);
        }
        Term::Apply { function, argument, .. } => {
            collect_term_ids(function, term_ids);
            collect_term_ids(argument, term_ids);
        }
        Term::Force { body, .. } => {
            collect_term_ids(body, term_ids);
        }
        Term::Constr { fields, .. } => {
            for field in fields {
                collect_term_ids(field, term_ids);
            }
        }
        Term::Case { constr, branches, .. } => {
            collect_term_ids(constr, term_ids);
            for branch in branches {
                collect_term_ids(branch, term_ids);
            }
        }
        // These variants don't contain nested terms
        Term::Var { .. }
        | Term::Constant { .. }
        | Term::Error { .. }
        | Term::Builtin { .. } => {
            // No nested terms to process
        }
    }
}