---
name: pr
description: Use when asked to open, raise or update a pull request, or to finish a branch. Builds the PR from recorded evidence and keeps it draft while anything is unresolved.
---

# Open the pull request

Claim only what the work file records. Never merge, tag, deploy or enable auto-merge.

1. **Gate:** `node ../../scripts/gate.mjs <base>`. On a protected-path FAIL, revert the file and write the needed change to the org human-handoff file (`../../org/policy.md`). Secrets → stop. No Node → the gate is NOT RUN and the PR stays draft.
2. **Version:** bump from the contract line (breaking → major, additive → minor, internal → patch) where the repo keeps a version; add a changelog entry if there is a changelog.
3. **Clean and push:** no scratch files or logs; commit the work file with the change; push the branch.
4. **Draft or ready:** ready only if the gate ran and passed, every gate WARN is resolved in Evidence, no Critical/High is open, no needs-human item is open, and every AC has a passing test. Otherwise draft, with the reason on the first line.
5. **Body** (every heading present; write "none" when empty):
```markdown
## <ID> — <one line>
> Draft: <reason>        ← only when draft
### What changed    3–5 lines · contract → version
### Acceptance      AC → test → status
### Evidence @<sha> build / tests / gate
### Review          verdict per round; open findings
### Needs human     item · why
```
6. If the branch already has a PR, update it instead of opening another. Reply: `PR <ID> — DRAFT|READY <url> · held by: <reason|none>`.
