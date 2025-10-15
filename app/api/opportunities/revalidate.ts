import { revalidatePath } from "next/cache"

export async function revalidateOpportunityPaths(accountId: string | null) {
  try {
    revalidatePath("/opportunities")
    if (accountId) {
      revalidatePath(`/accounts/${accountId}`)
    } else {
      revalidatePath("/accounts")
    }
  } catch (error) {
    console.warn("Failed to revalidate opportunity paths", error)
  }
}
