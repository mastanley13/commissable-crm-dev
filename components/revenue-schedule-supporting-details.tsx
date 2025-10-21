"use client"

import { useEffect, useMemo, useState } from "react"
import {
  PiggyBank,
  BriefcaseBusiness,
  Package,
  Coins,
  CreditCard,
  NotebookPen,
  Search,
  Settings2,
  Filter
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { RevenueScheduleDetailRecord } from "./revenue-schedule-details-view"

interface SectionNavigationItem {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

interface DetailLineProps {
  label: string
  value?: React.ReactNode
  emphasize?: boolean
  underline?: boolean
}

interface FinancialSplitDefinition {
  id: string
  tabLabel: string
  leftHeading: string
  rightHeading: string
  leftFields: DetailLineProps[]
  rightFields: DetailLineProps[]
}

const placeholder = <span className="text-slate-300">--</span>

function renderValue(value?: React.ReactNode) {
  if (value === undefined || value === null) {
    return placeholder
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed.length) {
      return placeholder
    }
    return trimmed
  }

  return value
}

function DetailLine({ label, value, emphasize = false, underline = false }: DetailLineProps) {
  const resolvedValue = renderValue(value)
  const labelClasses = emphasize ? "font-semibold text-slate-700" : "text-slate-600"
  const valueClasses = `text-right ${emphasize ? "font-semibold text-slate-900" : "text-slate-700"}`

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[minmax(0,220px),minmax(0,1fr)] items-baseline gap-4 text-sm">
        <span className={labelClasses}>{label}</span>
        <span className={valueClasses}>{resolvedValue}</span>
      </div>
      {underline ? (
        <div className="grid grid-cols-[minmax(0,220px),minmax(0,1fr)]">
          <span />
          <div className="flex flex-col gap-[3px] pb-1">
            <span className="h-px w-full bg-slate-300" />
            <span className="h-px w-full bg-slate-300" />
          </div>
        </div>
      ) : null}
    </div>
  )
}

const SECTION_ITEMS: SectionNavigationItem[] = [
  {
    id: "financial-summary",
    label: "Financial Summary",
    description: "Commission details and revenue splits",
    icon: PiggyBank
  },
  {
    id: "opportunity-details",
    label: "Opportunity Details",
    description: "Account and customer information",
    icon: BriefcaseBusiness
  },
  {
    id: "product-details",
    label: "Product Details",
    description: "Vendor supplied product data",
    icon: Package
  },
  {
    id: "reconciled-deposits",
    label: "Reconciled Deposits",
    description: "Deposit reconciliation information",
    icon: Coins
  },
  {
    id: "payments-made",
    label: "Payments Made",
    description: "Amounts paid out to reps and partners",
    icon: CreditCard
  },
  {
    id: "activities-notes",
    label: "Activities and Notes",
    description: "Tasks, notes, and attached files",
    icon: NotebookPen
  }
]

