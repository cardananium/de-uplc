# DE-UPLC Debugger - Test Report

## Test Information
- **Version:** 0.0.1
- **GH Revision:** dde78f1
- **Environment:** VS Code, MacOS 15.6

---

## Status Legend

| Status | Description |
|--------|-------------|
| ✅ Passed | Test passed successfully |
| ❌ Failed | Test failed |
| 🔧 Fixed | Bug was fixed |
| ⏭️ Skipped | Test skipped |
| ⚠️ Blocked | Test blocked by another bug |

---

## 1. Transaction Loading

### TC-1.1: Open transaction from hex file
| Field | Value |
|-------|-------|
| **Description** | Open transaction in plain hex format |
| **Preconditions** | Extension installed, data provider configured |
| **Steps** | 1. Click "Open transaction" button  in DE-UPLC panel<br>2. Select hex transaction file |
| **Expected Result** | Transaction loaded, redeemer list displayed in panel |
| **Status** | ✅ |

### TC-1.2: Open transaction from JSON with full context
| Field | Value |
|-------|-------|
| **Description** | Open transaction in JSON format with UTXOs and protocol params |
| **Preconditions** | Extension installed |
| **Steps** | 1. Click "Open transaction" button  in DE-UPLC panel<br>2. Select JSON file with transaction, utxos, protocolParams |
| **Expected Result** | Transaction loaded without external provider calls |
| **Status** | ✅ |

### TC-1.3: Open invalid file
| Field | Value |
|-------|-------|
| **Description** | Attempt to open invalid file |
| **Preconditions** | Extension installed |
| **Steps** | 1. Click "Open transaction" button  in DE-UPLC panel<br>2. Select file with invalid data |
| **Expected Result** | Clear error message displayed |
| **Status** | ✅ |

### TC-1.4: Select redeemer from list
| Field | Value |
|-------|-------|
| **Description** | Select redeemer from dropdown list |
| **Preconditions** | Transaction loaded |
| **Steps** | 1. Open redeemer dropdown list<br>2. Select redeemer |
| **Expected Result** | Script displayed in new tab, script info (hash, version) updated |
| **Status** | ✅ |

### TC-1.5: "Show script" button
| Field | Value |
|-------|-------|
| **Description** | Open script via Show script button |
| **Preconditions** | Redeemer selected |
| **Steps** | 1. Click "Show script" button |
| **Expected Result** | Script opens in new tab |
| **Status** | ✅ |

---

## 2. Debug Session Control

### TC-2.1: Start debugging
| Field | Value |
|-------|-------|
| **Description** | Start debug session |
| **Preconditions** | Redeemer selected |
| **Steps** | 1. Click Start button (▶️) |
| **Expected Result** | Icon changes to Pause, script opens in tab, execution begins |
| **Status** | ✅ |

### TC-2.2: Pause debugging
| Field | Value |
|-------|-------|
| **Description** | Pause script execution |
| **Preconditions** | Debug session running |
| **Steps** | 1. Click Pause button (⏸️) |
| **Expected Result** | Icon changes to Continue, current term highlighted in script, Machine State/Context/Environment panels populated, Budget displayed |
| **Status** | ✅ |

### TC-2.3: Continue debugging
| Field | Value |
|-------|-------|
| **Description** | Continue execution after pause |
| **Preconditions** | Session paused |
| **Steps** | 1. Click Continue button (▶️) |
| **Expected Result** | Icon changes to Pause, execution continues, Budget shows "—" |
| **Status** | ✅ |

### TC-2.4: Step debugging
| Field | Value |
|-------|-------|
| **Description** | Execute one CEK machine step |
| **Preconditions** | Session paused |
| **Steps** | 1. Click Step button (⏭️) |
| **Expected Result** | One step executed, highlight moves to next term, Machine State/Context/Environment/Budget updated |
| **Status** | ✅ |

### TC-2.5: Stop debugging
| Field | Value |
|-------|-------|
| **Description** | Complete stop of debug session |
| **Preconditions** | Session running or paused |
| **Steps** | 1. Click Stop button (⏹️) |
| **Expected Result** | Icon changes to Start, Machine State/Context/Environment/Logs panels cleared, highlight removed, Budget hidden |
| **Status** | ✅ |

### TC-2.6: Reset session (Refresh)
| Field | Value |
|-------|-------|
| **Description** | Restart current debug session from beginning |
| **Preconditions** | Session running or paused |
| **Steps** | 1. Click Refresh button (🔄) |
| **Expected Result** | Session restarts from beginning, execution begins anew |
| **Status** | ✅ |

---

## 3. Breakpoints

