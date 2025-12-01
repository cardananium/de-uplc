# UPLC and the CEK Machine:

Untyped Plutus Core (UPLC) and the CEK machine form the “execution layer” for Plutus scripts on Cardano. If you think in terms of CPUs and machine code:

* **UPLC** is the *machine code / ISA* (a small functional IR).
* The **CEK machine** is the *CPU model* (an abstract stack machine that defines how UPLC runs).

---

## 1. What UPLC Is

UPLC is defined as:

> An eagerly evaluated version of the untyped lambda calculus, extended with built-in types and functions, intended as the execution language for on-chain validation scripts.

In plain terms:

* It’s **untyped** at this level (type checking is done earlier).
* It’s **strict** (arguments are evaluated before being passed).
* It’s **purely functional** — there are no primitives for mutation or side effects.
* It has a **small core**: variables, lambdas, application, delay/force, constructors, case, constants, builtins, and `error`.

### 1.1 Programs and terms

A UPLC program has the form:

```lisp
(program v M)
```

* `v` — language version (e.g. `1.1.0`).
* `M` — the main term to evaluate.

The core grammar for terms (simplified) is:

```lisp
Term M ::= x                        ; variable
         | (con T c)                ; constant of type T
         | (builtin b)              ; built-in function
         | (lam x M)                ; lambda abstraction
         | [M N]                    ; application
         | (delay M)                ; delay evaluation of M
         | (force M)                ; force a delayed term
         | (constr k M1 … Mm)       ; constructor with tag k and m args
         | (case M N1 … Nn)         ; case analysis with n branches
         | (error)                  ; error
```

Higher-level languages (Plutus Tx, Aiken, etc.) compile into this language.

### 1.2 Values

The spec defines **Plutus Core values** as those terms that cannot reduce further under the reduction rules. They include:

* Constants: `(con T c)`
* Lambdas: `(lam x M)`
* Delayed terms: `(delay M)`
* Data constructors: `(constr i V1 … Vn)` where all `Vi` are values
* Well-formed partial builtin applications.

These are what the CEK machine treats as “results” at intermediate steps.

---

## 2. Key UPLC Constructs (with CPU Analogies)

This section explains *why* the core constructs exist and gives a hardware-ish analogy.

### 2.1 Lambda and application

* `(lam x M)` — defines a function with one parameter `x`.
* `[M N]` — applies function term `M` to argument `N`.

Because UPLC is strict:

* `N` is evaluated to a value first.
* Then the λ body `M` is executed in an environment extended with `x ↦ value-of-N`.

**Analogy:**

* `lam` ≈ function definition in C.
* `[M N]` ≈ call instruction: evaluate arguments, then jump into the function body with a fresh activation record.

### 2.2 delay and force

* `(delay M)` — wraps `M` into a thunk; `M` is *not* evaluated yet.
* `(force M)` — expects `M` to evaluate to a delayed value and then executes its contents.

This provides **explicit laziness** in an otherwise strict language:

* You can defer expensive computations.
* You can build lazy structures.
* You have more control over when gas is spent (because only actual evaluation consumes cost).

**Analogy:**

* `delay` ≈ store a closure / continuation instead of calling it now.
* `force` ≈ indirect call through a stored “function pointer + environment”.

### 2.3 Constructors and case

* `(constr k V1 … Vn)` — build a tagged data value with tag `k`.
* `(case M N1 … Nn)` — compute `M`, inspect its tag, and jump into the corresponding branch `Nk+1`, passing fields as arguments.

**Analogy:**

* `constr` ≈ tagged union / variant (`enum` with payload).
* `case` ≈ `switch(tag)` + jump.

### 2.4 Builtins and constants

UPLC has:

* Built-in **types** like integers, bytestrings, booleans, `unit`, `data`, etc.
* Built-in **functions** for arithmetic, bytestring operations, hashing, signature verification, etc. These are evaluated by a separate `Eval` function that takes a list of values and returns either a value or an error.

**Analogy:**

* Builtins ≈ ALU + crypto instructions + some system-library calls.
* `(con T c)` ≈ immediates or constants encoded in instructions.

---

