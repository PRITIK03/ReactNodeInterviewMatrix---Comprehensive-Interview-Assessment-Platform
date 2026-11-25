# Repository and privacy safeguards

The canonical repository is
<https://github.com/PRITIK03/ReactNodeInterviewMatrix---Comprehensive-Interview-Assessment-Platform>.
Use `origin` for fetches and pushes from this clone.

## Enable safeguards in a fresh clone

Run these commands at the repository root. They change only this clone's Git
configuration. Git does not automatically enable tracked hooks after cloning.
The commit hook needs Node.js on PATH, including when committing from an editor.

```sh
git remote set-url origin https://github.com/PRITIK03/ReactNodeInterviewMatrix---Comprehensive-Interview-Assessment-Platform.git
git config --local --replace-all remote.origin.pushurl https://github.com/PRITIK03/ReactNodeInterviewMatrix---Comprehensive-Interview-Assessment-Platform.git
git config --local remote.pushDefault origin
git config --local branch.main.pushRemote origin
git config --local push.default simple
git config --local push.autoSetupRemote true
git config --local core.hooksPath .githooks
```

The pre-push hook rejects destinations outside the canonical repository. It
accepts the repository's HTTPS and SSH URLs. It checks the destination only;
it does not scan outgoing commit history. `git push` uses the configured origin
and branch. Do not bypass hooks with `--no-verify` or override `core.hooksPath`.

For commit privacy, use your own GitHub username and the noreply address shown
in GitHub Settings > Emails. The owner clone is configured locally to use
PRITIK03's GitHub noreply identity. Other contributors must use their own identity:

```sh
git config --local user.name YOUR_GITHUB_USERNAME
git config --local user.email YOUR_GITHUB_NOREPLY_ADDRESS
```

## What stays local

The root `.gitignore` excludes environment files, credentials, private keys,
accounts and profile history, uploads, local databases, dependencies, virtual
environments, builds, caches, logs, reports, backups, editor settings, and
assistant session state. Use `private/` or `local-only/` for personal notes and
documents, and `exports/` or `backups/` for runtime exports and archives.

Keep source files, public logos, `data/` question banks, `package.json`, all
package lockfiles, `backend/requirements.txt`, and blank environment templates.
Do not blanket-ignore JSON files or the public question bank.

The blank environment template documents optional backend settings. Configure values in the backend service environment. Browser-visible `VITE_*` settings are public. The local edition stores accounts, private resumes, sessions and assessment history under the ignored `runtime/` directory. Keep historical plaintext account files out of migration and rotate previously exposed credentials.

## Check before committing

```sh
git remote -v
git status --short
git add <specific-files-you-reviewed>
npm run check:repo
git diff --cached --stat
git diff --cached
```

Review diffs locally; do not paste secret-bearing diffs into issues, chats, or
build logs. The first cleanup diff includes deleted sensitive content from the
previous commit even though those files are no longer in the staged snapshot.

The pre-commit hook runs `check:repo` automatically. It reads the complete staged
snapshot, rejects tracked files matching ignore rules (including forced adds),
and checks text for common API tokens, private keys, credential-bearing URLs,
email addresses other than example/noreply addresses, and common personal home
paths. Environment template credential values must be blank. Diagnostics do not
print matched values. Run `npm run test:repo-safety` to verify the safeguards.

These checks are an extra guard, not a guarantee: arbitrary personal information,
unknown token formats, binary contents, and previous commits need separate
review. Hooks can be disabled, and ignore rules can be overridden. Enable GitHub
secret scanning and push protection where available for additional protection.
This repository cleanup does not audit or fix application authentication or
authorization.

## Previously published sensitive information

The original history includes `backend/.env`, `backend/users.json`,
`backend/user_profiles.json`, Python bytecode, a personal README contact address,
and personal commit metadata. The environment file contained a Gemini API key.

1. Revoke that Gemini key in Google AI Studio and generate a replacement. Store
   the replacement only in the ignored `.env` or the deployment secret store.
   Reset any passwords from the published account file wherever they were reused.
2. Commit and push the reviewed cleanup to remove those files from the latest
   repository tree. Local copies were preserved by `git rm --cached`.
3. Removing files now does not remove their old contents. Purging published
   history requires a separately coordinated rewrite, including affected refs,
   commit identities, and bytecode that can contain local paths. Collaborators
   must use clean clones afterward. Cached views or forks may need separate
   cleanup through GitHub Support or their owners. Do not force-push casually.

See [Git's ignore documentation](https://git-scm.com/docs/gitignore),
[GitHub's sensitive-data removal guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository),
and [GitHub's commit email guidance](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address).
