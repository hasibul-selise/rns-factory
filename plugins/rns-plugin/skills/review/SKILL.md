---
name: review
description: Use when reviewing a branch, diff or PR against its brief and the repo's rules, including build's hand-off. Checks tests, security, personal data, tenancy and scope; reports only findings with a quoted line.
---

# Review a change

Judge the diff, not the author's explanation. Don't edit code. Follow the rns working rules (read `../../rules.md` if they aren't in context). Read `AGENTS.md` first: its guardrails and existing mechanisms are what "fit" is judged against.

1. **Scope:** base = the one given, else the work file's `Base:`, else the merge-base with the work file's `Target:` or the branch the user named, else run `node ../../scripts/gate.mjs` with no base and use the `Base:` it prints (the repo's default branch). Read `git diff <base>` (plus untracked files), each changed file, and its direct callers. Trust Evidence stamped with the current HEAD; otherwise run build + tests + `node ../../scripts/gate.mjs <base>` once.
2. **Check:**
   - **Tests:** each AC has a test; every rule-3 case the change touches is tested; assertions check values, not just "not null" or status only; no test was deleted or loosened.
   - **Security (rule 4a) and personal data (rule 4b):** give every item the diff touches a verdict; also no swallowed errors. Each gate WARN is fixed or has a credible reason in Evidence.
   - **Contract:** no silent breaking change (removed field, changed status/code, tightened validation).
   - **Fit:** reuses the helpers and mechanisms AGENTS.md lists (a second audit table, policy or helper next to an existing one is **High**); nothing the brief didn't ask for.
   - **Docs delta:** a mechanism, invariant, personal field or area the diff added is in the AGENTS.md rns block and `pii_fields`; missing → **Medium**. The block stays within `agents_md_budget`.
3. **Findings:** `Sev | file:line | quoted code | consequence (the input that breaks it) | fix`. No quote or no concrete consequence → drop it.
   - **Critical:** endpoint without auth that the brief doesn't mark public · object by id not checked against the caller (IDOR) · role/tenant/owner from the request · personal data in logs, exceptions or telemetry · personal data to an unnamed third party · a secret in the diff.
   - **High:** any other 4a/4b breach · a missing rule-3 test.
   - **Medium:** a gate WARN left unexplained.
   - A control that needs infrastructure the repo lacks is **needs human**, not a finding. Critical/High block; Medium/Low don't.
4. **Record:** append `## Review r<N> @<sha>` (≤ 20 lines) to the work file. Reply: `Review r<N> — FAIL | FINDINGS | PASS` plus the findings table.
