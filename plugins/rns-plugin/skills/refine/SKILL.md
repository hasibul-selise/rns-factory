---
name: refine
description: Use when a ticket or request is vague, or when asked to refine, clarify or scope work before building. Asks questions with defaults and writes a short brief with testable acceptance criteria.
---

# Refine a request

Output: the `## Brief` section of `.rns/work/<ID>.md` (`<ID>` = ticket id, else `local-<slug>`). The brief is ≤ 25 lines. You test the requirement; you don't design the solution. If the rns working rules aren't already in context, read `../../rules.md`.

1. **Load (one batch):** `AGENTS.md` and `.rns/config.yml` if present (don't ask what they already answer), the ticket (every comment, if it's a tracker link), and the few files it touches. If the work file exists, fold in new answers and re-ask only what's open.
2. **Ask** only what changes the build: roles and denials, tenant scope, personal data and retention, contracts and consumers, out of scope, state transitions, and for a bug the reproduction plus the source of "expected"; the start branch only when `node ../../scripts/start-point.mjs [branch the user named] [--hotfix]` prints `ask` (its `Start:` is the default, its candidates the options). At most 5 numbered questions per round and 3 rounds. Each question carries a default: "If unanswered: X". Local run: ask and wait. Unattended: record the defaults and continue.
3. **Write:**
```markdown
## Brief — <ID>: <title>
Type: feature|defect · Target: <branch> · Risky: yes/no (why) · Source: <link|chat>
**Outcome** — 2–3 lines, ending with what it does not do.
| AC | Given / when / then | Observable failure |
| Personal field | Classification | Retention | Shared with |   ← only when personal data is in scope; unknown → needs human
**Assumptions** — one line each; mark auth, roles, tenancy, personal data, money, consumed contracts as **needs human**
```
   Each AC names a value, a code or a visible outcome ("handles errors gracefully" is not an AC).
4. **Verdict:** NOT READY if an AC can't fail, an endpoint has no auth/status codes, or a defect has no reproduction. Otherwise READY or READY WITH ASSUMPTIONS (any needs human). Reply with the verdict, open questions and needs-human items only.
