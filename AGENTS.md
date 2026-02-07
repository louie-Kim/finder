# Repository Guidelines

## Project Structure & Module Organization
- `app/` contains the Next.js App Router source. Entry points live in `app/page.tsx` and `app/layout.tsx`; shared UI lives under `app/components/`.
- `app/globals.css` defines global styles; Tailwind is configured via `postcss.config.mjs` and the Tailwind dependency.
- `public/` holds static assets served at the web root (e.g., `public/next.svg`).
- `extension/` contains the browser extension assets (`manifest.json`, `content.js`, `background.js`, `content.css`).

## Build, Test, and Development Commands
- `pnpm dev`: run the Next.js dev server at `http://localhost:3000`.
- `pnpm build`: create a production build in `.next/`.
- `pnpm start`: serve the production build locally.
- `pnpm lint`: run ESLint (`eslint.config.mjs`) across the codebase.
Use `npm run <script>` if you are not using pnpm, but keep `pnpm-lock.yaml` updated when possible.

## Coding Style & Naming Conventions
- TypeScript + React (Next.js App Router) with 2-space indentation.
- Use PascalCase for React components and files like `FindReplaceEditor.tsx`.
- Use Tailwind utility classes for styling; keep custom CSS in `app/globals.css` when needed.
- Prefer named exports for helpers and default exports for page/layout components.

## Testing Guidelines
- No automated test framework is currently set up.
- If you add tests, align naming with the tool (e.g., `*.test.tsx`) and document how to run them.
- For UI changes, include a quick manual test note (e.g., “Open `/` and verify find/replace panel toggles with Ctrl+F/Ctrl+H”).

## Commit & Pull Request Guidelines
- Git history only shows an initial bootstrap commit, so no established commit message convention yet.
- Use clear, imperative summaries (e.g., “Add replace-all shortcut handling”), and group related changes.
- PRs should include: a concise summary, testing notes, and screenshots/GIFs for UI changes. Link any related issues.

## Security & Configuration Tips
- Environment configuration is minimal; add `.env.local` only when needed and avoid committing secrets.
- If updating extension code in `extension/`, verify permissions in `extension/manifest.json` remain minimal.

## Additional Instructions
1. Treat the latest verified phase in `plan.md` as the source of truth; if you revert, restore that verified state so it remains the latest.
2. Manage future improvements in `plan.md`. If additional improvements are needed later, refer to the phases in `plan.md`.
3. Check phase boxes in `plan.md` as work is verified, and keep the most recent verified phase current.
4. `plan.md` Phase 6-8 are for optimizing only the Next.js part using vercel-react-best-practices; do not touch the `extension/` code.
5. When modifying extension logic, preserve the shortcut-open behavior so the Finder panel still opens via `Ctrl+Shift+F` on both Naver and Tistory editors.
