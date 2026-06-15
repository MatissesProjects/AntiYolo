# Agentic Roles for AntiYolo

To build the Granular YOLO Extension with high precision, we define a set of agent roles. Each agent has a focused domain of responsibility, reducing context overload and maintaining high quality.

## Agent Directory

1. **[Architect Agent](agents/architect.md)**
   - **Role**: Overall coordinator, codebase structure, glue logic, API design.
   - **Scope**: `package.json` (top-level), `src/extension.ts` (activation/deactivation), orchestration.

2. **[UI & Configuration Agent](agents/ui_settings.md)**
   - **Role**: Handles settings schemas, UI presentation, configuration reading/writing.
   - **Scope**: Settings contributions in `package.json`, configuration interface files.

3. **[Command Validator Agent](agents/validator.md)**
   - **Role**: Core security and safety rules. Command tokenization, regex validation, level check logic.
   - **Scope**: `src/validator.ts`, unit tests for validation rules.

4. **[Integration Agent](agents/integration.md)**
   - **Role**: Intercepts command executions, handles dialogs/prompts, streams output logs back.
   - **Scope**: Terminal interception, UI confirmation flows, output streaming wrapper.

---

## Collaboration Protocol

- **Progressive Handover**: When a task moves from design to implementation, the **Architect** delegates to the **Validator** or **UI Agent** by updating `docs/planning.md`.
- **Commit Boundary**: Each agent works in logical chunks and commits to git only after confirming their code compiles and passes relevant tests.
