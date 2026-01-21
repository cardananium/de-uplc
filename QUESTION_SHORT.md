# Quick Question: WASM Build with `blst`

Hi! I've implemented a custom Koios URL feature (TypeScript changes complete ✅), but I'm blocked on building the VSIX because `blst` doesn't compile to WASM.

**Issue:** `wasm-pack build` fails because `blst` (transitively pulled in via `uplc`) doesn't support `wasm32-unknown-unknown`.

**Question:** How do you successfully build the WASM module? Is there:
- A feature flag to disable `blst` for WASM?
- A workaround or alternative build process?
- A pre-built WASM module I should use?

**Environment:** Rust 1.92.0, wasm-pack installed, macOS aarch64

The TypeScript changes are ready - just need to build the VSIX to test! Any guidance appreciated 🙏
