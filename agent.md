# agent.md
version: 1
about: >
  Defines the working behavior, responsibilities, and boundaries of the POS & Pawn App
  development agent. This agent uses TODO.md to run each tasks in there sequently one by one, marking them as done when finished. it will also use ui_taks.md, schema.sql, and permissions.v3.yaml as the system’s source of truth for generating UI, backend endpoints, database models,
  and RBAC enforcement.

## 🧠 Agent Purpose

This agent acts as the **technical executor and spec enforcer** for the Pawn & POS system.
It interprets and cross-references:
- ui_tasks.md: defines routes, purpose, UI components, and user roles.
- schema.sql: defines normalized relational data structures.
- permissions.v3.yaml: defines allowed actions, scopes, and RLS patterns.

It translates these into **code, endpoints, and validation logic**, maintaining consistency across:
1. Frontend (Next.js + Tailwind)
2. Backend (Node.js + Express  + Drizzle)
3. MySQL database
4. Role-based access and data visibility enforcement

## ⚙️ Core Responsibilities

1. **Read ui_tasks.md**
   - Extract routes, actions, and data requirements.
   - Generate API endpoint skeletons under /api/.
   - Suggest UI pages and reusable component layouts.

2. **Read schema.sql**
   - Validate data sources mentioned in UI specs exist in the DB.
   - Generate ORM models or Drizzle schema files.
   - Suggest migrations if entities or relations are missing.
   - Update if necessary

3. **Read permissions.v3.yaml**
   - Build role guard middleware (can(user, action, resource)).
   - Enforce field-level limits (discount %, cash payout caps).
   - Apply Row-Level Security (RLS) patterns per entity.

4. **Output**
   - For each route in task_ui.v3.yaml, produce:
     - API endpoint map
     - Type definitions (Zod schema or TypeScript interface)
     - Frontend form validation structure
     - Example UI code with actions and permissions guards

## 🧩 Behavior & Workflow

### Step 1: Parse Specs
- Read YAML files and extract: route, primary_data, actions, components, and roles_access.

### Step 2: Cross-Validate
- Ensure each data reference exists in schema.sql.
- Warn or auto-generate migrations if mismatched.

### Step 3: Generate Scaffolds
- Each route automatically includes:
  - Server action handlers
  - Error boundaries

### Step 4: Enforce Permissions
- Load permissions from YAML.
- Auto-wrap sensitive actions in guards:
  if (!can(user, 'pos.apply_discount')) throw new ForbiddenError();
- Respect approval flow (manager PIN, two-person rule).

### Step 5: Testing Layer
- For each endpoint, auto-generate a Vitest test file:
  - Checks permissions, success, and failure cases.
  - Validates schema alignment and audit logging.

## 🧱 Coding Standards

| Area | Rules |
|------|-------|
| Frontend | Next.js 14 App Router, React Server Components, Tailwind, ES Modules |
| Backend | Node 20+, Express or tRPC, Drizzle ORM, Zod validation, ESLint strict |
| Security | AES-256-GCM encryption, signed URLs for PII, audit log for every write |
| Testing | Vitest + Supertest for API, Playwright for E2E |
| Docs | JSDoc for functions, YAML comments for enums/constants |

## 🧮 Agent Commands (Prompt Patterns)

| Command | Description |
|----------|--------------|
| plan module <name> | Generate BE/FE/DB task plan for a module (e.g., POS, Loans, Inventory). |
| scaffold api <route> | Generate full Express/tRPC route handler, validation, and test. |
| scaffold ui <route> | Create Next.js page, import shadcn components, role-based actions. |
| sync schema | Validate all entities used in YAML exist in schema.sql. |
| generate types | Convert YAML + SQL schema into TypeScript interfaces. |
| guard check | List missing or weak permission guards in backend. |

## 🧑‍💼 Example Behavior

If the developer runs:
agent plan module pos

The agent:
- Parses /pos/* routes from YAML.
- Reads related tables (orders, order_items, payments, invoices).
- Generates:
  - /api/orders.ts CRUD handlers
  - /components/pos/TenderPanel.tsx
  - Tests for manager PIN override logic
  - Docs under /docs/pos.md

## 📦 Output Folders (for Cursor/Codex)

```
/docs/agent.md
/docs/task_ui.v3.yaml
/docs/permissions.v3.yaml
/docs/schema.sql
/frontend/app/...
/frontend/components/...
/backend/routes/...
/backend/models/...
/backend/middleware/guards.ts
/tests/api/...
/types/...
```

## ✅ Success Criteria

- Every UI route in YAML has a matching backend endpoint.
- No undefined table references between UI specs and schema.sql.
- Permissions guards automatically injected per route.
- Auditable writes for all financial and inventory ops.
- Consistent i18n, responsive layout, and role-based visibility.

## 🔒 Notes

- Never bypass permissions or omit audit logging.
- Always enforce branch scope and role visibility.
- Prefer server-side calculation for totals and taxes.
- For sensitive data (ID images, payment meta): only use signed URLs.
- Reuse the reusable dialogs.
