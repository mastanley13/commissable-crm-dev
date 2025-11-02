/**
 * Utility functions for calculating consistent column widths in dynamic tables.
 * 
 * These functions ensure that:
 * - Minimum widths prevent columns from becoming unusably narrow
 * - Header labels are always visible (don't clip)
 * - Text truncation works properly when content exceeds width
 * - Width constraints are consistent across similar column types
 */

import { Column } from "@/components/dynamic-table"

/**
 * Base minimum widths by column type.
 * These values ensure columns can display their header and basic content,
 * while allowing truncation for longer content.
 */
const TYPE_BASE_MIN_WIDTHS: Record<string, number> = {
  "multi-action": 100, // Checkbox + toggle + actions need space
  "toggle": 100,        // Toggle switch needs reasonable width
  "action": 80,         // Action buttons (edit, delete)
  "checkbox": 80,       // Just a checkbox
  "email": 140,         // Email addresses are typically longer (reduced from 160)
  "phone": 100,         // Phone numbers need formatting space (reduced from 120)
  "text": 80,           // Default text columns (headers wrap, so smaller minWidth is OK)
}

/**
 * Calculates the minimum width needed for a header label.
 * Headers can wrap to multiple lines, so we calculate based on the longest word
 * or a reasonable portion of the header text.
 * 
 * @param label - The header label text
 * @param sortable - Whether the column is sortable (affects arrow space)
 * @returns The minimum width in pixels needed to display a readable header portion
 */
function calculateHeaderMinWidth(label: string, sortable?: boolean): number {
  // Headers can wrap, so we calculate based on:
  // - Longest word in the header (to prevent awkward breaks)
  // - Or minimum readable width (whichever is larger)
  
  // Find longest word in the header
  const words = label.split(/\s+/)
  const longestWord = words.reduce((longest, word) => 
    word.length > longest.length ? word : longest, '')
  
  // Use longest word length, but cap at 8 chars for very long words
  const meaningfulChars = Math.min(8, Math.max(longestWord.length, 4))
  
  // Actual font metrics for Inter font at 11px (header size), medium weight
  // Measured: average char width ≈ 6px at 11px font size
  const avgCharWidth = 6
  
  // Base padding: left (12px) + right (12px) = 24px
  const horizontalPadding = 12 + 12
  
  // Resizer area: 4px
  const resizerSpace = 4
  
  // Sort arrows: 20px if sortable, 0 otherwise
  const sortArrowSpace = sortable ? 20 : 0
  
  // Header text width calculation (longest word)
  const textWidth = meaningfulChars * avgCharWidth
  
  // Total: longest word + padding + resizer + sort arrows
  const total = textWidth + horizontalPadding + resizerSpace + sortArrowSpace
  
  // Add 5px safety margin
  return Math.ceil(total + 5)
}

/**
 * Calculates a consistent minimum width for a column based on:
 * 1. Column type (affects base minimum)
 * 2. Header label length (must fit header text)
 * 3. Content type requirements
 * 
 * @param column - The column definition
 * @param options - Optional overrides
 * @returns The calculated minimum width in pixels
 * 
 * @example
 * ```typescript
 * const column = {
 *   id: "fullName",
 *   label: "Full Name",
 *   type: "text"
 * }
 * 
 * const minWidth = calculateMinWidth(column)
 * // Returns: Math.max(100, headerWidth) ensuring header fits
 * ```
 */
export function calculateMinWidth(
  column: Pick<Column, "label" | "type" | "sortable">,
  options?: {
    /** Override the calculated value with a custom minimum */
    absoluteMin?: number
    /** Add extra width for content that typically needs more space */
    contentBuffer?: number
    /** Force header fit check (default: true) */
    ensureHeaderFit?: boolean
  }
): number {
  const type = column.type || "text"
  const baseMin = TYPE_BASE_MIN_WIDTHS[type] ?? TYPE_BASE_MIN_WIDTHS["text"]
  
  // Calculate minimum needed for header label
  const ensureHeaderFit = options?.ensureHeaderFit !== false // Default: true
  const headerMin = ensureHeaderFit 
    ? calculateHeaderMinWidth(column.label, column.sortable)
    : 0
  
  // Start with the larger of: type base minimum or header minimum
  let minWidth = Math.max(baseMin, headerMin)
  
  // Add content buffer if specified (e.g., for columns with typically long content)
  if (options?.contentBuffer) {
    minWidth += options.contentBuffer
  }
  
  // Apply absolute minimum override if specified
  if (options?.absoluteMin) {
    minWidth = Math.max(minWidth, options.absoluteMin)
  }
  
  // Round to nearest 10 for consistency (80, 90, 100, 110, etc.)
  return Math.ceil(minWidth / 10) * 10
}