## 3. High-Level Reduction Semantics

The spec first defines evaluation via **contextual semantics**: a set of small-step reduction rules plus evaluation contexts.

Examples (schematically):

* Function application:

  ```text
  [(lam x M) V] → [V/x] M
  ```

* Forcing a delayed term:

  ```text
  force (delay M) → M
  ```

* Case on a constructor:

  ```text
  case (constr i V) N1 … Nn → [Ni+1 V]
  ```

Together with evaluation contexts (frames like `[_ M]`, `[V _]`, `(force _)`, etc.), this defines where and how terms can reduce.

For **implementation**, the spec then introduces the **CEK machine**, which is a more concrete description of evaluation.

---

## 4. The CEK Machine: State and Execution

The CEK machine is a **stack-based abstract machine** for executing UPLC efficiently. It’s a variant of the classical CEK machine (Control, Environment, Kontinuation), adapted for Plutus.

Conceptually, it alternates between:

* **Compute mode (⊳)** — walk down the AST, push frames that represent the surrounding context.
* **Return mode (⊲)** — bubble up a value, pop frames, and either apply functions, force thunks, run builtins, etc.

Plus two halting states: **error** and **final**.

### 4.1 Machine state: Σ

The state space is:

```text
State Σ ::= s; ρ ⊳ M    -- compute state
          | s ⊲ V       -- return state
          | ⬥          -- error
          | ◻ V        -- final (halt with value)
```

Where:

* `s` — **stack** of frames.
* `ρ` — **environment**, mapping variables to CEK values.
* `M` — UPLC term still being evaluated.
* `V` — CEK value.

#### CEK values

CEK uses a slightly richer notion of value:

```text
V ::= 〈con T c〉
    | 〈delay M ρ〉
    | 〈lam x M ρ〉
    | 〈constr i V*〉
    | 〈builtin b V* η〉
```

* Constants, delays, and lambdas capture the environment, forming closures.
* Constructors hold fully evaluated fields.
* Builtins carry collected arguments and an “arity/phase” marker `η`.

#### Environments

Environments are lists of bindings:

```text
ρ ::= [] | ρ[x ↦ V]
```

* Lookup (`ρ[x]`) finds the rightmost binding.
* Extending an environment creates a *new* environment (the old one remains unchanged).

Conceptually this is your **activation record / locals / closed-over variables**.

#### Stack frames

Frames represent “what to do with the next value”:

```text
f ::= (force _)                        -- for (force M)
    | [_ (M, ρ)]                       -- computing function of [M N]
    | [_ V]                            -- (variant used during builtin handling)
    | [V _]                            -- computing argument of [V N]
    | (constr i V* _ (M*, ρ))          -- accumulating constructor args
    | (case _ (M1 … Mn, ρ))            -- scrutinee for case
```

**Analogy:**

* `ρ` = environment ≈ activation record or “locals & captures”.
* `s` = stack ≈ call stack, but with expression-level continuations.
* Frames ≈ continuation chunks: “what remains to be done”.

---

## 5. Meaning of the CEK States

Let’s unpack each state form and what it’s for.

### 5.1 Compute state: `s; ρ ⊳ M`

> “Evaluate the term `M` under environment `ρ`, with `s` describing how to use the result.”

Here the machine:

* Pattern-matches on the shape of `M`.
* Possibly pushes a frame.
* Either recurses on a subterm (staying in compute) or switches to a return state when a value is reached.

Typical transitions (simplified):

* Variable:

  ```text
  s; ρ ⊳ x  ↦  s ⊲ ρ[x]
  ```

* Constant:

  ```text
  s; ρ ⊳ (con T c)  ↦  s ⊲ 〈con T c〉
  ```

* Lambda:

  ```text
  s; ρ ⊳ (lam x M)  ↦  s ⊲ 〈lam x M ρ〉
  ```

* Delay:

  ```text
  s; ρ ⊳ (delay M)  ↦  s ⊲ 〈delay M ρ〉
  ```

* Force:

  ```text
  s; ρ ⊳ (force M)  ↦  (force _)·s; ρ ⊳ M
  ```

