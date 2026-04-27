const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

const ROOT_DIR = path.resolve(__dirname, '..', '..')
const SOURCE_RELATIVE_PATH = 'wave-1/tc-05-1-to-m-split-lines.csv'
const SOURCE_FILE_PATH = path.join(
  ROOT_DIR,
  'docs',
  'plans',
  '03-31-2026-Data-Prep-Master-Testing-Prework',
  'generated',
  'deposit-batches',
  ...SOURCE_RELATIVE_PATH.split('/')
)

const EXPECTED_DEPOSIT_ID = '7c6dbc29-d849-4c71-91a0-afe07db263d3'
const TARGET_SCHEDULE_ID = 'bc5393d9-891b-4dea-ab07-9fd981017708'
const DISTRIBUTOR_ACCOUNT_ID = process.env.RS004_DISTRIBUTOR_ACCOUNT_ID?.trim() || '2bb0d87b-33c4-4c99-94b5-22bad4a0141a'
const VENDOR_ACCOUNT_ID = process.env.RS004_VENDOR_ACCOUNT_ID?.trim() || 'f72d09d8-b3d0-4302-850e-758cfec70072'

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true })
  return parsed.data.filter(Boolean)
}

function buildGeneratedBatchMapping() {
  return {
    version: 1,
    line: {
      paymentDate: 'Commission Payment Date',
      accountNameRaw: 'Customer Business Name',
      customerIdVendor: 'Customer Id',
      locationId: 'Location Id',
      distributorNameRaw: 'Acquired Master Agency Name',
      vendorNameRaw: 'Supplier Name',
      orderIdVendor: 'Telarus Order Id',
      partNumberRaw: 'Product Code',
      productNameRaw: 'Services',
      usage: 'Total Bill',
      commissionRate: 'Commission Rate',
      commission: 'Commission Role - Master Agent',
    },
    columns: {},
    customFields: {},
    header: {
      depositName: null,
      paymentDateColumn: 'Commission Payment Date',
      customerAccountColumn: null,
    },
    options: {
      hasHeaderRow: true,
    },
  }
}

async function loginAndGetSessionToken(baseUrl, email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error(`Login failed with ${response.status} ${response.statusText}`)
  }

  const setCookie = response.headers.get('set-cookie') ?? ''
  const match = /session-token=([^;]+)/.exec(setCookie)
  if (!match) {
    throw new Error('Login succeeded but no session-token cookie was returned.')
  }

  return match[1]
}

async function importFixture(baseUrl, sessionToken, depositName, commissionPeriod, paymentDate) {
  const file = new File([fs.readFileSync(SOURCE_FILE_PATH)], path.basename(SOURCE_FILE_PATH), { type: 'text/csv' })
  const form = new FormData()
  form.set('file', file)
  form.set('distributorAccountId', DISTRIBUTOR_ACCOUNT_ID)
  form.set('vendorAccountId', VENDOR_ACCOUNT_ID)
  form.set('mapping', JSON.stringify(buildGeneratedBatchMapping()))
  form.set('depositName', depositName)
  form.set('idempotencyKey', `reconciliation-batch:${SOURCE_RELATIVE_PATH}`)
  if (commissionPeriod) form.set('commissionPeriod', commissionPeriod)
  if (paymentDate) form.set('paymentDate', paymentDate)

  const response = await fetch(`${baseUrl}/api/reconciliation/deposits/import`, {
    method: 'POST',
    headers: {
      cookie: `session-token=${sessionToken}`,
    },
    body: form,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Import failed: ${response.status} ${JSON.stringify(payload)}`)
  }

  return payload
}

async function fetchDepositDetail(baseUrl, sessionToken, depositId) {
  const response = await fetch(`${baseUrl}/api/reconciliation/deposits/${depositId}/detail`, {
    headers: {
      cookie: `session-token=${sessionToken}`,
    },
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Deposit detail failed: ${response.status} ${JSON.stringify(payload)}`)
  }

  return payload
}

async function main() {
  const baseUrl = process.env.IMPORT_BASE_URL?.trim() || process.env.PLAYWRIGHT_BASE_URL?.trim() || 'http://127.0.0.1:3000'
  const email = process.env.PLAYWRIGHT_EMAIL?.trim() || 'admin@commissable.test'
  const password = process.env.PLAYWRIGHT_PASSWORD?.trim() || 'password123'

  const rows = parseCsv(SOURCE_FILE_PATH)
  const firstRow = rows[0]
  if (!firstRow) {
    throw new Error(`No data rows found in ${SOURCE_FILE_PATH}`)
  }

  const depositName = `AUTO IMPORT ${path.basename(SOURCE_FILE_PATH).replace(/\.csv$/i, '')}`
  const sessionToken = await loginAndGetSessionToken(baseUrl, email, password)
  const importPayload = await importFixture(
    baseUrl,
    sessionToken,
    depositName,
    String(firstRow['Commission Period'] ?? '').trim(),
    String(firstRow['Commission Payment Date'] ?? '').trim()
  )

  const depositId = importPayload?.data?.depositId || importPayload?.depositId
  if (typeof depositId !== 'string' || depositId.length === 0) {
    throw new Error(`Import response did not include a deposit ID: ${JSON.stringify(importPayload)}`)
  }

  const detailPayload = await fetchDepositDetail(baseUrl, sessionToken, depositId)
  const lineItems = Array.isArray(detailPayload?.data?.lineItems) ? detailPayload.data.lineItems : []
  const lineIds = lineItems.map(line => String(line?.id ?? '')).filter(Boolean)

  process.stdout.write(
    JSON.stringify(
      {
        sourceImportFile: SOURCE_RELATIVE_PATH,
        importMethod: 'POST /api/reconciliation/deposits/import via browser-authenticated helper',
        baseUrl,
        canonicalRuntime: {
          expectedDepositId: EXPECTED_DEPOSIT_ID,
          expectedTargetScheduleId: TARGET_SCHEDULE_ID,
        },
        bootstrapResult: {
          depositId,
          depositName,
          lineIds,
        },
        manifestPatchHint: {
          depositId,
          lineId: lineIds[0] ?? null,
          lineIds,
          scheduleIds: [TARGET_SCHEDULE_ID],
        },
        note:
          depositId === EXPECTED_DEPOSIT_ID
            ? 'Deposit ID matches the current canonical RS-004 mapping.'
            : 'Environment reset or reimport drift detected. Update the RS-004 manifest mapping before rerunning browser proof.',
      },
      null,
      2
    ) + '\n'
  )
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
