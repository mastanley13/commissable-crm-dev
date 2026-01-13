import type { Product, Account } from "@prisma/client"
import { getRevenueTypeLabel } from "@/lib/revenue-types"
import { type OtherSource, resolveOtherSource, resolveOtherValue } from "@/lib/other-field"

type ProductWithRelations = Product & {
  productSubtypeHouse?: string | null
  distributorProductSubtype?: string | null
  distributor?: Pick<Account, "id" | "accountName"> | null
  vendor?: Pick<Account, "id" | "accountName"> | null
  _count?: {
    revenueSchedules?: number
  }
}

export interface ProductListRow {
  id: string
  select: boolean
  active: boolean
  distributorId?: string | null
  productNameHouse: string
  distributorName: string
  vendorId?: string | null
  vendorName: string
  productFamilyHouse: string | null
  productFamilyVendor: string | null
  productSubtypeHouse: string | null
  productSubtypeVendor: string | null
  productNameVendor: string
  productNameOther?: string | null
  partNumberVendor: string
  partNumberOther?: string | null
  productDescriptionHouse: string
  productDescriptionVendor: string | null
  productDescriptionOther?: string | null
  otherSource?: OtherSource | null
  distributorProductSubtype: string | null
  quantity: number | null
  priceEach: number | null
  commissionPercent: number | null
  revenueSchedulePeriods: number | null
  revenueScheduleEstimatedStartDate: string | null
  revenueType: string
  revenueTypeLabel: string
  hasRevenueSchedules: boolean
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
  const revenueScheduleCount = product._count?.revenueSchedules ?? 0

  const productNameOther = resolveOtherValue(product.productNameVendor, product.productNameDistributor).value
  const partNumberVendor = product.partNumberVendor ?? product.productCode ?? null
  const partNumberOther = resolveOtherValue(partNumberVendor, product.partNumberDistributor).value
  const productDescriptionOther = resolveOtherValue(product.productDescriptionVendor, product.productDescriptionDistributor).value
  const otherSource = resolveOtherSource([
    [product.productNameVendor, product.productNameDistributor],
    [product.partNumberVendor, product.partNumberDistributor],
    [product.productDescriptionVendor, product.productDescriptionDistributor],
  ])

  return {
    id: product.id,
    select: false,
    active: Boolean(product.isActive),
    distributorId: product.distributor?.id ?? null,
    productNameHouse: product.productNameHouse ?? "",
    distributorName: product.distributor?.accountName ?? "",
    vendorId: product.vendor?.id ?? null,
    vendorName: product.vendor?.accountName ?? "",
    productFamilyHouse: product.productFamilyHouse ?? null,
    productFamilyVendor: product.productFamilyVendor ?? null,
    productSubtypeHouse: product.productSubtypeHouse ?? null,
    productSubtypeVendor: product.productSubtypeVendor ?? null,
    productNameVendor: product.productNameVendor ?? "",
    productNameOther,
    partNumberVendor: product.productCode ?? "",
    partNumberOther,
    productDescriptionHouse: product.description ?? "",
    productDescriptionVendor: product.productDescriptionVendor ?? null,
    productDescriptionOther,
    otherSource,
    distributorProductSubtype: product.distributorProductSubtype ?? null,
    quantity: null,
    priceEach,
    commissionPercent,
    revenueSchedulePeriods: null,
    revenueScheduleEstimatedStartDate: null,
    revenueType: product.revenueType ?? "",
    revenueTypeLabel: getRevenueTypeLabel(product.revenueType) ?? product.revenueType ?? "",
    hasRevenueSchedules: revenueScheduleCount > 0,
  }
}