* Application:

  ```text
  s; ρ ⊳ [M N]  ↦  [_ (N, ρ)]·s; ρ ⊳ M
  ```

* Case:

  ```text
  s; ρ ⊳ (case N Ms)  ↦  (case _ (Ms, ρ))·s; ρ ⊳ N
  ```

* Error:

  ```text
  s; ρ ⊳ (error)  ↦  ⬥
  ```

**Analogy:**

* This is like the CPU executing the current instruction / expression:

  * decode,
  * possibly push to the stack,
  * jump into a sub-expression.

### 5.2 Return state: `s ⊲ V`

> “We’ve just finished evaluating a subterm and obtained `V`. The top frame on `s` tells us how to continue.”

The machine now:

* Looks at the top frame,
* Pops it,
* Uses it to decide the next state.

Some key cases:

#### Empty stack (halt)

```text
[] ⊲ V  ↦  ◻ V
```

Execution finishes with result `V`.

#### Application frames (call)

From the compute step we had:

```text
s; ρ ⊳ [M N]  ↦  [_ (N, ρ)]·s; ρ ⊳ M
```

When `M` finishes:

```text
[_ (N, ρN)]·s ⊲ V_fun
  ↦  [V_fun _]·s; ρN ⊳ N
```

Then, when `N` finishes and `V_fun` is a lambda closure:

```text
[〈lam x M_body ρ_fun〉 _]·s ⊲ V_arg
  ↦  s; ρ_fun[x ↦ V_arg] ⊳ M_body
```

Here is where the **function call** actually happens: we extend the environment and start computing the body.

#### Force frames

For `(force M)`:

```text
s; ρ ⊳ (force M)  ↦  (force _)·s; ρ ⊳ M
```

When `M` evaluates to a delayed value:

```text
(force _)·s ⊲ 〈delay M' ρ'〉
  ↦  s; ρ' ⊳ M'
```

If the value is not a delay, the configuration becomes stuck and leads to error (no rule applies).

#### Constructor frames

During `(constr i M1 … Mn)`, we accumulate arguments via frames like:

```text
(constr i V* _ (Ms, ρ))
```

Each new argument value extends `V*`. When all arguments are collected:

```text
(constr i V* _ ([], ρ))·s ⊲ V_last
  ↦  s ⊲ 〈constr i (V* ⋅ V_last)〉
```

That constructor value then moves up the stack as `V`.

#### Case frames

For `(case N M1 … Mn)`:

```text
s; ρ ⊳ (case N Ms) ↦ (case _ (Ms, ρ))·s; ρ ⊳ N
```

When `N` evaluates to `〈constr i V1 … Vm〉`, the case frame chooses the branch `Mi+1` and arranges a call with fields as arguments (with some helper frames to pass `V1 … Vm`).

#### Builtin frames

Builtins are represented as:

```text
〈builtin b V* η〉
```

with:

* `b` — builtin identifier,
* `V*` — already-supplied arguments,
* `η` — what is still expected (e.g. more `force`s or more term arguments).

As arguments arrive through application:

```text
[〈builtin b V* (ι ⋅ η)〉 _]·s ⊲ V_arg
  ↦  s ⊲ 〈builtin b (V* ⋅ V_arg) η〉
```

When the builtin is fully saturated, an `Eval_CEK` function is called that returns either a CEK value or error.

### 5.3 Error state: `⬥`

> “The computation has failed in an unrecoverable way.”

The machine enters `⬥` when:

* It evaluates `(error)`.
* A builtin application fails (e.g., invalid operation).
* It reaches a configuration not covered by any rule (e.g. applying a non-function).

From `⬥` there are no transitions: this is a terminal state and corresponds to script failure.

### 5.4 Final state: `◻ V`

> “Evaluation succeeded; the result value is `V`.”

This is reached only when:

```text
[] ⊲ V  ↦  ◻ V
```

At this point:

* Execution stops.
* `V` is still a **CEK value** (may contain environments).

The spec defines a **discharging** step `U(V)` that converts a CEK value back into a pure UPLC term by recursively inserting the captured environments.

`◻ V` corresponds to a successful, pure result; `⬥` corresponds to `(error)`.

---

