---
name: make-agent-ready
description: Use once per repository, when AGENTS.md or .rns/config.yml is missing or stale, or to refresh them after big merges. Verifies the build/test commands by running them and writes a short AGENTS.md (context, commands, map, architecture, guardrails, existing mechanisms, done) that every later agent run reads.
---

# Make a repository agent-ready

Everything you write about the repo goes in one rns-managed block of `AGENTS.md` between `<!-- rns:begin -->` and `<!-- rns:end -->`. Never touch text outside the markers. Budget: the block ≤ 200 lines (aim for well under; every run reads it). Write only what you verified or saw in a file; skip anything a competent engineer does anyway.

**Refresh** (the block exists): read `verified_sha` from `.rns/config.yml`, then `git diff --stat <verified_sha>..HEAD`. Redo only the steps whose inputs changed (manifests → 2; new areas, entities, policies, services → 3–6). Keep the rest.

1. **Map (one batch of reads):** manifests, solution/workspace files, CI config, README, existing AGENTS.md/CLAUDE.md, test folders, `git log --oneline -15`; run `node --version`. Detect the stack and also read:
   - .NET: `global.json`, the startup project, `Program.cs` (DI, auth, middleware), the DbContext, the test factory, the migrations setup
   - Angular: `angular.json`, `app.config.ts`/app module, routes, HTTP interceptors, state (signals/NgRx/services), the test runner
   - Node/Python/Go/other: the entry point, router, data layer, test setup
2. **Verify commands:** find build, test, *one* test, lint/format and run commands and **run each one** (for the single test, pick an existing test). Record the command if it passed, `{run, status: failing, error}` if it failed, `null` if none. Never record a command you didn't run.
3. **Canonical context (≤ 8 lines):** what the system does and for whom, the domain terms as the code names them (`term = Type/field`), and the source-of-truth docs if any.
4. **Map and architecture:** where each kind of code goes (`path/ — what lives there`), and under each feature area its features as `feature: route or entry` (build adds one line per new feature). Then trace one request from the entry point through auth and tenant enforcement to the data layer. More than one layer or service → a mermaid `flowchart` of ≤ 12 nodes that marks where auth and tenancy are enforced; a single-layer app → skip the diagram.
5. **Guardrails:** invariants the code enforces, each `rule — evidence file` (auth and tenant enforcement point, error shape, validation placement, paging limits, anything the code comments say "never"). The personal-data fields (`Entity.Field — kind`). Protected paths: `../../org/protected-paths.txt` plus any the repo adds.
6. **Existing mechanisms:** for each of audit log, auth policies/roles, secrets/config, hashing/crypto, paging, caching, background jobs, feature flags, outbound HTTP, email/notifications: `the file that provides it`, or `none`. "none" matters: rule 4 turns a needed-but-missing mechanism into **needs human** instead of new infrastructure.
7. **Write:**
   - `AGENTS.md`: create it if missing; replace only the rns block. Sections in this order: `## Context`, `## Commands (verified @<short sha>)`, `## Map`, `## Architecture` (if drawn), `## Guardrails`, `## Existing mechanisms`, `## Done` (one line, true for any agent with or without rns: build and tests green, a test per acceptance criterion, and this block updated in the same commit when the change adds a feature, mechanism, invariant or personal field). First line in the block: `Before any code change follow .rns/working-rules.md.`
   - `CLAUDE.md`: if it exists and doesn't already import it, add the line `@AGENTS.md`; if it doesn't exist, create it with just that line.
   - `.rns/config.yml`: `verified_sha` (current HEAD), `commands`, `runtime` (`node <version>`, or `node missing — hooks and gate inactive`), `flags` (`tenancy`, `pii`, `async`, `ui`: true/false with evidence), `pii_fields: [Entity.Field, …]`, `agents_md_budget: 200`. Never store a base branch: it comes from the user, git, or a question (`scripts/start-point.mjs`).
   - `.rns/working-rules.md`: a copy of `../../rules.md` with `{{PLUGIN}}` left as is, headed `<!-- rns 0.7.5. {{PLUGIN}} = the folder where the rns plugin is installed; the session hook prints it. Unknown → record the gate as NOT RUN. -->`. Never write an absolute path into a committed file.
   - Delete `.rns/rules.md` if an older setup left it, after moving its conventions into Guardrails or Existing mechanisms.
8. **Report:** READY / READY WITH GAPS / NOT READY (NOT READY = no runnable test command), the commands table, and the block's line count. Node missing → say once that the hooks and gate are inactive until Node 18+ is installed. Write nothing outside `AGENTS.md`, `CLAUDE.md` and `.rns/`.
