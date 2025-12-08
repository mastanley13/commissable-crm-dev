export interface DepositUploadFormState {
  depositName: string
  depositReceivedDate: string
  commissionPeriod: string
  createdByContactId: string
  createdByLabel: string
  distributorAccountId: string
  distributorLabel: string
  vendorAccountId: string
  vendorLabel: string
}

export interface TemplateResponse {
  id: string
  name: string
  distributorName: string
  vendorName: string
  description?: string
  config?: Record<string, unknown> | null
}

export interface TemplateDetail extends TemplateResponse {
  createdByContactId?: string | null
  createdByContactName?: string | null
  createdByUserId?: string
  createdByUserName?: string | null
}
