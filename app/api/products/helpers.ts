import type { Product, Account } from "@prisma/client"

interface ProductWithRelations extends Product {
  distributor?: Pick<Account, "accountName"> | null
  vendor?: Pick<Account, "accountName"> | null
}

export interface ProductListRow {
  id: string
  select: boolean
  active: boolean
  productNameHouse: string
  distributorName: string
  vendorName: string
  productFamilyVendor: string | null
  productSubtypeVendor: string | null
  productNameVendor: string
  partNumberVendor: string
  productDescriptionHouse: string
  productDescriptionVendor: string | null
  quantity: number | null
  priceEach: number | null
  commissionPercent: number | null
  revenueSchedulePeriods: number | null
  revenueScheduleEstimatedStartDate: string | null
  revenueType: string
}

const PRODUCT_SPEC_TODO_FIELDS = new Set([
  "productFamilyVendor",
  "productSubtypeVendor",
  "productDescriptionVendor",
  "quantity",
  "revenueSchedulePeriods",
  "revenueScheduleEstimatedStartDate",
])

export function describeProductFieldTodo(field: keyof ProductListRow) {
  if (!PRODUCT_SPEC_TODO_FIELDS.has(field)) {
    return null
  }

  switch (field) {
    case "productFamilyVendor":
      return "Requires vendor product family metadata (not yet stored)."
    case "productSubtypeVendor":
      return "Requires vendor product subtype metadata (not yet stored)."
    case "productDescriptionVendor":
      return "Requires vendor-specific description field (not yet stored)."
    case "quantity":
      return "Quantity only exists on opportunity products and revenue schedules - not on base products."
    case "revenueSchedulePeriods":
      return "Derived from revenue schedules; needs aggregation."
    case "revenueScheduleEstimatedStartDate":
      return "Derived from revenue schedules; needs earliest schedule date."
    default:
      return null
  }
}

export function mapProductToRow(product: ProductWithRelations): ProductListRow {
  const commissionPercent = product.commissionPercent ? Number(product.commissionPercent) : null
  const priceEach = product.priceEach ? Number(product.priceEach) : null

  return {
    id: product.id,
    select: false,
    active: Boolean(product.isActive),
    productNameHouse: product.productNameHouse ?? "",
    distributorName: product.distributor?.accountName ?? "",
    vendorName: product.vendor?.accountName ?? "",
    productFamilyVendor: product.productFamilyVendor ?? null,
    productSubtypeVendor: product.productSubtypeVendor ?? null,
    productNameVendor: product.productNameVendor ?? "",
    partNumberVendor: product.productCode ?? "",
    productDescriptionHouse: product.description ?? "",
    productDescriptionVendor: null,
    quantity: null,
    priceEach,
    commissionPercent,
    revenueSchedulePeriods: null,
    revenueScheduleEstimatedStartDate: null,
    revenueType: product.revenueType ?? "",
  }
}
