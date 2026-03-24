# 2026-03-23 Code Structure, Performance, and Cost Action Plan

## Goal

Reduce page-load latency, avoid unnecessary database work, improve maintainability, and lower long-term infrastructure cost without disrupting active feature delivery.

## Primary Outcomes

- Faster initial page loads for authenticated users
- Fewer unnecessary API calls and database queries
- Leaner list/detail payloads
- Safer code structure for ongoing optimization
- Better visibility into query cost and page performance

## Quick Wins This Week

### 1. Make options endpoints read-only

Scope:
- Remove data-repair behavior from `/api/accounts/options`
- Move canonical account-type enforcement into a one-time script, migration, or admin-only repair action

Why:
- Dropdown loads should never perform write-capable cleanup logic
- This is a direct cost and latency reduction with low product risk

Expected impact:
- Faster modal and page setup
- Lower DB write volume
- Cleaner separation between operational maintenance and user-facing reads

Verification:
- Confirm `/api/accounts/options` only performs reads
- Compare request duration before and after
- Confirm account/account-type data remains unchanged during normal page loads

### 2. Add lightweight option endpoints for selectors

Scope:
- Create slim endpoints for owner/account/contact pickers that return only `id` and display label
- Stop using heavier list endpoints for dropdowns where pagination metadata and related objects are not needed

Why:
- Many selectors currently pull more data than they display
- This is a straightforward way to reduce payload size and query cost

Expected impact:
- Smaller JSON responses
- Faster modal open time
- Less database work for common UI interactions

Verification:
- Measure response payload sizes before and after
- Confirm selectors still work in create/edit flows

### 3. Reduce auth/session churn

Scope:
- Stop updating `lastSeenAt` on every authenticated request
- Update session activity on a coarse interval instead

Why:
- Current auth behavior appears to add avoidable write traffic to nearly every API call

Expected impact:
- Immediate DB write reduction
- Lower auth overhead across the app

Verification:
- Count auth-related queries per request before and after
- Confirm login, logout, and session expiry behavior still works

### 4. Add basic performance instrumentation

Scope:
- Log endpoint duration for the highest-traffic routes
- Capture Prisma query timing for local/staging profiling
- Identify worst offenders by route and query class

Why:
- The review identifies likely hotspots, but ongoing work should be guided by measurements

Expected impact:
- Better prioritization
- Less guesswork during refactors

Verification:
- Produce a short list of top slow routes and heavy queries in staging

### 5. Clean the app root and isolate non-runtime artifacts

Scope:
- Move temp files, patches, screenshots, and loose analysis artifacts out of the main project root where practical
- Define a clear location for scratch/debug files

Why:
- Repo noise slows onboarding and makes optimization work harder

Expected impact:
- Easier navigation
- Lower chance of accidental edits or confusion during builds/reviews

Verification:
- Root directory contains mostly runtime and config files
- Team has a documented location for temporary artifacts

## Medium-Sized Refactors This Month

### 1. Convert major detail pages to summary-first loading

Scope:
- Refactor account and opportunity detail screens so the initial page load returns a lean summary
- Load contacts, activities, groups, products, revenue schedules, and other heavy tab data only when needed

Why:
- Current detail pages appear to load too much upfront and then still perform follow-up client requests

Expected impact:
- Faster first meaningful render
- Smaller initial payloads
- Better perceived performance for large records

Verification:
- Measure initial detail-page load time before and after
- Confirm tab navigation still feels responsive

### 2. Move more page data loading to the server

Scope:
- Reduce client-side “load after mount” patterns for major list/detail pages
- Render pages with known auth context and initial data server-side where appropriate

Why:
- Client waterfalls make the app feel slower than it needs to

Expected impact:
- Less spinner-driven navigation
- Better first render quality
- Fewer duplicate browser requests

Verification:
- Compare network waterfall depth before and after
- Confirm first paint includes useful content instead of placeholder-only states

