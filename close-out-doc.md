# Close Out Report


### Name of project and Project URL on IdeaScale/Fund
- Project Name: DE-UPLC: Visual Studio Code Extension for Debugging and Visualizing Plutus Bytecode
- Link: https://projectcatalyst.io/funds/12/cardano-open-developers/de-uplc-visual-studio-code-extension-for-debugging-and-visualizing-plutus-bytecode

### Your Project Number
1200091

### Name of project manager
Evgenii Lisitskii

### Date project started
August 2024

### Date project completed
December 2025

### List of challenge KPIs and how the project addressed them

The proposal was submitted in the Project Catalyst Fund12, "Cardano Open: Developers" funding category, the category KPI have been stated as:
- Standardize, develop, support, or provide utilities for full stack solutions and integrated development environments
- Create new libraries, SDKs, publicly available APIs, toolchains and frameworks

Our proposal addressed these via:
- Providing a user-friendly VS-code extension for debugging UPLC in transaction context.

### List of project KPIs and how the project addressed them

Our project KPIs had been stated as:

- UI Design and Architecture
  - UI mockup and wireframes
  - Component diagram of the project
  - Document of technology limitations


- General UI Components
  - Interactive UI components for the debugger based on mockups from Milestone 1. (excluding UPLC visualization, which will be done in Milestone 3).
  - API definition for the debugger engine.
  - Navigation flow document.
  - Mock of the future debugger engine, based on the API definitions provided. (real implementation will be done in Milestone 4).


- UPLC Visualization UI Component
  - UI components for visualizing the structure of decoded UPLC.
  - Integration with the mocked debugger engine.


- Debugger Engine
  - Debugger engine codebase.
  - Integration of the debugger engine with Aiken-UPLC.
  - Communication layer between the debugger UI and the debugger engine.


- Visual Studio Code Integration 
  - Implementation of necessary extension points and APIs to integrate the DE-UPLC UI components and debugger engine into Visual Studio Code as extension.
  - Extension packaging and distribution scripts.
  - User settings and configurations for the extension.

- Testing and Documentation
  - Testing report of the DE-UPLC extension.
  - User documentation.
  - Public release on GitHub.
  - Final close-out report
  - Final closeout video


All KPIs have been addressed through our respective Proposal Milestone deliverables where we had a total of 6 Milestones which packaged all our work and execution. At the time of writing this report, all Milestones which focused on the development of DE-UPLC have been successfully delivered, reviewed and approved.

### Key achievements (in particular around collaboration and engagement)
Key achievements of this proposal can be summarized such as:

#### Successful development completion
( in addition to achieved KPIs at “List of project KPIs and how the project addressed them”)
Without the actual completion of the development, no other success criteria could have been achieved, hence the first and foremost key achievement is to have fully completed all development activities and the launch of the tool to the public


#### Successful Proposal execution
Besides the development, the completion of the respective catalyst proposal administration is key to allow us the final completion and report of the project. We are glad that all processes, from submission, to onboarding and to milestone reporting have been smooth and successful.


#### Grow Cardano’s Open Source Stack
With the completion of DE-UPLC, we add an additional open source tool to the Cardano ecosystem and are glad to see the cardano open source ecosystem growing by another helpful tool the community has asked for.

### Key learnings

#### Deeper understanding of VS Code extension API
Working on this project gave us a much clearer mental model of how the VS Code extension API is structured and how extensions actually run. We explored activation events, command registration, contribution points, and the lifecycle of an extension from activation to disposal. We also gained hands-on experience with workspace and window events, tree views, and webviews, which helped us design extensions that feel integrated and responsive instead of just “bolted on” to the editor.

#### Better understanding of CEK machine internals
We also deepened our understanding of the CEK abstract machine, especially how it evaluates terms step by step. We looked closely at how environments, stacks, and frames interact, how values are represented, and how control flows during function application, forcing, and error handling. This gave us a more concrete picture of what actually happens during evaluation, beyond high-level semantics.

#### Integration between Rust-WASM and JavaScript
We significantly improved our practical knowledge of how to wire Rust-compiled WebAssembly modules into JavaScript applications. In particular, we had to carefully manage memory and data representation across the boundary and design a small, well-structured interface so that both Rust and JavaScript can exchange data reliably. This work resulted in cleaner integration points, more predictable performance, and a better separation of concerns between the native and web layers.

### Next steps for the product or service developed
As for the next steps for DE-UPLC, we will use feedback from users to plan the further development of the extension and prioritize improvements to the debugging and visualization experience. In particular, we will explore adding a phase-1 validation feature, so that developers can run preliminary validation checks directly from the extension before submitting transactions. This will help catch issues earlier in the workflow and make DE-UPLC an even more useful day-to-day tool for Cardano developers.


### Final thoughts/comments

Because Catalyst can’t function without its voters, reviewers, and administrators, we want to extend a big thank you to everyone who helped turn this proposal into reality. Your support is truly appreciated.

### Links to other relevant project sources or documents.
- Github: https://github.com/cardananium/de-uplc
- Proposal Milestones on Catalyst: https://projectcatalyst.io/funds/12/cardano-open-developers/de-uplc-visual-studio-code-extension-for-debugging-and-visualizing-plutus-bytecode

### Link to Close-out video - must be either YouTube or Vimeo link only 

- https://youtu.be/GKgt79-W3Dg