### TC-3.1: Set breakpoint via click
| Field | Value |
|-------|-------|
| **Description** | Set breakpoint by clicking on gutter |
| **Preconditions** | Script open in tab |
| **Steps** | 1. Click on gutter (left margin) next to term |
| **Expected Result** | Red breakpoint dot appears, breakpoint added to Breakpoints panel |
| **Status** | ✅ |

### TC-3.2: Set breakpoint via F9
| Field | Value |
|-------|-------|
| **Description** | Set breakpoint using hotkey |
| **Preconditions** | Script open, cursor on line with term |
| **Steps** | 1. Press F9 |
| **Expected Result** | Breakpoint toggled on/off |
| **Status** | ✅ |

### TC-3.3: Stop at breakpoint
| Field | Value |
|-------|-------|
| **Description** | Automatic stop when breakpoint reached |
| **Preconditions** | Breakpoint set, session in running mode |
| **Steps** | 1. Start debugging<br>2. Wait for breakpoint to be reached |
| **Expected Result** | Execution stops at breakpoint, term highlighted |
| **Status** | ✅ |

### TC-3.4: Remove breakpoint
| Field | Value |
|-------|-------|
| **Description** | Remove breakpoint |
| **Preconditions** | Breakpoint set |
| **Steps** | 1. Click on existing breakpoint (red dot) |
| **Expected Result** | Breakpoint removed from script and Breakpoints panel |
| **Status** | ✅ |

### TC-3.5: Breakpoints panel - list display
| Field | Value |
|-------|-------|
| **Description** | Check breakpoints display in panel |
| **Preconditions** | Multiple breakpoints set |
| **Steps** | 1. Open Breakpoints panel |
| **Expected Result** | All breakpoints displayed in list with term information |
| **Status** | ✅ |

---

## 4. Debug Data Display

### TC-4.1: Machine State - display
| Field | Value |
|-------|-------|
| **Description** | Display current CEK machine state |
| **Preconditions** | Session paused |
| **Steps** | 1. Expand Machine State tree |
| **Expected Result** | State type (Compute/Return) and contents displayed |
| **Status** | ✅ |

### TC-4.2: Machine Context - frame stack display
| Field | Value |
|-------|-------|
| **Description** | Display CEK machine context stack |
| **Preconditions** | Session paused |
| **Steps** | 1. Expand Machine Context tree |
| **Expected Result** | Frame stack with types and contents displayed |
| **Status** | ✅ |

### TC-4.3: Environment
| Field | Value |
|-------|-------|
| **Description** | Display current environment |
| **Preconditions** | Session paused |
| **Steps** | 1. Expand Environment tree |
| **Expected Result** | Environments  values displayed |
| **Status** | ✅ |

### TC-4.4: Logs - trace message display
| Field | Value |
|-------|-------|
| **Description** | Display trace call logs |
| **Preconditions** | Script contains trace calls |
| **Steps** | 1. Execute script until trace<br>2. Check Logs panel |
| **Expected Result** | Trace messages displayed in Logs list |
| **Status** | ✅ |

### TC-4.5: Budget - resource consumption display
| Field | Value |
|-------|-------|
| **Description** | Display resource consumption |
| **Preconditions** | Session paused |
| **Steps** | 1. Check Budget section in panel |
| **Expected Result** | CPU Spent/Available, Memory Spent/Available displayed |
| **Status** | ✅ |

### TC-4.6: Open node in separate tab
| Field | Value |
|-------|-------|
| **Description** | Open tree node in separate tab for detailed view |
| **Preconditions** | Session paused, data tree displayed |
| **Steps** | 1. Right-click on node<br>2. Select "Show in Tab" |
| **Expected Result** | Node opens in new tab with JSON data |
| **Status** | ✅ |

---

## 5. Script Context

### TC-5.1: Show Context button
| Field | Value |
|-------|-------|
| **Description** | View transaction script context |
| **Preconditions** | Redeemer selected |
| **Steps** | 1. Click "Show context" button |
| **Expected Result** | Script Context opens in new tab |
| **Status** | ✅ |

### TC-5.2: Script Context contents
| Field | Value |
|-------|-------|
| **Description** | Check Script Context completeness |
| **Preconditions** | Script Context open |
| **Steps** | 1. Check for main sections |
| **Expected Result** | tx_info (inputs, outputs, mint, etc.) displayed |
| **Status** | ✅ |

---

## 6. Execution Completion

