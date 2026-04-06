# Frontend Quality Commands

## Core Scripts

- `npm run lint`: run ESLint across the frontend workspace.
- `npm run lint:fix`: auto-fix lint issues where possible.
- `npm run format`: run Prettier across tracked frontend source/config files.
- `npm run format:check`: verify formatting without changing files.
- `npm run test -- --run`: run the Vitest suite in CI mode.
- `npm run build`: type-check and create the production bundle.
- `npm run lint-staged`: run staged-file quality checks from the `frontend` directory.

## Notes

- Import paths now use the `@/` alias configured in Vite, Vitest, and TypeScript.
- Route screens live under `src/pages`; the old `src/routes` layout is no longer the active source of truth.
- `lint-staged` is configured in `package.json` for TypeScript, JavaScript, CSS, Markdown, JSON, and YAML files.
