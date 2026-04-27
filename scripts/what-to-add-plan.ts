export type CatalogPlanRow = {
  rowNumber: number
  vendorName: string
  houseProductName: string
  vendorProductName: string
}

export type OpportunityPlanRow = {
  rowNumber: number
  accountName: string
  opportunityName: string
  vendorName: string
  houseProductName: string
  vendorProductName: string
  expectedUsage: number
  expectedRatePercent: number
  expectedCommission: number
  periods: number
}

export type DoNotAddPlanRow = {
  rowNumber: number
  accountName: string
  vendorName: string
  vendorProductName: string
  expectedUsage: number
  expectedRatePercent: number
  expectedCommission: number
  accountOnly: boolean
}

export const DISTRIBUTOR_NAME = "Telarus"

export const DEFAULT_SCHEDULE_START = new Date(Date.UTC(2026, 3, 1))

export const supplementalCatalogRows: CatalogPlanRow[] = [
  {
    rowNumber: 0,
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
  },
]

export const catalogPlanRows: CatalogPlanRow[] = [
  {
    rowNumber: 1,
    vendorName: "ACC Business",
    houseProductName: "Managed Internet (HSIA)",
    vendorProductName: "HSIA Internet Access",
  },
  {
    rowNumber: 2,
    vendorName: "ACC Business",
    houseProductName: "VoIP Seats",
    vendorProductName: "VoIP",
  },
  {
    rowNumber: 3,
    vendorName: "AT&T",
    houseProductName: "AT&T Fiber 1G",
    vendorProductName: "U-Verse Fiber Broadband - 1000M1000M",
  },
  {
    rowNumber: 4,
    vendorName: "AT&T",
    houseProductName: "AT&T Fiber 100M",
    vendorProductName: "U-Verse Fiber Broadband - 100M20M",
  },
  {
    rowNumber: 5,
    vendorName: "AT&T",
    houseProductName: "AT&T Fiber 300M",
    vendorProductName: "U-Verse Fiber Broadband - FBS300M300M",
  },
  {
    rowNumber: 6,
    vendorName: "AT&T",
    houseProductName: "AT&T Internet Basic",
    vendorProductName: "ATT INTERNET - BASIC 6 IP",
  },
  {
    rowNumber: 7,
    vendorName: "Bigleaf",
    houseProductName: "SD-WAN 500M",
    vendorProductName: "500 Mbps SD-WAN Service",
  },
  {
    rowNumber: 8,
    vendorName: "Bigleaf",
    houseProductName: "SD-WAN 100M",
    vendorProductName: "100 Mbps SD-WAN Service",
  },
]

