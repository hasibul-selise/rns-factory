# Changelog

## 0.7.5 (2026-09-29): base branch from the prompt or git, not config

- **gate** with no base uses `.rns/config.yml` `base_branch` only if a human set it, else the repo's default branch from local refs (`origin/HEAD`, then `origin/main`, `origin/master`, `main`, `master`). The hardcoded `main` fallback is gone, so repos on `master` or with only `origin/main` work. A branch name as the arg now means its merge-base, not its tip. The gate prints `Base: <sha> (from …)`.
- **start-point** (`scripts/start-point.mjs`, new) decides where a ticket's work starts from local refs: `clear` when the user named a branch, config pins one, or the repo has a single default; `ask` only when it isn't clear (no default found, `develop`/`release/*` next to the default, an existing feature branch with its own commits, a hotfix with release lines). **refine** and **build** ask that one question only on `ask`; unattended runs take the default and list it as needs human. The choice is recorded once as `Target:` and build branches from it.
- **make-agent-ready** no longer writes `base_branch`. **review** falls back to the gate's detected base; **build** records `Target:` when the user names a branch and **pr** targets it, else the repo default.

## 0.7.4 (2026-09-28): Cursor session hook detects the host without CURSOR_PLUGIN_ROOT

- **session-start** emits `additional_context` when `CURSOR_VERSION` or `CURSOR_PROJECT_DIR` is set, not only when `CURSOR_PLUGIN_ROOT` is set. Cursor's documented hook environment does not include `CURSOR_PLUGIN_ROOT`, so 0.7.3 wrote `additionalContext` and the rules never entered the session. Claude Code is unchanged: it does not set those variables and still receives `hookSpecificOutput` only.

## 0.7.3 (2026-09-28): AGENTS.md lifecycle, cross-host hardening
Benchmark: T4 11/11 twice (judge 41, 41). AGENTS.md showed no measurable quality effect on the small seed (T5, T6); see AGENTS-MD-STUDY.md.

- **make-agent-ready** writes a short, structured **AGENTS.md** in an rns-managed block (`<!-- rns:begin/end -->`, ≤ 200 lines, human text outside the markers is never touched): Context · Commands (verified @sha, incl. one-test) · Map · Architecture (mermaid ≤ 12 nodes, only for multi-layer apps; marks where auth and tenancy are enforced) · Guardrails (invariants with evidence, personal fields, protected paths) · Existing mechanisms (file or `none`) · Done. Stack probes for .NET, Angular and others. **Refresh mode** redoes only what changed since `verified_sha`.
- `CLAUDE.md` imports `@AGENTS.md` (Claude Code doesn't read AGENTS.md on its own). `.rns/rules.md` is folded into AGENTS.md and removed.
- **Portable `.rns/working-rules.md`:** `{{PLUGIN}}` stays unresolved; no absolute path in committed files (0.7.2 baked in `E:/…`, which broke cloud agents and other machines).
- **build** loads AGENTS.md first (reuse listed mechanisms; `none` → needs human) and gets a **Docs delta** step: if the diff added a mechanism, invariant, personal field or area, update just those lines of the rns block and `pii_fields` in the same commit, within budget.
- **Every new feature is recorded:** when AGENTS.md exists, build adds one Map line per new endpoint, page, job, event or CLI command under its area, besides mechanisms, invariants and personal fields; a refactor or bug fix changes nothing. The gate WARNs when a route or endpoint is added without an AGENTS.md change, and stays quiet in repos without AGENTS.md.
- **review** judges fit against AGENTS.md (a second audit table or policy next to an existing one is High) and checks the docs delta (missing → Medium). **refine** reads AGENTS.md before asking.
- **Staleness:** gate WARN 9 when setup/CI files changed, or 30+ commits landed, since AGENTS.md was last updated; build then trusts the code over the doc, lists "run make-agent-ready (refresh)" under needs human, and doesn't refresh inside the change.
- **AGENTS.md "Done" line is host-neutral** (build and tests green, a test per criterion, block updated), so agents without the plugin aren't pushed into plugin-only steps. In T6 the plain agent's cost doubled with the old wording.
- **Cross-host fixes:** session-start emits exactly one context field per host (unknown hosts: `additionalContext` only; hosts that read several would inject twice); build's fresh-subagent review falls back to a separate pass on hosts without subagents (Codex without multi-agent). Verified: Claude Code (validate, hooks, guard), Cursor (manifest, hooks-cursor.json, `additional_context` when both root variables are set), Codex (skills path, `"hooks": {}`, marketplace), from PowerShell, cmd and Git Bash.
- **Gate:** WARN 7 when the diff adds an entity/DbSet, auth policy, route group, hosted service, HTTP client, interceptor or store but AGENTS.md is unchanged; WARN 8 when the rns block exceeds `agents_md_budget`.

## 0.7.2 (2026-09-27) — release candidate
- **Rule 4b:** after erasure keep neither the value nor a plain hash of it anywhere; audit rows record action, count, actor and time. A subject reference only if the ticket asks for one, as a keyed hash whose secret comes from the repo's existing secret mechanism, else **needs human**. (Replaces 0.7.1's HMAC mandate, which made agents build secret infrastructure.)

## 0.7.1 (2026-09-27) — superseded
- **Rule 4b:** trace each personal field first (columns, tables, logs, caches, exports, derived values that can re-link); match identifiers normalised (trim; case-fold emails) when looking up, erasing or de-duplicating.
- **Rule 4a:** enforce roles with the framework's mechanism on the route (policy or attribute), not an inline check.
- **Rule 3:** new test case: a case/whitespace variant of the identifier is found; after an erase or delete, no stored copy remains (other tables and audit rows included).
- **build:** the plan's `Data` table "erased where" lists every place the 4b trace found.

## 0.7.0 (2026-09-27) — snapshot in `working_content/rns-v0.7.0-snapshot`
- **Rule 4 split into 4a Security and 4b Personal data** (GDPR-style), applied by the agent to every hunk it writes, not only at review. Detect-and-record: a control is built only if the ticket or the repo already calls for it.
- **Rule 3:** output lacks unexposed fields; the body can't set role/tenant/owner/status/price.
- **build:** a `Data` table in the plan; a self-check step that re-reads its own diff against 4a/4b; gate WARNs must be resolved in Evidence.
- **review:** refers to 4a/4b by number, with a severity mapping (PII in logs, IDOR, no-auth endpoint, identity from the request → Critical).
- **refine:** a personal-field table (classification, retention, shared with) in the brief.
- **make-agent-ready:** records `pii_fields` and the Node runtime; writes `.rns/working-rules.md` and a pointer in `AGENTS.md`/`CLAUDE.md`, so hosts without session hooks still follow the rules.
- **Gate** adds WARNs: personal data in log/exception/telemetry calls, real-looking emails in fixtures/seeds/tests, new anonymous endpoints.
- **Node instead of bash:** `hooks/session-start.mjs`, `hooks/guard.mjs`, `scripts/gate.mjs` and `scripts/lib.mjs` (Node ≥ 18, built-ins only) behave the same in PowerShell, cmd, Git Bash, zsh and bash. Fail open without Node. session-start emits the field each host expects (Claude Code, Cursor, others).

Benchmark: see [BENCHMARK.md](BENCHMARK.md).
