# rns-plugin 0.7.6: a lean software factory for coding agents

rns makes an AI coding agent deliver a ticket the way a careful senior engineer would. It writes a failing test first, checks auth, tenancy and personal data in its own diff, reuses what the repo already has, and flags what needs a human. The output is a reviewable change with evidence.

It works in **Claude Code, Cursor and Codex**. It adds about 1,200 tokens of working rules to each session, plus five commands.

```
make-agent-ready (once per repo)
refine ──► build ──► review ──► pr
            ▲          │
            └─ repair ─┘  ≤ 3 rounds, then a human
```

---

## Does it help? With vs without

Measured on a .NET multi-tenant API with hidden acceptance tests (the agent never sees them) and a blind Opus judge. Model: Sonnet. Full data: [BENCHMARK.md](BENCHMARK.md).

| | **Without a plugin** | **With rns** (+ make-agent-ready once) |
|---|---|---|
| Hidden acceptance tests passed (T1–T4) | 87% (47/54) | **100% (85/85, 0.7.2; 0.7.3: 22/22 on T4)** |
| Security + GDPR task (T4), judge /50 | 32.7 | **41.3** |
| Safety score (auth, tenancy, privacy), /10 | 5.7 | **8.2** |
| Plain features and bug fixes (T1–T3), judge /50 | 42 · 46 · 38 | 40 · 48 · 40 (about the same) |
| Cost per ticket | **$0.42** | $0.78 (+ $0.50 one-off setup) |
| Time per ticket | **2.1 min** | 4.1 min |

**Where rns adds value:** changes that touch auth, roles, tenancy, personal data, exports or money. Without a plugin, agents repeatedly:
- kept the erased email (or a reversible hash of it) in an audit table;
- matched emails case-sensitively, so `Jane@ACME` survived "erasure";
- left CSV formula injection in exports;
- skipped the forbidden, cross-tenant and repeat-request tests.

rns catches these while the code is being written (rules 3, 4a, 4b), then again with its gate and review.

**Where it adds little:** small, low-risk features and bug fixes. There a plain agent is about as good, and roughly twice as fast and cheap.

**AGENTS.md, honestly:** on this 10-file repo, a fresh AGENTS.md did **not** measurably improve the next feature (T5, T6: same scores with a fresh, stale or no doc). Agents found the reusable code by reading it. Expect AGENTS.md to matter more on large repos and for humans and cloud agents joining cold. Treat that as likely, not proven. See [AGENTS-MD-STUDY.md](AGENTS-MD-STUDY.md).

**Rule of thumb:** use `build` for tickets that touch security, tenancy, personal data or public contracts, or when you want a PR with evidence. For a quick internal tweak, a plain prompt is fine; the injected rules still apply.

---

## Quick start

**Needs:** git, **Node 18+** (for the hooks and gate; without it rns still works, see Troubleshooting) and your stack's SDK.

### Claude Code
```text
/plugin marketplace add <path-or-git-url-of-this-folder>
/plugin install rns-plugin@rns
```
Commands: `/rns-plugin:make-agent-ready`, `/rns-plugin:build ABC-123`, `/rns-plugin:refine`, `/rns-plugin:review`, `/rns-plugin:pr`.
Local try-out: `claude --plugin-dir plugins/rns-plugin`.
What loads: the rules at session start (hook), the protected-path guard on every Write/Edit (hook), the skills.

### Cursor
Add this folder as a plugin marketplace (Cursor reads `.cursor-plugin/`), or copy `plugins/rns-plugin` to `~/.cursor/plugins/local/rns-plugin`, then restart Cursor. In Agent chat, ask for the skill by name, for example "use the rns build skill for ABC-123".
What loads: the rules at session start (hook) and the skills. Cursor has no pre-write hook, so protected paths are enforced by the gate instead.

### Codex
```bash
codex plugin marketplace add <path-of-this-folder>
codex plugin add rns-plugin@rns
```
Ask "use the rns build skill for ABC-123".
What loads: the skills. Codex runs no session-start hook, so the rules reach it two ways: every skill reads `rules.md` itself, and Codex reads the repo's `AGENTS.md` natively, which make-agent-ready points at `.rns/working-rules.md`. The fresh-subagent review needs Codex's multi-agent mode; without it, build runs review as a separate pass.

### Then, in each repo, once
Run **make-agent-ready**. It runs your build and test commands to verify them and writes a short `AGENTS.md` (context, verified commands, map, architecture, guardrails, existing mechanisms, done). Every later run reads it. Commit what it writes.

---

## Daily use

| Command | Use it when | What you get |
|---|---|---|
| `make-agent-ready` | once per repo; again after big merges (**refresh** mode) | a verified AGENTS.md rns block (≤ 200 lines), `CLAUDE.md` → `@AGENTS.md`, `.rns/config.yml`, `.rns/working-rules.md` |
| `refine` | the ticket is vague | ≤ 5 questions per round, each with a default; a ≤ 25-line brief with acceptance criteria that can fail |
| `build <ticket>` | implement a feature or fix, end to end (or "plan only") | plan (criterion → test) → red-green → self-check 4a/4b → **AGENTS.md docs delta** → verify + gate → review → repair → optional PR |
| `review` | check any branch or PR | findings with a quoted line and a concrete consequence; a missing test case is High |
| `pr` | open or update a PR | gate, then draft or ready, with a body built from the recorded evidence |

