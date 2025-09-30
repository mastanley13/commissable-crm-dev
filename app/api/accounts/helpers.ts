export function mapAccountToListRow(account: any) {
  const status = account.status ?? "Active";
  const isActive = status === "Active";

  return {
    id: account.id,
    select: false,
    active: isActive,
    status,
    accountName: account.accountName,
    accountLegalName: account.accountLegalName ?? "",
    accountType: account.accountType?.name ?? "",
    accountTypeId: account.accountTypeId ?? null,
    accountOwner: account.owner?.fullName ?? "",
    accountOwnerId: account.ownerId ?? null,
    shippingState: account.shippingAddress?.state ?? "",
    shippingCity: account.shippingAddress?.city ?? "",
    shippingZip: account.shippingAddress?.postalCode ?? "",
    shippingStreet: account.shippingAddress?.line1 ?? "",
    shippingStreet2: account.shippingAddress?.line2 ?? "",
    isDeleted: !isActive
  }
}

export const accountIncludeForList = {
  accountType: { select: { name: true } },
  owner: { select: { fullName: true } },
  shippingAddress: {
    select: { line1: true, line2: true, city: true, state: true, postalCode: true }
  }
}
