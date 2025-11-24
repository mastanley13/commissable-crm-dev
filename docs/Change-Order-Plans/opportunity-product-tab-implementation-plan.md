# Implementation Plan: Opportunity Product Tab Enhancement
## Progressive Search UX with Dual-Column Modal

### Architecture Overview

**Modal Structure**: Single modal with **two header tabs** (tab-like navigation), **two-column layout** for each tab

#### Tab 1: "Add Product from Catalog"
- **Left Column**: Progressive search panel (Distributor → Vendor → Family → Product)
- **Right Column**: Line item details (Quantity, Price, Commission, Periods, Start Date)

#### Tab 2: "Create New Product"
- **Full 2-column product creation form** matching `components/product-create-modal.tsx`
- Uses exact same field layout/order as main Products Module
- After creation, automatically creates line item with same right-column details

---

## Implementation Tasks Breakdown

### Phase 1: API Foundation (Backend)

#### 1.1 Create Faceted Search Endpoint
**File**: `app/api/products/facets/route.ts` (new)

**Purpose**: Return counts for each filter option to enable "search by elimination"

**Request**:
```typescript
GET /api/products/facets?distributorId=uuid&vendorId=uuid&productFamilyVendor=value
```

**Response**:
```typescript
{
  distributors: [
    { id: "uuid", name: "Acme Corp", count: 45 },
    { id: "uuid", name: "Beta Inc", count: 23 }
  ],
  vendors: [
    { id: "uuid", name: "Cisco", count: 12 },
    { id: "uuid", name: "Dell", count: 8 }
  ],
  families: [
    { name: "Switches", count: 5 },
    { name: "Routers", count: 7 }
  ]
}
```

**Logic**:
- Apply current filters (distributorId, vendorId, family) progressively
- Count distinct products for each next-level option
- Only return options with count > 0
- Respect tenant isolation and active products

#### 1.2 Create Duplicate Check Endpoint
**File**: `app/api/products/dedupe-check/route.ts` (new)

**Purpose**: Preflight check for likely duplicates before product creation

**Request**:
```typescript
POST /api/products/dedupe-check
{
  productCode: string,
  productNameVendor?: string,
  vendorAccountId?: string,
  tenantId: string
}
```

**Response**:
```typescript
{
  exactMatch: Product | null,  // Same productCode (normalized)
  likelyMatches: Product[]      // Same vendor + similar name
}
```

**Normalization Logic**:
```typescript
function normalizeProductCode(code: string): string {
  return code
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // Remove punctuation/spaces
    .trim()
}

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')  // Collapse whitespace
    .trim()
}
```

**Matching Rules**:
1. **Exact**: `normalizedProductCode` matches (blocks creation)
2. **Likely**: Same `vendorAccountId` + normalized name similarity >80% (Levenshtein distance)

#### 1.3 Enhance Products Search Endpoint
**File**: `app/api/products/route.ts` (modify)

**Changes**:
- Ensure strict filter application: `distributorId`, `vendorId`, `productFamilyVendor` as AND conditions
- Support combo: structured filters AND free-text `q` parameter
- Return total count for pagination

**No breaking changes** - already mostly implemented.

---

### Phase 2: Shared Components (Frontend)

#### 2.1 Progressive Search Panel Component
**File**: `components/product-lookup-panel.tsx` (new)

**Props**:
```typescript
interface ProductLookupPanelProps {
  prefillDistributorId?: string
  prefillVendorId?: string
  onProductSelected: (product: Product) => void
  className?: string
}
```

