### VS Code

| Feature                      | Conclusion                                                                                         | Solution Method            |
|------------------------------|----------------------------------------------------------------------------------------------------|----------------------------|
| **Debugger Functions**       | Present, but not extensible for non-standard cases; not suitable for the current task              | Develop custom components  |
| **Custom Syntax Highlighting** | Present; suitable for most tasks                                                                 |                            |
| **API for Extensions**       | Present; suitable for the current task                                                             |                            |
| **Custom UI Components**     | Present; supports WebView, allowing the creation of custom components                              |                            |
| **Running WASM Code**        | Present                                                                                            |                            |

### Aiken

| Feature                                                                                          | Conclusion                                  | Solution Method                      |
|--------------------------------------------------------------------------------------------------|---------------------------------------------|---------------------------------------|
| **Debugger Functions**                                                                           | Absent                                      | Fork and add missing functions        |
| **Breakpoints**                                                                                  | Absent                                      | Fork and add missing functions        |
| **Step-by-Step Execution**                                                                       | Absent                                      | Fork and add missing functions        |
| **Encoding Terms in JSON**                                                                       | Absent                                      | Fork and add missing functions        |
| **Decoding Compiled Code**                                                                       | Present                                     |                                       |
| **Decoding text representation of UPLC**                                                         | Present                                     |                                       |
| **Functions important for future development (but not required for implementation in Fund 12):** |                                             |                                       |
| - **Source Maps for Textual UPLC**                                                               | Absent                                      | Fork and add missing functions        |
| - **Source Maps for Aiken Language**                                                             | Absent                                      | Fork and add missing functions        |
