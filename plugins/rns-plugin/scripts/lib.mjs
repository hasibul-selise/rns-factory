// Shared helpers for the rns hooks and gate. Node >= 18, built-ins only.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));

export const toPosix = (p) => p.replace(/\\/g, '/');

export function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

export function tryGit(args, cwd) {
  try { return git(args, cwd); } catch { return null; }
}

export function readText(file) {
  try { return readFileSync(file, 'utf8'); } catch { return ''; }
}

// Shell case pattern -> RegExp: * matches anything including "/", ? one char, [..] a class. Case-insensitive.
export function globToRegex(pattern) {
  let re = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '*') re += '.*';
    else if (c === '?') re += '.';
    else if (c === '[') {
      const end = pattern.indexOf(']', i + 1);
      if (end < 0) { re += '\\['; continue; }
      re += '[' + pattern.slice(i + 1, end).replace(/^!/, '^').replace(/\\/g, '\\\\') + ']';
      i = end;
    } else re += c.replace(/[.+^${}()|\\/]/g, '\\$&');
  }
  return new RegExp('^' + re + '$', 'i');
}

// Org list plus the repo's optional .rns/protected-paths.txt.
export function protectedPatterns(repoRoot) {
  const text = readText(join(pluginRoot, 'org', 'protected-paths.txt')) + '\n' +
    (repoRoot ? readText(join(repoRoot, '.rns', 'protected-paths.txt')) : '');
  return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map(globToRegex);
}

// The repo's default branch from local refs only (no network): origin/HEAD, else the first common name that exists.
export function defaultBranch(repoRoot) {
  const head = (tryGit(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], repoRoot) || '').trim();
  if (head) return { branch: head, source: 'origin/HEAD' };
  for (const b of ['origin/main', 'origin/master', 'main', 'master']) {
    if (tryGit(['rev-parse', '--verify', '-q', `${b}^{commit}`], repoRoot)) return { branch: b, source: 'fallback' };
  }
  return null;
}

// True when name is a local or remote-tracking branch (not a sha or tag).
export function isBranch(name, repoRoot) {
  return ['refs/heads/', 'refs/remotes/'].some((p) => tryGit(['rev-parse', '--verify', '-q', p + name], repoRoot));
}

// Minimal reader for the few .rns/config.yml keys the gate needs.
export function readConfig(repoRoot) {
  const text = readText(join(repoRoot, '.rns', 'config.yml'));
  const baseBranch = (text.match(/^base_branch:\s*["']?([^"'\s#]+)/m) || [])[1];
  let piiFields = [];
  const inline = text.match(/^pii_fields:\s*\[([^\]]*)\]/m);
  if (inline) piiFields = inline[1].split(',');
  else {
    const block = text.match(/^pii_fields:\s*\r?\n((?:[ \t]+-.*\r?\n?)+)/m);
    if (block) piiFields = block[1].split(/\r?\n/).map((l) => l.replace(/^\s*-\s*/, ''));
  }
  piiFields = piiFields.map((f) => f.trim().replace(/^["']|["']$/g, '').split('.').pop()).filter(Boolean);
  const agentsBudget = Number((text.match(/^agents_md_budget:\s*(\d+)/m) || [])[1]) || 0;
  return { baseBranch, piiFields, agentsBudget };
}
