export function normalizeAccountTypeToken(value: string | null | undefined): string {
  return (value ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase()
}

type AccountTypeLike =
  | string
  | null
  | undefined
  | {
      code?: string | null
      name?: string | null
    }

export function isHouseAccountType(accountType: AccountTypeLike): boolean {
  if (!accountType) {
    return false
  }

  if (typeof accountType === "string") {
    const token = normalizeAccountTypeToken(accountType)
    return token === "HOUSE" || token === "HOUSEREP"
  }

  const nameToken = normalizeAccountTypeToken(accountType.name)
  const codeToken = normalizeAccountTypeToken(accountType.code)

  return (
    nameToken === "HOUSE" ||
    nameToken === "HOUSEREP" ||
    codeToken === "HOUSE" ||
    codeToken === "HOUSEREP"
  )
}
