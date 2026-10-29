# Agent instructions

## Git

- Never commit code (no `git commit`, `git commit --amend`, `git merge`, `git rebase` or anything else that creates commits). Leave all changes uncommitted in the working tree; the project owner reviews and commits them manually.

## Decisions

- Never assume decisions. Every product, UX and architecture decision must be raised and confirmed by the project owner during planning. Only pure implementation details (naming, internal code structure, choices that change neither behaviour, UX nor high-level architecture) may be made without confirmation.
- During planning, ask thoroughly about edge cases (empty, loading and error states, invalid input and URLs, offline/stale data, boundary values, narrow screens) before finalizing the plan.
- Record every decision in README.md under "Decisions (caught automatically)", whether the project owner made it or it was proposed and confirmed. Group the decisions by topic and keep them a high-level overview without implementation details.

## UI

- Build the UI with shadcn/ui components (Radix primitives) as much as possible.
- No custom styles: use only shadcn components and their variants, shadcn theme color tokens (e.g. `bg-primary`, `text-muted-foreground`, `bg-destructive`) and standard Tailwind layout, spacing and typography utilities. No custom colors (Tailwind palette colors, hex, rgb), no arbitrary values (`w-[137px]`), no custom CSS or extra CSS variables beyond what shadcn generates.

## Verification

- Verify changes only with `npm run check`. Don't run the dev server, builds, browsers or screenshots; the project owner verifies the result manually.
