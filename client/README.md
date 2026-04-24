This is the Next.js storefront client for the ND Shop repository.

## Purpose

This app is the official storefront/account runtime for the repository. The Vite `frontend/` app remains focused on admin/workbook flows.

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
- Storefront/account flows backed by the shared Go services, including a dedicated `/wishlist` route

## Runtime notes

- `npm run dev` serves the host-based client at `http://127.0.0.1:3000`
- `npm run start` serves the standalone production build from `.next/standalone`
- `make client-build` and `make client-start` are available from the repo root
- Docker Compose now runs this app by default as the shopper UI
- backend redirects and payment return URLs should point at `http://localhost:3000`

## References

- [Next.js documentation](https://nextjs.org/docs)
