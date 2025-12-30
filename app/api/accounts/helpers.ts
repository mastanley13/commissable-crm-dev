export function mapAccountToListRow(account: any) {
  const status = account.status ?? "Active";
  const isActive = status === "Active";
  const isDeleted = status === "Archived";

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
    accountNumber: account.accountNumber ?? "",
    parentAccount: account.parent?.accountName ?? "",
    parentAccountId: account.parentAccountId ?? null,
    shippingState: account.shippingAddress?.state ?? "",
    shippingCity: account.shippingAddress?.city ?? "",
    shippingZip: account.shippingAddress?.postalCode ?? "",
    shippingStreet: account.shippingAddress?.line1 ?? "",
    shippingStreet2: account.shippingAddress?.line2 ?? "",
    shippingCountry: account.shippingAddress?.country ?? "",
    billingStreet: account.billingAddress?.line1 ?? "",
    billingStreet2: account.billingAddress?.line2 ?? "",
    billingCity: account.billingAddress?.city ?? "",
    billingState: account.billingAddress?.state ?? "",
    billingZip: account.billingAddress?.postalCode ?? "",
    billingCountry: account.billingAddress?.country ?? "",
    industry: account.industry?.name ?? "",
    websiteUrl: account.websiteUrl ?? "",
    description: account.description ?? "",
    isDeleted
  }
}

export const accountIncludeForList = {
  accountType: { select: { name: true } },
  owner: { select: { fullName: true } },
  parent: { select: { accountName: true } },
  industry: { select: { name: true } },
  shippingAddress: {
    select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true }
  },
  billingAddress: {
    select: { line1: true, line2: true, city: true, state: true, postalCode: true, country: true }
  }
}
