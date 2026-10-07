# rns-plugin: a lean software factory for coding agents

rns makes an AI coding agent deliver a ticket the way a careful senior engineer would:
failing test first, auth/tenancy/personal-data checks on its own diff, reuse of what the
repo already has, and a clear list of what needs a human. You get a reviewable change
with evidence.

Works in **Claude Code, Cursor and Codex**. Adds ~1,200 tokens of rules per session, plus five commands.

```
make-agent-ready (once per repo)
refine ──► build ──► review ──► pr
            ▲          │
            └─ repair ─┘  ≤ 3 rounds, then a human
```

## When to use it

| Use `build` for | A plain prompt is fine for |
|---|---|
| auth, roles, tenancy, personal data, exports, money, public contracts, or when you want a PR with evidence | small, low-risk features and bug fixes (same quality, about half the cost and time) |

The rules are injected into every session either way.

## Install

**Needs:** git, Node 18+ (for hooks and the gate; rns still works without it) and your stack's SDK.

**Claude Code**
```text
/plugin marketplace add <path-or-git-url-of-this-folder>
/plugin install rns-plugin@rns
```
Local try-out: `claude --plugin-dir plugins/rns-plugin`.

**Cursor:** add this folder as a plugin marketplace, or copy `plugins/rns-plugin` to
`~/.cursor/plugins/local/rns-plugin` and restart. Then ask: "use the rns build skill for ABC-123".

**Codex**
```bash
codex plugin marketplace add <path-of-this-folder>
codex plugin add rns-plugin@rns
```
Then ask: "use the rns build skill for ABC-123".

**Then, once per repo:** run `make-agent-ready` and commit what it writes.

## Commands

| Command | Use it when | You get |
|---|---|---|
| `make-agent-ready` | once per repo; again after big merges | a verified, short `AGENTS.md` the agent reads on every run |
| `refine` | the ticket is vague | up to 5 questions with defaults, then a short brief with testable acceptance criteria |
| `build <ticket>` | implementing a feature or fix | plan → failing test → code → security/privacy self-check → gate → review → repair → optional PR |
| `review` | checking any branch or PR | findings, each with the quoted line and its consequence |
| `pr` | opening or updating a PR | a PR body built from the recorded evidence; kept as draft while anything is unresolved |

In Claude Code the commands are `/rns-plugin:<name>`, e.g. `/rns-plugin:build ABC-123`.

Unattended runs (CI, cloud agents) never stop to ask. They record defaults and mark risky
assumptions **needs human**, which keeps the PR in draft.

## Results

Measured on a .NET multi-tenant API with Sonnet. Each ticket has **hidden acceptance tests**
that are added only after the agent finishes, and a blind Opus judge scores the diff out of 50.

| Task | Ticket |
|---|---|
| T1 | Cancel an order (vague feature) |
| T2 | "Filtered total is wrong" (bug fix) |
| T3 | Admin-only CSV export with filters (feature with traps) |
| T4 | GDPR right to erasure (security + personal data) |

| | Without a plugin | With rns |
|---|---|---|
| Hidden tests passed (T1–T4) | 87% | **100%** ¹ |
| T4 security + GDPR, judge /50 | 32.7 | **41.5** |
| Safety (auth, tenancy, privacy), /10 | 5.7 | **8.2** |
| T1 · T2 · T3, judge /50 | 42 · 46 · 38 | 40 · 48 · 40 (about the same) |
| Cost / time per ticket | **$0.42 · 2.1 min** | $0.78 · 4.1 min (+ $0.50 one-off setup) |

¹ rns 0.7.2: 85/85 over 11 runs; no plugin: 47/54 over 6 runs. A re-run of 0.7.3 on T4 passed 22/22.

**What agents got wrong without rns:**
- kept the erased email (or a reversible hash of it) in an audit table
- matched emails case-sensitively, so `Jane@ACME` survived "erasure"
- left CSV formula injection in exports
- skipped the forbidden, cross-tenant and repeat-request tests

Method, every run and caveats: [BENCHMARK.md](BENCHMARK.md). On this small repo AGENTS.md
made no measurable difference to the next feature: [AGENTS-MD-STUDY.md](AGENTS-MD-STUDY.md).

## What rns adds to your repo (commit these)

| File | Purpose |
|---|---|
| `AGENTS.md` (between `<!-- rns:begin/end -->`) | the repo's memory: commands, map, architecture, guardrails, reusable mechanisms. `build` keeps it current; text outside the markers is never touched. |
| `CLAUDE.md` | `@AGENTS.md`, because Claude Code doesn't read AGENTS.md on its own |
| `.rns/config.yml` | verified commands and settings |
| `.rns/working-rules.md` | the rules for hosts without session hooks |
| `.rns/work/<ID>.md` | one per ticket: brief, plan, evidence, review; the PR body is built from it |

<details>
<summary><b>How it works</b></summary>

| Layer | What | Cost |
|---|---|---|
| Rules (`rules.md`) | plan each criterion → test · red → green · required test cases · security · personal data · fit the repo · finish with the gate | ~1,200 tokens |
| Skills | the five commands | loaded only when used |
| Guard hook (Claude Code) | blocks writes to CI, infra, lockfiles and secrets; the change goes to a hand-off note | 0 unless it fires |
| Gate (`scripts/gate.mjs`) | FAIL on protected paths and secrets; WARN on missing tests, personal data in logs, stale AGENTS.md, … | 0, the agent runs it |
| Org policy (`org/`) | SELISE numbers and the protected-path list | read on demand |

**Design principle:** checks detect problems. The agent builds a control only when the ticket
or an existing repo mechanism calls for it; otherwise it marks the item *needs human*.

| | Claude Code | Cursor | Codex |
|---|---|---|---|
| Rules at session start | hook | hook | via skills + AGENTS.md |
| Guard before writes | ✅ | gate only | gate only |
| Fresh-subagent review | ✅ | ✅ | multi-agent mode, else a separate pass |

</details>

<details>
<summary><b>Customise for your organisation</b></summary>

Edit only `plugins/rns-plugin/org/`: `policy.md` (page size, retries, retention…) and
`protected-paths.txt`. A repo can add `.rns/protected-paths.txt`; its AGENTS.md guardrails
win over org defaults.

**Cloud agents:** commit the files above, add the plugin to `.claude/settings.json`
(marketplace + `enabledPlugins`), and give the image git, Node 18+ and your SDK.

</details>

<details>
<summary><b>Troubleshooting</b></summary>

| Symptom | Fix |
|---|---|
| `Gate: NOT RUN (node missing)`, PR stays draft | install Node 18+ |
| The agent doesn't know the rules | check the plugin is enabled and restart; on Codex run `make-agent-ready` |
| WARN "AGENTS.md may be stale" | run `make-agent-ready` (it refreshes only what changed) |
| WARN "feature … but AGENTS.md unchanged" | add the Map line, or say in Evidence why none is needed |
| Edit to `.github/…` blocked | by design; see `docs/ci-cd-requirements.md` |
| Headless/CI auth error | re-login: `claude` → `/login` |

</details>

## More
[CHANGELOG](CHANGELOG.md) · [BENCHMARK](BENCHMARK.md) · [AGENTS-MD-STUDY](AGENTS-MD-STUDY.md) · [CONTRIBUTING](CONTRIBUTING.md) (folder layout, tests, measuring a change)