export const opportunityPlanRows: OpportunityPlanRow[] = [
  {
    rowNumber: 9,
    accountName: "iResearch",
    opportunityName: "iResearch - Telarus - ACC - Fiber",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 686,
    expectedRatePercent: 16,
    expectedCommission: 109.76,
    periods: 12,
  },
  {
    rowNumber: 10,
    accountName: "J.B. Steel & Precast",
    opportunityName: "JB Steel - Telarus - ACC - Fiber (Circuit 1)",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 868,
    expectedRatePercent: 16,
    expectedCommission: 138.88,
    periods: 12,
  },
  {
    rowNumber: 11,
    accountName: "J.B. Steel & Precast",
    opportunityName: "JB Steel - Telarus - ACC - Fiber (Circuit 2)",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 999,
    expectedRatePercent: 16,
    expectedCommission: 159.84,
    periods: 12,
  },
  {
    rowNumber: 12,
    accountName: "Masterpiece Lighting LLC",
    opportunityName: "Masterpiece - Telarus - ACC - Fiber (A)",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 600,
    expectedRatePercent: 16,
    expectedCommission: 96,
    periods: 12,
  },
  {
    rowNumber: 13,
    accountName: "Masterpiece Lighting LLC",
    opportunityName: "Masterpiece - Telarus - ACC - Fiber (B)",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 572.84,
    expectedRatePercent: 16,
    expectedCommission: 91.65,
    periods: 12,
  },
  {
    rowNumber: 14,
    accountName: "Lazega and Johanson",
    opportunityName: "Lazega - Telarus - ACC - Fiber",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 1214,
    expectedRatePercent: 17,
    expectedCommission: 206.38,
    periods: 12,
  },
  {
    rowNumber: 15,
    accountName: "Rent the Runway",
    opportunityName: "Rent the Runway - Telarus - ACC - Fiber",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 2255,
    expectedRatePercent: 16,
    expectedCommission: 360.8,
    periods: 12,
  },
  {
    rowNumber: 16,
    accountName: "Slappey & Sadd",
    opportunityName: "Slappey - Telarus - ACC - Fiber",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 496,
    expectedRatePercent: 16,
    expectedCommission: 79.36,
    periods: 12,
  },
  {
    rowNumber: 17,
    accountName: "Trimont Real Estate",
    opportunityName: "Trimont - Telarus - ACC - Fiber",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 800,
    expectedRatePercent: 16,
    expectedCommission: 128,
    periods: 12,
  },
  {
    rowNumber: 18,
    accountName: "United Sales Agency",
    opportunityName: "United Sales - Telarus - ACC - Fiber",
    vendorName: "ACC Business",
    houseProductName: "Managed Fiber",
    vendorProductName: "MIS",
    expectedUsage: 467,
    expectedRatePercent: 16,
    expectedCommission: 74.72,
    periods: 12,
  },
  {
    rowNumber: 19,
    accountName: "KRE UP Holdings",
    opportunityName: "KRE UP - Telarus - ACC - Cable",
    vendorName: "ACC Business",
    houseProductName: "Managed Internet (HSIA)",
    vendorProductName: "HSIA Internet Access",
    expectedUsage: 160,
    expectedRatePercent: 17,
    expectedCommission: 27.2,
    periods: 12,
  },
  {
    rowNumber: 20,
    accountName: "University Partners",
    opportunityName: "Univ Partners - Telarus - ACC - Cable",
    vendorName: "ACC Business",
    houseProductName: "Managed Internet (HSIA)",
    vendorProductName: "HSIA Internet Access",
    expectedUsage: 165,
    expectedRatePercent: 16,
    expectedCommission: 26.4,
    periods: 12,
  },
  {
    rowNumber: 21,
    accountName: "TekStream Solutions",
    opportunityName: "TekStream - Telarus - ATT - Fiber1G",
    vendorName: "AT&T",
    houseProductName: "AT&T Fiber 1G",
    vendorProductName: "U-Verse Fiber Broadband - 1000M1000M",
    expectedUsage: 210,
    expectedRatePercent: 12.8,
    expectedCommission: 26.88,
    periods: 12,
  },
  {
    rowNumber: 22,
    accountName: "Wimberly Lawson",
    opportunityName: "Wimberly - Telarus - ATT - Fiber1G",
    vendorName: "AT&T",
    houseProductName: "AT&T Fiber 1G",
    vendorProductName: "U-Verse Fiber Broadband - 1000M1000M",
    expectedUsage: 190,
    expectedRatePercent: 13.6,
    expectedCommission: 25.84,
    periods: 12,
  },
  {
    rowNumber: 23,
    accountName: "American Academy of Family Physicians",
    opportunityName: "AAFP - Telarus - ATT - Fiber100M",
    vendorName: "AT&T",
    houseProductName: "AT&T Fiber 100M",
    vendorProductName: "U-Verse Fiber Broadband - 100M20M",
    expectedUsage: 145,
    expectedRatePercent: 12.8,
    expectedCommission: 18.56,
    periods: 12,
  },
  {
    rowNumber: 24,
    accountName: "Azalea Health Innovations",
    opportunityName: "Azalea - Telarus - ATT - Fiber300M",
    vendorName: "AT&T",
    houseProductName: "AT&T Fiber 300M",
    vendorProductName: "U-Verse Fiber Broadband - FBS300M300M",
    expectedUsage: 990,
    expectedRatePercent: 12.8,
    expectedCommission: 126.72,
    periods: 12,
  },
  {
    rowNumber: 25,
    accountName: "Level Creek Property",
    opportunityName: "Level Creek - Telarus - ATT - Basic",
    vendorName: "AT&T",
    houseProductName: "AT&T Internet Basic",
    vendorProductName: "ATT INTERNET - BASIC 6 IP",
    expectedUsage: 105,
    expectedRatePercent: 12.8,
    expectedCommission: 13.44,
    periods: 12,
  },
  {
    rowNumber: 26,
    accountName: "Capital Investment Advisors",
    opportunityName: "Capital Inv - Telarus - Bigleaf - SDWAN500",
    vendorName: "Bigleaf",
    houseProductName: "SD-WAN 500M",
    vendorProductName: "500 Mbps SD-WAN Service",
    expectedUsage: 558.88,
    expectedRatePercent: 8,
    expectedCommission: 44.71,
    periods: 12,
  },
  {
    rowNumber: 27,
    accountName: "Persium Group",
    opportunityName: "Persium - Telarus - Bigleaf - SDWAN100",
    vendorName: "Bigleaf",
    houseProductName: "SD-WAN 100M",
    vendorProductName: "100 Mbps SD-WAN Service",
    expectedUsage: 199,
    expectedRatePercent: 16,
    expectedCommission: 31.84,
    periods: 12,
  },
]

export const doNotAddPlanRows: DoNotAddPlanRow[] = [
  {
    rowNumber: 28,
    accountName: "Paramount Staffing",
    vendorName: "ACC Business",
    vendorProductName: "HSIA Internet Access",
    expectedUsage: 190,
    expectedRatePercent: 16,
    expectedCommission: 30.4,
    accountOnly: false,
  },
  {
    rowNumber: 29,
    accountName: "Plan Professional",
    vendorName: "ACC Business",
    vendorProductName: "HSIA Internet Access",
    expectedUsage: 160,
    expectedRatePercent: 17,
    expectedCommission: 27.2,
    accountOnly: false,
  },
  {
    rowNumber: 30,
    accountName: "REIT Funding",
    vendorName: "ACC Business",
    vendorProductName: "HSIA Internet Access",
    expectedUsage: 145,
    expectedRatePercent: 17,
    expectedCommission: 24.65,
    accountOnly: false,
  },
  {
    rowNumber: 31,
    accountName: "Stonemont Financial",
    vendorName: "ACC Business",
    vendorProductName: "HSIA Internet Access",
    expectedUsage: 165,
    expectedRatePercent: 16,
    expectedCommission: 26.4,
    accountOnly: false,
  },
  {
    rowNumber: 32,
    accountName: "Win-Tech, Inc.",
    vendorName: "ACC Business",
    vendorProductName: "HSIA Internet Access",
    expectedUsage: 65,
    expectedRatePercent: 17,
    expectedCommission: 11.05,
    accountOnly: true,
  },
]

export const allCatalogRows = [...supplementalCatalogRows, ...catalogPlanRows]

export function slugify(value: string): string {
  return value
    .toUpperCase()
    .replace(/&/g, "AND")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function addMonths(date: Date, monthOffset: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1))
}
