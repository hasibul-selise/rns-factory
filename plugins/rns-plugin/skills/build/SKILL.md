---
name: build
description: Use when asked to implement, build or fix a ticket, feature or bug, end to end or up to a PR, or only to plan it. Plans criterion→test, codes red-green, self-checks security and personal data on the diff, keeps AGENTS.md current, verifies, reviews and repairs.
---

# Build a change

Follow the rns working rules (read `../../rules.md` if they aren't in context). Record in `.rns/work/<ID>.md`: tables and one-liners only; the code is the deliverable.

1. **Load (one batch):** `AGENTS.md` (the repo's context, commands, guardrails and existing mechanisms: reuse what it lists, and treat `none` as a needs-human gap, not something to build), `.rns/config.yml`, `../../org/policy.md`, the work file; `.rns/rules.md` if an older setup left one.
   - No AGENTS.md rns block → suggest **make-agent-ready** in the report and continue.
   - AGENTS.md older than the repo (the gate's staleness WARN, or setup/CI files changed since it was last updated) → trust the code over the doc where they disagree, list "AGENTS.md stale: run make-agent-ready (refresh)" under needs human, and continue. Don't run the refresh inside this change.
   - No config → take the build/test commands from the README or manifests.
   - No brief → clear request: write a ≤ 10-line brief yourself (Outcome, AC table, Assumptions with **needs human**). Unclear: run **refine** first.
   - Brief NOT READY → local: stop and ask; unattended: continue, and the gaps become needs human.
2. **Plan → `## Plan` (≤ 15 lines):** `Base: <git rev-parse HEAD>`; a table `AC | test (one line) | files`; the contract line (additive | breaking | internal: tightened validation or a changed status/code/field is breaking). Defect: cause at `file:line` and the regression test. Personal fields added or exposed → `Data: | field | class | retention | erased where |` (from the brief; "erased where" lists every place the 4b trace found; unknown → needs human). Risky: one line per rule-4a/4b item touched, with the decision. **Plan-only request → stop here.**
3. **Code:** create a branch; for each row, write the test, see it fail for the right reason, write the minimum code, see it pass. Cover the rule-3 cases the change touches. Commit when green.
4. **Self-check:** read `git diff <base>` once and hold every added hunk against 4a and 4b (logs, exceptions, DTOs, responses, fixtures, lookups by id, new endpoints). Fix what breaks a rule, with a test where rule 3 applies; a control the repo can't support becomes needs human.
5. **Docs delta (AGENTS.md exists → always check it):** every new feature (endpoint, page, job, event, CLI command) gets its one line under its area in **Map** (`area/ — feature: route or entry`). Also a reusable mechanism (helper, policy, audit/log table, error code, config section) → Existing mechanisms; an invariant → Guardrails; a personal field → Guardrails and `pii_fields` in `.rns/config.yml`; a line the change made wrong → fix it. Edit only those lines of the rns block, in the same commit as the code; stay within `agents_md_budget` (merge or drop stale lines). Refactor or bug fix with no new feature or mechanism → change nothing. Record `Docs delta: <items> | none (why)`.
6. **Verify → `## Evidence @<sha>` (≤ 10 lines):** one batch of full build + tests + `node ../../scripts/gate.mjs <base>`. Record count lines, the gate verdict, `AC-n → test ✓ (red first ✓)`, `Self-check 4a/4b: N fixed, M needs human`, each gate WARN as `fixed` or `ok: <why>`, and `NOT RUN (reason)` for anything skipped (no Node → `Gate: NOT RUN (node missing)`, which keeps the PR draft).
7. **Review:** normal change → run **review** yourself on the diff. Risky or > 10 files → a fresh subagent in the foreground (wait, never poll): "Read and follow `<absolute path of ../review/SKILL.md>`. Work file: `<path>`. Base: `<sha>`." Send no summary. No subagents on this host → run **review** yourself as a separate pass that starts from the diff, not from your notes.
8. **Repair:** fix Critical/High, rerun step 6, re-review the delta. At most 3 rounds; then leftovers are needs human.
9. **Finish:** run **pr** if a PR was asked for. Report: `Build <ID> — COMPLETE | COMPLETE WITH GAPS | BLOCKED · tests added N · open: … · needs human: …`
