# Deploy

This document describes the current production workflow for Hotate.

## Production Target

- Host alias: `apps-vps`
- App directory: `~/hotate`
- Public domain: read `APP_DOMAIN` from `~/hotate/.env`

## Standard Deploy

```bash
ssh apps-vps '
  cd ~/hotate &&
  git pull --ff-only origin master &&
  docker compose up -d --build
'
```

## Verification

```bash
ssh apps-vps '
  cd ~/hotate &&
  docker compose ps &&
  docker logs --tail=30 hotate
'
```

From a client machine, confirm the public endpoint responds:

```bash
curl -skI https://<APP_DOMAIN>/
```

Expected behavior today is `401 Unauthorized` with `WWW-Authenticate: Basic realm="Hotate"` when credentials are not supplied.

## Rollback

On the server:

```bash
cd ~/hotate
git log --oneline -n 5
git checkout <previous-good-commit>
docker compose up -d --build
```

If you roll back this way, return the repo to `master` afterward once you are done investigating.

## Deployment Notes

- `docker compose.yml` is the primary production path.
- The container stores app data in `~/hotate/data`.
- SSH keys are mounted from `SSH_KEY_DIR` into `/home/node/.ssh`.
- If branch tracking is missing on the server, use `git pull --ff-only origin master`.
