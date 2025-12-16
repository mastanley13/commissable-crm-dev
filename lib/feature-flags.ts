import type { ReadonlyURLSearchParams } from "next/navigation"

function parseBooleanFlag(value: string | null | undefined): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

/**
 * Feature flag: enables the redesigned Revenue Schedule Detail view.
 *
 * - Controlled by env var NEXT_PUBLIC_RSD_DETAILS_V2.
 * - Optional query params `rsd_v2` / `rsdV2` override env for QA.
 */
export function isRevenueScheduleDetailRedesignEnabled(
  searchParams?: ReadonlyURLSearchParams | URLSearchParams | null
): boolean {
  const envFlag = parseBooleanFlag(process.env.NEXT_PUBLIC_RSD_DETAILS_V2 ?? "")

  const queryValue =
    typeof searchParams?.get === "function"
      ? searchParams.get("rsd_v2") ?? searchParams.get("rsdV2")
      : null

  const queryFlag = parseBooleanFlag(queryValue ?? "")

  // Query param overrides env when present; otherwise env flag controls.
  if (queryValue !== null && queryValue !== undefined) {
    return queryFlag
  }

  return envFlag
}

/**
 * Feature flag: switches the primary navigation from the left sidebar
 * to a horizontal bar at the top of the page.
 *
 * - Controlled by env var NEXT_PUBLIC_TOP_NAV.
 * - Default is off (sidebar layout).
 */
export function isTopNavigationExperimentEnabled(): boolean {
  return parseBooleanFlag(process.env.NEXT_PUBLIC_TOP_NAV ?? "")
}