/**
 * Creates a column configuration helper that applies consistent width calculations.
 * 
 * @example
 * ```typescript
 * const createColumn = columnWidthHelper()
 * 
 * const columns: Column[] = [
 *   createColumn({
 *     id: "suffix",
 *     label: "Suffix",
 *     type: "text",
 *     width: 100,
 *     sortable: true
 *   }),
 *   createColumn({
 *     id: "fullName",
 *     label: "Full Name",
 *     type: "text",
 *     width: 180,
 *     sortable: true,
 *     // Automatically calculates minWidth based on "Full Name" header
 *   })
 * ]
 * ```
 */
export function columnWidthHelper() {
  return function <T extends Omit<Column, "minWidth">>(
    column: T,
    options?: Parameters<typeof calculateMinWidth>[1]
  ): T & { minWidth: number } {
    const minWidth = calculateMinWidth(column, options)
    return {
      ...column,
      minWidth,
    }
  }
}

/**
 * Applies consistent minWidth to an array of columns.
 * Useful for bulk migration or ensuring consistency across a table.
 * 
 * @param columns - Array of columns to update
 * @param options - Optional overrides for specific columns
 * @returns Array of columns with calculated minWidth values
 * 
 * @example
 * ```typescript
 * const columns = applyConsistentMinWidths([
 *   { id: "name", label: "Name", type: "text", width: 180 },
 *   { id: "email", label: "Email Address", type: "email", width: 200 },
 * ], {
 *   overrides: {
 *     name: { contentBuffer: 20 }
 *   }
 * })
 * ```
 */
export function applyConsistentMinWidths<T extends Column[]>(
  columns: T,
  options?: {
    /** Override specific column IDs with custom options */
    overrides?: Record<string, Parameters<typeof calculateMinWidth>[1]>
  }
): T {
  return columns.map(column => {
    const override = options?.overrides?.[column.id]
    const minWidth = calculateMinWidth(column, override)
    
    return {
      ...column,
      minWidth,
    }
  }) as T
}

/**
 * Validates that all column headers fit within their minWidth.
 * Returns validation results with any issues found.
 * 
 * @param columns - Array of columns to validate
 * @returns Validation result with issues array
 * 
 * @example
 * ```typescript
 * const validation = validateColumnHeaders(columns)
 * if (!validation.valid) {
 *   console.warn('Header clipping issues:', validation.issues)
 * }
 * ```
 */
export function validateColumnHeaders(columns: Column[]): {
  valid: boolean
  issues: Array<{ 
    columnId: string
    label: string
    minWidth: number
    requiredWidth: number
    difference: number
  }>
} {
  const issues: Array<{ 
    columnId: string
    label: string
    minWidth: number
    requiredWidth: number
    difference: number
  }> = []
  
  columns.forEach(column => {
    const requiredWidth = calculateHeaderMinWidth(column.label, column.sortable)
    const actualMinWidth = column.minWidth ?? 0
    
    if (actualMinWidth < requiredWidth) {
      issues.push({
        columnId: column.id,
        label: column.label,
        minWidth: actualMinWidth,
        requiredWidth,
        difference: requiredWidth - actualMinWidth,
      })
    }
  })
  
  return {
    valid: issues.length === 0,
    issues,
  }
}

/**
 * Default minimum widths for quick reference and documentation.
 * Use these as guidelines, but prefer calculateMinWidth() for consistency.
 */
export const DEFAULT_MIN_WIDTHS = {
  ...TYPE_BASE_MIN_WIDTHS,
  /** Very short fields like "ID", "Suffix" */
  shortText: 80,
  /** Normal text fields */
  normalText: 100,
  /** Longer text fields like "Full Name", "Description" */
  longText: 140,
  /** Email addresses */
  email: 160,
  /** Phone numbers */
  phone: 120,
} as const