### TC-6.1: Successful script completion
| Field | Value |
|-------|-------|
| **Description** | Script completes successfully |
| **Preconditions** | Session started |
| **Steps** | 1. Execute script to end (Continue without breakpoints) |
| **Expected Result** | Modal "Script execution finished" with "Open Result" button displayed, panels cleared |
| **Status** | ✅ |

### TC-6.2: Open execution result
| Field | Value |
|-------|-------|
| **Description** | View result after successful completion |
| **Preconditions** | Script completed successfully |
| **Steps** | 1. Click "Open Result" in modal |
| **Expected Result** | Result opens in new tab |
| **Status** | ✅ |

### TC-6.3: Script execution error
| Field | Value |
|-------|-------|
| **Description** | Script terminates with error |
| **Preconditions** | Session started, script contains error |
| **Steps** | 1. Execute script until error |
| **Expected Result** | Error message displayed, panels cleared |
| **Status** | ✅ |

### TC-6.4: Panel cleanup after completion
| Field | Value |
|-------|-------|
| **Description** | Panels cleared after completion (success or error) |
| **Preconditions** | Session finished |
| **Steps** | 1. Check Machine State/Context/Environment/Logs panels |
| **Expected Result** | All panels empty, Budget hidden |
| **Status** | ✅ |

---

## 7. Button State UI

### TC-7.1: Button state before redeemer selection
| Field | Value |
|-------|-------|
| **Description** | Check button availability when redeemer not selected |
| **Preconditions** | Transaction not loaded or redeemer not selected |
| **Steps** | 1. Check control button states |
| **Expected Result** | All control buttons disabled |
| **Status** | ✅ |

### TC-7.2: Button state in "stopped" mode
| Field | Value |
|-------|-------|
| **Description** | Check button availability after redeemer selection |
| **Preconditions** | Redeemer selected, session not started |
| **Steps** | 1. Check button states |
| **Expected Result** | Start enabled, Step/Stop/Refresh disabled |
| **Status** | ✅ |

### TC-7.3: Button state in "running" mode
| Field | Value |
|-------|-------|
| **Description** | Check button availability during execution |
| **Preconditions** | Session running |
| **Steps** | 1. Check button states |
| **Expected Result** | Pause/Stop/Refresh enabled, Step disabled |
| **Status** | ✅ |

### TC-7.4: Button state in "pause" mode
| Field | Value |
|-------|-------|
| **Description** | Check button availability when paused |
| **Preconditions** | Session paused |
| **Steps** | 1. Check button states |
| **Expected Result** | All buttons enabled (Continue/Step/Stop/Refresh) |
| **Status** | ✅ |

---

## 8. Inlay Hints

### TC-8.1: Enable Inlay Hints
| Field | Value |
|-------|-------|
| **Description** | Check inlay hints in script |
| **Preconditions** | Setting `deuplc.enableInlayHints` = true |
| **Steps** | 1. Open script<br>2. Check for hints |
| **Expected Result** | Inline hints displayed for terms |
| **Status** | ✅ |

### TC-8.2: Disable Inlay Hints
| Field | Value |
|-------|-------|
| **Description** | Check inlay hints disabled |
| **Preconditions** | Script open |
| **Steps** | 1. In settings set `deuplc.enableInlayHints` = false<br>2. Check script |
| **Expected Result** | Hints not displayed |
| **Status** | ✅ |

### TC-8.3: Toggle Inlay Hints (Ctrl+Alt+H)
| Field | Value |
|-------|-------|
| **Description** | Toggle inlay hints with hotkey |
| **Preconditions** | Script open |
| **Steps** | 1. Press Ctrl+Alt+H |
| **Expected Result** | Hints toggle on/off |
| **Status** | ✅ |

---

## 9. Data Provider Settings

### TC-9.1: Load via Koios API (default)
| Field | Value |
|-------|-------|
| **Description** | Load UTXOs and protocol params via Koios |
| **Preconditions** | Internet available, default settings |
| **Steps** | 1. Click "Open transaction" button <br>2. Select hex transaction file |
| **Expected Result** | UTXOs and protocol params loaded automatically |
| **Status** | ✅ |

### TC-9.2: Koios API with key
| Field | Value |
|-------|-------|
| **Description** | Use Koios API with API key |
| **Preconditions** | Have Koios API key |
| **Steps** | 1. In settings set `deuplc.providers.koios.apiKey`<br>2. Click "Open transaction" button  and select hex file |
| **Expected Result** | Requests made using API key |
| **Status** | ✅ |

### TC-9.3: Provider timeout
| Field | Value |
|-------|-------|
| **Description** | Check timeout setting |
| **Preconditions** | Slow or unstable network |
| **Steps** | 1. In settings set `deuplc.providers.timeout` = 5000<br>2. Click "Open transaction" button  and select hex file |
| **Expected Result** | Error displayed on timeout |
| **Status** | ✅ |

