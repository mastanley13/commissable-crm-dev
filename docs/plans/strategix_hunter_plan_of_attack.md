# Commissable CRM — StrategixAI/Hunter Plan of Attack (02-02 + 02-05 + Rob feedback)

Last updated: **2026-02-09**

## Goal
Get Rob unblocked for **clean, end-to-end reconciliation testing** (1:1, 1:M, M:1, Flex/overages, chargebacks) while fixing the highest-risk **data integrity** issues.

---

## 1) What Rob asked for (master list)

### A) Testing + data hygiene
- Full reset: clear deposit-related data so testing isn’t polluted. 【fileciteturn1file11L7-L13】
- Clean, targeted test datasets (1:1, 1:M, M:1, overage/Flex, chargeback, lump-sum future schedules). 【fileciteturn1file11L29-L34】

### B) Deposit upload + multi-vendor mapping
- Add a **vendor filter** to mapping so users can map one vendor at a time (scales to thousands of rows). 【fileciteturn1file11L9-L13】
- Add a **“save template” warning/prompt** when navigating away after new mappings (avoid losing work). 【fileciteturn1file11L11-L13】
- Layout/flow: move “New fields” section below tabs + include vendor filter + add “Save to template” prompt. 【fileciteturn1file9L43-L48】

### C) Reconciliation UI / workflow improvements
- Vendor summary should be a **floating, draggable widget** (not a blocking modal), showing key unallocated counts/totals. 【fileciteturn1file11L13-L14】
- Add Flex/Chargebacks entry point on main reconciliation page. 【fileciteturn1file11L45-L46】
- Flex/Chargebacks UI: expected/actual/delta labeling; add related schedule column; green highlights; clear old data. 【fileciteturn1file11L47-L48】【fileciteturn1file9L15-L20】

### D) Revenue schedules & correctness
- RS detail UI fixes: rename **Payment Type → Revenue Type** and pull from product catalog; swap Subagent and Product Name House; **House Rep required**; Subagent defaults to None/N/A. 【fileciteturn1file11L15-L24】
- Fix RS date generation bug: schedule dates land on **1st of month @ 8am ET** (avoid DST/timezone drift). 【fileciteturn1file11L25-L26】【fileciteturn1file11L65-L66】
- Inline edit: default effective date correctly + show “Old Price / New Price” + fix notification. 【fileciteturn4file10L15-L24】【fileciteturn4file10L63-L66】
- **Bulk edit recalculation bug:** bulk updating Price Each leaves dependent calculated fields stale; trigger recalculation after bulk updates (and audit dependent fields). 【fileciteturn2file0L11-L18】【fileciteturn2file0L65-L66】
- **First/Last schedule date backfill:** older products weren’t backfilled; needs one-time migration/backfill (or always-correct query strategy). 【fileciteturn1file1L51-L62】

### E) Data propagation + undo integrity
- Matching deposits should update the **main product catalog**, and Undo must revert *all* changes (including catalog updates). Rob requested a write-up. 【fileciteturn1file11L27-L28】

### F) PDF upload validation
- PDF upload needs a **real PDF deposit file** + matching opportunity to test. 【fileciteturn1file11L1-L4】【fileciteturn1file11L63-L64】

### G) CloudBot (OpenClaw/ClawdBot) security scoping
- Rob wants: privacy/access, guardrails, failover plan, and a schematic of data/compute/replication layers. 【fileciteturn4file10L1-L4】
- Deliver a 1-pager: scope/security/deployment/DR/failover/access/updates/reuse/retainer. 【fileciteturn4file10L61-L66】【fileciteturn4file12L25-L43】

---

## 2) Prioritized plan of attack (what *you* need to ship)

### P0 — **ASAP / before the next testing touchpoint**
(There was a follow-up scheduled for **Feb 9 @ 10:00**. 【fileciteturn4file10L69-L71】)

1) **Fix data correctness blockers**
- Bulk edit recalculation: ensure bulk updates trigger recalculation of dependent fields. 【fileciteturn2file0L11-L18】
- RS schedule date generation @ 1st-of-month 8am ET (timezone/DST safe). 【fileciteturn1file11L65-L66】
- First/Last schedule date backfill for older products (one-time migration or query-based). 【fileciteturn1file1L51-L62】

2) **Unblock reconciliation testing (clean environment + key UI fixes)**
- Clear all deposits/deposit line items in test environment. 【fileciteturn1file11L7-L13】
- RS detail page field fixes (Revenue Type source, House Rep required, Subagent default, field ordering). 【fileciteturn1file11L15-L24】
- Inline edit improvements: effective date default + old/new value UI + notification. 【fileciteturn4file10L15-L24】

3) **Send/ship the two key “explainers” Rob is expecting**
- Data propagation + Undo write-up (deposit → opp → product catalog; and Undo rollback scope). 【fileciteturn1file11L27-L28】
- CloudBot 1-pager (security + deployment + DR/failover + access controls). 【fileciteturn4file10L61-L66】


### P1 — Before **data migration planning**
(Data migration meeting scheduled **Thu Feb 19 @ 12:00 PM**. 【fileciteturn4file10L57-L60】)

4) **Multi-vendor mapping is usable at scale**
- Vendor filter on mapping screen. 【fileciteturn1file11L9-L13】
- “Save to template” warning/prompt when navigating away after mapping changes. 【fileciteturn1file11L11-L13】
- Layout cleanup: move “New fields” below tabs, reduce hunting/scrolling. 【fileciteturn1file9L43-L48】

5) **Reconciliation UX polish that reduces user errors**
- Floating vendor summary widget / deposit summary bar (non-blocking). 【fileciteturn1file11L13-L14】
- Flex/Chargebacks button on main reconciliation + refine Flex/Chargebacks UI. 【fileciteturn1file11L45-L48】

6) **PDF upload validation**
- Validate real PDF import end-to-end with Rob’s sample PDF + matching opp. 【fileciteturn1file11L63-L64】

7) **Pre-work for Feb 19 migration session**
- Send migration pre-work (scenarios: cold start vs full migration vs hybrid). 【fileciteturn4file10L67-L68】


### P2 — Next (important, but not blocking the immediate testing loop)
8) Match seeds indicator (“Y”) should explain criteria (clickable icon / tooltip). (Requested during reconciliation review.) 【fileciteturn6file11L1-L27】
9) Apply action should populate Actual Usage/Commission and visually highlight (e.g., green). (Requested during reconciliation review.) 【fileciteturn6file11L1-L27】
10) Fix Back button on reconciliation/deposit pages. 【fileciteturn1file11L55-L56】

---

## 3) What you need from Rob (dependencies / requests back)

**Data / test assets**
- [ ] Clean, targeted test datasets (1:1, 1:M, M:1, overage/Flex, chargeback, lump-sum). 【fileciteturn1file11L29-L34】
- [ ] Sample PDF deposit file + matching opportunity for validation. 【fileciteturn1file11L63-L64】
- [ ] 10–12 row multi-vendor deposit file for mapping flow testing. 【fileciteturn1file11L69-L70】

**UI input**
- [ ] Layout mockup for floating vendor summary widget. 【fileciteturn1file11L35-L36】

---

## 4) Notes / assumptions
- **ASSUMED:** “Before next meeting” refers to the immediate follow-up cadence mentioned in the Feb 5 notes (Feb 9 follow-up + Feb 19 migration session). 【fileciteturn4file10L57-L71】
- **ASSUMED:** Bulk edit recalculation should run server-side so the database is correct immediately (vs. a UI-only fix). Rob’s write-up frames this as the preferred approach. 【fileciteturn2file0L69-L76】

