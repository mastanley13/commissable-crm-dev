export interface OpportunityLineItemRecord {
  id: string
  productId: string
  productName: string
  productNameHouse?: string | null
  productNameVendor?: string | null
  productCode?: string | null
  revenueType?: string | null
  status?: string | null
  quantity: number
  unitPrice: number
  expectedUsage: number
  expectedRevenue: number
  expectedCommission: number
  revenueStartDate: string | null
  revenueEndDate: string | null
  distributorId?: string | null
  distributorName?: string | null
  vendorId?: string | null
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

export interface OpportunityActivityAttachment {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  uploadedAt?: string | null
  uploadedByName?: string
}

export interface OpportunityActivityRecord {
  id: string
  active: boolean
  activityDate?: string | Date | null
  activityType?: string | null
  activityStatus?: string | null
  description?: string | null
  activityOwner?: string | null
  createdBy?: string | null
  attachment?: string | null
  fileName?: string | null
  attachments?: OpportunityActivityAttachment[]
}

export interface OpportunityIdentifiers {
  accountIdHouse?: string | null
  accountIdVendor?: string | null
  accountIdDistributor?: string | null
  accountIdOther?: string | null
  customerIdHouse?: string | null
  customerIdVendor?: string | null
  customerIdDistributor?: string | null
  customerIdOther?: string | null
  locationId?: string | null
  orderIdHouse?: string | null
  orderIdVendor?: string | null
  orderIdDistributor?: string | null
  orderIdOther?: string | null
  customerPurchaseOrder?: string | null
  otherSource?: "Vendor" | "Distributor" | null
}

export interface OpportunityRevenueScheduleRecord {
  id: string
  productId?: string | null
  opportunityProductId?: string | null
  distributorId?: string | null
  distributorName?: string | null
  vendorId?: string | null
  vendorName?: string | null
  accountId?: string | null
  accountName?: string | null
  opportunityId?: string | null
  opportunityName?: string | null
  scheduleNumber?: string | null
  scheduleDate?: string | null
  status: string | null
   scheduleStatus?: string | null
   inDispute?: boolean
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
  activities?: OpportunityActivityRecord[]
}

export interface HistoryRow {
  id: string
  occurredAt: string
  userName: string
  action: string
  field: string
  fromValue: string
  toValue: string
}

export const MOCK_HISTORY_ROWS: HistoryRow[] = [
  {
    id: "1",
    occurredAt: "2025-11-15 14:32",
    userName: "Jordan Lee",
    action: "Update",
    field: "Account Owner",
    fromValue: "A. Romero",
    toValue: "Jordan Lee"
  },
  {
    id: "2",
    occurredAt: "2025-11-12 09:04",
    userName: "Priya Patel",
    action: "Update",
    field: "Status",
    fromValue: "Prospect",
    toValue: "Active"
  },
  {
    id: "3",
    occurredAt: "2025-11-05 17:20",
    userName: "Alex Morgan",
    action: "Update",
    field: "Primary Contact",
    fromValue: "Jamie Chan",
    toValue: "Taylor Reed"
  },
  {
    id: "4",
    occurredAt: "2025-10-30 11:11",
    userName: "System",
    action: "Create",
    field: "Account Name",
    fromValue: "-",
    toValue: "Edgewater Holdings"
  },
  {
    id: "5",
    occurredAt: "2025-11-18 10:15",
    userName: "Sarah Chen",
    action: "Update",
    field: "Subagent %",
    fromValue: "0%",
    toValue: "15%"
  },
  {
    id: "6",
    occurredAt: "2025-11-18 10:15",
    userName: "Sarah Chen",
    action: "Update",
    field: "House Rep %",
    fromValue: "0%",
    toValue: "25%"
  },
  {
    id: "7",
    occurredAt: "2025-11-18 10:15",
    userName: "System",
    action: "Auto-Update",
    field: "House Split %",
    fromValue: "100%",
    toValue: "60%"
  }
]
