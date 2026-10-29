This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## From engineer

During development I focused on the frontend part of the fleet management dashboard. I picked Next.js for this app because it makes it easy to build full-stack projects. I delegated the mocked backend ("app/api/\*", "lib/api/\*", "lib/mock-backend/\*") to Claude and didn't review it thoroughly; its main purpose is to provide data to visualize on the frontend.

For the visual part I chose to base my design on shadcn because it provides a good set of pre-built components with a lean design, and most of the shadcn component code lives in the repo itself (which gives a freedom of adjusting the styling easily).

### Robots list: filtering on the server

The robots table filters, sorts and paginates on the server, not in the browser. With 26 robots, client-side filtering would be faster and simpler, but it would not hold up at real scale:

- **Payload and rendering grow with the fleet.** Sending every robot to the browser means downloading and rendering data the user never looks at. Server-side pagination keeps every response to one page.
- **Data lives in several services.** In a real company, robot identity, live state, alerts and firmware come from different microservices. Filtering in the browser would mean fetching from all of them and joining the results there. A backend-for-frontend, or a read model such as a search index fed by events, can join, filter, sort, count and scope access in one place.
- **Correct totals.** Totals and page counts have to come from the full data set, and only the backend has it.

How it works here:

- All filter, sort and pagination state lives in the URL, so a view can be shared, bookmarked or reloaded.
- The page reads the search params on the server and calls a small data layer (`lib/data/robots.ts`). Today that layer calls the mock backend's `listRobots` directly. In production it would call the fleet API with the same parameters, which already match `GET /api/robots`.
- When live updates (SSE) are added, the client should subscribe only to the robots on the current page, not to the whole fleet.

## Decisions (caught automatically)

### Architecture

- Filtering, sorting and pagination happen on the server, so the page keeps working as the fleet grows (see above).
- The URL is the single source of truth for the robots list state, handled by a small in-house hook instead of a library.
- The robots table is rendered on the server; only the interactive controls run in the browser.
- The page talks to the backend through a thin data layer, so the mock backend can be replaced by a real API without touching the UI.

### UI

- shadcn/ui with Radix primitives and the classic shadcn look, used as much as possible.
- No custom styles: only standard shadcn components, variants and theme colors.
- Light theme only for now; there is no app shell (sidebar, header) yet.

### Robots page

- The robots list is the home page and a read-only overview: rows are not clickable, there is no live data and no map.
- The table shows the robot, site, model, status, battery, current task, open alerts, firmware and when the robot was last seen.
- Filters: search, site, status and model kind, plus quick filters for robots with open alerts, low battery or outdated firmware.
- Robots that need attention are listed first by default; the list is paginated and can be sorted by name, status, battery and last seen.
- Skeletons are shown while data loads, and a Refresh button fetches fresh data.

### Edge cases

- Offline robots show their last known values, visibly muted.
- An invalid URL is never silently corrected: it shows no results, with an option to reset the filters.
- If loading fails, the page shows an error with a way to try again.
- On narrow screens the table scrolls sideways instead of hiding columns.
