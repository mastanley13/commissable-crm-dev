type InlineEditEntity = "accounts" | "contacts" | "opportunities" | "products"

const INLINE_ENV_KEY = "NEXT_PUBLIC_INLINE_DETAIL_EDIT"

const flagSource = (process.env[INLINE_ENV_KEY] ?? "")
  .split(",")
  .map(value => value.trim().toLowerCase())
  .filter(Boolean)

const allEnabled = flagSource.includes("all")

export function isInlineDetailEditEnabled(entity: InlineEditEntity): boolean {
  if (allEnabled) return true
  return flagSource.includes(entity)
}

export function isAnyInlineDetailEditEnabled(): boolean {
  return allEnabled || flagSource.length > 0
}

export type InlineEditConfig = InlineEditEntity[]

export const inlineEditConfig: InlineEditConfig = allEnabled
  ? ["accounts", "contacts", "opportunities", "products"]
  : (flagSource as InlineEditConfig)

