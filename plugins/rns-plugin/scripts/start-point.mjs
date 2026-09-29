// rns start point: where a ticket's work starts and where its PR goes, and whether that is clear or the user must be asked.
// Branches come only from the user (the arg) or git; no branch names are assumed.   Usage: node start-point.mjs [named-branch]
// Prints one line: Start: <branch> · clear|ask · <reason> [· options: …]
// On any branch other than the default it always asks: here → <fork> | stack on <current> | fresh from <fork>.
import { defaultBranch, isBranch, tryGit } from './lib.mjs';

const out = (s) => process.stdout.write(s + '\n');
const top = tryGit(['rev-parse', '--show-toplevel'], process.cwd());
if (!top) { out('FAIL not a git repository'); process.exit(1); }
const root = top.trim();
const g = (args) => (tryGit(args, root) || '').trim();
const lines = (s) => s.split(/\r?\n/).filter(Boolean);
const named = process.argv.slice(2).find((a) => !a.startsWith('--')) || '';

const report = (branch, verdict, reason, options = []) => {
  out(`Start: ${branch || 'unknown'} · ${verdict} · ${reason}` + (options.length ? ` · options: ${options.join(' | ')}` : ''));
  process.exit(0);
};

const refs = lines(g(['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads', 'refs/remotes/origin']))
  .filter((r) => r !== 'origin/HEAD' && r !== 'origin');
const ahead = (from, to) => Number(g(['rev-list', '--count', `${from}..${to}`])) || 0;
const sha = (ref) => g(['rev-parse', '--verify', '-q', `${ref}^{commit}`]);
const current = g(['symbolic-ref', '--quiet', '--short', 'HEAD']);
const sameBranch = (a, b) => a && b && a.replace(/^origin\//, '') === b.replace(/^origin\//, '');

if (named && !isBranch(named, root)) report(named, 'ask', 'named branch not found', refs.slice(0, 8));

const def = defaultBranch(root);
const defNote = def?.hint ? ` (${def.hint})` : '';

// Fork point: the other branch HEAD has the fewest own commits over (ties → most recent); falls back to the default.
const others = refs.filter((r) => !sameBranch(r, current) && sha(r));
const fork = others.reduce((best, r) => {
  const n = ahead(r, 'HEAD');
  return best && best.n <= n ? best : { r, n };
}, null);
const from = def && fork && ahead(def.branch, 'HEAD') === fork.n ? def.branch : fork?.r;

// A named branch other than the one checked out: start from it, PR into it.
if (named && !sameBranch(named, current)) report(named, 'clear', 'named');

if (!def) report(from || current, 'ask', 'no default branch from git (no origin/HEAD, remote not reachable)', others.slice(0, 8));

// On the default (or detached at its tip): fresh branch from it.
const onDefault = sameBranch(current, def.branch) || (!current && sha('HEAD') === sha(def.branch));
if (onDefault) report(def.branch, 'clear', `on default (${def.source})${defNote}`);

// Anywhere else: always ask.
const own = ahead(from || def.branch, 'HEAD');
const where = current || 'detached HEAD';
const target = from || def.branch;
const forkNote = sameBranch(target, def.branch) ? '' : `, fork point ${target}, default ${def.branch}`;
report(target, 'ask', `on ${where} (${own} own commit${own === 1 ? '' : 's'}${forkNote})${defNote}`, [
  `here → ${target}${own ? ` (PR includes ${own} earlier commit${own === 1 ? '' : 's'})` : ''}`,
  ...(current ? [`stack on ${current}`] : []),
  `fresh from ${target}`,
]);
