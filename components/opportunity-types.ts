export interface OpportunityLineItemRecord {
  id: string
  productId: string
  productName: string
  productCode?: string | null
  revenueType?: string | null
  quantity: number
  unitPrice: number
  expectedUsage: number
  expectedRevenue: number
  expectedCommission: number
  revenueStartDate: string | null
  revenueEndDate: string | null
  distributorName?: string | null
  vendorName?: string | null
  priceEach: number | null
  createdAt?: string | null
  updatedAt?: string | null
  active?: boolean
}

export interface OpportunitySummaryMetrics {
  expectedUsageGrossTotal?: number
  expectedUsageAdjustmentsGrossTotal?: number
  actualUsageGrossTotal?: number
  actualUsageAdjustmentsGrossTotal?: number
  remainingUsageGrossTotal?: number
  remainingUsageAdjustmentsGrossTotal?: number
  expectedCommissionGrossTotal?: number
  expectedCommissionAdjustmentsGrossTotal?: number
  actualCommissionGrossTotal?: number
  actualCommissionAdjustmentsGrossTotal?: number
  remainingCommissionGrossTotal?: number
  remainingCommissionAdjustmentsGrossTotal?: number
  expectedCommissionHouseRepTotal?: number
  expectedCommissionSubAgentTotal?: number
  expectedCommissionHouseTotal?: number
  actualCommissionHouseRepTotal?: number
  actualCommissionSubAgentTotal?: number
  actualCommissionHouseTotal?: number
  remainingCommissionHouseRepTotal?: number
  remainingCommissionSubAgentTotal?: number
  remainingCommissionHouseTotal?: number
}

export interface OpportunityRoleRecord {
  id: string
  role: string
  fullName: string
  jobTitle?: string | null
  email?: string | null
  workPhone?: string | null
  phoneExtension?: string | null
  mobile?: string | null
  active?: boolean
}

export interface OpportunityIdentifiers {
  accountIdHouse?: string | null
  accountIdVendor?: string | null
  accountIdDistributor?: string | null
  customerIdHouse?: string | null
  customerIdVendor?: string | null
  customerIdDistributor?: string | null
  locationId?: string | null
  orderIdHouse?: string | null
  orderIdVendor?: string | null
  orderIdDistributor?: string | null
  customerPurchaseOrder?: string | null
}

export interface OpportunityRevenueScheduleRecord {
  id: string
  distributorName?: string | null
  vendorName?: string | null
  scheduleNumber?: string | null
  scheduleDate?: string | null
  status: string | null
  productNameVendor?: string | null
  quantity: number
  unitPrice: number
  expectedUsageGross: number
  expectedUsageAdjustment: number
  expectedUsageNet: number
  actualUsage: number
  usageBalance: number
  expectedCommissionGross: number
  expectedCommissionAdjustment: number
  expectedCommissionNet: number
  actualCommission: number
  commissionDifference: number
  expectedCommissionRatePercent: number
  actualCommissionRatePercent: number
  commissionRateDifferencePercent: number
  createdAt?: string | null
  updatedAt?: string | null
}

export interface OpportunityDetailRecord {
  id: string
  name: string
  stage: string
  status: string
  type: string
  leadSource: string | null
  amount: number
  probability: number
  expectedCommission: number
  forecastCategory: string | null
  estimatedCloseDate: string | null
  actualCloseDate: string | null
  nextStep: string | null
  competitors: string | null
  lossReason: string | null
  description: string | null
  subAgent?: string | null
  subagentPercent?: number | null
  houseRepPercent?: number | null
  houseSplitPercent?: number | null
  referredBy?: string | null
  shippingAddress?: string | null
  billingAddress?: string | null
  account: {
    id: string
    accountName: string
    accountLegalName: string | null
  } | null
  owner: {
    id: string | null
    name: string | null
  }
  createdBy?: {
    id: string
    name: string | null
  } | null
  updatedBy?: {
    id: string
    name: string | null
  } | null
  createdAt: string | null
  updatedAt: string | null
  totals: {
    lineItemCount: number
    quantityTotal: number
    expectedRevenueTotal: number
    expectedCommissionTotal: number
    weightedAmount: number | null
    expectedUsageTotal: number
  }
  lineItems: OpportunityLineItemRecord[]
  summaryMetrics?: OpportunitySummaryMetrics
  roles?: OpportunityRoleRecord[]
  identifiers?: OpportunityIdentifiers
  revenueSchedules?: OpportunityRevenueScheduleRecord[]
}
