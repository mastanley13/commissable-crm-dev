import test from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { StartDateSelectionTable } from "../components/revenue-schedule-create-modal"
import type { ChangeStartDatePreviewRow } from "../lib/revenue-schedule-change-start-date"

test("StartDateSelectionTable renders inline current/new/status columns and collision state", () => {
  const previewRow: ChangeStartDatePreviewRow = {
    id: "schedule-1",
    scheduleNumber: "RS-500",
    currentDate: "2026-01-01",
    newDate: "2026-02-01",
    status: "collision",
    productNameVendor: "Hosted Voice",
    distributorName: "Distributor",
    vendorName: "Vendor",
    opportunityName: "Opportunity",
    conflicts: ["2026-02-01 conflicts with an existing schedule (RS-501) for this product."],
  }

  const markup = renderToStaticMarkup(
    React.createElement(StartDateSelectionTable, {
      options: [
        {
          id: "schedule-1",
          label: "RS-500",
          scheduleNumber: "RS-500",
          scheduleDate: "2026-01-01",
          opportunityProductId: "opp-product-1",
          scheduleStatus: "Open",
          inDispute: false,
          actualUsage: 0,
          actualCommission: 0,
          productNameVendor: "Hosted Voice",
          distributorName: "Distributor",
          vendorName: "Vendor",
          opportunityName: "Opportunity",
        },
      ],
      selectedIds: ["schedule-1"],
      previewRowsById: new Map([["schedule-1", previewRow]]),
      previewLoading: false,
      getIneligibilityReason: () => undefined,
      onToggle: () => undefined,
    }),
  )

  assert.match(markup, /Current Schedule Date/)
  assert.match(markup, /New Schedule Date/)
  assert.match(markup, /Status/)
  assert.match(markup, /Collision/)
  assert.match(markup, /bg-rose-100 text-rose-700/)
  assert.match(markup, /2026-02-01/)
})
