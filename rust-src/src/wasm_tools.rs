#[cfg(all(target_arch = "wasm32", not(target_os = "emscripten")))]
pub use wasm_bindgen::prelude::{wasm_bindgen, JsValue};

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
use std::fmt;

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
pub use noop_proc_macro::wasm_bindgen;

#[cfg(all(target_arch = "wasm32", not(target_os = "emscripten")))]
pub type JsError = JsValue;

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
#[derive(Debug, Clone)]
pub struct JsError {
    msg: String,
}

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
impl JsError {
    pub fn from_str(s: &str) -> Self {
        Self { msg: s.to_owned() }
    }

    // to match JsValue's API even though to_string() exists
    pub fn as_string(&self) -> Option<String> {
        Some(self.msg.clone())
    }
}

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
impl fmt::Display for JsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.msg)
    }
}

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
impl std::error::Error for JsError {}

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
#[derive(Debug, Clone)]
pub struct JsValue {
    value: String,
}

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
impl JsValue {
    pub fn from_str(s: &str) -> Self {
        Self { value: s.to_string() }
    }
    
    pub fn as_string(&self) -> Option<String> {
        Some(self.value.clone())
    }
    
    pub fn is_null(&self) -> bool {
        false
    }
    
    pub fn is_undefined(&self) -> bool {
        false
    }
}

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
impl From<&str> for JsValue {
    fn from(s: &str) -> Self {
        JsValue::from_str(s)
    }
}

#[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
impl From<String> for JsValue {
    fn from(s: String) -> Self {
        Self { value: s }
    }
}

pub fn is_wasm_target() -> bool {
    cfg!(all(target_arch = "wasm32", not(target_os = "emscripten")))
}

pub type WasmResult<T> = Result<T, JsError>;

#[macro_export]
macro_rules! wasm_only {
    ($($code:tt)*) => {
        #[cfg(all(target_arch = "wasm32", not(target_os = "emscripten")))]
        {
            $($code)*
        }
    };
}

#[macro_export]
macro_rules! non_wasm_only {
    ($($code:tt)*) => {
        #[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
        {
            $($code)*
        }
    };
}

#[macro_export]
macro_rules! js_error {
    ($msg:expr) => {
        #[cfg(all(target_arch = "wasm32", not(target_os = "emscripten")))]
        {
            $crate::wasm_tools::JsValue::from_str(&format!("{}", $msg))
        }
        #[cfg(not(all(target_arch = "wasm32", not(target_os = "emscripten"))))]
        {
            $crate::wasm_tools::JsError::from_str(&format!("{}", $msg))
        }
    };
}