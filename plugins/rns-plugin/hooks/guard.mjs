// PreToolUse guard: block Write/Edit on protected paths (exit 2). Costs no context unless it fires.
// Shell-driven writes are not intercepted; scripts/gate.mjs catches them on the diff.
// Override for one session: RNS_ALLOW_PROTECTED=1
import { join, isAbsolute, relative, resolve } from 'node:path';
import { pluginRoot, protectedPatterns, readText, toPosix, tryGit } from '../scripts/lib.mjs';

if (process.env.RNS_ALLOW_PROTECTED === '1') process.exit(0);

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(raw); } catch { process.exit(0); }
  const ti = input.tool_input || {};
  const file = ti.file_path || ti.notebook_path || ti.path;
  if (!file) process.exit(0);

  const cwd = input.cwd || process.cwd();
  const abs = isAbsolute(file) ? file : resolve(cwd, file);
  const top = tryGit(['rev-parse', '--show-toplevel'], cwd);
  const root = top ? top.trim() : '';
  let rel = toPosix(abs);
  if (root) {
    const r = toPosix(relative(root, abs));
    if (r && !r.startsWith('../') && !isAbsolute(r)) rel = r;
  }

  if (protectedPatterns(root).some((re) => re.test(rel))) {
    const handoff = (readText(join(pluginRoot, 'org', 'policy.md')).match(/^\| human-handoff-file \| `([^`]*)`/m) || [])[1];
    process.stderr.write(`rns guard: '${rel}' is a protected path (CI/CD, infra, lockfile or secret). Don't edit it; write the required change to ${handoff || 'a hand-off note'} for a human.\n`);
    process.exit(2);
  }
  process.exit(0);
});
