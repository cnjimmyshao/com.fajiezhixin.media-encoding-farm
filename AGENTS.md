# Repository Guidelines

## Project Structure & Module Organization
`app.mjs` wires Express routes, config, and the worker services. Domain logic sits under `src/controllers`, HTTP routing in `src/routes/{api,web}.mjs`, and ffmpeg integrations in `src/services`. Database helpers live in `src/db`, while static assets stay in `src/public` and view templates in `views`. Environment and codec defaults ship from `config/default.mjs`.

## Build, Test, and Development Commands
- `npm run dev` – start the server with `NODE_ENV=development` and auto-load `.env` for quick iteration.
- `npm start` – run the production process; use this before tagging a release to mirror deploy behavior.
- `npm run migrate` – execute `src/db/migrate.mjs` to create or upgrade SQLite tables; required any time schema changes.
For manual smoke tests, post a job after `npm run dev` using:
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"inputPath":"/media/in.mp4","outputPath":"/media/out.mp4","codec":"h264","impl":"ffmpeg"}'
```

## Coding Style & Naming Conventions
Follow ES modules with always-on `type: module`. Use 2-space indentation, trailing commas only where multi-line arrays/objects demand clarity, and prefer descriptive camelCase identifiers (`jobQueue`, `ffmpegRunner`). Keep controller/service pairs named after their resource (e.g., `jobs.mjs`, `ffmpeg-runner.mjs`). Continue the existing practice of JSDoc blocks for exported functions to document params and return values.

## Testing Guidelines
There is no bundled test runner yet, so add focused integration tests before landing major changes. Co-locate specs as `*.spec.mjs` next to the module or under `src/__tests__`, and use Node’s built-in `node --test` harness to avoid extra deps. Validate new migrations by running `npm run migrate` against a fresh SQLite file, then replaying the curl workflow above to ensure CRUD parity.

## Commit & Pull Request Guidelines
History uses lightweight Conventional Commits (`feat:`, `fix:`, `chore:`). Keep subjects under 72 chars and describe user-facing behavior first. Pull requests need: summary of intent, bullet list of key changes, any linked issue ID, migration checklist (ran `npm run migrate`?), and screenshots or curl transcripts when the HTTP surface changes. Small, reviewable PRs that include reproduction steps and rollback notes are favored.

## Security & Configuration Tips
Never commit `.env`; use `.env.example` to document required keys such as storage roots or ffmpeg flags. Sensitive path mappings belong in `config/default.mjs` overrides (`config/production.mjs` per environment). When sharing logs, scrub job payloads because they may include customer S3 URIs embedded via the audit trail.
