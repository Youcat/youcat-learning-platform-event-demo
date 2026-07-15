# Event Demo Development Guidance

## Scope

This folder contains the mobile-first Brazilian Portuguese YOUCAT Love Forever event demo. Read `README.md` before changing its behavior or deployment model.

## Source Integrity

- Treat the authenticated Markdown files in `/Users/paterjoachim/Documents/YOUCAT Love forever Korrektur` as the source of truth for YOUCAT, DOCAT, and YOUCAT Love Forever publication text.
- Do not reconstruct official wording from memory, the web, PDFs, backups, or correction reports.
- Rebuild `src/data/official-content.json` with `npm run content`; do not manually rewrite authenticated questions or answers.
- Rebuild `src/data/deep-dive-sources.js` with `npm run deep-dive-content` when its authenticated inputs change.
- Preserve Portuguese as the participant-facing default. English is the development language selected with `?lang=en`.

## Safe Working Rules

- Preserve existing uncommitted work and avoid unrelated rewrites.
- Never expose or commit `.env.local` values.
- Do not deploy, push, alter production Firebase state, or contact participants without Fr. Joachim's explicit confirmation.
- Keep anonymous reflections and pastoral material private; summarize rather than quote unless exact wording is required.
- Keep the no-Firebase local fallback working.

## Quality Gate

- Use Node.js 22.
- Run `npm run doctor` after a fresh checkout or when source paths change.
- Run `npm run check` for content and game tests.
- Run `npm run build` for changes that can affect the shipped app.
- For UI changes, verify a narrow phone viewport, touch controls, Portuguese text, keyboard access, and reduced motion where relevant.

## Project Conventions

- Use the existing plain JavaScript, CSS, and Vite architecture unless a requested change clearly requires otherwise.
- Reuse existing YOUCAT tokens, typography, illustrations, and interaction patterns.
- Keep Firestore writes compact and within the documented event/load-test model.
- Update `README.md` when setup, behavior, deployment, or operational assumptions change.
