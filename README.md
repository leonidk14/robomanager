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

During the development I was focusing on the frontend part of the fleet management dashboard. For the development I picked Next.js to build this app since it allows to easily build projects full-stack. I delegated creating mocked backend ("app/api/\*", "lib/api/\*", "lib/mock-backend/\*") to CLAUDE and didn't review it properly, the main point of the backend is to provide data to visualize on the frontend.
