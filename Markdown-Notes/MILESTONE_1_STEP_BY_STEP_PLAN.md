 # Milestone 1 Step-by-Step Execution Plan

## Context & Goal
- Milestone 1 covers Accounts and Contacts with 140+ contract-mandated fields, dynamic tables, role-based access control (4 roles), and audit logging tied to the 25% payment trigger.
- Frontend scaffolding and live Cloud SQL connectivity are in place; remaining work focuses on production-ready data, API, RBAC, UX polish, and acceptance verification.

## Phase 0 - Alignment & Readiness (Day 0)
1. **Kickoff Sync** - Confirm scope, acceptance checklist, owners, and timeline. Output: approved backlog and sprint board.
2. **Environment Verification** - Smoke-test Cloud SQL connectivity from local/staging, confirm `DATABASE_URL`, Prisma client generation, and secrets management.
3. **Tooling Setup** - Ensure logging, feature flag, and QA environments are ready; align on branching strategy and code review cadence.

## Phase 1 - Data Foundation (Days 1-2)
4. **Schema Audit & Gap Closure** - Compare current Prisma schema to contract field matrix for Accounts/Contacts; add missing columns, enums, and relations (including address duplication and parent account links).
5. **Migrations & Seed Data** - Generate migrations against Cloud SQL, apply to dev/staging, and seed reference data (account types, industries, roles) for consistent fixtures.
6. **Validation Rules** - Implement Prisma-level and database constraints for email, phone, URL, 2-letter states, and max zip length; document any custom checks needed in app layer.

## Phase 2 - Service & API Layer (Days 3-5)
7. **Repository/Service Contracts** - Define data-access services for Accounts and Contacts (list, detail, create, update, delete, search) returning DTOs that match frontend expectations.
8. **HTTP/API Endpoints** - Build Next.js route handlers (REST/GraphQL per architecture) enforcing tenant scoping, pagination, search filters, and optimistic concurrency.
9. **Error & Logging Middleware** - Standardize error responses, input sanitation, and attach request IDs needed for downstream audit logging.

## Phase 3 - Security & RBAC (Days 4-6, overlaps Phase 2)
10. **Auth Guard Implementation** - Hook existing auth provider to API routes, ensuring user identity and tenant context propagate to services.
11. **Role Policy Matrix** - Encode the four-role permissions (Salesperson, Sales Management, Accounting, Admin) covering CRUD, import/export, and column visibility.
12. **Copy Protection & Session Controls** - Add Accounting copy-block, session timeout, and export restrictions; validate via automated tests.

## Phase 4 - Frontend Integration (Days 5-8)
13. **Dynamic Tables w/ Preferences** - Connect list views to real endpoints, persist column visibility/order, filters, sorts per user, and meet performance targets (<= 2s initial load, <= 300ms column ops).
14. **Detail & Inline Editing** - Wire detail pages to live data, enabling inline edits with autosave, address copy feature, inherited contact type, and account-contact linkage.
15. **Modal/Popup Forms** - Integrate create/edit forms (accounts, contacts, opportunities, activities) with validation and optimistic UI feedback.

## Phase 5 - Audit Logging & Observability (Days 7-9)
16. **CRUD Event Logging** - Record create/update/delete events with before/after payloads, user, IP, and request ID; expose admin audit viewer or export.
17. **Activity Timeline Hookups** - Ensure timeline tab pulls from audit/activity feeds to satisfy detail-page completeness.
18. **Monitoring & Alerts** - Configure application logging, error monitoring, and threshold alerts for key SLAs.

## Phase 6 - Quality, Import/Export, and Performance (Days 9-11)
19. **Automated & Manual QA** - Author integration tests for API & RBAC, run regression on dynamic tables, execute persona-based manual scripts.
20. **Import/Export Workflows** - Deliver CSV templates, validate role-based access, and ensure large-file handling success paths and error reporting.
21. **Performance Tuning** - Load-test 1k record tables, add indexes, paginate responses, and document benchmarks.

## Phase 7 - Documentation & Acceptance (Days 11-13)
22. **User & Admin Docs** - Finalize module walkthroughs, RBAC guide, and import/export instructions aligning with contract deliverables.
23. **Deployment Readiness** - Prepare release notes, migration checklist, environment variables, and rollback plan; dry run deployment to staging.
24. **Acceptance Review** - Conduct stakeholder demo, walk through 25% payment checklist, capture sign-off, and archive evidence.

## Phase 8 - Buffer & Closeout (Day 14)
25. **Bug Triage Buffer** - Reserve last day for issue remediation, polish, and sign-off follow-ups.
26. **Retrospective & Handoff** - Record lessons learned, backlog remaining items for Milestone 2, and package artifacts for client handover.

## Cross-Cutting Workstreams
- **Project Management** - Daily standups, progress tracking, and risk escalation.
- **Security & Compliance** - Review data handling, ensure least-privilege DB access, and document audit retention.
- **Stakeholder Communication** - Weekly status reports with traffic-light indicators for scope, schedule, and quality.

## Key Deliverable Checklist
- Accounts & Contacts CRUD with 140+ live fields
- Dynamic tables with persisted preferences
- Fully enforced RBAC (4 roles) and Accounting copy protection
- Complete audit logging with review tooling
- Import/export workflows and documentation
- Performance benchmarks meeting contract SLAs
- Signed acceptance documenting payment trigger