### 3. Simplify list endpoints and payloads

Scope:
- Review accounts, opportunities, and similar list endpoints
- Remove relation data that the table does not actually need
- Avoid loading related collections when precomputed summaries would do

Why:
- List APIs should be optimized for list views, not act like mini detail endpoints

Expected impact:
- Lower DB cost per list request
- Faster sorting/filtering responses

Verification:
- Compare query time and payload size before and after
- Confirm list columns still render with no regressions

### 4. Improve search strategy for high-traffic tables

Scope:
- Audit the broad `contains` filters across accounts/opportunities
- Add appropriate indexes or move to Postgres full-text/trigram search where needed

Why:
- Current search patterns will become more expensive as tenant data grows

Expected impact:
- Faster search and filter operations
- Better scalability for larger customers

Verification:
- Run query-plan comparison on representative search requests
- Track latency improvement on large datasets

### 5. Break up oversized components by responsibility

Scope:
- Split very large components into:
  - route/page shell
  - data-fetch module
  - tab modules
  - modal modules
  - action/mutation helpers
  - view-model mappers

Why:
- Large files make optimization slow, risky, and hard to verify

Expected impact:
- Easier debugging and testing
- Clearer performance boundaries
- Safer future feature work

Verification:
- Largest UI files shrink substantially
- Team can modify one tab or modal without touching unrelated logic

## Deeper Architecture Improvements Later

### 1. Introduce a consistent data-access layer

Scope:
- Create shared query functions per domain instead of embedding query logic directly across many route handlers

Why:
- This makes query optimization, caching, and testing much easier

Expected impact:
- Lower duplication
- Better consistency in payload shape and query patterns

### 2. Establish cache strategy by data type

Scope:
- Define what should be:
  - request-time dynamic
  - short-lived cached
  - invalidated on mutation
  - loaded on demand

Why:
- The app currently leans heavily toward dynamic/no-store behavior

Expected impact:
- Better use of Next.js rendering and caching capabilities
- Reduced repeated work for stable reference data

### 3. Introduce search-specific models or materialized search surfaces

Scope:
- For complex cross-field search, build a denormalized search surface rather than relying on many relational `contains` filters

Why:
- This improves scalability and makes list/search endpoints more predictable

Expected impact:
- Lower query complexity
- Faster search for large tenants

### 4. Revisit session architecture

Scope:
- Consider whether session validation can rely less on repeated DB lookups
- Evaluate signed session payloads, cached session resolution, or a hybrid approach

Why:
- Auth overhead compounds across the entire application

Expected impact:
- Broad latency reduction
- Lower request-time database dependency

### 5. Add automated performance guardrails

Scope:
- Add route-level benchmarks, query-budget checks, or dashboard-level performance smoke tests

Why:
- Performance improvements fade unless protected by process and tooling

Expected impact:
- Regressions are caught earlier
- Performance becomes part of normal delivery quality

## Recommended Sequencing

1. Remove write behavior from options endpoints
2. Add slim option endpoints and switch consumers
3. Reduce auth/session write frequency
4. Instrument the slowest routes
5. Refactor account detail and opportunity detail to summary-first loading
6. Simplify list payloads and search behavior
7. Break up oversized components as the above refactors land
8. Introduce deeper caching and data-access architecture once the hot paths are stable

## Suggested Success Metrics

- Initial authenticated page render time
- Account detail first render time
- Opportunity detail first render time
- Number of API calls made during first load of key pages
- Median and p95 duration for accounts/opportunities list routes
- Median and p95 duration for account/opportunity detail routes
- Query count per request for auth-protected endpoints
- Payload size for option endpoints and major detail endpoints

## Delivery Approach

- Treat quick wins as low-risk operational improvements
- Schedule medium refactors by user-visible workflow, starting with the highest-traffic pages
- Use deeper architecture changes only after instrumentation confirms the current top bottlenecks

