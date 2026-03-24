This is the new standalone Next.js client for the ND Shop repository.

## Purpose

This app is intended to host the upcoming MCP/Stitch-driven UI implementation without disrupting the existing `frontend/` Vite app during migration.

## Getting started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Current scope

- App Router
- TypeScript
- ESLint
- `src/` directory layout
- Minimal landing page ready for the design implementation phase

## Next steps

The next implementation step is to translate the prepared Stitch/MCP design into reusable route segments, layouts, and components inside `client/src/`.

## References

- [Next.js documentation](https://nextjs.org/docs)
