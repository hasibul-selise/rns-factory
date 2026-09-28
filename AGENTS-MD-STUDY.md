# Does AGENTS.md help the next feature? (rns 0.7.3, 2026-09-28)

**Answer on this benchmark: not measurably, on a small repo where the reusable code sits next to the change.** The mechanism works: make-agent-ready writes a useful 54-line AGENTS.md; build's docs delta updates it after a feature and even repairs a stale one; the gate checks it. But T5 agents found everything they needed by reading the file they were extending, with or without the doc.

## Setup
- T4 (GDPR erasure) with rns 0.7.3 + make-agent-ready → 11/11, 11/11, judge 41/41 (no regression vs 0.7.2). Docs delta added `ErasureAudit` (audit log) and `Policies.Admin` to AGENTS.md.
- T5 (ORD-31, list the erasure audit trail) on **identical code** from that T4 run, three doc conditions: **fresh** (docs delta applied), **stale** (pre-T4 doc says "audit log: none, policies: none"), **none** (AGENTS.md, CLAUDE.md, .rns removed). rns 0.7.3 and no plugin, 2 runs each. 7 hidden tests, incl. "no second audit table".

## Results
| Condition | rns 0.7.3: hidden · judge · $ · turns | no plugin: hidden · judge · $ · turns |
|---|---|---|
| fresh AGENTS.md | 14/14 · 43.0 · 0.79 · 47 | 14/14 · 43.0 · 0.68 · 40 |
| stale AGENTS.md | 14/14 · 43.0 · 0.84 · 44 | 14/14 · 43.0 · 0.76 · 42 |
| no AGENTS.md | 14/14 · 42.0 · 0.81 · 51 | 14/14 · 43.0 · 0.62 · 23 |

Side-by-side sample (no plugin, fresh vs none): both added `GET /erasures` to the existing admin group in `CustomerEndpoints.cs`, used `PageRequest`/`PagedResult`, reused `ErasureAudit` and relied on its tenant filter. The code differs only in one local variable. The judge found the same issue in both: no tie-breaker on `CreatedAt` for stable paging.

## What did work
- **Docs delta keeps the doc true.** rns runs on the stale repo corrected AGENTS.md (+11/−9: "audit log: none" → `ErasureAudit`). Fresh runs made small edits (+3/−3). Runs with no AGENTS.md recorded "Docs delta: none".
- **Gate:** the docs-delta and size checks ran in every rns run (47/200).
- **Portable:** `.rns/working-rules.md` has no absolute paths; `CLAUDE.md` = `@AGENTS.md`.

## Why no effect, and how to test it properly
T5's mechanism lives in the exact file being extended, so any agent sees it. AGENTS.md should pay off when:
1. the mechanism is **far from the change** (for example "audit order cancellations", which should reuse the audit mechanism from `Features/Customers` in `Features/Orders`);
2. the repo is **large**, so exploration costs turns; this seed is 10 files;
3. a convention **can't be inferred from nearby code** (a policy defined only in Program.cs, or a "never do X" rule).
Next step: T6 (cross-feature reuse) and a larger seed.

## Follow-up: T6, cross-feature reuse (2026-09-28)
Here the reusable pieces live **outside** the folder being changed: the admin policy is in `Auth/` + Program.cs, and the audit table is in `Domain/`, used only by `Features/Customers`. Ticket ORD-33: admins delete pending orders and each deletion is audited. The same three start repos, 12 runs, 9 hidden tests + T4's 11 as regression.

| Condition | rns 0.7.3: judge · $ · reused audit table | no plugin: judge · $ · reused audit table |
|---|---|---|
| fresh AGENTS.md | 41.5 · 1.38 · 1/2 | 41.5 · 0.92 · 0/2 |
| stale AGENTS.md | 42.5 · 1.05 · 0/2 | 42.0 · 0.84 · 0/2 |
| no AGENTS.md | 43.0 · 0.89 · 0/2 | 40.5 · **0.46** · 0/2 |

- **All 12 reused the admin policy**, with or without the doc (Program.cs is short and agents read it). All 12 kept T4's erasure working (T4 regression 11/11).
- **11 of 12 added a second audit table** (`OrderDeletionAudit`) whatever the doc said. The one run that merged everything into a single `AuditLog` got the **lowest** judge score (37): the judge saw rewriting a working audit mechanism as risk. So "no second audit table" is too strict a test here; a separate table for a separate action is defensible.
- **Every run with an AGENTS.md updated it** (docs delta, +4 to +15 lines), including the plain agent.
- **Cost:** the plain agent's cost roughly doubled when an AGENTS.md was present ($0.46 → $0.84–0.92). The old "Done" line asked for the rns gate and a docs update. 0.7.3 now uses a host-neutral Done line; that effect isn't re-measured yet.

**Conclusion after T5 and T6:** on a small repo AGENTS.md does not raise quality. rns keeps it read and current (verified in every run), and it remains useful as onboarding for humans, cloud agents and larger repos. The quality gains rns delivers come from its rules, gate and review (see BENCHMARK.md).