Unattended runs (CI, cloud agents) never stop to ask. They record defaults and mark risky assumptions **needs human**, which keeps the PR in draft.

---

## What rns writes to your repo (commit these)

| File | Written by | Purpose |
|---|---|---|
| `AGENTS.md` (block between `<!-- rns:begin/end -->`) | make-agent-ready; updated by build | the repo's memory: context, commands, map, architecture, guardrails, existing mechanisms, done. Text outside the markers is never touched. |
| `CLAUDE.md` | make-agent-ready | `@AGENTS.md`, because Claude Code doesn't read AGENTS.md on its own |
| `.rns/config.yml` | make-agent-ready | machine keys: `verified_sha`, commands, flags, `pii_fields`, `agents_md_budget: 200` |
| `.rns/working-rules.md` | make-agent-ready | the rules for hosts without session hooks; portable, with no absolute paths |
| `.rns/work/<ID>.md` | build, review | one per ticket: Brief · Plan · Evidence · Review. The PR body is built from it. |

**AGENTS.md stays current:** when build adds a feature (endpoint, page, job, event), a reusable mechanism, an invariant or a personal field, it updates just those lines in the same commit. The gate **warns** when a route or entity was added without an AGENTS.md change, and when setup or CI files changed since AGENTS.md was last updated (refresh it then).

**Cloud agents:** commit the files above. Add the plugin to the project's `.claude/settings.json` (marketplace plus `enabledPlugins`) so cloud sessions install it. Give the image git, Node 18+ and your SDK. Never commit `.claude/settings.local.json`, build output or secrets.

---

## How it works

| Layer | What | Cost |
|---|---|---|
| **Rules** (`rules.md`, injected) | 1 plan criterion → test · 2 red → green · 3 required test cases (roles, two tenants, error codes, filters, state, output fields, mass assignment, personal-data variants) · 4a security · 4b personal data · 5 fit the repo, read AGENTS.md · 6 finish with the gate | ~1,200 tokens |
| **Skills** | the five commands above, plus `rules` for hosts without hooks | loaded only when used |
| **Guard hook** (Claude Code) | blocks writes to CI, infra, lockfiles and secret files; the change goes to a hand-off note for a human | 0 tokens unless it fires |
| **Gate** (`scripts/gate.mjs`, any host) | FAIL: protected paths, secrets. WARN: no test change, personal data in logs, real-looking emails in fixtures, new anonymous endpoints, feature added without an AGENTS.md update, AGENTS.md over budget or stale | 0 tokens; the agent runs it |
| **Org policy** (`org/`) | SELISE numbers (page size, timeouts, retention…) and the protected-path list | read on demand |

Design principle: **checks detect; the agent builds a control only when the ticket or an existing repo mechanism requires it**, otherwise it's *needs human*. Rules that told agents to build controls caused scope creep and broke runs in our benchmarks.

### Host support
| | Claude Code | Cursor | Codex |
|---|---|---|---|
| Skills / commands | ✅ | ✅ | ✅ |
| Rules injected at session start | ✅ hook | ✅ hook | via skills + AGENTS.md |
| Protected-path guard before writes | ✅ | gate only | gate only |
| Gate | ✅ | ✅ | ✅ |
| Fresh-subagent review | ✅ | ✅ | multi-agent mode, else a separate pass |

Hooks and gate are zero-dependency Node files and behave the same in PowerShell, cmd, Git Bash, bash and zsh (verified on Windows; macOS/Linux use the same code paths).

---

## Customise for your organisation
Edit only `plugins/rns-plugin/org/`:
- `policy.md`: numbers and rules (page size, retries, coverage, audit retention…)
- `protected-paths.txt`: paths agents must never write

A repo can add its own protected paths in `.rns/protected-paths.txt`. A repo's AGENTS.md guardrails win over org defaults.

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| Evidence says `Gate: NOT RUN (node missing)` and the PR stays draft | install Node 18+; hooks and gate fail open without it |
| The agent doesn't seem to know the rules | Claude Code/Cursor: check the plugin is enabled and the session restarted. Codex: run make-agent-ready so AGENTS.md points at the rules. |
| Gate WARN "AGENTS.md may be stale" | setup/CI changed or 30+ commits since the last update: run `make-agent-ready` (it refreshes only what changed) |
| Gate WARN "feature … but AGENTS.md unchanged" | add the feature's Map line, or state in Evidence why none is needed |
| An edit to `.github/…` is blocked | by design; the needed change is written to `docs/ci-cd-requirements.md` for a human |
| Headless or CI runs fail with an auth error | re-login the CLI (`claude` → `/login`) |

## More
- [CHANGELOG.md](CHANGELOG.md): what changed and why, 0.7.0 → 0.7.6
- [BENCHMARK.md](BENCHMARK.md): method, tasks, every run
- [AGENTS-MD-STUDY.md](AGENTS-MD-STUDY.md): does AGENTS.md help the next feature?
- [CONTRIBUTING.md](CONTRIBUTING.md): principles, layout, tests and how to measure a change

```
plugins/rns-plugin/
  rules.md            working rules (injected; single source)
  skills/             make-agent-ready · refine · build · review · pr · rules
  hooks/              session-start.mjs · guard.mjs · hooks.json (Claude Code) · hooks-cursor.json
  scripts/            gate.mjs · start-point.mjs · lib.mjs
  org/                policy.md · protected-paths.txt
  .claude-plugin/ .cursor-plugin/ .codex-plugin/
```