**UI Structure**:
```
┌─────────────────────────────────────┐
│ Step 1: Distributor                 │
│ [Typeahead Search] (Required)       │
│   ↳ Shows facet counts              │
├─────────────────────────────────────┤
│ Step 2: Vendor                      │
│ [Typeahead Search] (Required)       │
│   ↳ Filtered by Distributor         │
│   ↳ Shows facet counts              │
├─────────────────────────────────────┤
│ Step 3: Product Family (Optional)   │
│ [Dropdown with counts]              │
│   ↳ Filtered by Dist + Vendor       │
├─────────────────────────────────────┤
│ Step 4: Product Selection           │
│ [Search input + Results list]       │
│   ↳ Filtered by all above           │
│                                     │
│ ┌─ Product Result Card ──────────┐ │
│ │ Product Name House             │ │
│ │ Vendor: Cisco | Code: ABC123   │ │
│ │ Family: Switches | $1,200.00   │ │
│ │ [Select] button                │ │
│ └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Gating Logic**:
- Vendor field **disabled** until Distributor selected
- Family field **disabled** until Vendor selected
- Product results **empty** until Vendor selected (minimum requirement)

**Features**:
- Debounced search (200ms)
- Loading skeletons for each field
- Empty states with helpful messaging
- Keyboard navigation (arrow keys, Enter to select)
- Facet count badges next to options

#### 2.2 Duplicate Warning Panel
**File**: `components/product-duplicate-warning.tsx` (new)

**Props**:
```typescript
interface ProductDuplicateWarningProps {
  exactMatch: Product | null
  likelyMatches: Product[]
  onUseExisting: (product: Product) => void
  onProceedAnyway: () => void
  onCancel: () => void
}
```

**UI**:
```
┌────────────────────────────────────────┐
│ ⚠️ Potential Duplicates Found          │
├────────────────────────────────────────┤
│ We found similar products:             │
│                                        │
│ ┌─ Exact Match (Blocks creation) ────┐│
│ │ Product Name House                 ││
│ │ Vendor: Cisco | Code: ABC123       ││
│ │ [Use This Product] button          ││
│ └────────────────────────────────────┘│
│                                        │
│ ┌─ Likely Match ─────────────────────┐│
│ │ Product Name House                 ││
│ │ Vendor: Cisco | Code: ABC124       ││
│ │ Similarity: 85%                    ││
│ │ [Use This Product] button          ││
│ └────────────────────────────────────┘│
│                                        │
│ [Cancel] [Proceed Anyway] (if allowed) │
└────────────────────────────────────────┘
```

---

### Phase 3: Modal Restructure

#### 3.1 Update OpportunityLineItemCreateModal
**File**: `components/opportunity-line-item-create-modal.tsx` (major refactor)

**New Structure**:

```tsx
<Modal>
  <Header>
    {/* Tab Navigation */}
    <TabButton active={tab === 'catalog'}>
      Add Product from Catalog
    </TabButton>
    <TabButton active={tab === 'create'}>
      Create New Product
    </TabButton>
  </Header>

  <Content>
    {tab === 'catalog' && (
      <TwoColumnLayout>
        <LeftColumn>
          <ProductLookupPanel
            prefillDistributorId={opportunityDistributorId}
            prefillVendorId={opportunityVendorId}
            onProductSelected={handleProductSelected}
          />
        </LeftColumn>

        <RightColumn>
          <LineItemDetailsForm>
            {/* Removed: Opportunity ID (hidden) */}
            <Field label="Quantity" required />
            <Field label="Price Each" />
            <Field label="Expected Commission Rate %" />
            <Field label="Revenue Schedule Periods" />
            <Field label="Revenue Schedule Start Date" />
            {/* Date picker: left-aligned, fixed calendar alignment */}
          </LineItemDetailsForm>
        </RightColumn>
      </TwoColumnLayout>
    )}

    {tab === 'create' && (
      <ProductCreateForm>
        {/* Full 2-column layout matching ProductCreateModal */}
        {/* Same field order as product-create-modal.tsx:210-354 */}

        <LeftColumn>
          <Field label="Product Name - House" required />
          <Field label="Part Number - House" />
          <Field label="Distributor Name" />
          <Field label="Vendor Name" />
          <Field label="Product Family - House" />
          <Field label="House - Product Subtype" disabled />
        </LeftColumn>

        <RightColumn>
          <Field label="Price Each" />
          <Field label="Commission %" />
          <Field label="Revenue Type" required />
          <Field label="Status" type="switch" />
        </RightColumn>

        <FullWidth>
          <Field label="House - Description" type="textarea" />
        </FullWidth>

        <TwoColumns>
          <DistributorColumn>
            <Field label="Distributor - Product Name" />
            <Field label="Distributor - Part Number" />
            <Field label="Distributor - Product Family" />
            <Field label="Distributor - Product Subtype" disabled />
            <Field label="Distributor - Description" type="textarea" />
          </DistributorColumn>

          <VendorColumn>
            <Field label="Vendor - Product Name" />
            <Field label="Vendor - Part Number" />
            <Field label="Vendor - Product Family" />
            <Field label="Vendor - Product Subtype" />
            <Field label="Vendor - Description" type="textarea" />
          </VendorColumn>
        </TwoColumns>
      </ProductCreateForm>
    )}
  </Content>

  <Footer>
    <CancelButton />
    <SubmitButton>
      {tab === 'catalog' ? 'Add to Opportunity' : 'Create & Add to Opportunity'}
    </SubmitButton>
  </Footer>
