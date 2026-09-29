// rns start point: which branch a ticket's work starts from, and whether that is clear or the user must be asked.
// Local refs only (no network).   Usage: node start-point.mjs [named-branch] [--hotfix]
// Prints one line: Start: <branch> · clear|ask · <reason> · candidates: a, b
import { defaultBranch, isBranch, readConfig, tryGit } from './lib.mjs';

const out = (s) => process.stdout.write(s + '\n');
const top = tryGit(['rev-parse', '--show-toplevel'], process.cwd());
if (!top) { out('FAIL not a git repository'); process.exit(1); }
const root = top.trim();
const g = (args) => (tryGit(args, root) || '').trim();
const lines = (s) => s.split(/\r?\n/).filter(Boolean);

const args = process.argv.slice(2);
const hotfix = args.includes('--hotfix');
const named = args.find((a) => !a.startsWith('--')) || '';

const report = (branch, verdict, reason, candidates = []) => {
  out(`Start: ${branch || 'unknown'} · ${verdict} · ${reason}` + (candidates.length ? ` · candidates: ${candidates.join(', ')}` : ''));
  process.exit(0);
};

// Branch names without the origin/ prefix; a local branch wins over its remote-tracking copy.
const refs = lines(g(['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin']))
  .filter((r) => r !== 'origin/HEAD' && r !== 'origin');
const byName = new Map();
for (const r of refs) {
  const n = r.replace(/^origin\//, '');
  if (!byName.has(n) || !r.startsWith('origin/')) byName.set(n, r);
}
const ahead = (from, to) => Number(g(['rev-list', '--count', `${from}..${to}`])) || 0;
const current = g(['symbolic-ref', '--quiet', '--short', 'HEAD']);

// Clear: the user named it, or a human pinned it in config.
if (named) {
  if (isBranch(named, root)) report(named, 'clear', 'named');
  report(named, 'ask', 'named branch not found', [...byName.keys()].slice(0, 8));
}
const cfg = readConfig(root);
if (cfg.baseBranch) report(cfg.baseBranch, 'clear', 'config base_branch');

// A. No default branch detectable.
const def = defaultBranch(root);
if (!def) {
  const upstream = g(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  report(upstream || current, 'ask', 'no default branch (no origin/HEAD, main or master)', [...byName.keys()].slice(0, 8));
}
const defName = def.branch.replace(/^origin\//, '');

// D. Hotfix with release lines present: which line?
const releases = [...byName.keys()].filter((n) => /^(release|hotfix)\//.test(n));
if (hotfix && releases.length) report(byName.get(releases[0]), 'ask', 'hotfix: which release line', [...releases, defName]);

// Other long-lived branches besides the default.
const others = [...byName.keys()].filter((n) => n !== defName && /^(develop|dev|staging|release\/.+)$/.test(n));
const integration = others.find((n) => /^(develop|dev)$/.test(n) && ahead(def.branch, byName.get(n)) > 0);
const suggested = integration ? byName.get(integration) : def.branch;

// C. On a non-default branch that has its own commits: stack on it, or start fresh?
if (current && current !== defName && !others.includes(current) && ahead(suggested, 'HEAD') > 0) {
  report(suggested, 'ask', `on ${current} with its own commits: stack on it or start fresh`, [...new Set([suggested, def.branch, current])]);
}

// B. Several long-lived candidates and none named.
if (others.length) report(suggested, 'ask', 'several long-lived branches', [defName, ...others]);

report(def.branch, 'clear', current === defName ? 'on default' : `default (${def.source})`);
