import { spawnSync } from 'node:child_process';

// Inspect the index, not working files: an unstaged edit cannot hide a staged
// secret. Diagnostics report only filenames, line numbers, and rule names.
function git(args, input, allowedStatuses = [0]) {
  const result = spawnSync('git', args, { input, maxBuffer: 64 * 1024 * 1024 });
  if (result.error || !allowedStatuses.includes(result.status)) {
    throw new Error(`Git safety check failed during ${args[0]}; commit blocked.`);
  }
  return result.stdout;
}

const rules = [
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['API secret key', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}/],
  ['private key', /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/],
  ['credentials in URL', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@/i],
  ['personal filesystem path', /(?:\b[A-Z]:[\\/]Users[\\/]|\/Users\/|\/home\/)[A-Za-z0-9_.-]+/i],
];

function scanText(path, content) {
  const issues = [];
  const template = /(?:^|\/)\.env\.(?:example|sample|template)$/.test(path);
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    for (const [label, pattern] of rules) {
      if (pattern.test(line)) issues.push(`${path}:${index + 1}: possible ${label}`);
    }
    for (const match of line.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g)) {
      const domain = match[1].toLowerCase();
      const sshRemote = match[0] === 'git' + '@github.com' && /^[:/]/.test(line.slice(match.index + match[0].length));
      if (sshRemote) continue;
      if (!/^(?:example\.(?:com|org|net)|users\.noreply\.github\.com)$/.test(domain)) {
        issues.push(`${path}:${index + 1}: review email address before publishing`);
        break;
      }
    }
    if (template && !line.trimStart().startsWith('#')) {
      const assignment = line.match(/^\s*([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)\s*=\s*(.*)$/i);
      if (assignment && !/^(?:""|'')?\s*(?:#.*)?$/.test(assignment[2])) {
        issues.push(`${path}:${index + 1}: credential values in environment templates must be blank`);
      }
    }
  }
  return issues;
}

try {
  const entries = git(['ls-files', '--stage', '-z']).toString('utf8')
    .split('\0').filter(Boolean).map((entry) => {
      const match = entry.match(/^(\d+) ([a-f0-9]+) ([0-3])\t([\s\S]+)$/);
      if (!match || match[3] !== '0') throw new Error('Resolve index conflicts before running the safety check.');
      return { mode: match[1], oid: match[2], path: match[4] };
    });
  const issues = [];
  if (entries.length) {
    const ignored = git(['check-ignore', '--no-index', '-z', '--stdin'],
      entries.map(({ path }) => path).join('\0') + '\0', [0, 1]);
    for (const path of ignored.toString('utf8').split('\0').filter(Boolean)) {
      issues.push(`${path}: ignored file is tracked; remove it from the index with git rm --cached`);
    }
  }

  const blobs = entries.filter(({ mode }) => mode !== '160000');
  const objects = [...new Set(blobs.map(({ oid }) => oid))];
  const contents = new Map();
  if (objects.length) {
    const batch = git(['cat-file', '--batch'], objects.join('\n') + '\n');
    let offset = 0;
    for (const oid of objects) {
      const newline = batch.indexOf(10, offset);
      const header = batch.subarray(offset, newline).toString('ascii');
      const match = header.match(/^([a-f0-9]+) blob (\d+)$/);
      if (!match || match[1] !== oid) throw new Error('Cannot read staged blob; commit blocked.');
      const size = Number(match[2]);
      const content = batch.subarray(newline + 1, newline + 1 + size);
      if (!content.includes(0)) contents.set(oid, content.toString('utf8'));
      offset = newline + 1 + size + 1;
    }
  }
  for (const { oid, path } of blobs) {
    if (contents.has(oid)) issues.push(...scanText(path, contents.get(oid)));
  }

  if (issues.length) {
    console.error('Repository safety check blocked the commit:\n' + issues.map((issue) => `- ${issue}`).join('\n'));
    console.error('Keep real secrets and personal data in ignored local files. See docs/git-safety.md.');
    process.exitCode = 1;
  } else {
    console.log(`Repository safety check passed (${entries.length} staged snapshot files).`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
