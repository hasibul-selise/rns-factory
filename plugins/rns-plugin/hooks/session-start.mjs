// SessionStart: inject the rns working rules (~900 tokens). Emits the JSON field each host expects.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pluginRoot, toPosix } from '../scripts/lib.mjs';

let text;
try {
  text = readFileSync(join(pluginRoot, 'rules.md'), 'utf8').replaceAll('{{PLUGIN}}', toPosix(pluginRoot));
} catch {
  process.exit(0); // fail open: skills read rules.md themselves
}

const env = process.env;
let out;
// Cursor's hook process always has CURSOR_VERSION and CURSOR_PROJECT_DIR. CURSOR_PLUGIN_ROOT is not one of them, so keying only on it emits the wrong field and the rules are dropped. Do not use CLAUDE_PROJECT_DIR: Claude Code sets that too.
if (env.CURSOR_PLUGIN_ROOT || env.CURSOR_VERSION || env.CURSOR_PROJECT_DIR) {
  out = { additional_context: text };
} else if (env.CLAUDE_PLUGIN_ROOT && !env.COPILOT_CLI) {
  out = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } };
} else {
  // Copilot CLI and other hosts: the SDK-standard top-level field. Emit exactly one field; a host that reads several would inject twice.
  out = { additionalContext: text };
}
process.stdout.write(JSON.stringify(out) + '\n');
