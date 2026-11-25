import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const canonical = 'https://github.com/PRITIK03/ReactNodeInterviewMatrix---Comprehensive-Interview-Assessment-Platform.git';

function run(repo, executable, args, input) {
  return spawnSync(executable, args, { cwd: repo, encoding: 'utf8', input });
}

function git(repo, ...args) {
  const result = run(repo, 'git', args);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function write(repo, name, content) {
  mkdirSync(dirname(join(repo, name)), { recursive: true });
  writeFileSync(join(repo, name), content);
}

function fixture(t) {
  const tempRoot = realpathSync(tmpdir());
  const repo = mkdtempSync(join(tempRoot, 'interview-repo-safety-'));
  t.after(() => {
    const target = realpathSync(repo);
    assert.ok(target.startsWith(tempRoot + sep));
    assert.equal(target, resolve(repo));
    rmSync(target, { recursive: true, force: true });
  });
  git(repo, 'init', '--quiet');
  git(repo, 'config', 'user.name', 'Safety Tests');
  git(repo, 'config', 'user.email', 'tester@users.noreply.github.com');
  git(repo, 'config', 'core.hooksPath', '.githooks');
  git(repo, 'config', 'commit.gpgsign', 'false');
  for (const name of ['.gitignore', '.gitattributes', '.githooks/pre-commit', '.githooks/pre-push', 'scripts/check-repo-safety.mjs']) {
    mkdirSync(dirname(join(repo, name)), { recursive: true });
    copyFileSync(join(sourceRoot, name), join(repo, name));
  }
  git(repo, 'add', '.');
  return repo;
}

function check(repo) {
  return run(repo, process.execPath, [join(repo, 'scripts/check-repo-safety.mjs')]);
}

test('public source, question banks, lockfiles, and blank templates remain committable', (t) => {
  const repo = fixture(t);
  write(repo, 'data/companies.json', '[]\n');
  write(repo, 'package-lock.json', '{}\n');
  write(repo, 'backend/.env.example', 'GEMINI_API_KEY=\nJUDGE0_KEY=\n');
  git(repo, 'add', '.');
  assert.equal(check(repo).status, 0);
  // Exercise the real Git pre-commit hook, without touching the project history.
  git(repo, 'commit', '--quiet', '-m', 'Safe fixture');
});

test('ignore policy covers nested secrets, runtime data, and generated files without hiding source', (t) => {
  const repo = fixture(t);
  const blocked = ['backend/.env', 'frontend/my-react-app/.env.production', 'backend/.env.example.local',
    'backend/users.json', 'backend/user_profiles.json', 'backend/users.backup.json',
    'frontend/node_modules/example/index.js', 'backend/__pycache__/main.pyc', '.venv/bin/python',
    'frontend/my-react-app/dist/index.html', 'backups/export.zip', 'private/notes.txt',
    '.vscode/settings.json', 'secrets/key.pem', 'uploads/resume.pdf', 'backend/local.sqlite3'];
  const ignored = run(repo, 'git', ['check-ignore', '--no-index', '--stdin'], blocked.join('\n') + '\n');
  assert.equal(ignored.status, 0);
  assert.deepEqual(ignored.stdout.trim().split(/\r?\n/), blocked);
  const allowed = ['backend/.env.example', 'frontend/.env.sample', 'backend/main.py', 'data/coding/amazon.json',
    'frontend/my-react-app/package-lock.json', 'frontend/my-react-app/public/logos/amazon.png', '.githooks/pre-commit'];
  assert.equal(run(repo, 'git', ['check-ignore', '--no-index', '--stdin'], allowed.join('\n') + '\n').status, 1);
});

test('forced staging of ignored files is blocked', (t) => {
  const repo = fixture(t);
  write(repo, 'backend/.env', 'GEMINI_API_KEY=\n');
  write(repo, 'backend/users.json', '{}\n');
  git(repo, 'add', '--force', 'backend/.env', 'backend/users.json');
  const result = check(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ignored file is tracked/);
  assert.match(result.stderr, /backend\/users\.json/);
});

test('staged secrets are blocked even when the working copy is clean, without printing values', (t) => {
  const repo = fixture(t);
  const fakeKey = 'AIza' + 'A'.repeat(35);
  write(repo, 'config.js', `const key = '${fakeKey}';\n`);
  git(repo, 'add', 'config.js');
  write(repo, 'config.js', 'const key = process.env.GEMINI_API_KEY;\n');
  const result = run(repo, 'git', ['hook', 'run', 'pre-commit']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /config\.js:1: possible Google API key/);
  assert.ok(!result.stderr.includes(fakeKey));
  git(repo, 'add', 'config.js');
  assert.equal(check(repo).status, 0);
});

test('personal contacts and populated credential templates are blocked', (t) => {
  const repo = fixture(t);
  const contact = 'developer' + '@gmail.com';
  write(repo, 'contact.md', contact + '\n');
  write(repo, 'backend/.env.example', 'GEMINI_API_KEY=not-a-real-credential\n');
  git(repo, 'add', '.');
  const result = check(repo);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /review email address/);
  assert.match(result.stderr, /credential values in environment templates must be blank/);
  assert.ok(!result.stderr.includes(contact));
});

test('Git push hook accepts only the canonical HTTPS or SSH repository', (t) => {
  const repo = fixture(t);
  const ssh = 'git@github.com:PRITIK03/ReactNodeInterviewMatrix---Comprehensive-Interview-Assessment-Platform.git';
  for (const url of [canonical, canonical.slice(0, -4), ssh, 'ssh://' + ssh.replace('github.com:', 'github.com/')]) {
    assert.equal(run(repo, 'git', ['hook', 'run', 'pre-push', '--', 'origin', url]).status, 0);
  }
  for (const url of ['https://github.com/someone/other.git', canonical + '/extra', canonical.replace('github.com', 'github.com.example.com'), join(repo, 'other.git')]) {
    const result = run(repo, 'git', ['hook', 'run', 'pre-push', '--', 'origin', url]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Push blocked/);
  }
});