</Modal>
```

**Key Changes**:
1. **Tab State**: `activeTab: 'catalog' | 'create'` (default: `'catalog'`)
2. **Prefill Logic**:
   ```typescript
   const opportunityDistributorId = opportunity.account?.accountType === 'Distributor'
     ? opportunity.accountId
     : null

   const opportunityVendorId = opportunity.account?.accountType === 'Vendor'
     ? opportunity.accountId
     : null
   ```
3. **Remove Opportunity ID field** from UI (still in payload)
4. **Create New Flow**:
   - On submit → call `POST /api/products/dedupe-check` first
   - If exact match → show error, switch to `ProductDuplicateWarning`
   - If likely matches → show `ProductDuplicateWarning` with "Proceed Anyway" option
   - If clean → create product via `POST /api/products`
   - Then create line item via `POST /api/opportunities/{id}/line-items`

#### 3.2 Submission Flow Updates

**Add from Catalog** (`catalog` tab):
```typescript
async function handleAddFromCatalog() {
  // Validate: product selected, quantity > 0
  const payload = {
    productId: selectedProduct.id,
    quantity: form.quantity,
    unitPrice: form.unitPrice || selectedProduct.priceEach,
    expectedCommission: form.expectedCommission,
    schedulePeriods: form.schedulePeriods,
    commissionStartDate: form.commissionStartDate,
    commissionPercent: form.commissionPercent || selectedProduct.commissionPercent
  }

  await fetch(`/api/opportunities/${opportunityId}/line-items`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })

  onSuccess()
  onClose()
}
```

**Create New Product** (`create` tab):
```typescript
async function handleCreateNewProduct() {
  // Step 1: Dedupe check
  const dedupeResult = await fetch('/api/products/dedupe-check', {
    method: 'POST',
    body: JSON.stringify({
      productCode: form.productCode,
      productNameVendor: form.productNameVendor,
      vendorAccountId: form.vendorAccountId
    })
  }).then(r => r.json())

  // Step 2: Handle duplicates
  if (dedupeResult.exactMatch) {
    showError('Exact match exists - cannot create duplicate')
    setDuplicateWarning(dedupeResult)
    return
  }

  if (dedupeResult.likelyMatches.length > 0) {
    setDuplicateWarning(dedupeResult)
    // User must confirm or use existing
    return
  }

  // Step 3: Create product
  const productResult = await fetch('/api/products', {
    method: 'POST',
    body: JSON.stringify({
      productNameHouse: form.productNameHouse,
      productCode: form.productCode,
      revenueType: form.revenueType,
      // ... all other fields from ProductCreateModal
    })
  }).then(r => r.json())

  // Step 4: Create line item (same as Add from Catalog)
  await fetch(`/api/opportunities/${opportunityId}/line-items`, {
    method: 'POST',
    body: JSON.stringify({
      productId: productResult.id,
      quantity: 1,  // Default or from additional field
      // ... line item details
    })
  })

  onSuccess()
  onClose()
}
```

---

### Phase 4: UX Enhancements

#### 4.1 Date Picker Improvements
**Issue**: Calendar misalignment in current implementation

**Fix**:
- Use left-aligned positioning for calendar popup
- Ensure z-index layering doesn't conflict with modal
- Match styling from product-create-modal.tsx:258-262

#### 4.2 Loading States
- Skeleton loaders for typeahead fields while fetching
- Spinner on "Add to Opportunity" button during submission
- Disable form during async operations

#### 4.3 Empty States
```
┌────────────────────────────────┐
│ No products found              │
│                                │
│ Try adjusting your filters or │
│ create a new product.          │
│                                │
│ [Switch to Create New]         │
└────────────────────────────────┘
```

#### 4.4 Keyboard Navigation
- Tab through Distributor → Vendor → Family → Product fields
- Arrow keys to navigate dropdown options
- Enter to select highlighted option
- Escape to close dropdowns/cancel modal

---

## File Changes Summary

### New Files
1. `app/api/products/facets/route.ts` - Faceted search counts
2. `app/api/products/dedupe-check/route.ts` - Duplicate detection
3. `components/product-lookup-panel.tsx` - Progressive search component
4. `components/product-duplicate-warning.tsx` - Duplicate warning UI
5. `lib/product-normalization.ts` - Shared normalization utilities

### Modified Files
1. `components/opportunity-line-item-create-modal.tsx` - Complete restructure
2. `app/api/products/route.ts` - Minor query enhancements (if needed)

### Reference Files (no changes)
1. `components/product-create-modal.tsx` - Field layout reference
2. `app/api/opportunities/[opportunityId]/line-items/route.ts` - Existing line item creation

---

## Testing Checklist

### Unit Tests
- [ ] `normalizeProductCode()` handles special characters correctly
- [ ] `normalizeProductName()` collapses whitespace properly
- [ ] Facet counts return correct numbers with progressive filters

### Integration Tests
- [ ] `GET /api/products/facets` respects tenant isolation
- [ ] `POST /api/products/dedupe-check` finds exact and likely matches
- [ ] Progressive search filters cascade correctly (Distributor → Vendor → Family)
- [ ] Creating product with exact duplicate shows error
- [ ] Creating product with likely duplicate shows warning but allows proceed

### UI Tests
- [ ] Vendor field disabled until Distributor selected
- [ ] Family field disabled until Vendor selected
- [ ] Product results empty until minimum filters applied
- [ ] Facet counts display next to dropdown options
- [ ] Switching tabs preserves form state (or clears appropriately)
- [ ] Opportunity ID hidden in UI but included in submission
- [ ] Date picker calendar aligned correctly
- [ ] Keyboard navigation works throughout

### E2E Tests
- [ ] Add existing product from catalog creates line item
- [ ] Create new product + add to opportunity in one flow
- [ ] Prefill from opportunity account works correctly
- [ ] Duplicate warning shows and "Use Existing" switches tabs
- [ ] Empty state with "Create New" button switches tabs

---

## Migration & Rollout

### Phase 1: Backend APIs (Days 1-2)
- Create facets endpoint
- Create dedupe-check endpoint
- Test with Postman/curl

### Phase 2: Component Library (Days 3-4)
- Build ProductLookupPanel component
- Build ProductDuplicateWarning component
- Storybook stories for isolated testing

### Phase 3: Modal Integration (Days 5-6)
- Refactor OpportunityLineItemCreateModal
- Wire up new components
- Connect to APIs
- Manual QA testing

### Phase 4: Polish & Deploy (Day 7)
- Fix edge cases
- Accessibility audit
- Performance testing
- Deploy to staging → production

---

## Acceptance Criteria ✅

1. **Progressive Search**
   - ✅ User must select Distributor before Vendor field activates
   - ✅ User must select Vendor before Family/Product fields activate
   - ✅ Each dropdown shows facet counts for available options
   - ✅ Product results filtered by all active selections

2. **Two-Column Layout**
   - ✅ Left column: Progressive search panel
   - ✅ Right column: Line item details (Quantity, Price, Commission, Periods, Start Date)
   - ✅ Opportunity ID hidden from UI

3. **Create New Product**
   - ✅ Separate tab with full 2-column product form
   - ✅ Matches exact layout/field order of ProductCreateModal
   - ✅ Includes "House - Description" field
   - ✅ Full Product Revenue Type dropdown populated

4. **Duplicate Detection**
   - ✅ Exact productCode match blocks creation, shows error
   - ✅ Likely matches show warning with "Use Existing" options
   - ✅ User can proceed with creation if no exact match

5. **Prefill Behavior**
   - ✅ Auto-populate Distributor/Vendor from Opportunity primary account
   - ✅ Fall back to blank if account type doesn't match

6. **Tab Navigation**
   - ✅ Two header tabs: "Add Product from Catalog" and "Create New Product"
   - ✅ Default opens to "Add Product from Catalog"

---

## Questions for Clarification (if needed during implementation)

1. Should the right-column "Line Item Details" also appear in the "Create New Product" tab, or only after product creation?
2. Do we need revenue schedule fields (Periods, Start Date) in both tabs, or only "Add from Catalog"?
3. Should "Create New Product" immediately add to opportunity, or require a second step?

Current assumption: **Create New Product** → creates product → automatically adds to opportunity in single flow.

---

## Design Decisions from User Clarifications

### Modal Architecture
- **Single modal** with two tab-style headers (not separate modals)
- Tab 1: "Add Product from Catalog"
- Tab 2: "Create New Product"

### Progressive Search Behavior
- **Hard gates with cascading filters**
- All fields visible, but downstream fields disabled until upstream selection made
- Typeahead with server-side filtering
- User flow: Distributor (required) → Vendor (required) → Product Family (optional) → Product (required)

### Create New Product Flow
- **Separate tab** with full 2-column product creation form
- NOT inline in right column
- Uses exact same layout/field order as ProductCreateModal from main Products Module
- Includes all necessary fields: House - Description, full Product Revenue Type entries

### Prefill Strategy
- **Option A & C**: Prefill from Opportunity primary account if it's a Distributor/Vendor type
- If unable to prefill (account type doesn't match), leave blank for manual selection

### Field Visibility
- **Opportunity ID**: Remove from visible UI (field exists in backend but hidden in modal)

### Tab Titles
- **Separate titles per tab**:
  - "Add Product from Catalog"
  - "Create New Product"

---

This plan retains maximum compatibility with the current structure while implementing the progressive search UX as specified in the enhancement plan.