### TC-9.4: Retry attempts
| Field | Value |
|-------|-------|
| **Description** | Check retry attempts on network error |
| **Preconditions** | Unstable network |
| **Steps** | 1. In settings set `deuplc.providers.retryAttempts` = 3<br>2. Click "Open transaction" button  and select hex file with unstable network |
| **Expected Result** | Retries performed on error |
| **Status** | ✅ |

### TC-9.5: Offline provider - enable
| Field | Value |
|-------|-------|
| **Description** | Enable offline provider |
| **Preconditions** | Have JSON file with UTXOs and protocol params |
| **Steps** | 1. In settings set `deuplc.providers.offline.enabled` = true<br>2. In settings set `deuplc.providers.offline.filePath` to JSON file<br>3. Click "Open transaction" button  and select hex file |
| **Expected Result** | Data loaded from local file |
| **Status** | ✅ |

### TC-9.6: Offline provider - invalid path
| Field | Value |
|-------|-------|
| **Description** | Specify non-existent file for offline provider |
| **Preconditions** | Offline provider enabled |
| **Steps** | 1. In settings set `deuplc.providers.offline.filePath` to non-existent file<br>2. Click "Open transaction" button  and select hex file |
| **Expected Result** | Clear error about unable to read file |
| **Status** | ✅ |

### TC-9.7: Offline provider - invalid JSON
| Field | Value |
|-------|-------|
| **Description** | Specify file with invalid JSON |
| **Preconditions** | Offline provider enabled |
| **Steps** | 1. In settings specify file with invalid JSON<br>2. Click "Open transaction" button  and select hex file |
| **Expected Result** | Parse error displayed |
| **Status** | ✅ |

---

## 10. Edge Cases

### TC-10.1: Change redeemer during debugging
| Field | Value |
|-------|-------|
| **Description** | Change redeemer when session active |
| **Preconditions** | Session running or paused |
| **Steps** | 1. Select different redeemer from list |
| **Expected Result** | Current session stops, new script loads, breakpoints cleared |
| **Status** | ✅ |

### TC-10.2: Open new transaction during debugging
| Field | Value |
|-------|-------|
| **Description** | Open new transaction when session active |
| **Preconditions** | Session running or paused |
| **Steps** | 1. Click "Open transaction" button  and select new file |
| **Expected Result** | Current session stops, all tabs close, new transaction loads |
| **Status** | ✅ |

### TC-10.3: Budget overspend
| Field | Value |
|-------|-------|
| **Description** | Display budget overspend |
| **Preconditions** | Script consumes more resources than available |
| **Steps** | 1. Execute script until budget exceeded |
| **Expected Result** | Budget rows highlighted in red |
| **Status** | ✅ |

### TC-10.4: Transaction without redeemers
| Field | Value |
|-------|-------|
| **Description** | Open transaction without Plutus scripts |
| **Preconditions** | Transaction contains no redeemers |
| **Steps** | 1. Click "Open transaction" button  and select such transaction |
| **Expected Result** | "No redeemers available" message displayed |
| **Status** | ✅ |

### TC-10.5: Close script tab during debugging
| Field | Value |
|-------|-------|
| **Description** | Close script tab when session active |
| **Preconditions** | Session paused, script open |
| **Steps** | 1. Close script tab |
| **Expected Result** | Session continues, can reopen script via "Show script" |
| **Status** | ✅ |

---

## Results Summary

| Category | Total | ✅ Passed | ❌ Failed | 🔧 Fixed | ⏭️ Skipped |
|----------|-------|-----------|-----------|----------|------------|
| 1. Transaction Loading | 5 | 5 | 0 | 0 | 0 |
| 2. Debug Session Control | 6 | 6 | 0 | 0 | 0 |
| 3. Breakpoints | 5 | 5 | 0 | 0 | 0 |
| 4. Debug Data Display | 6 | 6 | 0 | 0 | 0 |
| 5. Script Context | 2 | 2 | 0 | 0 | 0 |
| 6. Execution Completion | 4 | 4 | 0 | 0 | 0 |
| 7. Button State UI | 4 | 4 | 0 | 0 | 0 |
| 8. Inlay Hints | 3 | 3 | 0 | 0 | 0 |
| 9. Data Provider Settings | 7 | 7 | 0 | 0 | 0 |
| 10. Edge Cases | 5 | 5 | 0 | 0 | 0 |
| **TOTAL** | **47** | **47** | **0** | **0** | **0** |
