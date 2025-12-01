# DE-UPLC — Debugger for UPLC (Untyped Plutus Core)

<p align="center">
  <img src="resources/icon.png" alt="DE-UPLC Logo" width="128" height="128">
</p>

**DE-UPLC** is a Visual Studio Code extension that provides a powerful debugging environment for UPLC (Untyped Plutus Core) — the low-level smart contract language used in the Cardano blockchain.

## Features

- 🔍 **Step-by-step debugging** — Execute UPLC scripts one step at a time
- 🎯 **Breakpoints** — Set breakpoints on specific terms to pause execution
- 📊 **Machine State Inspection** — View the CEK machine state including stack, environments, and values
- 💰 **Budget Tracking** — Monitor execution units and memory consumption in real-time
- 📝 **Script Context Viewer** — Inspect the full transaction context (ScriptContext)
- 🌐 **Data Providers** — Fetch UTXOs and protocol parameters from Koios API or local files

> 📚 **New to UPLC?** Read [UPLC and the CEK Machine](UPLC_AND_CEK.md) for a detailed explanation of the language and execution model.

## Installation

### From VSIX File (Recommended)

1. Download the latest `.vsix` file from the [Releases](https://github.com/cardananium/de-uplc/releases) page
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette
4. Type "Install from VSIX" and select **Extensions: Install from VSIX...**
5. Navigate to the downloaded `.vsix` file and select it
6. Reload VS Code when prompted

Alternatively, install via terminal:

```bash
code --install-extension de-uplc-0.0.1.vsix
```

### From Source

See [Building from Source](#building-from-source) section below.

## Quick Start

### 1. Prepare Your Transaction

The extension supports two input formats:

**Format A: Plain CBOR Hex**

Simply create a file containing the raw transaction CBOR hex string:

```
84a400d9010281825820abc123...
```

Supported extensions: `.tx`, `.cbor`, `.txt`, `.bin`

> When using plain hex, the extension will automatically fetch required UTXOs and protocol parameters from configured data providers (Koios API or offline file).

**Format B: JSON with Full Context**

Create a JSON file with the transaction and all required context data:

```json
{
  "transaction": "84a400d9010281825820abc123...",
  "network": "mainnet",
  "utxos": [
    {
      "txHash": "abc123...",
      "outputIndex": 0,
      "address": "addr1...",
      "value": {
        "lovelace": "1000000",
        "assets": {
          "policyId.assetName": "100"
        }
      },
      "datumHash": null,
      "inlineDatum": "d8799f...",
      "referenceScript": {
        "type": "PlutusV2",
        "script": "59052d01..."
      }
    }
  ],
  "protocolParams": {
    "costModels": { "PlutusV1": [...], "PlutusV2": [...], "PlutusV3": [...] },
    "maxTxExMem": "14000000",
    "maxTxExSteps": "10000000000",
    "protocolVersion": { "major": 10, "minor": 0 }
  }
}
```

> This format is useful when you want to debug offline or with custom UTXOs/parameters.

📁 **Examples & Type Definitions:**
- Full context example: [`test-tx.json`](test-tx.json)
- Type definitions: [`src/common.ts`](src/common.ts) — see `DebuggerContext`, `UtxoOutput`, `ProtocolParameters`

### 2. Configure Data Providers (Optional)

If you're using **Format A** (plain hex), configure how the extension fetches missing UTXOs and protocol parameters:

**Option 1: Koios API (Default)**

The extension will automatically fetch data from Koios. Optionally configure:
1. Go to **Settings** → search for "DE-UPLC"
2. Set `deuplc.providers.koios.apiKey` if you have one

**Option 2: Offline File**

1. Go to **Settings** → search for "DE-UPLC"
2. Enable `deuplc.providers.offline.enabled`
3. Set `deuplc.providers.offline.filePath` to your JSON file with UTXOs and protocol params

📁 **Example:** [`test-file-provider.json`](test-file-provider.json) — offline data provider file with UTXOs and protocol parameters

### 3. Start Debugging

1. Open the **UPLC Debugger** sidebar (click the debugger icon in the Activity Bar)
2. Click **"Open Transaction"** button in the **Transaction** panel to load your file
3. Select a redeemer from the dropdown (e.g., `spend#0`, `mint#1`)
4. Click the **Start** button (▶️)

## User Interface

### Sidebar Panels

The extension adds a dedicated sidebar with the following panels:

| Panel | Description |
|-------|-------------|
| **Main Controls** | Debugger controls (Start, Pause, Step, Stop, Refresh) and script information |
| **Transaction** | **Open Transaction** button to load a transaction file |
| **Machine Context** | View the continuation stack — frames representing pending operations |
| **Machine State** | Inspect current term being evaluated or value being returned |
| **Environments** | Browse variable bindings and closures |
| **Logs** | View trace output from the script |
| **Breakpoints** | Manage your breakpoints |

### Debugger Controls

| Button | Action | Description |
|--------|--------|-------------|
| ▶️ | **Start/Continue** | Start debugging or continue execution |
| ⏸️ | **Pause** | Pause execution (when running) |
| ⏭️ | **Step** | Execute single step |
| 🔄 | **Refresh** | Reset debugging session to beginning |
| ⏹️ | **Stop** | Stop debugging session |

### Budget Display

When debugging is active, you'll see real-time budget tracking:

- **Ex units**: Execution units spent / available
- **Memory units**: Memory units spent / available

Budget values turn red when limits are exceeded.

## Working with Scripts

### Viewing the Script

1. Select a redeemer from the dropdown
2. Click **"Show script"** to open the decompiled UPLC in a new tab
3. The script viewer shows the hierarchical term structure

### Setting Breakpoints

1. Open the script viewer (click "Show script")
2. Click on the line number gutter, or:
   - Right-click → **Toggle Term Breakpoint**
   - Press **F9** on a line with a term
3. Breakpoints appear in the **Breakpoints** panel

### Viewing Script Context

Click **"Show context"** to view the full `ScriptContext` including:

- Transaction inputs/outputs
- Minting policies
- Certificates
- Withdrawals
- Signatories
- Validity range
- And more...

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `F9` | Toggle breakpoint (in script viewer) |
| `Ctrl+Alt+H` | Toggle inlay hints |

## Configuration

Access settings via **File** → **Preferences** → **Settings** → search "DE-UPLC"

| Setting | Default | Description |
|---------|---------|-------------|
| `deuplc.enableInlayHints` | `true` | Show inlay hints in the term viewer |
| `deuplc.providers.koios.apiKey` | `""` | Optional Koios API key |
| `deuplc.providers.timeout` | `30000` | HTTP timeout in milliseconds |
| `deuplc.providers.retryAttempts` | `3` | Number of retry attempts for network errors |
| `deuplc.providers.offline.enabled` | `true` | Enable offline/file-based data provider |
| `deuplc.providers.offline.filePath` | `""` | Path to JSON file with UTXOs and protocol params |

## Building from Source

### Prerequisites

- **Node.js** 18+
- **Rust** + wasm32-unknown-unknown target
- **wasm-pack** (`cargo install wasm-pack`)

### Build Steps

```bash
# Clone the repository
git clone https://github.com/cardananium/de-uplc.git
cd de-uplc

# Install dependencies
npm ci

# Generate schemas and types
npm run generate-all

# Build WASM module
cd rust-src
./build-quick.sh
cd ..

# Build extension
npm run package

# Create .vsix package
npx vsce package
```

Or use the automated build script:

```bash
./build-extension.sh
```

## Troubleshooting

### WASM Build Errors

```bash
# Install wasm-pack
cargo install wasm-pack

# Add Rust WASM target
rustup target add wasm32-unknown-unknown
```

### Extension Not Loading

1. Check the VS Code Developer Console (`Help` → `Toggle Developer Tools`)
2. Look for `[DE-UPLC]` messages in the console

### Data Provider Issues

- Verify your JSON file path is correct
- Check that the JSON structure matches the expected format
- For Koios, ensure network connectivity

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

See the [LICENSE](LICENSE) file for details.

## Links

- **Repository**: [https://github.com/cardananium/de-uplc](https://github.com/cardananium/de-uplc)
- **Issues**: [https://github.com/cardananium/de-uplc/issues](https://github.com/cardananium/de-uplc/issues)
