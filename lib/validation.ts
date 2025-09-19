/**
 * Server-side data validation utilities
 * Implements contract requirements for field validation
 */

export interface ValidationError {
  field: string
  message: string
  value?: any
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

// Validation patterns per contract requirements
export const VALIDATION_PATTERNS = {
  // Email format: proper@email.com
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  
  // Phone format: xxx-xxx-xxxx
  phone: /^\d{3}-\d{3}-\d{4}$/,
  
  // URL format: https://website.com
  url: /^https?:\/\/(www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/,
  
  // State: 2-letter codes only
  state: /^[A-Z]{2}$/,
  
  // Zip: Maximum 12 characters
  zip: /^.{1,12}$/
} as const

// US State codes for validation
export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC' // Washington DC
] as const

/**
 * Validates email format according to contract requirements
 */
export function validateEmail(email: string | null | undefined): ValidationResult {
  const errors: ValidationError[] = []
  
  if (!email) {
    return { isValid: true, errors: [] } // Optional field
  }
  
  if (typeof email !== 'string') {
    errors.push({
      field: 'email',
      message: 'Email must be a string',
      value: email
    })
  } else if (!VALIDATION_PATTERNS.email.test(email)) {
    errors.push({
      field: 'email',
      message: 'Email must be in format: proper@email.com',
      value: email
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates phone format according to contract requirements (xxx-xxx-xxxx)
 */
export function validatePhone(phone: string | null | undefined, fieldName: string = 'phone'): ValidationResult {
  const errors: ValidationError[] = []
  
  if (!phone) {
    return { isValid: true, errors: [] } // Optional field
  }
  
  if (typeof phone !== 'string') {
    errors.push({
      field: fieldName,
      message: 'Phone must be a string',
      value: phone
    })
  } else if (!VALIDATION_PATTERNS.phone.test(phone)) {
    errors.push({
      field: fieldName,
      message: 'Phone must be in format: xxx-xxx-xxxx',
      value: phone
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates URL format according to contract requirements
 */
export function validateUrl(url: string | null | undefined, fieldName: string = 'url'): ValidationResult {
  const errors: ValidationError[] = []
  
  if (!url) {
    return { isValid: true, errors: [] } // Optional field
  }
  
  if (typeof url !== 'string') {
    errors.push({
      field: fieldName,
      message: 'URL must be a string',
      value: url
    })
  } else if (!VALIDATION_PATTERNS.url.test(url)) {
    errors.push({
      field: fieldName,
      message: 'URL must be in format: https://website.com',
      value: url
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates state code according to contract requirements (2-letter codes only)
 */
export function validateState(state: string | null | undefined, fieldName: string = 'state'): ValidationResult {
  const errors: ValidationError[] = []
  
  if (!state) {
    return { isValid: true, errors: [] } // Optional field
  }
  
  if (typeof state !== 'string') {
    errors.push({
      field: fieldName,
      message: 'State must be a string',
      value: state
    })
  } else if (!VALIDATION_PATTERNS.state.test(state)) {
    errors.push({
      field: fieldName,
      message: 'State must be a 2-letter code (e.g., CA, NY, TX)',
      value: state
    })
  } else if (!US_STATE_CODES.includes(state as any)) {
    errors.push({
      field: fieldName,
      message: 'State must be a valid US state code',
      value: state
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates zip code according to contract requirements (maximum 12 characters)
 */
export function validateZip(zip: string | null | undefined, fieldName: string = 'zip'): ValidationResult {
  const errors: ValidationError[] = []
  
  if (!zip) {
    return { isValid: true, errors: [] } // Optional field
  }
  
  if (typeof zip !== 'string') {
    errors.push({
      field: fieldName,
      message: 'Zip code must be a string',
      value: zip
    })
  } else if (!VALIDATION_PATTERNS.zip.test(zip)) {
    errors.push({
      field: fieldName,
      message: 'Zip code must be maximum 12 characters',
      value: zip
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates required string fields
 */
export function validateRequiredString(value: string | null | undefined, fieldName: string): ValidationResult {
  const errors: ValidationError[] = []
  
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required`,
      value
    })
  } else if (typeof value !== 'string') {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a string`,
      value
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates account data according to contract requirements
 */
export function validateAccountData(data: any): ValidationResult {
  const errors: ValidationError[] = []
  
  // Required fields
  const accountNameResult = validateRequiredString(data.accountName, 'Account Name')
  errors.push(...accountNameResult.errors)
  
  const accountTypeResult = validateRequiredString(data.accountTypeId, 'Account Type')
  errors.push(...accountTypeResult.errors)
  
  // Optional fields with format validation
  if (data.websiteUrl) {
    const urlResult = validateUrl(data.websiteUrl, 'Website URL')
    errors.push(...urlResult.errors)
  }
  
  // Address validation
  if (data.shippingAddress) {
    const shippingStateResult = validateState(data.shippingAddress.state, 'Shipping State')
    errors.push(...shippingStateResult.errors)
    
    const shippingZipResult = validateZip(data.shippingAddress.postalCode, 'Shipping Zip')
    errors.push(...shippingZipResult.errors)
  }
  
  if (data.billingAddress) {
    const billingStateResult = validateState(data.billingAddress.state, 'Billing State')
    errors.push(...billingStateResult.errors)
    
    const billingZipResult = validateZip(data.billingAddress.postalCode, 'Billing Zip')
    errors.push(...billingZipResult.errors)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates contact data according to contract requirements
 */
export function validateContactData(data: any): ValidationResult {
  const errors: ValidationError[] = []
  
  // Required fields
  const firstNameResult = validateRequiredString(data.firstName, 'First Name')
  errors.push(...firstNameResult.errors)
  
  const lastNameResult = validateRequiredString(data.lastName, 'Last Name')
  errors.push(...lastNameResult.errors)
  
  const accountIdResult = validateRequiredString(data.accountId, 'Account')
  errors.push(...accountIdResult.errors)
  
  // Optional fields with format validation
  if (data.emailAddress) {
    const emailResult = validateEmail(data.emailAddress)
    errors.push(...emailResult.errors)
  }
  
  if (data.workPhone) {
    const workPhoneResult = validatePhone(data.workPhone, 'Work Phone')
    errors.push(...workPhoneResult.errors)
  }
  
  if (data.mobilePhone) {
    const mobilePhoneResult = validatePhone(data.mobilePhone, 'Mobile Phone')
    errors.push(...mobilePhoneResult.errors)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Formats phone number to xxx-xxx-xxxx format
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Format as xxx-xxx-xxxx
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  
  return phone // Return original if not 10 digits
}

/**
 * Normalizes email address (lowercase, trim)
 */
export function normalizeEmail(email: string): string {
  if (!email) return ''
  return email.toLowerCase().trim()
}

/**
 * Normalizes state code (uppercase, trim)
 */
export function normalizeState(state: string): string {
  if (!state) return ''
  return state.toUpperCase().trim()
}

/**
 * Creates a standardized validation error response
 */
export function createValidationErrorResponse(errors: ValidationError[]): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation failed',
      details: errors
    }),
    {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}
