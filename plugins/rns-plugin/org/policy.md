# Org policy — SELISE

The only file in this plugin that holds organisation-specific rules and numbers. Skills and check packs name the rule ("the org page-size limit") and look it up here. To use the plugin elsewhere, replace this folder.

Precedence: the repo's `.rns/rules.md` > this file > nothing. A number that appears nowhere is not enforced.

## Numbers

| Key | Value |
|---|---|
| page-size | default 20, max 100, enforced server-side |
| outbound-timeout | explicit on every HTTP, DB and broker call |
| retry | backoff, max 3 attempts, only for idempotent operations |
| coverage-new-lines | handlers/services/middleware 90% · mappers/validators 100% · UI components 80% |
| audit-retention | ≥ 1 year, append-only |
| accessibility | WCAG 2.1 AA on changed screens |
| dependency-hold | critical, or high without an owned and dated mitigation → PR stays draft |
| human-handoff-file | `docs/ci-cd-requirements.md` — where agents write changes a human must apply to protected paths |

## Rules

| # | Sev | Rule |
|---|---|---|
| O1 | Critical | The tenant/partition key comes only from the verified identity and is applied at the data layer. Cross-tenant access returns not-found |
| O2 | High | Errors leave the API as RFC 7807 Problem Details with a stable `code` |
| O3 | High | Personal data has a classification and a retention period in the brief; unknown → *needs a human* |
| O4 | High | Every data component renders loading, empty and error states |
| O5 | — | Ticket ids match `[A-Z]+-\d+`; branch `<type>/<ID>-<slug>` unless the repo says otherwise |

Protected paths (agents never write them) are listed in `protected-paths.txt` and enforced by the hook and `scripts/gate.mjs`.
