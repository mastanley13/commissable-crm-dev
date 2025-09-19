export function mapAccountToListRow(account: any) {
  return {
    id: account.id,
    active: account.status === "Active",
    accountName: account.accountName,
    accountLegalName: account.accountLegalName ?? "",
    accountType: account.accountType?.name ?? "",
    accountOwner: account.owner?.fullName ?? "",
    shippingState: account.shippingAddress?.state ?? "",
    shippingCity: account.shippingAddress?.city ?? "",
    shippingZip: account.shippingAddress?.postalCode ?? "",
    shippingStreet: account.shippingAddress?.line1 ?? "",
    shippingStreet2: account.shippingAddress?.line2 ?? ""
  }
}

export const accountIncludeForList = {
  accountType: { select: { name: true } },
  owner: { select: { fullName: true } },
  shippingAddress: {
    select: { line1: true, line2: true, city: true, state: true, postalCode: true }
  }
}
