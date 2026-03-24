# Agent C Kickoff - 2026-03-23

## Scope Confirmed

Per the March 23 handoff, Agent C owns:

- `CRM-REC-106` - Scenario A
- `CRM-REC-107` - Scenario B
- `CRM-REC-108` - Scenario C
- `CRM-REC-109` - Shared Step 2 / Step 3 UX and copy

Primary source-of-truth reviewed:

- `docs/tasks/Commissable_Multi_Agent_Handoff_2026-03-23.md`
- `docs/tasks/Commissable_Wave_Ownership_Matrix.xlsx - Wave Ownership Matrix.csv`
- `docs/notes/Reconciliation Maching Issues and Workflow.docx.md`

## What the March 2026 spec requires

- Scenario A = adjustment record on the current schedule only.
- Scenario B = adjustment record on the current schedule plus future schedules in the same chain.
- Scenario C = show proposed child schedule number during preview, but create the child only after confirm.
- `price_each` must stay unchanged in every scenario.
- Step 2 / Step 3 copy must use adjustment-ledger wording, not "absorb into price each" wording.
- Option B must explicitly name `12699`.
- Flex naming must use `[parent].[sequence]`, not `FLEX-*`.

## Current implementation findings

### 1. The grouped-match UI is still a 2-option model, not the required A/B/C model

Current wizard modal:

- `components/reconciliation-match-wizard-modal.tsx`

Observed behavior:

- The modal offers only `Adjust` and `FlexProduct`.
- The copy says "Create an adjustment schedule" instead of "adjustment record created".
- There is no Scenario B / forward-adjustment path.
- There is no preview copy that explicitly names `12699`.

Key evidence:

- `components/reconciliation-match-wizard-modal.tsx:193`
- `components/reconciliation-match-wizard-modal.tsx:287`

### 2. The apply route is off-spec for both Scenario A and Scenario C

Current grouped-match apply route:

- `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts`

Observed behavior:

- `Adjust` creates a new child revenue schedule instead of a ledger record on the existing schedule.
- `FlexProduct` creates a new product, optional opportunity product, and a new schedule using `FLEX-*` naming.
- The allocation rewrite moves matched amounts onto that created schedule instead of preserving the base schedule plus ledger adjustments.

Key evidence:

- `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts:85`
- `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts:153`
- `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts:190`
- `app/api/reconciliation/deposits/[depositId]/matches/apply/route.ts:236`

### 3. Preview contracts still expose only `Adjust` / `FlexProduct`

Current preview logic:

- `lib/matching/match-group-preview.ts`

Observed behavior:

- Variance prompts only allow `Adjust` or `FlexProduct`.
- Preview calculations rely on existing schedule adjustment aggregate fields, but there is no first-class per-match adjustment ledger contract for Agent C to use.

Key evidence:

- `lib/matching/match-group-preview.ts:787`
- `lib/matching/match-group-preview.ts:849`

### 4. Agent B dependency contract is not present yet in the match-group schema

Current schema:

- `prisma/schema.prisma`

Observed behavior:

- `DepositMatchGroup` currently stores only base group status fields.
- It does not yet persist scenario resolution metadata or created/affected artifact ids in first-class columns.

Key evidence:

- `prisma/schema.prisma:914`

## Dependency gap blocking safe Agent C implementation

The March handoff says Agent C depends on:

- `CRM-REC-105` match-group metadata
- `CRM-REC-101` no preview-time flex creation
- `CRM-REC-110` total-dollar adjustment ledger model

Current code does not yet show those contracts in the grouped-match flow. The biggest blocker is `CRM-REC-110`: the grouped-match route currently creates schedules for "Adjust" instead of writing separate adjustment records.

## Agent C starting position

Work started this turn:

- Reviewed Agent C scope and March 2026 governing docs.
- Mapped current grouped-match UI, preview, apply, and schema surfaces.
- Identified the concrete divergence points above.

Recommended next implementation order once Agent B contract lands or is approved for parallel build:

1. Replace `Adjust` / `FlexProduct` prompt model with A / B / C scenario model in the match wizard.
2. Introduce Scenario A/B application logic on top of the approved adjustment-ledger contract.
3. Keep Scenario C confirm-only and switch naming to `[parent].[sequence]`.
4. Rewrite Step 2 / Step 3 copy to March 2026 ledger wording, including explicit `12699` copy for Scenario B.
5. Extend match-group persistence so Agent D can undo by owned artifacts only.

## No code changes started yet

I did not modify existing implementation files in this turn because the current grouped-match contract is still missing the foundation required by the handoff, and the repo instructions for this workspace require strict scope discipline.
