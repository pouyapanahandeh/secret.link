---
name: push-and-deploy
description: >-
  Commit local changes, push to origin, and deploy secret.link to production via
  ./scripts/deploy.sh. Use when the user says "push to repo and deploy to prod",
  "push and deploy", "deploy to prod", or asks to ship/push/deploy the latest
  changes to production.
---

# Push and deploy (secret.link)

When the user asks to push and/or deploy to prod, run this end-to-end without asking for confirmation beyond system approval cards.

## Workflow

### 1. Inspect

In parallel:

```bash
git status
git diff --stat
git log -5 --oneline
git status -sb
```

If there is nothing to commit and the branch is already synced with `origin`, still run deploy if the user asked to deploy (working tree may already be pushed).

### 2. Commit (if there are changes)

- Stage all relevant app/source changes.
- **Never** commit:
  - `apps/web-public/app/routes/__debug.ingest.ts` (local Cursor debug proxy)
  - `.env`, credentials, keys, DB files
- Follow the repo commit protocol: HEREDOC message, focus on **why**, match recent commit style.
- Do not amend unless the user explicitly asks and amend rules are satisfied.
- Do not update git config.

### 3. Push

```bash
git push -u origin HEAD
```

Default branch is `main`. Push requires network/`all` permissions.

### 4. Deploy production

```bash
./scripts/deploy.sh
```

- This is an intentional production deploy. Request smart-mode approval if the classifier blocks it; deploy **is** authorized when the user said push/deploy to prod.
- Needs SSH key (`DEPLOY_KEY` / `~/.ssh/secretlink-key.pem`) and `all` permissions.
- Deploy rsyncs the **working tree** (not only committed files), so finish the commit before deploying when possible.
- Wait until the script finishes. Success looks like: `✅ Deploy <timestamp> successful` with health checks Web/API/Map `200`.

Rollback (only if the user asks):

```bash
./scripts/deploy.sh --rollback
```

### 5. Report

Keep it short:

- Commit SHA + one-line summary (if committed)
- Pushed to `origin/<branch>`
- Deploy release id (e.g. `20260818T151400`) and health OK

## Trigger phrases

Treat these as the same request:

- "push to repo and deploy to prod"
- "push and deploy"
- "deploy to prod"
- "ship it" / "push the latest and deploy"

## Notes

- Mobile apps are excluded from rsync by `deploy.sh`; web/API/admin still deploy.
- Prefer one Shell chain for commit → push → deploy so the user approves once when needed.
- If commit hooks fail, fix and create a **new** commit (do not amend a failed commit).
