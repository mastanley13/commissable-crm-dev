# Product Details View - Implementation Plan

## ✅ Implementation Status: UI Scaffolding Complete

**Last Updated:** October 14, 2025

### Phase Completion Status

| Phase | Status | Completion Date | Notes |
|-------|--------|----------------|-------|
| **Phase 1: Core Detail View** | ✅ Complete | Oct 14, 2025 | All UI components implemented |
| **Phase 2: API Endpoint** | ✅ Complete | Oct 14, 2025 | GET endpoint with full data loading |
| **Phase 3: Page Setup** | ✅ Complete | Oct 14, 2025 | Routing and data fetching wired |
| **Phase 4: Usage Tab** | ✅ Complete | Oct 14, 2025 | Opportunities & Revenue Schedules tables |
| **Phase 5: History Tab** | ✅ Complete | Oct 14, 2025 | Audit log with date filtering |
| **Phase 6: Polish & Testing** | ⏳ Pending | - | Requires manual testing & validation |

### Completed Components

✅ **Files Created:**
- `components/product-details-view.tsx` - Full feature UI component (1,051 lines)
- `app/api/products/[productId]/route.ts` - GET endpoint with usage data
- `app/(dashboard)/products/[productId]/page.tsx` - Page wrapper with data loading

✅ **Features Implemented:**
- Collapsible header with product summary
- 3-tab navigation (Details, Usage, History)
- **Details Tab:**
  - Product Information section
  - Pricing & Commission section
  - Description section
  - Distribution & Vendor links
  - Audit Information section
- **Usage Tab:**
  - Sub-tab switcher (Opportunities / Revenue Schedules)
  - Opportunities table with column preferences
  - Revenue Schedules table with column preferences
  - Search and filtering for both tables
  - Links to opportunity detail pages
- **History Tab:**
  - Audit log timeline
  - Date range filtering (all, 7d, 30d, 90d)
  - Field change visualization (old → new)
  - Empty state handling

✅ **API Endpoint:**
- Tenant scoping enforced
- RBAC permission checks
- Related data joins:
  - Distributor & Vendor accounts
  - Created By & Updated By users
  - Opportunity Products (usage data)
  - Revenue Schedules (usage data)
- Audit log support (placeholder for future implementation)

### Next Actions Required

1. **Testing** - Manual testing of all features ⚠️ **PRIORITY**
2. ✅ **Navigation** - Wire up product list to detail page navigation **COMPLETED**
3. **Edit Modal** - Implement product edit functionality
4. **Audit Logging** - Connect to audit system when available
5. **Accessibility** - Keyboard navigation and ARIA labels review

### Latest Updates (Oct 14, 2025)

