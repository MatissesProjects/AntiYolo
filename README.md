# 🛡️ AntiYolo: Granular Security & Execution Interceptor

**AntiYolo** is a premium, granular security extension designed for the **Antigravity IDE** and VS Code ecosystem. It acts as an execution interceptor and safety gatekeeper for commands executed by autonomous AI agents. By providing a tiered security engine, path-boundary validations, remote approval workflows, and an interactive visual dashboard, AntiYolo balances agent productivity with robust developer security.

---

## 🚀 Key Features

*   **🔒 Tiered Security Levels (YOLO Tiers 0–3):** Match agent capabilities to your comfort level—ranging from strict step-by-step confirmation to fully autonomous command execution with safety overrides.
*   **📦 Predefined Scoped Categories:** Fine-grained switchboards for Package, Git, Build, Test, and File Operations to dictate exactly what an agent can auto-run.
*   **📂 Workspace Safety Boundaries:** Enforce path restrictions that prevent agents from escaping workspace folders via absolute paths or directory traversal (`../`) options.
*   **📺 Sleek Visual Dashboard:** An interactive VS Code Webview dashboard built with clean styling, featuring live settings, category toggles, custom whitelist management, and an execution audit log with output viewer.
*   **💬 Remote Approvals via Discord:** Receive interactive embed cards in your Discord channel with clickable `Approve`, `Whitelist`, and `Deny` actions processed via a local redirect server.
*   **⚡ Quick Settings Status Bar:** A reactive status bar item displaying the active security state. Click to access quick bypass settings, toggle boundaries, or switch YOLO levels.

---

## 🛡️ YOLO Security Tiers

AntiYolo enforces four distinct execution levels:

| Tier | Security Level | Auto-Executed Commands | Prompt Required For |
| :--- | :--- | :--- | :--- |
| **`0`** | **Interactive** | None | *All* commands require explicit manual approval. |
| **`1`** | **Read-Only YOLO** | Safe inspection commands (e.g., `cat`, `ls`, `pwd`, `grep`, `git status`, `git diff`, `echo`). | Modifying commands, file writes, package management, compiles, and any unknown tools. |
| **`2`** | **Scoped YOLO** | Predefined category actions that are explicitly toggled **ON** + custom user-whitelisted commands. | Disabled categories, non-listed actions, or unrecognized commands. |
| **`3`** | **Full YOLO** | *All* commands except blacklisted destructive utilities. | Critical system tools (`rm`, `mkfs`, `dd`, `shutdown`, `reboot`, `mv`). |

> [!WARNING]
> Critical destructive commands (e.g. `rm`, `mkfs`, `dd`, `shutdown`, `reboot`, `mv`) are explicitly blacklisted at **all levels** and will fall back to prompting for user verification.

---

## 🔌 Advanced Verification Pipeline

The validation logic (`CommandValidator`) processes commands through a robust multi-stage security pipeline:

```
              ┌──────────────────────────┐
              │  Received Agent Command  │
              └─────────────┬────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │  Unwrap command wrappers │◄─── Strips sudo, env, npx, npm exec, etc.
              └─────────────┬────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │  Blacklist Check (All)   │────► [Blocked / Prompt] (rm, mv, dd, ...)
              └─────────────┬────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │   Recursive Shell Check  │◄─── Tokenizes & validates bash -c / cmd /c
              └─────────────┬────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │  Inline Script Scanning  │◄─── Scans python/node/ruby eval strings
              └─────────────┬────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │    YOLO Level Filter     │────► Level 0: Always Prompt
              └─────────────┬────────────┘      Level 1: Read-Only Whitelist
                            │                  Level 2: Category Switches + Custom Whitelist
                            ▼                  Level 3: Auto-execute
              ┌──────────────────────────┐
              │ Workspace Boundary Check │────► Blocks paths pointing outside project
              └─────────────┬────────────┘
                            │
                            ▼
                     [Auto-Executed]
```

*   **Recursive Wrapper Unwrapping:** Safely parses and resolves underlying executables inside wrappers like `sudo`, `env`, `npx`, `npm exec`, `yarn dlx`, and `bundle exec`.
*   **Recursive Shell Parsing:** Tokenizes shell syntax operators (`&&`, `||`, `;`, `\n`, `|`) to ensure nested commands do not hide malicious payload actions.
*   **Inline Script Scanning:** Runs text/regex safety checks on inline execution script options (`python -c`, `node -e`, etc.) to block blacklisted command invocations.

---

## 🎛️ Scoped Categories (Level 2)

When running in **Scoped YOLO (Level 2)**, you can configure granular rules across five functional domains:

