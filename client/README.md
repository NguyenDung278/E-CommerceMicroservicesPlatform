This is the Next.js storefront client for the ND Shop repository.

## Purpose

This app is the App Router storefront/account surface that can run alongside the existing `frontend/` Vite app while the UI stack is being aligned.

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the production standalone bundle:

```bash
npm run build
```

Start the production standalone server:

```bash
npm run start
```

The build and start scripts now prepare `.next/standalone` with the required
`.next/static` and `public` assets automatically, so local production smoke
tests no longer need a manual copy step.

## Current scope

- App Router
- TypeScript
- ESLint
- `src/` directory layout
- Minimal landing page ready for the design implementation phase

## Runtime notes

- `npm run dev` serves the host-based client at `http://127.0.0.1:3000`
- `npm run start` serves the standalone production build from `.next/standalone`
- `make client-build` and `make client-start` are available from the repo root
- backend redirects and payment return URLs should point at `http://localhost:3000` when you want the standalone client to be the active UI

## References

- [Next.js documentation](https://nextjs.org/docs)
