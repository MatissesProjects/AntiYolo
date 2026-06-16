# AntiYolo Future Plans: Advanced Selections & Visual Dashboard

This document tracks the plans to extend the Granular YOLO Extension with a full set of selectable command categories and a premium, interactive VS Code Webview dashboard.

## 🎯 Goal
Give users fine-grained control ("a full set of selections") over exactly which command categories the autonomous agent is allowed to run without prompts. Instead of typing raw whitelist strings, users can toggle predefined categories and manage settings via a high-fidelity dashboard.

---

## 1. Structured Command Categories
We will introduce five standard categories of operations that can be toggled independently for **Level 2 (Scoped YOLO)**:

*   📦 **Package Operations (`allowPackageOps`)**: Allows installing/uninstalling packages (e.g., `npm install`, `pip install`, `cargo add`).
*   🧪 **Test Operations (`allowTestOps`)**: Allows running tests (e.g., `npm test`, `pytest`, `cargo test`).
*   🏗️ **Build Operations (`allowBuildOps`)**: Allows compiling/building projects (e.g., `tsc`, `npm run build`, `cargo build`).
*   🌿 **Git Operations (`allowGitOps`)**: Allows repository tracking/staging/syncing (e.g., `git add`, `git commit`, `git push`, `git checkout`).
*   📂 **File Operations (`allowFileOps`)**: Allows writing or copying files/directories (e.g., `mkdir`, `touch`, `cp`).

---

## 2. Interactive Settings Dashboard (Webview)
We will build a VS Code Webview dashboard with rich design aesthetics (dark mode, glassmorphism, responsive elements, and clean animations):

```mermaid
graph TD
    Webview[Dashboard Webview UI] <-->|VSCode Message API| Extension[Extension Backend]
    Extension <-->|Read/Write| Configuration[VS Code Workspace Settings]
    Extension <-->|Read| AuditLog[InMemory / Persistent Audit Log]
```

### Key UI Sections
1.  **Header**: Extension state indicator, glowing active status, and "Open Settings" shortcut.
2.  **YOLO Level Selector**: A visual grid of 4 styled cards (0: Interactive, 1: Read-Only, 2: Scoped, 3: Full) with glowing border highlights depending on which level is active.
3.  **Scoped YOLO Category Panel**: A grid of toggle switches representing the 5 predefined command categories, active only when Scoped YOLO is selected.
4.  **Custom Whitelist Manager**: An interactive list of user-defined whitelist patterns, allowing quick addition and deletion.
5.  **Execution Audit Log**: A terminal-like table showing the history of commands executed by the agent, their status (Auto-Executed, Prompted & Approved, Prompted & Denied, Blocked, Timed Out), execution duration, and expandable stdout/stderr outputs.

---

## 3. Implementation Steps & Progressive Disclosure
To keep code size small and focused, we split implementation into distinct, logical modules:

*   **`src/types.ts`**: Update config interfaces and enum selections.
*   **`src/config.ts`**: Update configuration retrieval to read new category boolean flags.
*   **`src/validator.ts`**: Integrate the new category checks into the validation pipeline.
*   **`src/logger.ts`** [NEW]: A dedicated command history logger class that keeps track of the last $N$ commands and their execution results.
*   **`src/dashboard.ts`** [NEW]: Panel coordinator managing the lifecycle of the VS Code Webview panel, serialization, and messaging.
*   **`src/media/dashboard.html`** [NEW]: The HTML, CSS (vanilla CSS dark-mode dashboard), and JS bundle for the Webview UI.