export function RevenueScheduleSupportingDetails({ schedule }: { schedule: RevenueScheduleDetailRecord }) {
  const [activeSectionId, setActiveSectionId] = useState<string>(SECTION_ITEMS[0].id)

  const financialSplits = useMemo<FinancialSplitDefinition[]>(() => {
    const commissionActual = schedule.actualCommission ?? "$0.00"
    const commissionDifference = schedule.commissionDifference ?? "$0.00"
    const expectedNet = schedule.expectedCommissionNet ?? "$0.00"

    const houseSplit = schedule.houseSplitPercent ?? "20.00%"
    const houseRepSplit = schedule.houseRepSplitPercent ?? "30.00%"
    const subagentSplit = schedule.subagentSplitPercent ?? "50.00%"

    return [
      {
        id: "house",
        tabLabel: `Commission Split - House (${houseSplit})`,
        leftHeading: `Reconciled Commissions - House - ${houseSplit}`,
        rightHeading: `Receivables - House - ${houseSplit}`,
        leftFields: [
          { label: "Commission Actual", value: commissionActual },
          { label: "House Split %", value: `X ${houseSplit}` },
          { label: "Commission Net House", value: expectedNet, emphasize: true, underline: true }
        ],
        rightFields: [
          { label: "Commission Balance Total", value: commissionDifference },
          { label: "House Split %", value: `X ${houseSplit}` },
          { label: "Commission Net Receivables House", value: commissionDifference, emphasize: true, underline: true }
        ]
      },
      {
        id: "house-rep",
        tabLabel: `Commission Split - House Rep (${houseRepSplit})`,
        leftHeading: `Reconciled Commissions - House Rep - ${houseRepSplit}`,
        rightHeading: `Receivables - House Rep - ${houseRepSplit}`,
        leftFields: [
          { label: "Commission Actual", value: commissionActual },
          { label: "House Rep Split %", value: `X ${houseRepSplit}` },
          { label: "Commission Net House Rep", value: expectedNet, emphasize: true, underline: true }
        ],
        rightFields: [
          { label: "Commission Balance Total", value: commissionDifference },
          { label: "House Rep Split %", value: `X ${houseRepSplit}` },
          { label: "Commission Net Receivables House Rep", value: commissionDifference, emphasize: true, underline: true }
        ]
      },
      {
        id: "subagent",
        tabLabel: `Commission Split - Subagent (${subagentSplit})`,
        leftHeading: `Reconciled Commissions - Subagent - ${subagentSplit}`,
        rightHeading: `Receivables - Subagent - ${subagentSplit}`,
        leftFields: [
          { label: "Commission Actual", value: commissionActual },
          { label: "Subagent Split %", value: `X ${subagentSplit}` },
          { label: "Commission Net Subagent", value: expectedNet, emphasize: true, underline: true }
        ],
        rightFields: [
          { label: "Commission Balance Total", value: commissionDifference },
          { label: "Subagent Split %", value: `X ${subagentSplit}` },
          { label: "Commission Net Receivables Subagent", value: commissionDifference, emphasize: true, underline: true }
        ]
      }
    ]
  }, [
    schedule.actualCommission,
    schedule.commissionDifference,
    schedule.expectedCommissionNet,
    schedule.houseRepSplitPercent,
    schedule.houseSplitPercent,
    schedule.subagentSplitPercent
  ])

  const [activeSplitId, setActiveSplitId] = useState<string>(financialSplits[0]?.id ?? "")

  useEffect(() => {
    if (!financialSplits.length) {
      setActiveSplitId("")
      return
    }

    if (!financialSplits.some(split => split.id === activeSplitId)) {
      setActiveSplitId(financialSplits[0].id)
    }
  }, [financialSplits, activeSplitId])

  const activeSplit = financialSplits.find(split => split.id === activeSplitId) ?? financialSplits[0]

  const opportunityColumns = useMemo<DetailLineProps[][]>(() => {
    const columnA: DetailLineProps[] = [
      { label: "Account ID - House", value: schedule.accountName ?? "A0000000000008867" },
      { label: "Account ID - Vendor", value: schedule.vendorName ?? "0008" },
      { label: "Account ID - Distributor", value: schedule.distributorName ?? "0002" },
      { label: "Customer ID - House", value: "0012" },
      { label: "Customer ID - Vendor", value: "0013" },
      { label: "Customer ID - Distributor", value: "0014" }
    ]

    const columnB: DetailLineProps[] = [
      { label: "Location ID", value: "0015" },
      { label: "Opportunity ID", value: schedule.opportunityId ?? "1" },
      { label: "Opportunity Owner", value: schedule.opportunityName ?? "4" },
      { label: "Order ID - House", value: "001231" },
      { label: "Order ID - Vendor", value: "0016" },
      { label: "Order ID - Distributor", value: "0017" }
    ]

    return [columnA, columnB]
  }, [schedule.accountName, schedule.distributorName, schedule.opportunityId, schedule.opportunityName, schedule.vendorName])

  const productColumns = useMemo<DetailLineProps[][]>(() => {
    const shippingAddress = schedule.shippingAddress ?? "23, ABC Street"
    const city = shippingAddress.split(",").slice(-2, -1)[0]?.trim() ?? "Rio Linda"
    const stateMatch = schedule.shippingAddress?.match(/\b[A-Z]{2}\b/)?.[0] ?? "CA"

    const fields: DetailLineProps[] = [
      { label: "Service ID", value: schedule.revenueSchedule ?? "12355234" },
      { label: "USOC", value: schedule.productRevenueType ?? "AA3251" },
      { label: "Service Address", value: shippingAddress },
      { label: "Service City", value: city },
      { label: "Service State", value: stateMatch },
      { label: "Service Postal Code", value: "92242" }
    ]

    return [fields.slice(0, 3), fields.slice(3)]
  }, [schedule.productRevenueType, schedule.revenueSchedule, schedule.shippingAddress])

  const reconciledDeposits = useMemo(
    () => [
      {
        item: "1",
        depositDate: "2025-04-01",
        payee: schedule.vendorName ?? "Telarus",
        product: schedule.productNameVendor ?? "UCaaS Seat - 1 User",
        usageActual: schedule.actualUsage ?? "$12.00",
        commissionActual: schedule.actualCommission ?? "$1.20",
        paymentMethod: "Bank Transfer",
        paymentReference: "RS-1234-PYMT"
      }
    ],
    [schedule.actualCommission, schedule.actualUsage, schedule.productNameVendor, schedule.vendorName]
  )

  const depositTotals = useMemo(
    () => ({
      usageActual: "$120.00",
      commissionActual: schedule.actualCommission ?? "$120.00"
    }),
    [schedule.actualCommission]
  )

  const paymentsMade = useMemo(
    () => [
      {
        item: "1",
        paymentDate: "2025-04-07",
        payee: schedule.subagentName ?? "Subagent Team",
        split: schedule.subagentSplitPercent ?? "50.00%",
        amount: "$60.00",
        method: "ACH",
        reference: "PMT-10024"
      },
      {
        item: "2",
        paymentDate: "2025-04-10",
        payee: "House Rep Team",
        split: schedule.houseRepSplitPercent ?? "30.00%",
        amount: "$36.00",
        method: "Check",
        reference: "PMT-10025"
      }
    ],
    [schedule.houseRepSplitPercent, schedule.subagentName, schedule.subagentSplitPercent]
  )

  const renderFinancialSummary = () => {
    if (!activeSplit) {
      return <p className="text-sm text-slate-500">No commission split data available.</p>
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3">
          {financialSplits.map(split => {
            const isActive = split.id === activeSplitId
            return (
              <button
                key={split.id}
                type="button"
                onClick={() => setActiveSplitId(split.id)}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  isActive ? "bg-primary-600 text-white shadow" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                }`}
              >
                {split.tabLabel}
              </button>
            )
          })}
        </div>
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">{activeSplit.leftHeading}</h3>
            <div className="space-y-4">
              {activeSplit.leftFields.map(field => (
                <DetailLine key={`${activeSplit.id}-left-${field.label}`} {...field} />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-slate-900">{activeSplit.rightHeading}</h3>
            <div className="space-y-4">
              {activeSplit.rightFields.map(field => (
                <DetailLine key={`${activeSplit.id}-right-${field.label}`} {...field} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderOpportunityDetails = () => (
    <div className="space-y-6">
      <div className="grid gap-10 lg:grid-cols-2">
        {opportunityColumns.map((column, columnIndex) => (
          <div key={`opportunity-column-${columnIndex}`} className="space-y-4">
            {column.map(field => (
              <DetailLine key={`opportunity-${columnIndex}-${field.label}`} {...field} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  const renderProductDetails = () => (
    <div className="space-y-6">
      <div className="grid gap-10 lg:grid-cols-2">
        {productColumns.map((column, columnIndex) => (
          <div key={`product-column-${columnIndex}`} className="space-y-4">
            {column.map(field => (
              <DetailLine key={`product-${columnIndex}-${field.label}`} {...field} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  const renderReconciledDeposits = () => (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] overflow-hidden rounded-2xl border border-slate-200 text-sm">
          <thead className="bg-indigo-50 text-indigo-700">
            <tr>
              {["Item", "Deposit Date", "Payee", "Product Name - Vendor", "Usage Actual", "Commission Actual", "Payment Method", "Payment Reference"].map(header => (
                <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white text-slate-700">
            {reconciledDeposits.map(row => (
              <tr key={`deposit-${row.item}`} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-900">{row.item}</td>
                <td className="px-4 py-3">{row.depositDate}</td>
                <td className="px-4 py-3">{row.payee}</td>
                <td className="px-4 py-3">{row.product}</td>
                <td className="px-4 py-3 text-right">{row.usageActual}</td>
                <td className="px-4 py-3 text-right">{row.commissionActual}</td>
                <td className="px-4 py-3">{row.paymentMethod}</td>
                <td className="px-4 py-3">{row.paymentReference}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 bg-slate-50 text-slate-900">
              <td className="px-4 py-3 text-sm font-semibold" colSpan={4}>
                Deposit Totals
              </td>
              <td className="px-4 py-3 text-right text-sm font-semibold">{depositTotals.usageActual}</td>
              <td className="px-4 py-3 text-right text-sm font-semibold">{depositTotals.commissionActual}</td>
              <td className="px-4 py-3" colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderPaymentsMade = () => (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] overflow-hidden rounded-2xl border border-slate-200 text-sm">
          <thead className="bg-indigo-50 text-indigo-700">
            <tr>
              {["Item", "Payment Date", "Payee", "Split %", "Amount Paid", "Payment Method", "Payment Reference"].map(header => (
                <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white text-slate-700">
            {paymentsMade.map(row => (
              <tr key={`payment-${row.item}`} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-900">{row.item}</td>
                <td className="px-4 py-3">{row.paymentDate}</td>
                <td className="px-4 py-3">{row.payee}</td>
                <td className="px-4 py-3 text-right">{row.split}</td>
                <td className="px-4 py-3 text-right">{row.amount}</td>
                <td className="px-4 py-3">{row.method}</td>
                <td className="px-4 py-3">{row.reference}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )

  const renderActivitiesNotes = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-10 rounded-full border border-slate-300 bg-white px-10 text-sm text-slate-700 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
            placeholder="Search Here"
            type="search"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-10 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-700 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100">
            <option>Filter By Column</option>
            <option>Activity Date</option>
            <option>Activity Type</option>
          </select>
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-full bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            <Filter className="mr-2 h-4 w-4" />
            Apply Filter
          </button>
          <button
            aria-label="More filter options"
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm transition hover:border-primary-200 hover:text-primary-600"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            className="rounded-full bg-primary-600 px-4 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-700"
          >
            Active
          </button>
          <button
            type="button"
            className="rounded-full px-4 py-1 text-xs font-semibold text-slate-600 transition hover:bg-white"
          >
            Show All
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] overflow-hidden rounded-2xl border border-slate-200 text-sm">
          <thead className="bg-indigo-100 text-indigo-700">
            <tr>
              {["Actions", "Active", "Activity Date", "Activity ID", "Activity Type", "Description", "Attachment"].map(header => (
                <th key={header} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white text-slate-600">
            <tr>
              <td className="px-4 py-6 text-center text-sm" colSpan={7}>
                No data available in table
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <div className="flex items-center gap-3">
          <button className="text-primary-600 transition hover:text-primary-700" type="button">
            Previous
          </button>
          <button className="text-primary-600 transition hover:text-primary-700" type="button">
            Next
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span>Showing 0 to 0 of 0 entries</span>
          <label className="flex items-center gap-2">
            <span>Show</span>
            <select className="rounded border border-slate-300 bg-white px-2 py-1 text-sm">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
            <span>entries</span>
          </label>
        </div>
        <button
          type="button"
          className="inline-flex items-center rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
        >
          Create New
        </button>
      </div>
    </div>
  )

  let sectionContent: React.ReactNode

  switch (activeSectionId) {
    case "financial-summary":
      sectionContent = renderFinancialSummary()
      break
    case "opportunity-details":
      sectionContent = renderOpportunityDetails()
      break
    case "product-details":
      sectionContent = renderProductDetails()
      break
    case "reconciled-deposits":
      sectionContent = renderReconciledDeposits()
      break
    case "payments-made":
      sectionContent = renderPaymentsMade()
      break
    case "activities-notes":
      sectionContent = renderActivitiesNotes()
      break
    default:
      sectionContent = null
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-4 xl:grid-cols-[260px,1fr]">
        <nav className="flex flex-col gap-2 rounded-3xl bg-slate-100 p-3">
          {SECTION_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = item.id === activeSectionId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSectionId(item.id)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  isActive ? "border-primary-200 bg-white shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-white/70"
                }`}
              >
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border ${
                    isActive ? "border-primary-500 bg-primary-600 text-white" : "border-primary-100 bg-primary-50 text-primary-600"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="space-y-0.5">
                  <span className={`block text-sm font-semibold ${isActive ? "text-primary-700" : "text-slate-700"}`}>{item.label}</span>
                  <span className="block text-[11px] leading-tight text-slate-500">{item.description}</span>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-inner">
          {sectionContent ?? <p className="text-sm text-slate-500">Select a section to view its details.</p>}
        </div>
      </div>
    </section>
  )
}