*   📦 **Package Operations (`allowPackageOps`):**
    *   Actions: `install` (npm/yarn/pip install), `ci` (clean installs), `update` (upgrades), `uninstall` (removes).
*   🧪 **Test Operations (`allowTestOps`):**
    *   Actions: `test` (generic runner), `pytest`, `jest`, `vitest`, `mocha`, `playwright`, `cypress`.
*   🏗️ **Build Operations (`allowBuildOps`):**
    *   Actions: `tsc` (TypeScript compiler), `build` (npm/vite/cargo build), `make`, `gradle`, `maven`.
*   🌿 **Git Operations (`allowGitOps`):**
    *   Actions: `add`, `commit`, `push`, `checkout`, `branch`, `pull`, `fetch`, `stash`, `reset`.
*   📂 **File Operations (`allowFileOps`):**
    *   Actions: `mkdir` (make directory), `touch` (create file), `cp` (copy), `chmod` (permissions), `chown` (ownership).

---

## 📂 Workspace Safety Boundary

Setting `antiyolo.restrictToWorkspace` to `true` enforces strict filesystem isolation:
*   Arguments and parameters containing absolute paths or traversal sequences (`../`) are scanned.
*   Any path pointing outside the current VS Code workspace folders triggers a fallback to manual confirmation.
*   Prevents directory-escape attacks on sensitive directories (e.g., `/etc/`, `~/.ssh/`).

---

## 📺 Visual Settings & Audit Log Dashboard

Open the visual dashboard by executing the `AntiYolo: Show Dashboard` command. Built as a sleek VS Code Webview, it features:
1.  **State Header:** Live toggle switch to enable/bypass safety checks globally.
2.  **YOLO Level Selector:** Visual grids showcasing active states with glowing accents.
3.  **Scoped YOLO Category Panel:** Manage active categories and check/uncheck individual actions dynamically.
4.  **Custom Whitelist Manager:** Quick-add custom commands or regular expression patterns; delete entries with a click.
5.  **Execution Audit Log:** Real-time log tracking auto-execution, approvals, denials, blocks, execution durations, and outputs (stdout/stderr).

---

## 💬 Remote Approvals via Discord

When an agent requests a blocked or prompt-required command, AntiYolo can route the request to a Discord channel:
1.  **Notification Webhook:** Post an interactive Rich Embed to Discord.
2.  **Action Links:** The Discord message includes clickable links:
    *   **Approve Once:** Executes this single command instance.
    *   **Whitelist & Approve:** Appends the command to the custom workspace whitelist and executes it.
    *   **Deny Request:** Aborts the command and returns an error context to the agent.
3.  **Local Redirect Server:** Listens on a configured local port (default: `7788`) to receive approval redirects and automatically resume agent flows.

---

## ⚙️ Configuration & Commands

### Extension Commands

*   `antiyolo.runCommand` — Executes a structured JSON payload safely through the interceptor.
*   `antiyolo.showDashboard` — Displays the interactive Webview panel.
*   `antiyolo.showMenu` — Displays the Quick Pick options menu in the editor.
*   `antiyolo.toggleEnabled` — Globally toggles the enablement state.
*   `antiyolo.toggleRestrictToWorkspace` — Toggles the workspace isolation path boundary.

### Configuration Properties (`settings.json`)

Configure options globally or in workspace settings:

```json
{
  "antiyolo.enabled": true,
  "antiyolo.yoloLevel": 2,
  "antiyolo.timeoutSeconds": 15,
  "antiyolo.restrictToWorkspace": true,
  "antiyolo.whitelist": [
    "npm run lint",
    "git status"
  ],
  "antiyolo.allowPackageOps": true,
  "antiyolo.allowedPackageActions": ["install", "ci", "update"],
  "antiyolo.allowGitOps": true,
  "antiyolo.allowedGitActions": ["add", "commit", "push", "checkout", "status", "diff"],
  "antiyolo.allowBuildOps": false,
  "antiyolo.allowTestOps": false,
  "antiyolo.allowFileOps": false,
  "antiyolo.enableDiscord": false,
  "antiyolo.discordWebhookUrl": "",
  "antiyolo.localServerPort": 7788
}
```

---

## 🛠️ Development & Installation

### Setup
1.  Clone the repository and install dependencies:
    ```bash
    npm install
    ```
2.  Compile typescript files:
    ```bash
    npm run compile
    ```
3.  Watch mode for auto-compiling changes:
    ```bash
    npm run watch
    ```

### Running Tests
Execute unit tests using Mocha:
```bash
npm test
```

### Launch Extension
1.  Open this project folder in VS Code.
2.  Press `F5` to open a Development Host window.
3.  Run commands or configure options to see the interceptor in action.

---

## 📄 License
This project is licensed under the MIT License. See the LICENSE file for details.