## 6. Immutability and Memory Behaviour 

Although the spec does **not** mandate a specific heap layout or GC, it implicitly describes a **pure, immutable** world:

### 6.1 Immutability of data and environments

At the UPLC / CEK level:

* There is **no assignment**, `set!`, reference cell, in-place update, or global mutable variable.
* All “values” (constants, lambdas, delays, constructors, builtin results) are **immutable**: once created, they never change.
* Environments `ρ` are **persistent**:

  * Extending an environment creates a *new* environment `ρ[x ↦ V]`.
  * The old environment remains valid and unchanged.
* Stack frames, once pushed, are also immutable structures; the machine only pushes and pops them, never “mutating” them in place.

All observable state change is represented by **changing the machine configuration** `(s, ρ, M/V)` step by step — not by mutating existing values.

**Analogy:**

* Think of values as living in a read-only heap.
* A CEK transition allocates new values/environments/frames, but never modifies existing ones.

### 6.2 Memory use and structural sharing (implementation perspective)

The spec works at a semantic level and does not define:

* heap layout,
* garbage collection,
* pointer representation.

However, a reasonable implementation will:

* Represent environments as linked structures (objects/lists pointing to a parent environment).
* Use **structural sharing**:

  * When you extend `ρ` to `ρ[x ↦ V]`, you keep the tail of `ρ` shared.
  * When you build larger data structures, they can re-use existing sub-structures.
* Treat closures (`〈lam x M ρ〉` and `〈delay M ρ〉`) as heap-allocated objects capturing a pointer to `ρ` rather than copying all bindings.

This is the standard implementation approach for pure λ-calculi and is entirely consistent with the CEK semantics.

### 6.3 Side effects and builtins

From the point of view of UPLC:

* Builtins are specified as **pure functions** from values to either a value or an error.
* They do not mutate global state or external memory.
* Any “context” (e.g. transaction info, datum, redeemer) is passed into the script as immutable `data` values.

So there is **no shared mutable state** between UPLC terms:

* No global variables.
* No hidden mutable memory.
* Only the evolving CEK state, which is conceptually just a series of **new** immutable states.

**Ledger-level perspective:**

* The ledger state (UTxO set, governance state, etc.) is treated as an immutable input to each script invocation.
* Scripts can only **validate** or **reject** a transaction; they doesn’t mutate ledger state directly — the ledger applies the transaction rules.


## 7. CPU-Style Summary

Here’s a compact mapping between UPLC/CEK concepts and conventional architecture ideas:

| UPLC / CEK                            | Rough CPU / runtime analogue                       |
| ------------------------------------- | -------------------------------------------------- |
| `(program v M)`                       | Binary / main entrypoint                           |
| UPLC term `M`                         | Instruction sequence / function body               |
| UPLC language as a whole              | ISA (instruction set architecture)                 |
| CEK machine                           | CPU / interpreter micro-architecture               |
| Environment `ρ`                       | Activation record / locals + closed-over variables |
| Stack `s` of frames                   | Call stack + expression-level continuations        |
| Compute state `s; ρ ⊳ M`              | “Currently executing this expression”              |
| Return state `s ⊲ V`                  | “Returning value V into surrounding context”       |
| Error state `⬥`                       | Fatal exception / trap                             |
| Final state `◻ V`                     | Process exit with return value                     |
| `(lam x M)`                           | Function definition                                |
| `[M N]`                               | Function call                                      |
| `(delay M)` / `(force M)`             | Thunk creation / thunk forcing (indirect call)     |
| `(con T c)`                           | Immediate constant                                 |
| `(constr k …)` + `(case …)`           | Tagged unions + `switch` on tag                    |
| `(builtin b)` with CEK builtin values | Built-in instructions / pure library calls         |
| Immutability of values and envs       | Read-only memory + persistent data structures      |
| Contextual semantics rules            | High-level reduction semantics                     |
| CEK transitions                       | Concrete execution / micro-steps                   |

Thinking this way:

* UPLC is the *language* the chain actually runs.
* The CEK machine is the *virtual CPU* whose behaviour is fully specified.
* All state changes are expressed as new CEK configurations; values and environments remain immutable.