# Contributing to rns-plugin

Thanks for improving the plugin. Every rule here came out of a benchmark, so please read the principles before you change behaviour, and measure before you claim a gain.

## Principles (learned the hard way)
1. **Checks detect; the agent builds a control only when the ticket or an existing repo mechanism calls for it.** Otherwise it records **needs human**. A rule that names a specific control ("use an HMAC with a configured secret") made agents build secret infrastructure the repo didn't have (0.7.1: one run returned 500 outside its own tests). Always add "via the repo's existing mechanism, else needs human".
2. **Inline beats links.** Anything that must shape every run goes into `rules.md` (injected at session start) or inline in a SKILL.md. Traces showed agents skip linked reference files on small tasks.
3. **One source per fact.** `rules.md` holds the test cases (rule 3) and risk checks (4a, 4b); skills refer to them by number. AGENTS.md holds repo facts; `.rns/config.yml` holds machine keys. Don't copy lists between files.
4. **Output tokens and turns are the cost.** Keep artifacts to tables and one-liners; cap sizes (work file sections, AGENTS.md budget). Batch reads and commands.
5. **Gate heuristics only WARN.** FAIL is reserved for protected paths and secrets. If a WARN is noisy, tighten the pattern; don't promote it.
6. **Host-neutral wording.** Describe actions ("run review in a fresh subagent; no subagents → a fresh pass yourself"), not one host's tool names.

## Layout
```
plugins/rns-plugin/
  rules.md                 the working rules (injected; single source for rules 1–6)
  skills/<name>/SKILL.md   make-agent-ready · refine · build · review · pr · rules
  hooks/                   session-start.mjs (inject rules) · guard.mjs (block protected paths) · hooks.json (Claude Code) · hooks-cursor.json
  scripts/gate.mjs         the diff gate · lib.mjs shared helpers (Node ≥ 18, built-ins only)
  org/                     policy.md · protected-paths.txt (the only organisation-specific files)
  .claude-plugin/ .cursor-plugin/ .codex-plugin/   one manifest per host
```

## Making a change
- **A rule:** edit `rules.md`. Keep the injected text under about 1,300 tokens (check with the session-start command below).
- **A skill:** keep the step numbers stable where other files refer to them (build step 5 is the docs delta, step 6 Verify).
- **The gate:** add a numbered check in `scripts/gate.mjs`; label it `PASS <what>` or `WARN <what>: file:line`; never print secret values. Keep checks 1–6 behaviour stable.
- **Org values:** only in `org/`. Nothing else may contain SELISE-specific numbers.
- **Hooks:** Node built-ins only, no `npm install`. Fail open: any error exits non-zero but **not 2** (2 blocks a tool call in Claude Code).
- **Versions:** bump every manifest (`plugins/rns-plugin/.{claude,cursor,codex}-plugin/plugin.json`, both `marketplace.json`) and add a CHANGELOG entry saying *why*.

## Test before you open a PR
From PowerShell **and** a POSIX shell (Git Bash, macOS or Linux):
```bash
claude plugin validate plugins/rns-plugin
CLAUDE_PLUGIN_ROOT=plugins/rns-plugin node plugins/rns-plugin/hooks/session-start.mjs   # JSON with hookSpecificOutput.additionalContext
CURSOR_PLUGIN_ROOT=plugins/rns-plugin node plugins/rns-plugin/hooks/session-start.mjs   # JSON with additional_context
echo '{"cwd":"<repo>","tool_input":{"file_path":"<repo>/.github/x.yml"}}' | node plugins/rns-plugin/hooks/guard.mjs; echo $?   # 2
node plugins/rns-plugin/scripts/gate.mjs <base-sha>   # run inside a git repo: PASS/WARN/FAIL lines, then GATE PASS|FAIL
```
For a gate change, also plant a case that must WARN and a clean diff that must PASS (see `working_content/bench` for the seed repo).

## Measure behaviour changes
Any change to rules or skills is a claim that needs evidence. The harness lives in `working_content/bench` (a .NET multi-tenant seed, hidden acceptance tests, a blind Opus judge):
```bash
bash working_content/bench/run2.sh T4 rns73r sonnet _try1     # one ticket run (plugin variants run make-agent-ready once first)
python working_content/bench/score.py T4-rns73r_try1          # hidden tests, cost, turns, diff
bash working_content/bench/judge.sh T4-rns73r_try1 opus       # blind 0–50 judge
```
Run at least T3 and T4 (the tasks with traps), two repeats each; ±2 judge points is noise. Write the numbers into `working_content/bench/results.md` and the CHANGELOG.

## Host compatibility checklist
- **Claude Code:** `hooks/hooks.json` uses `${CLAUDE_PLUGIN_ROOT}` and matcher `startup|clear|compact`; the guard runs on `Write|Edit|MultiEdit|NotebookEdit`.
- **Cursor:** `.cursor-plugin/plugin.json` points at `./skills/` and `./hooks/hooks-cursor.json`, which uses `"version": 1`, a lowercase `sessionStart` and a relative command. session-start detects `CURSOR_PLUGIN_ROOT` first and emits `additional_context` only.
- **Codex:** `.codex-plugin/plugin.json` declares `"skills": "./skills/"` and **`"hooks": {}`**, so Codex doesn't auto-run the Claude-shaped `hooks.json`. Codex has no session-start hook; it gets the rules from the skills (each reads `rules.md`) and from the repo's `AGENTS.md`, which it reads natively.
- Emit exactly one context field per host: Claude Code reads both `additional_context` and `hookSpecificOutput` and would inject twice.