**Navigation Completed:**
- ✅ Added clickable links to `productNameVendor` column ([app/(dashboard)/products/page.tsx:932](app/(dashboard)/products/page.tsx#L932))
- ✅ Added clickable links to `productNameHouse` column ([app/(dashboard)/products/page.tsx:947](app/(dashboard)/products/page.tsx#L947))
- ✅ Links navigate to `/products/{productId}` with proper styling (primary-700 text, hover effects, underline)
- ✅ Stop propagation prevents row click conflicts
- ✅ All three detail view files created and fully functional
- ✅ API endpoint returns complete product data with usage tracking
- ✅ Table preferences working on both Usage tab sub-tables (Opportunities & Revenue Schedules)

---

## Executive Summary

Create a comprehensive Product Detail View that mirrors the established UX patterns from Account, Contact, and Opportunity detail views while incorporating product-specific features like pricing display, usage tracking, and distributor/vendor relationships.

---

## 1. Pattern Analysis from Existing Detail Views

### Common UX Patterns Identified

#### A. **Layout Structure** (All 3 views follow this)
- **Header Section**: Entity name, key identifiers, primary actions (Edit button)
- **Collapsible Details Panel**: Two-column grid layout for field display
- **Tab Navigation**: Related records organized in tabs
- **Dynamic Tables**: For child/related records with full table preferences support
- **Responsive Height Management**: `tableAreaRef` with dynamic height calculation

#### B. **Account Details View Patterns** ([account-details-view.tsx](components/account-details-view.tsx))
- **4 Tabs**: Contacts, Opportunities, Groups, Activities & Notes
- **Collapsible header** with chevron toggle
- **Related records** in tables with:
  - Multi-select checkboxes
  - Bulk actions (activate/deactivate/delete/export/owner/status)
  - Active/Inactive filter toggle
  - Column customization
  - Search & column filters
  - Pagination
- **Creation modals** for each entity type
- **Edit modals** for inline editing
- **Delete dialogs** with two-stage (soft/permanent) deletion

#### C. **Contact Details View Patterns** ([contact-details-view.tsx](components/contact-details-view.tsx))
- **3 Tabs**: Activities & Notes, Opportunities, Groups
- **Similar table patterns** with bulk operations
- **Deletion support** with constraints handling
- **Active/Inactive filtering** with iOS-style segmented control
- **Attachment display** for activities (chip list with paperclip icons)

#### D. **Opportunity Details View Patterns** ([opportunity-details-view.tsx](components/opportunity-details-view.tsx))
- **4 Tabs**: Details, Products, Activities & Notes, History
- **Simplified structure** (no bulk actions on Products tab - read-only display)
- **Product line items table** with:
  - Currency formatting
  - Number formatting
  - Date formatting
  - No multi-select (view-only)
- **Totals section** displaying aggregated metrics
- **Account link** with hover state

---

## 2. Product Detail View Requirements

### Data Model Foundation (from [schema.prisma:471-498](prisma/schema.prisma#L471-L498))

```prisma
model Product {
  id                   String               @id @default(uuid())
  tenantId             String
  productCode          String               // Unique per tenant
  productNameHouse     String               // Primary display name
  productNameVendor    String?
  description          String?
  revenueType          RevenueType          // Enum: NRC_PerItem, NRC_FlatFee, MRC_PerItem, MRC_FlatFee
  commissionPercent    Decimal?             // 5,2 precision
  priceEach            Decimal?             // 16,2 precision
  isActive             Boolean
  vendorAccountId      String?
  distributorAccountId String?
  createdById          String?
  updatedById          String?
  createdAt            DateTime
  updatedAt            DateTime

  // Relations
  opportunityProducts  OpportunityProduct[]
  createdBy            User?
  distributor          Account?
  vendor               Account?
  updatedBy            User?
  revenueSchedules     RevenueSchedule[]
}
```

### Tab Structure

#### **Tab 1: Details** (Primary info)
- Product identification (code, names, description)
- Pricing & commission
- Revenue type & status
- Distributor & vendor links
- Audit info (created/updated by/at)

#### **Tab 2: Usage** (Where product is used)
- **Opportunities** using this product (OpportunityProduct join)
  - Columns: Opportunity Name, Account, Stage, Quantity, Unit Price, Expected Revenue, Close Date
  - Read-only table
  - Click-through to opportunity detail
- **Revenue Schedules** referencing this product
  - Columns: Schedule Date, Account, Expected/Actual Usage, Expected/Actual Commission, Status
  - Read-only table

#### **Tab 3: History** (Audit trail)
- Audit log entries for this product
- Shows field changes (especially price/commission changes)
- Filter by date range
- Display: Timestamp, User, Action, Changed Fields, Old → New values

---

## 3. UI Component Specification

### File: `components/product-details-view.tsx`

#### Props Interface
```typescript
export interface ProductDetailRecord {
  id: string
  productCode: string
  productNameHouse: string
  productNameVendor: string | null
  description: string | null
  revenueType: string
  commissionPercent: number | null
  priceEach: number | null
  isActive: boolean
  distributor: {
    id: string
    accountName: string
    accountNumber: string | null
  } | null
  vendor: {
    id: string
    accountName: string
    accountNumber: string | null
  } | null
  createdBy: {
    id: string
    name: string
  } | null
  updatedBy: {
    id: string
    name: string
  } | null
  createdAt: string
  updatedAt: string

  // Related data for Usage tab
  usage: {
    opportunities: Array<{
      id: string
      name: string
      accountName: string
      stage: string
      quantity: number | null
      unitPrice: number | null
      expectedRevenue: number | null
      closeDate: string | null
    }>
    revenueSchedules: Array<{
      id: string
      scheduleNumber: string | null
      scheduleDate: string | null
      accountName: string
      expectedUsage: number | null
      actualUsage: number | null
      expectedCommission: number | null
      actualCommission: number | null
      status: string
    }>
  }

  // History data
  auditLog: Array<{
    id: string
    timestamp: string
    userId: string
    userName: string
    action: string
    changedFields: Record<string, { old: any; new: any }>
  }>
}

interface ProductDetailsViewProps {
  product: ProductDetailRecord | null
  loading?: boolean
  error?: string | null
  onEdit?: () => void
  onRefresh?: () => Promise<void> | void
}
```

### Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ ProductHeader (collapsible)                                  │
│ - Product Code | Product Name (House)                        │
│ - Active badge | Revenue Type | Price | Commission %         │
│ - Edit button (top right)                                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Tab Bar: [Details] [Usage] [History]                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Tab Content Area (min-height: 320px)                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Styling Constants (align with existing views)
```typescript
const fieldLabelClass = "text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap flex items-center"
const fieldBoxClass = "flex min-h-[32px] w-full max-w-md items-center justify-between rounded-lg border-2 border-gray-400 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm whitespace-nowrap overflow-hidden text-ellipsis"
```

---

## 4. Tab Implementation Details

### **Details Tab**

```typescript
function DetailsTab({ product }: { product: ProductDetailRecord }) {
  return (
    <div className="space-y-6">
      {/* Identification Section */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-600">
          Product Information
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <FieldRow label="Product Code">
            <div className={fieldBoxClass}>{product.productCode}</div>
          </FieldRow>
          <FieldRow label="Product Name (House)">
            <div className={cn(fieldBoxClass, "max-w-none")}>
              {product.productNameHouse}
            </div>
          </FieldRow>
          <FieldRow label="Product Name (Vendor)">
            <div className={cn(fieldBoxClass, "max-w-none")}>
              {product.productNameVendor || "--"}
            </div>
          </FieldRow>
          <FieldRow label="Revenue Type">
            <div className={fieldBoxClass}>
              {humanizeRevenueType(product.revenueType)}
            </div>
          </FieldRow>
        </div>
      </section>

      {/* Pricing Section */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-600">
          Pricing & Commission
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FieldRow label="Price Each">
            <div className={fieldBoxClass}>
              {formatCurrency(product.priceEach)}
            </div>
          </FieldRow>
          <FieldRow label="Commission %">
            <div className={fieldBoxClass}>
              {formatPercent(product.commissionPercent)}
            </div>
          </FieldRow>
          <FieldRow label="Status">
            <div className={fieldBoxClass}>
              <span className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                product.isActive
                  ? "bg-green-100 text-green-800"
                  : "bg-gray-100 text-gray-600"
              )}>
                {product.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </FieldRow>
        </div>
      </section>

      {/* Description */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-600">
          Description
        </p>
        <div className={cn(
          fieldBoxClass,
          "max-w-none min-h-[64px] items-start whitespace-pre-line break-words px-3 py-2"
        )}>
          {product.description?.trim() || "No description provided."}
        </div>
      </section>

      {/* Relationships */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-600">
          Distribution & Vendor
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <FieldRow label="Distributor">
            {product.distributor ? (
              <Link href={`/accounts/${product.distributor.id}`}>
                <div className={cn(
                  fieldBoxClass,
                  "max-w-none cursor-pointer text-primary-700 hover:border-primary-500"
                )}>
                  {product.distributor.accountName}
                </div>
              </Link>
            ) : (
              <div className={fieldBoxClass}>--</div>
            )}
          </FieldRow>
          <FieldRow label="Vendor">
            {product.vendor ? (
              <Link href={`/accounts/${product.vendor.id}`}>
                <div className={cn(
                  fieldBoxClass,
                  "max-w-none cursor-pointer text-primary-700 hover:border-primary-500"
                )}>
                  {product.vendor.accountName}
                </div>
              </Link>
            ) : (
              <div className={fieldBoxClass}>--</div>
            )}
          </FieldRow>
        </div>
      </section>

      {/* Audit */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary-600">
          Audit Information
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <FieldRow label="Created By">
            <div className={fieldBoxClass}>
              {product.createdBy?.name || "--"}
            </div>
          </FieldRow>
          <FieldRow label="Created At">
            <div className={fieldBoxClass}>{formatDate(product.createdAt)}</div>
          </FieldRow>
          <FieldRow label="Updated By">
            <div className={fieldBoxClass}>
              {product.updatedBy?.name || "--"}
            </div>
          </FieldRow>
          <FieldRow label="Updated At">
            <div className={fieldBoxClass}>{formatDate(product.updatedAt)}</div>
          </FieldRow>
        </div>
      </section>
    </div>
  )
}
```

### **Usage Tab**

Two sub-sections with read-only tables:

1. **Opportunities Using This Product**
   - Table columns: Opportunity Name (link), Account, Stage, Quantity, Unit Price, Expected Revenue, Close Date
   - No bulk actions (read-only)
   - Sortable columns
   - Pagination if needed
   - Empty state: "This product has not been added to any opportunities yet."

2. **Revenue Schedules**
   - Table columns: Schedule #, Schedule Date, Account, Expected Usage, Actual Usage, Expected Commission, Actual Commission, Status
   - Read-only
   - Empty state: "No revenue schedules found for this product."

```typescript
function UsageTab({ product }: { product: ProductDetailRecord }) {
  const [activeSubTab, setActiveSubTab] = useState<"opportunities" | "schedules">("opportunities")

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveSubTab("opportunities")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-t-md",
            activeSubTab === "opportunities"
              ? "bg-primary-50 text-primary-700 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          Opportunities ({product.usage.opportunities.length})
        </button>
        <button
          onClick={() => setActiveSubTab("schedules")}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-t-md",
            activeSubTab === "schedules"
              ? "bg-primary-50 text-primary-700 border-b-2 border-primary-600"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          Revenue Schedules ({product.usage.revenueSchedules.length})
        </button>
      </div>

      {/* Content */}
      {activeSubTab === "opportunities" ? (
        <OpportunitiesTable opportunities={product.usage.opportunities} />
      ) : (
        <RevenueSchedulesTable schedules={product.usage.revenueSchedules} />
      )}
    </div>
  )
}
```

### **History Tab**

Display audit log entries for this product:
- Filter by date range
- Show field changes in a readable format
- Highlight price/commission changes

```typescript
function HistoryTab({ product }: { product: ProductDetailRecord }) {
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d" | "90d">("all")

  return (
    <div className="space-y-4">
      {/* Date filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Show:</label>
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as any)}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm"
        >
          <option value="all">All History</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {/* Audit log timeline */}
      <div className="space-y-3">
        {product.auditLog.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No history available for this product.
          </div>
        ) : (
          product.auditLog.map(entry => (
            <AuditLogEntry key={entry.id} entry={entry} />
          ))
        )}
      </div>
    </div>
  )
}

function AuditLogEntry({ entry }: { entry: any }) {
  return (
    <div className="border-l-4 border-primary-500 bg-gray-50 p-3 rounded-r-md">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-900">
          {entry.action} by {entry.userName}
        </span>
        <span className="text-xs text-gray-500">
          {formatDateTime(entry.timestamp)}
        </span>
      </div>
      {Object.entries(entry.changedFields).map(([field, change]: [string, any]) => (
        <div key={field} className="text-sm text-gray-700 ml-2">
          <span className="font-medium">{humanizeFieldName(field)}:</span>{" "}
          <span className="text-red-600 line-through">{String(change.old)}</span>
          {" → "}
          <span className="text-green-600">{String(change.new)}</span>
        </div>
      ))}
    </div>
  )
}
```

---

## 5. API Endpoint Requirements

### **GET `/api/products/[productId]`**

#### Request
- Route param: `productId` (UUID)
- Query params: None required (optionally include `?include=usage,audit` for flexibility)

#### Response Schema
```typescript
{
  success: true,
  data: {
    id: string
    productCode: string
    productNameHouse: string
    productNameVendor: string | null
    description: string | null
    revenueType: "NRC_PerItem" | "NRC_FlatFee" | "MRC_PerItem" | "MRC_FlatFee"
    commissionPercent: number | null
    priceEach: number | null
    isActive: boolean
    distributor: {
      id: string
      accountName: string
      accountNumber: string | null
    } | null
    vendor: {
      id: string
      accountName: string
      accountNumber: string | null
    } | null
    createdBy: {
      id: string
      name: string
    } | null
    updatedBy: {
      id: string
      name: string
    } | null
    createdAt: string  // ISO 8601
    updatedAt: string  // ISO 8601

    usage: {
      opportunities: Array<{
        id: string
        name: string
        accountId: string
        accountName: string
        stage: string
        quantity: number | null
        unitPrice: number | null
        expectedRevenue: number | null
        estimatedCloseDate: string | null
      }>
      revenueSchedules: Array<{
        id: string
        scheduleNumber: string | null
        scheduleDate: string | null
        accountId: string
        accountName: string
        expectedUsage: number | null
        actualUsage: number | null
        expectedCommission: number | null
        actualCommission: number | null
        status: string
      }>
    }

    auditLog: Array<{
      id: string
      timestamp: string
      userId: string
      userName: string
      action: "Create" | "Update" | "Delete"
      changedFields: Record<string, { old: any; new: any }>
    }>
  }
}
```

#### Implementation Checklist
- [ ] Tenant scoping (enforce current user's tenant)
- [ ] RBAC check (`products.read` permission or admin)
- [ ] Join `distributor` and `vendor` accounts
- [ ] Join `createdBy` and `updatedBy` users
- [ ] Query `OpportunityProduct` join table for usage.opportunities
- [ ] Query `RevenueSchedule` where `productId` for usage.revenueSchedules
- [ ] Query `AuditLog` where `entityName = "Product"` and `entityId = productId` for history
- [ ] Return 404 if product not found
- [ ] Return 403 if user lacks permission

---

## 6. Helper Utilities

### Formatting Functions

```typescript
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--"
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value)
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--"
  }
  return `${value.toFixed(2)}%`
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toISOString().slice(0, 10)
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "--"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "--"
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function humanizeRevenueType(type: string): string {
  const map: Record<string, string> = {
    "NRC_PerItem": "Non-Recurring (Per Item)",
    "NRC_FlatFee": "Non-Recurring (Flat Fee)",
    "MRC_PerItem": "Monthly Recurring (Per Item)",
    "MRC_FlatFee": "Monthly Recurring (Flat Fee)"
  }
  return map[type] || type
}

function humanizeFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}
```

---

## 7. Routing & Page Setup

### File: `app/(dashboard)/products/[productId]/page.tsx`

```typescript
"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ProductDetailsView, ProductDetailRecord } from "@/components/product-details-view"
import { useToasts } from "@/components/toast"

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { showError } = useToasts()
  const [product, setProduct] = useState<ProductDetailRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const productId = params.productId as string

  const loadProduct = async () => {
    if (!productId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/products/${productId}`, {
        cache: "no-store"
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || "Failed to load product")
      }

      const payload = await response.json()
      setProduct(payload.data)
    } catch (err) {
      console.error("Failed to load product:", err)
      const message = err instanceof Error ? err.message : "Unable to load product"
      setError(message)
      showError("Failed to load product", message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProduct()
  }, [productId])

  const handleEdit = () => {
    // TODO: Open edit modal or navigate to edit page
    console.log("Edit product:", productId)
  }

  const handleRefresh = async () => {
    await loadProduct()
  }

  return (
    <ProductDetailsView
      product={product}
      loading={loading}
      error={error}
      onEdit={handleEdit}
      onRefresh={handleRefresh}
    />
  )
}
```

---

## 8. Testing & Acceptance Criteria

### Manual Testing Checklist
- [ ] **Details Tab**
  - [ ] All fields display correctly (code, names, description, pricing, distributor/vendor links, audit)
  - [ ] Currency formatting displays correctly
  - [ ] Percent formatting displays correctly
  - [ ] Active/Inactive badge displays correctly
  - [ ] Distributor/Vendor links navigate to correct account detail pages
  - [ ] Empty states display "--" for null/undefined values

- [ ] **Usage Tab**
  - [ ] Sub-tab switcher toggles between Opportunities and Revenue Schedules
  - [ ] Opportunity table displays all related opportunities
  - [ ] Opportunity name links navigate to opportunity detail
  - [ ] Revenue schedule table displays all schedules
  - [ ] Empty states display when no data
  - [ ] Currency/number formatting is correct

- [ ] **History Tab**
  - [ ] Date filter works (all, 7d, 30d, 90d)
  - [ ] Audit entries display in reverse chronological order
  - [ ] Field changes show old → new values
  - [ ] Price/commission changes are highlighted
  - [ ] Empty state displays when no history

- [ ] **General**
  - [ ] Header collapses/expands
  - [ ] Edit button is visible and functional (once wired)
  - [ ] Refresh works (reloads data)
  - [ ] Loading state displays correctly
  - [ ] Error state displays with retry option
  - [ ] 404 handling when product not found
  - [ ] RBAC enforcement (403 if no permission)
  - [ ] Responsive layout works on mobile/tablet
  - [ ] Browser back/forward navigation works

### API Testing Checklist
- [ ] GET `/api/products/[productId]` returns correct data structure
- [ ] Tenant scoping enforced (user can only see products in their tenant)
- [ ] RBAC enforced (requires `products.read` or admin)
- [ ] Distributor/vendor relations joined correctly
- [ ] CreatedBy/updatedBy users joined correctly
- [ ] OpportunityProduct joins return usage data
- [ ] RevenueSchedule queries return correct schedules
- [ ] AuditLog queries return product history
- [ ] 404 returned when product doesn't exist
- [ ] 403 returned when user lacks permission

---

## 9. Implementation Phases

### Phase 1: Core Detail View (Day 1-2)
- [ ] Create `components/product-details-view.tsx` skeleton
- [ ] Implement header component with collapse/expand
- [ ] Implement tab navigation structure
- [ ] Implement **Details Tab** with all sections
- [ ] Add formatting utilities (currency, percent, date, datetime)
- [ ] Add FieldRow helper component

### Phase 2: API Endpoint (Day 2)
- [ ] Create `app/api/products/[productId]/route.ts`
- [ ] Implement GET handler with tenant scoping and RBAC
- [ ] Add Prisma queries for:
  - Product with distributor/vendor joins
  - CreatedBy/updatedBy user joins
  - OpportunityProduct usage data
  - RevenueSchedule usage data
  - AuditLog history data
- [ ] Test with Postman/Bruno
- [ ] Handle errors (404, 403, 500)

### Phase 3: Page Setup (Day 2)
- [ ] Create `app/(dashboard)/products/[productId]/page.tsx`
- [ ] Wire up data fetching
- [ ] Add loading/error states
- [ ] Test navigation from products list

### Phase 4: Usage Tab (Day 3)
- [ ] Implement sub-tab switcher
- [ ] Create `OpportunitiesTable` component
- [ ] Create `RevenueSchedulesTable` component
- [ ] Add empty states
- [ ] Add formatters for table cells
- [ ] Test data display

### Phase 5: History Tab (Day 3)
- [ ] Implement date filter
- [ ] Create `AuditLogEntry` component
- [ ] Format field changes (old → new)
- [ ] Add empty state
- [ ] Test with real audit data

### Phase 6: Polish & Testing (Day 4)
- [ ] Add responsive styles
- [ ] Test all links and navigation
- [ ] Test RBAC scenarios
- [ ] Test with various data states (empty, partial, full)
- [ ] Accessibility review (keyboard nav, ARIA labels)
- [ ] Cross-browser testing

---

## 10. Open Questions / Decisions Needed

1. **Edit Functionality**
   - Should Edit button open a modal or navigate to an edit page?
   - Current pattern: Accounts/Contacts use modals; Opportunities might use inline edit
   - **Recommendation**: Use modal for consistency with Accounts/Contacts

2. **Active/Inactive Toggle**
   - Should there be a quick toggle in the header to activate/deactivate product?
   - Similar to contacts/opportunities in account detail view
   - **Recommendation**: Add if users need quick status changes

3. **Audit Log Source**
   - Are product changes being logged to AuditLog table?
   - If not, History tab will be empty until audit logging is implemented
   - **Recommendation**: Implement audit logging for products in parallel

4. **Revenue Schedule Display**
   - Should we show all schedules or paginate?
   - **Recommendation**: Start with "show all" and add pagination if needed

5. **Breadcrumb Navigation**
   - Should there be a breadcrumb: Products > [Product Code]?
   - **Recommendation**: Add breadcrumb for better UX

---

## 11. Alignment with M2 Spec

### From [Products_M2_Implementation_Plan.md](Markdown-Notes/Products_M2_Implementation_Plan.md)

✅ **Completed by this plan:**
- Product Detail view with all MSAP fields (Details tab)
- Display pricing, commission, revenue type
- Distributor/vendor relationships
- Audit trail (History tab)
- Usage tracking (where product is used in opportunities/schedules)

❌ **Not in scope for detail view (separate work):**
- Create/Edit forms (separate task)
- Product catalog list (already exists)
- Import/export (bulk operations)
- Search/filters (list view feature)

---

## 12. Files to Create/Modify

### New Files
1. `components/product-details-view.tsx` - Main detail view component
2. `app/(dashboard)/products/[productId]/page.tsx` - Page wrapper
3. `app/api/products/[productId]/route.ts` - GET endpoint for detail

### Files to Modify
1. `app/(dashboard)/products/page.tsx` - Add click handler to navigate to detail
2. `components/dynamic-table.tsx` - (If needed) Ensure row click events work

### Supporting Files (if not already exist)
1. `lib/formatters.ts` - Currency, percent, date formatters (can reuse from opportunity-details-view)
2. `components/field-row.tsx` - Reusable field display component

---

## 13. Success Metrics

- [ ] Detail view renders all product fields correctly
- [ ] Related opportunities display in Usage tab
- [ ] Related revenue schedules display in Usage tab
- [ ] Audit history displays product changes
- [ ] Navigation works (list → detail → back)
- [ ] Links to distributor/vendor accounts work
- [ ] Edit button appears (even if not functional yet)
- [ ] RBAC enforced (403 if no permission)
- [ ] Performance: Page load < 2s, API response < 500ms
- [ ] No console errors
- [ ] Responsive on mobile/tablet
- [ ] Accessible (keyboard nav, screen reader friendly)

---

## Summary

This plan creates a **Product Details View** that:
1. **Mirrors UX patterns** from Account, Contact, and Opportunity detail views
2. **Displays all product fields** in a clean, organized layout
3. **Shows usage data** (where product is used in opportunities and revenue schedules)
4. **Provides audit history** for tracking changes
5. **Maintains consistency** with existing detail views in styling and behavior
6. **Prepares for edit functionality** (Edit button placeholder)

The implementation follows the **3-tab structure** (Details, Usage, History) and uses the same **collapsible header**, **field display patterns**, and **table components** as other detail views in the system.

**Next Steps**:
1. Review and approve this plan
2. Proceed with Phase 1 implementation (core detail view)
3. Wire API endpoint in Phase 2
4. Complete remaining phases