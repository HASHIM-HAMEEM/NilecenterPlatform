# Nile Learn AI Rules & Instructions

You must read and adhere to the guidelines, constraints, and product specs described in these Markdown files before proposing designs or writing code:

1. **CLAUDE.md**
   - Location: [CLAUDE.md](file:///Users/fin./Desktop/nile-center-platform/CLAUDE.md)
   - Scope: Engineering discipline, code simplicity, surgical changes, verification, and code style.
2. **AGENTS.md**
   - Location: [AGENTS.md](file:///Users/fin./Desktop/nile-center-platform/AGENTS.md) or [.agents/AGENTS.md](file:///Users/fin./Desktop/nile-center-platform/.agents/AGENTS.md)
   - Scope: Product definition, user roles (`student`, `teacher`, `registrar`, `headofdepartment`, `branchadmin`, `superadmin`), security boundaries (RBAC, RLS), portal-specific routes, repository command inventory, and response format.
3. **Feature prompts (.codex/prompts/*.md)**
   - Location: [.codex/prompts/](file:///Users/fin./Desktop/nile-center-platform/.codex/prompts/)
   - Scope: Specific requirements, data models, routes, and acceptance criteria for features like catalog, auth/RBAC, student portal, assessments, etc.
4. **General documentation (docs/)**
   - Location: [docs/](file:///Users/fin./Desktop/nile-center-platform/docs/)
   - Scope: Development roadmap and design brainstorm files.

## Workflow Rules
- Always use the Standard Loop described in `AGENTS.md` (Read, Spec, Plan, Implement, Verify, Review, Fix, Document).
- Run `./scripts/verify.sh` to run Prettier formatting checks, TypeScript verification, unit tests, and production builds before finishing work.
- Never commit environment files (`.env*`) or local execution logs (`.playwright-cli/`, `.playwright-mcp/`, `.manus-logs/`).
