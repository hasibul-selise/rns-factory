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
if (env.CURSOR_PLUGIN_ROOT) {
  out = { additional_context: text };
} else if (env.CLAUDE_PLUGIN_ROOT && !env.COPILOT_CLI) {
  out = { hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } };
} else {
  // Copilot CLI and other hosts: the SDK-standard top-level field. Emit exactly one field; a host that reads several would inject twice.
  out = { additionalContext: text };
}
process.stdout.write(JSON.stringify(out) + '\n');
