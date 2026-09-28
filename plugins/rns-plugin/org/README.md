# org/ — the only organisation-specific folder

| File | Used by |
|---|---|
| `policy.md` | skills and check packs, which look up org numbers and rules here |
| `protected-paths.txt` | `hooks/guard.mjs` (blocks writes) and `scripts/gate.mjs` (fails the diff) |

To reuse rns-plugin for another organisation, edit or replace these two files. Nothing else in the plugin contains SELISE-specific values.
