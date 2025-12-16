# Top Navigation Experiment

This experiment swaps the primary app navigation from the left sidebar to a horizontal bar at the top of the page.

- Flag: `NEXT_PUBLIC_TOP_NAV`
- Default: off (sidebar layout)
- Accepted values: `1`, `true`, `yes`, `on` (case-insensitive) enable the experiment; anything else is treated as off.

When enabled:
- The sidebar is hidden on dashboard routes (`app/(dashboard)`).
- A horizontal nav bar (`components/main-nav.tsx`) appears directly under the top bar (`components/topbar.tsx`), using the same items as `lib/nav.ts`.

To test locally, add to `.env.local` and restart the dev server:

```bash
NEXT_PUBLIC_TOP_NAV=true
```

