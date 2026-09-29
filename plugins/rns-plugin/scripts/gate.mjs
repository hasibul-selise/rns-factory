// rns gate: deterministic checks on the diff since <base> (committed + uncommitted + untracked).
// Any host with Node >= 18 and git.   Usage: node gate.mjs [base-sha | base-branch]   Exit 1 on FAIL.
// FAIL: protected paths, secrets. WARN (resolve each in Evidence): tests, personal data in logs,
// real-looking data in fixtures, new anonymous endpoints.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defaultBranch, isBranch, protectedPatterns, readConfig, tryGit } from './lib.mjs';

const out = (s) => process.stdout.write(s + '\n');
const top = tryGit(['rev-parse', '--show-toplevel'], process.cwd());
if (!top) { out('FAIL not a git repository'); process.exit(1); }
const root = top.trim();
const g = (args) => tryGit(args, root);
const cfg = readConfig(root);

// Base: the arg (a branch → its merge-base; a sha as is), else config base_branch, else the repo's default branch.
let base = process.argv[2] || '';
let from = 'arg';
let branch = '';
if (base && isBranch(base, root)) branch = base;
else if (!base) {
  const def = cfg.baseBranch ? { branch: cfg.baseBranch, source: 'config' } : defaultBranch(root);
  if (!def) { out('FAIL base not found (pass a base branch or sha, or run: git remote set-head origin --auto)'); process.exit(1); }
  branch = def.branch; from = def.source;
}
if (branch) {
  base = (g(['merge-base', 'HEAD', branch]) || '').trim();
  if (!base) { out(`FAIL no merge-base with '${branch}' (pass a base sha)`); process.exit(1); }
  from = `${from}: ${branch}`;
}
if (!g(['rev-parse', '--verify', '-q', `${base}^{commit}`])) { out(`FAIL base '${base}' not found`); process.exit(1); }
out(`Base: ${base.slice(0, 12)} (from ${from})`);

const lines = (s) => (s || '').split(/\r?\n/).filter(Boolean);
const untracked = lines(g(['ls-files', '--others', '--exclude-standard']));
const changed = [...new Set([...lines(g(['diff', '--name-only', base])), ...untracked])].sort();
let status = 0;

// 1. Protected paths (org list + optional repo list). A lockfile next to a changed manifest is a WARN.
const patterns = protectedPatterns(root);
const manifestChanged = changed.some((f) => /(package\.json|\.csproj|Directory\.Packages\.props|pyproject\.toml|requirements.*\.txt|go\.mod|Cargo\.toml|Gemfile|composer\.json)$/i.test(f));
const isLock = (f) => /(\.lock|package-lock\.json|packages\.lock\.json|pnpm-lock\.yaml)$/i.test(f);
const hits = [], lockwarn = [];
for (const f of changed) {
  if (!patterns.some((re) => re.test(f))) continue;
  if (isLock(f) && manifestChanged) lockwarn.push(f); else hits.push(f);
}
if (hits.length) { out(`FAIL protected paths changed: ${hits.join(' ')}`); status = 1; } else out('PASS protected paths');
if (lockwarn.length) out(`WARN lockfile changed with its manifest (dependency change — review it): ${lockwarn.join(' ')}`);

// Added lines with file and line number: tracked diff hunks + every line of untracked text files.
const added = [];
let file = null, ln = 0;
for (const l of (g(['diff', base, '-U0', '--no-color', '--no-ext-diff']) || '').split('\n')) {
  const line = l.replace(/\r$/, '');
  if (line.startsWith('+++ ')) { file = line === '+++ /dev/null' ? null : line.replace(/^\+\+\+ (b\/)?/, ''); continue; }
  const h = line.match(/^@@ -\S+ \+(\d+)/);
  if (h) { ln = Number(h[1]); continue; }
  if (file && line.startsWith('+')) added.push({ file, line: ln++, text: line.slice(1) });
}
for (const f of untracked) {
  try {
    if (statSync(join(root, f)).size > 1024 * 1024) continue;
    const text = readFileSync(join(root, f), 'utf8');
    if (text.includes('\0')) continue;
    text.split(/\r?\n/).forEach((t, i) => added.push({ file: f, line: i + 1, text: t }));
  } catch { /* unreadable: skip */ }
}
const report = (pass, label, found) => {
  if (!found.length) { out(`PASS ${pass}`); return; }
  const shown = found.slice(0, 10).map((a) => `${a.file}:${a.line}`).join(' ');
  out(`WARN ${label}: ${shown}${found.length > 10 ? ` (+${found.length - 10} more)` : ''}`);
};

// 2. Secrets in added lines (value never printed)
const secretRe = /(-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}|(password|passwd|secret|api[_-]?key|access[_-]?token)["']?\s*[:=]\s*["'][^"' ]{8,})/i;
const secrets = added.filter((a) => secretRe.test(a.text)).length;
if (secrets) { out(`FAIL possible secret in added lines (${secrets} match; value not shown; rotate if real)`); status = 1; } else out('PASS secrets');

// 3. Code changed without any test change
const isTest = (f) => /(^|\/)(tests?|__tests__|specs?)\/|(Tests?|Spec)\.[a-z]+$|\.(test|spec)\.[a-z]+$|(^|\/)test_[^/]*\.py$|_test\.(go|py)$/.test(f);
const isCode = (f) => /\.(cs|ts|tsx|js|jsx|mjs|py|go|java|kt|rb|php)$/.test(f);
const code = changed.filter((f) => isCode(f) && !isTest(f));
if (code.length && !changed.some(isTest)) out('WARN code changed with no test file changed'); else out('PASS tests touched');

