# Deployment

## App

```text
Name: AROS Developer Portal
Repo: Shreai/aros-developer-portal
Runtime: React + Vite portal, optional Node/Express server
Portal path: portal/
Build command: cd portal && npm run build
Dev command: cd portal && npm run dev
Serve command: cd portal && npm run serve
```

## Local Development

```powershell
cd portal
npm install
npm run dev
```

## Build

```powershell
cd portal
npm ci
npm run build
```

## CI

`.github/workflows/ci.yml` calls the org reusable Node CI
(`Shreai/.github` → `reusable-node-ci.yml`) with `working-directory: portal`:
`npm ci` + `vite build` on every push/PR. This is a static docs SPA, so a
passing build is the CI gate — deployment is publishing `portal/dist` (or
running `portal/server.mjs` in front of it) at the chosen production route
below; no separate runtime pipeline is needed.

Note: `portal/server.test.mjs` (vitest) reads `../../ports.json` from outside
this repo, so it only runs in the original multi-repo workspace layout, not in
CI. `.github/workflows/release.yml` builds and packages the release zip.

## Environments

GitHub environments already created:

| Environment | URL | Trigger | Secrets namespace |
|---|---|---|---|
| dev | local / TBD dev URL | branch/manual | `shre/aros-developer-portal/dev/*` |
| qa-beta | TBD | beta tag/manual approval | `shre/aros-developer-portal/qa-beta/*` |
| production | `developers.shre.ai` or `docs.aros.live`, pending decision | version tag/manual approval | `shre/aros-developer-portal/production/*` |

## Secrets

The portal is public documentation by default. It should not require runtime
secrets unless analytics, search, publishing, or protected beta docs are added.

Namespace pattern:

```text
shre/aros-developer-portal/<environment>/<secret-name>
```

## Release

Release artifact:

```text
aros-developer-portal.zip
```

Contents:

```text
portal/dist
sdks
examples
README.md
DEPLOYMENT.md
OWNERSHIP.md
```

## Signup / Access Mode

Recommended mode:

```text
Signup mode: public documentation
Auth: none for public docs
API keys: generated from Shre/AROS platform, not from this static portal
Partner onboarding: invite or account flow in AROS/Shre app
```

## Production Decision Needed

Choose canonical public route:

```text
developers.shre.ai
docs.aros.live
developers.aros.live
```

Recommendation:

```text
developers.shre.ai for platform-wide developer docs.
docs.aros.live for AROS-specific product docs.
```