// 4. Personal data in logs, exceptions or telemetry (rule 4b)
const logRe = /(\b_?(logger|log|logging|console|telemetry|tracer|span)\s*[.(]|\bLog(Information|Warning|Error|Debug|Critical|Trace)\s*\(|\b(print|println|printf)\s*\(|\b(Debug|Trace)\.Write|\bthrow\s+new\s+\w*(Exception|Error)\s*\(|\braise\s+\w+\()/i;
const piiTokens = ['e-?mail', 'phone', 'mobile', 'address', 'first_?name', 'last_?name', 'full_?name', 'surname', 'ssn', 'national_?id', 'tax_?id', 'passport', 'birth', 'dob', 'iban',
  ...cfg.piiFields.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))];
const piiRe = new RegExp(`(${piiTokens.join('|')})`, 'i');
report('no personal data in logs', 'possible personal data in log/exception/telemetry (log the id instead)',
  added.filter((a) => isCode(a.file) && !isTest(a.file) && logRe.test(a.text) && piiRe.test(a.text)));

// 5. Real-looking personal data in fixtures, seeds, snapshots and tests (rule 4b)
const isFixture = (f) => isTest(f) || /(^|\/)(fixtures?|seeds?|seed-?data|snapshots?|__snapshots__|mocks?|testdata)\/|seed|fixture|\.snap$/i.test(f);
const emailRe = /[A-Za-z0-9._%+-]+@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})/g;
const safeDomain = (d) => /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i.test(d);
report('fixture data synthetic', 'real-looking email in fixture/seed/test (use @example.com)',
  added.filter((a) => isFixture(a.file) && [...a.text.matchAll(emailRe)].some((m) => !safeDomain(m[1]))));

// 6. New anonymous surface (rule 4a): confirm the brief marks it public
report('no new anonymous endpoint', 'new anonymous endpoint (brief must mark it public)',
  added.filter((a) => isCode(a.file) && !isTest(a.file) && /\[AllowAnonymous\]|\.AllowAnonymous\(\)|@PermitAll\b|\.permitAll\(\)|@Public\(\)/.test(a.text)));

// 7. Structural change without an AGENTS.md update (docs delta)
const structRe = /\bDbSet<|\bAddPolicy\s*\(|\bMapGroup\s*\(|\bAddHostedService<|\bAddHttpClient\b|\bHttpInterceptorFn\b|\bimplements\s+HttpInterceptor\b|\bcreateFeature\s*\(|\bsignalStore\s*\(|\bprovideRouter\s*\(|\bAPIRouter\s*\(|\bexpress\.Router\s*\(|\.Map(Get|Post|Put|Patch|Delete|Methods)\s*\(|\[Http(Get|Post|Put|Patch|Delete)\b|\[Route\s*\(|^\s*\{\s*path\s*:\s*['"`]|@(Get|Post|Put|Patch|Delete)(Mapping)?\s*\(|\brouter\.(get|post|put|patch|delete)\s*\(|@app\.(get|post|put|patch|delete)\s*\(/;
const structural = added.filter((a) => isCode(a.file) && !isTest(a.file) && structRe.test(a.text));
const agentsTouched = changed.some((f) => /^AGENTS\.md$/i.test(f));
const agentsExists = (() => { try { return statSync(join(root, 'AGENTS.md')).isFile(); } catch { return false; } })();
if (!agentsExists) out('PASS docs delta (no AGENTS.md; run make-agent-ready to create one)');
else if (structural.length && !agentsTouched) {
  const shown = structural.slice(0, 5).map((a) => `${a.file}:${a.line}`).join(' ');
  out(`WARN new feature or structural change (route/endpoint, entity, policy, service, interceptor, store) but AGENTS.md unchanged — update the rns block or say why not: ${shown}`);
} else out('PASS docs delta');

// 8. AGENTS.md rns block within budget
const agentsText = (() => { try { return readFileSync(join(root, 'AGENTS.md'), 'utf8'); } catch { return ''; } })();
const block = (agentsText.match(/<!-- rns:begin -->([\s\S]*?)<!-- rns:end -->/) || [])[1];
if (block !== undefined) {
  const n = block.split(/\r?\n/).filter((l) => l.trim()).length;
  const budget = cfg.agentsBudget || 200;
  if (n > budget) out(`WARN AGENTS.md rns block is ${n} lines (budget ${budget}) — merge or drop stale lines`); else out(`PASS AGENTS.md size (${n}/${budget})`);
}

// 9. AGENTS.md staleness: commits since the rns block was last written that it hasn't seen
if (agentsExists) {
  const lastDoc = (g(['log', '-1', '--format=%H', base, '--', 'AGENTS.md']) || '').trim();
  if (lastDoc) {
    const since = lines(g(['log', '--format=%H', `${lastDoc}..${base}`]));
    const touched = lines(g(['diff', '--name-only', lastDoc, base]));
    const setup = touched.filter((f) => /(^|\/)(package\.json|angular\.json|global\.json|Directory\.(Build|Packages)\.props|[^/]+\.(csproj|sln|slnx)|pyproject\.toml|go\.mod|Cargo\.toml)$|^\.github\/|^\.gitlab-ci\.yml$|^azure-pipelines/i.test(f));
    if (setup.length || since.length > 30) {
      const why = [setup.length ? `setup/CI changed (${setup.slice(0, 3).join(' ')})` : '', since.length > 30 ? `${since.length} commits` : ''].filter(Boolean).join(', ');
      out(`WARN AGENTS.md may be stale: ${why} since it was last updated — run make-agent-ready (refresh)`);
    } else out(`PASS AGENTS.md fresh (${since.length} commits since last update)`);
  }
}

out(`GATE ${status === 0 ? 'PASS' : 'FAIL'} base=${(g(['rev-parse', '--short', base]) || base).trim()}`);
process.exit(status);
