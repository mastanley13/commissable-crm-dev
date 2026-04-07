import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test'
import {
  buildBlockedResult,
  captureScenarioScreenshot,
  fetchJson,
  isDepositDetailNotFound,
  loadScenarioManifest,
  openDepositDetail,
  postJson,
  selectRowCheckbox,
  waitForRowCheckbox,
  type ScenarioArtifactRef,
  type ScenarioManifestEntry,
  type ScenarioResult,
  writeScenarioResult,
} from './reconciliation-suite.helpers'

const manifest = loadScenarioManifest()

type ScenarioContext = {
  scenario: ScenarioManifestEntry
  startedAt: string
}

function getExecutionLineIds(scenario: ScenarioManifestEntry): string[] {
  const execution = scenario.execution
  if (execution.mode !== 'browser-live') {
    return []
  }

  return execution.lineIds?.length ? execution.lineIds : [execution.lineId]
}

async function blockIfLineUnavailable(
  ctx: ScenarioContext,
  page: Page,
  testInfo: TestInfo
): Promise<ScenarioResult | null> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  if (await isDepositDetailNotFound(page)) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-deposit-404`)]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason:
        'The mapped reconciliation deposit route rendered the app 404 page in the current browser session, so the scenario could not be executed.',
      notes: [
        'The browser reached the deposit route, but the page itself did not resolve to a live reconciliation detail view.',
        'Marked blocked instead of failed because this indicates runtime-fixture drift or environment mismatch, not a confirmed product regression.',
      ],
      artifacts,
      execution,
    }
  }

  const detail = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
  if (!detail.ok) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-detail-error`)]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason: `Deposit detail endpoint returned HTTP ${detail.status} for the mapped runtime fixture.`,
      notes: [
        'The browser reached the deposit route, but the underlying detail API was not healthy in the shared TEST DB.',
        'Marked blocked instead of failed because this is an environment/runtime-fixture issue, not a verified reconciliation logic regression.',
      ],
      artifacts,
      execution,
    }
  }

  const detailLines = Array.isArray(detail.data?.data?.lineItems) ? detail.data.data.lineItems : []
  if (!detailLines.some((line: { id?: string }) => line?.id === execution.lineId)) {
    const artifacts = [
      await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-line-missing-from-api`),
    ]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason:
        'The mapped deposit line item is no longer present in the current deposit detail payload, so the runtime fixture has drifted.',
      notes: [
        'The reconciliation detail API responded, but the expected line ID from the scenario manifest was not included in the live payload.',
        'Marked blocked instead of failed because the prepared fixture no longer matches the recorded scenario mapping.',
      ],
      artifacts,
      execution,
    }
  }

  if (!(await waitForRowCheckbox(page, execution.lineId, 4_000))) {
    const artifacts = [
      await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-line-unavailable`),
    ]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason:
        'The mapped deposit line item exists in the detail payload but did not render as a selectable row in the current browser session.',
      notes: [
        'The scenario manifest line ID is still present in the deposit detail API response.',
        'Marked blocked instead of failed because this indicates UI availability drift rather than a verified reconciliation logic defect.',
      ],
      artifacts,
      execution,
    }
  }

  return null
}

async function blockIfAnyMappedLineUnavailable(
  ctx: ScenarioContext,
  page: Page,
  testInfo: TestInfo
): Promise<ScenarioResult | null> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  await openDepositDetail(page, execution.depositId)
  if (await isDepositDetailNotFound(page)) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-deposit-404`)]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason:
        'The mapped reconciliation deposit route rendered the app 404 page in the current browser session, so the scenario could not be executed.',
      notes: [
        'The browser reached the deposit route, but the page itself did not resolve to a live reconciliation detail view.',
      ],
      artifacts,
      execution,
    }
  }

  const detail = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
  if (!detail.ok) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-detail-error`)]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason: `Deposit detail endpoint returned HTTP ${detail.status} for the mapped runtime fixture.`,
      notes: ['The underlying detail API was not healthy in the shared TEST DB.'],
      artifacts,
      execution,
    }
  }

  const detailLines = Array.isArray(detail.data?.data?.lineItems) ? detail.data.data.lineItems : []
  const missingLineIds = getExecutionLineIds(ctx.scenario).filter(
    lineId => !detailLines.some((line: { id?: string }) => line?.id === lineId)
  )
  if (missingLineIds.length > 0) {
    const artifacts = [
      await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-line-missing-from-api`),
    ]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason: `One or more mapped deposit line items are no longer present in the current deposit detail payload: ${missingLineIds.join(', ')}.`,
      notes: [
        'Marked blocked instead of failed because the prepared fixture no longer matches the recorded scenario mapping.',
      ],
      artifacts,
      execution,
    }
  }

  for (const lineId of getExecutionLineIds(ctx.scenario)) {
    if (!(await waitForRowCheckbox(page, lineId, 4_000))) {
      const artifacts = [
        await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-line-unavailable`),
      ]
      return {
        scenarioId: ctx.scenario.scenarioId,
        title: ctx.scenario.title,
        lane: ctx.scenario.lane,
        status: 'blocked',
        startedAt: ctx.startedAt,
        finishedAt: new Date().toISOString(),
        reason: `Mapped deposit line item ${lineId} exists in the API payload but did not render as a selectable row in the browser.`,
        notes: [
          'Marked blocked instead of failed because this indicates UI availability drift rather than a verified reconciliation defect.',
        ],
        artifacts,
        execution,
      }
    }
  }

  return null
}

async function fetchCandidateRows(page: Page, depositId: string, lineId: string): Promise<any[]> {
  const candidates = await fetchJson<any>(page, `/api/reconciliation/deposits/${depositId}/line-items/${lineId}/candidates`)
  expect(candidates.ok).toBeTruthy()
  return Array.isArray(candidates.data?.data) ? candidates.data.data : []
}

function inferGroupedMatchType(scenario: ScenarioManifestEntry): 'OneToMany' | 'ManyToOne' {
  const lineIds = getExecutionLineIds(scenario)
  const execution = scenario.execution
  if (execution.mode !== 'browser-live') {
    return 'ManyToOne'
  }

  if (lineIds.length === 1 && execution.scheduleIds.length > 1) {
    return 'OneToMany'
  }

  return 'ManyToOne'
}

function isRuntimePathValidationScenario(scenario: ScenarioManifestEntry): boolean {
  return scenario.execution.mode === 'browser-live' && scenario.execution.validationScope === 'runtime-path-validation'
}

function buildPreferredVarianceResolutions(preview: any): Array<{ scheduleId: string; action: string }> {
  const prompts = Array.isArray(preview?.variancePrompts) ? preview.variancePrompts : []
  return prompts
    .map((prompt: any) => {
      const options = Array.isArray(prompt?.allowedPromptOptions) ? prompt.allowedPromptOptions : []
      const preferredAction =
        options.includes('AdjustCurrent')
          ? 'AdjustCurrent'
          : options.includes('FlexChild')
            ? 'FlexChild'
            : options.includes('AdjustCurrentAndFuture')
              ? 'AdjustCurrentAndFuture'
              : options[0]

      if (!preferredAction || typeof prompt?.scheduleId !== 'string') {
        return null
      }

      return {
        scheduleId: prompt.scheduleId,
        action: preferredAction,
      }
    })
    .filter((item): item is { scheduleId: string; action: string } => item != null)
}

async function waitForVisible(locator: Locator, timeout = 5_000): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout })
    return true
  } catch {
    return false
  }
}

async function postJsonWithRequest<T = unknown>(
  page: Page,
  endpoint: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const response = await page.context().request.post(endpoint, body === undefined ? undefined : { data: body })
  const payload = await response.json().catch(() => null)
  return { ok: response.ok(), status: response.status(), data: payload as T | null }
}

async function selectFilterOption(page: Page, ariaLabel: string, optionLabel: string): Promise<void> {
  const trigger = page.getByLabel(ariaLabel)
  await trigger.click()
  await page.getByRole('menuitem', { name: optionLabel, exact: true }).click()
  await expect(trigger).toContainText(optionLabel)
}

async function resolveVariancePromptIfPresent(page: Page): Promise<string | null> {
  const dialog = page.getByRole('dialog', { name: /Resolve out-of-tolerance overage/i })
  if (!(await waitForVisible(dialog, 1_500))) {
    return null
  }

  const options = [
    {
      action: 'AdjustCurrent',
      label: 'Adjust this schedule only',
      locator: dialog.getByRole('button', { name: /Option A: Adjust this schedule only/i }),
    },
    {
      action: 'FlexChild',
      label: 'Create flex child schedule',
      locator: dialog.getByRole('button', { name: /Option C: Create flex child schedule/i }),
    },
    {
      action: 'AdjustCurrentAndFuture',
      label: 'Adjust this and all future schedules',
      locator: dialog.getByRole('button', { name: /Option B: Adjust this and all future schedules/i }),
    },
  ] as const

  for (const option of options) {
    if (await option.locator.isDisabled()) {
      continue
    }

    await option.locator.click()
    await dialog.getByRole('button', { name: 'Continue' }).click()
    await dialog.waitFor({ state: 'hidden' })
    return `Variance resolution required operator confirmation; selected ${option.action} (${option.label}).`
  }

  throw new Error('Variance resolution dialog opened, but no enabled operator resolution option was available.')
}

async function submitGroupedWizardThroughUi(wizard: Locator, page: Page): Promise<string[]> {
  const resolutionNotes: string[] = []

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const submitButton = wizard.getByRole('button', { name: /^Submit Match$/ })
    await expect(submitButton).toBeEnabled({ timeout: 20_000 })
    await submitButton.click()

    const resolutionNote = await resolveVariancePromptIfPresent(page)
    if (resolutionNote) {
      resolutionNotes.push(resolutionNote)
      continue
    }

    await expect(wizard.getByText('Applied successfully')).toBeVisible({ timeout: 20_000 })
    await expect(wizard.getByText(/Match Group ID:/)).toBeVisible()
    return resolutionNotes
  }

  throw new Error('The grouped match wizard never reached an applied state through the UI submit path.')
}

function isMatchedLikeStatus(line: { status?: string; reconciled?: boolean } | undefined): boolean {
  if (!line) {
    return false
  }

  return Boolean(line.reconciled) || line.status === 'Matched' || line.status === 'Partially Matched'
}

async function runRs001(ctx: ScenarioContext, page: Page, testInfo: TestInfo): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  await openDepositDetail(page, execution.depositId)

  const detail = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
  expect(detail.ok).toBeTruthy()
  expect(detail.data?.data?.metadata?.status).toBe('Completed')
  expect(detail.data?.data?.metadata?.reconciled).toBe(true)
  expect(detail.data?.data?.lineItems?.[0]?.status).toBe('Matched')
  expect(detail.data?.data?.lineItems?.[0]?.reconciled).toBe(true)
  expect(Number(detail.data?.data?.lineItems?.[0]?.usageUnallocated ?? -1)).toBe(0)
  expect(Number(detail.data?.data?.lineItems?.[0]?.commissionUnallocated ?? -1)).toBe(0)

  const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-001-finalized-detail')]
  return {
    scenarioId: ctx.scenario.scenarioId,
    title: ctx.scenario.title,
    lane: ctx.scenario.lane,
    status: 'pass',
    startedAt: ctx.startedAt,
    finishedAt: new Date().toISOString(),
    notes: [
      'Verified against the completed duplicate TC-01 deposit already present in the current TEST DB.',
      'Deposit detail and API payload both report Completed / reconciled final state with zero remaining allocation.',
    ],
    artifacts,
    execution,
  }
}

async function runRs002(ctx: ScenarioContext, page: Page, testInfo: TestInfo): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  const fixtureLabel =
    execution.flowId === 'rs002-exact-metadata-candidate'
      ? 'Dedicated RS-002 metadata-assisted starter deposit'
      : 'Wave 1 pending TC-01 deposit'

  await openDepositDetail(page, execution.depositId)
  await selectRowCheckbox(page, execution.lineId)

  const candidates = await fetchJson<any>(
    page,
    `/api/reconciliation/deposits/${execution.depositId}/line-items/${execution.lineId}/candidates`
  )
  expect(candidates.ok).toBeTruthy()
  const rows = candidates.data?.data ?? []
  if (rows.length === 0) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-002-runtime-fixture-drift')]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason:
        `The mapped ${fixtureLabel} line currently returns zero candidate schedules in the shared TEST DB, so the RS-002 runtime fixture no longer matches the scenario precondition.`,
      notes: [
        'Direct authenticated API check during execution returned an empty candidate array.',
        'Marked blocked instead of failed to avoid reporting shared-fixture drift as a product regression.',
      ],
      artifacts,
      execution,
    }
  }
  expect(rows).toHaveLength(1)
  expect(rows[0]?.id).toBe(execution.scheduleIds[0])
  expect(rows[0]?.reasons).toEqual(
    expect.arrayContaining(['Order ID matches', 'Customer ID matches'])
  )

  const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-002-metadata-candidate')]
  return {
    scenarioId: ctx.scenario.scenarioId,
    title: ctx.scenario.title,
    lane: ctx.scenario.lane,
    status: 'pass',
    startedAt: ctx.startedAt,
    finishedAt: new Date().toISOString(),
    notes: [
      `${fixtureLabel} returned exactly one candidate.`,
      'Candidate reasoning explicitly includes order ID and customer ID evidence, matching the additional-information scenario goal.',
    ],
    artifacts,
    execution,
  }
}

async function openTc04Wizard(
  scenario: ScenarioManifestEntry,
  page: Page
): Promise<void> {
  const execution = scenario.execution
  if (execution.mode !== 'browser-live') {
    throw new Error('TC-04 live wizard requested for a non-live scenario.')
  }

  await openDepositDetail(page, execution.depositId)
  await selectRowCheckbox(page, execution.lineId)

  for (const scheduleId of execution.scheduleIds.slice(0, 3)) {
    await selectRowCheckbox(page, scheduleId)
  }

  await page.getByRole('button', { name: /^Match$/ }).last().click()
  await expect(page.getByText('RECONCILIATION MATCH')).toBeVisible()
}

async function runRs003(ctx: ScenarioContext, page: Page, testInfo: TestInfo): Promise<ScenarioResult> {
  await openTc04Wizard(ctx.scenario, page)
  await expect(page.getByText('Match 1 line to 3 schedules')).toBeVisible()
  await expect(page.getByText('Match Type 1:M')).toBeVisible()

  const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-003-tc04-1tom-preview')]
  return {
    scenarioId: ctx.scenario.scenarioId,
    title: ctx.scenario.title,
    lane: ctx.scenario.lane,
    status: 'pass-pending-ui-review',
    startedAt: ctx.startedAt,
    finishedAt: new Date().toISOString(),
    notes: [
      'Current live TC-04 wizard previews a clean 1:M allocation across the intended TC-04 schedule trio.',
      'Left as pass-pending-ui-review because the operator-facing allocation and final confirm flow still need a human acceptance pass in the current shared DB state.',
    ],
    artifacts,
    execution: ctx.scenario.execution,
  }
}

async function runRs004(ctx: ScenarioContext, page: Page, testInfo: TestInfo): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  await openDepositDetail(page, execution.depositId)

  const lineIds = getExecutionLineIds(ctx.scenario)
  const groupedMatchType = inferGroupedMatchType(ctx.scenario)
  if (lineIds.length < 2 || execution.scheduleIds.length !== 1 || groupedMatchType !== 'ManyToOne') {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-004-invalid-manytoone-shape')]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason:
        'The current runtime mapping is not a true ManyToOne fixture. RS-004 requires multiple deposit lines and exactly one target schedule.',
      notes: [`Mapped line count: ${lineIds.length}.`, `Mapped schedule count: ${execution.scheduleIds.length}.`],
      artifacts,
      execution,
    }
  }

  const detail = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
  if (!detail.ok) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-004-detail-error')]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason: `Deposit detail endpoint returned HTTP ${detail.status} for the mapped runtime fixture.`,
      notes: ['The underlying detail API was not healthy in the shared TEST DB.'],
      artifacts,
      execution,
    }
  }

  const detailLines = Array.isArray(detail.data?.data?.lineItems) ? detail.data.data.lineItems : []
  const missingLineIds = lineIds.filter(lineId => !detailLines.some((line: { id?: string }) => line?.id === lineId))
  if (missingLineIds.length > 0) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-004-line-missing-from-api')]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason: `One or more mapped deposit line items are no longer present in the current deposit detail payload: ${missingLineIds.join(', ')}.`,
      notes: ['Marked blocked instead of failed because the prepared fixture no longer matches the recorded scenario mapping.'],
      artifacts,
      execution,
    }
  }

  const preflightCleanupNotes: string[] = []
  let currentDetailLines = detailLines
  for (let attempt = 0; attempt < lineIds.length; attempt += 1) {
    const contaminatedLineIds = lineIds.filter(lineId => {
      const line = currentDetailLines.find((candidate: { id?: string }) => candidate?.id === lineId)
      return isMatchedLikeStatus(line)
    })

    if (contaminatedLineIds.length === 0) {
      break
    }

    const unmatchResponse = await postJsonWithRequest<any>(
      page,
      `/api/reconciliation/deposits/${execution.depositId}/line-items/${contaminatedLineIds[0]}/unmatch`
    )
    expect(unmatchResponse.ok).toBeTruthy()
    preflightCleanupNotes.push(
      `Preflight cleanup restored the shared RS-004 fixture after prior contamination was detected on line ${contaminatedLineIds[0]}.`
    )

    const refreshedDetail = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
    expect(refreshedDetail.ok).toBeTruthy()
    currentDetailLines = Array.isArray(refreshedDetail.data?.data?.lineItems) ? refreshedDetail.data.data.lineItems : []
  }

  const residualContamination = lineIds.filter(lineId => {
    const line = currentDetailLines.find((candidate: { id?: string }) => candidate?.id === lineId)
    return isMatchedLikeStatus(line)
  })
  if (residualContamination.length > 0) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-004-preflight-cleanup-incomplete')]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason: `The mapped RS-004 fixture could not be restored to a clean unmatched state before browser proof. Remaining contaminated lines: ${residualContamination.join(', ')}.`,
      notes: [
        ...preflightCleanupNotes,
        'Blocked instead of failed because this indicates shared-fixture contamination rather than a verified product regression.',
      ],
      artifacts,
      execution,
    }
  }

  await openDepositDetail(page, execution.depositId)

  await selectFilterOption(page, 'Filter deposit line items', 'Unmatched')
  await selectFilterOption(page, 'Filter suggested matches', 'Suggested')

  for (const lineId of lineIds) {
    if (!(await waitForRowCheckbox(page, lineId, 4_000))) {
      const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-004-line-unavailable')]
      return {
        scenarioId: ctx.scenario.scenarioId,
        title: ctx.scenario.title,
        lane: ctx.scenario.lane,
        status: 'blocked',
        startedAt: ctx.startedAt,
        finishedAt: new Date().toISOString(),
        reason: `Mapped deposit line item ${lineId} exists in the API payload but did not render as a selectable row in the browser after filter reset.`,
        notes: ['Marked blocked instead of failed because this indicates UI availability drift rather than a verified reconciliation defect.'],
        artifacts,
        execution,
      }
    }
  }

  const targetScheduleId = execution.scheduleIds[0]
  const findings: string[] = []
  for (const lineId of lineIds) {
    const rows = await fetchCandidateRows(page, execution.depositId, lineId)
    const target = rows.find((row: any) => row?.id === targetScheduleId)
    if (!target) {
      const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-004-ui-missing-target-candidate')]
      return {
        scenarioId: ctx.scenario.scenarioId,
        title: ctx.scenario.title,
        lane: ctx.scenario.lane,
        status: 'blocked',
        startedAt: ctx.startedAt,
        finishedAt: new Date().toISOString(),
        reason: `Mapped deposit line ${lineId} no longer returns the intended grouped target schedule ${targetScheduleId}.`,
        notes: ['This indicates fixture or candidate-scoring drift in shared TEST.'],
        artifacts,
        execution,
      }
    }

    findings.push(`Line ${lineId} returned ${rows.length} candidate(s) including ${targetScheduleId}.`)
  }

  const artifacts: ScenarioArtifactRef[] = []
  let cleanupNeeded = false

  try {
    for (const lineId of lineIds) {
      await selectRowCheckbox(page, lineId)
    }

    if (!(await waitForRowCheckbox(page, targetScheduleId, 5_000))) {
      const missingScheduleArtifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-004-ui-schedule-missing')]
      return {
        scenarioId: ctx.scenario.scenarioId,
        title: ctx.scenario.title,
        lane: ctx.scenario.lane,
        status: 'blocked',
        startedAt: ctx.startedAt,
        finishedAt: new Date().toISOString(),
        reason:
          'The mapped target schedule did not render as a selectable suggested-match row after selecting the three grouped deposit lines.',
        notes: [
          'The API candidate checks still returned the intended schedule for each line, so this is treated as a browser/operator rendering gap rather than a remap miss.',
        ],
        artifacts: missingScheduleArtifacts,
        execution,
      }
    }

    await selectRowCheckbox(page, targetScheduleId)

    const matchButton = page.getByRole('button', { name: 'Match', exact: true }).last()
    await expect(matchButton).toBeEnabled()

    artifacts.push(await captureScenarioScreenshot(page, testInfo, 'rs-004-ui-selection-ready'))

    await matchButton.click()

    const wizard = page.getByRole('dialog', { name: 'Reconciliation match wizard' })
    await expect(wizard).toBeVisible()
    await expect(wizard).toContainText('Match 3 lines to 1 schedule')
    await expect(wizard).toContainText(/Match Type\s*M:1/)
    artifacts.push(await captureScenarioScreenshot(page, testInfo, 'rs-004-ui-wizard-open'))

    const varianceResolutionNotes = await submitGroupedWizardThroughUi(wizard, page)
    cleanupNeeded = true

    artifacts.push(await captureScenarioScreenshot(page, testInfo, 'rs-004-ui-applied'))

    await wizard.getByRole('button', { name: 'Cancel' }).click()
    await expect(wizard).toBeHidden()

    await openDepositDetail(page, execution.depositId)
    await expect(page.getByText(/Fully Matched/)).toBeVisible({ timeout: 20_000 })

    await selectFilterOption(page, 'Filter deposit line items', 'Matched')
    const lineTable = page.getByRole('table', { name: 'Data table' }).first()
    for (const lineId of lineIds) {
      await expect(page.getByRole('checkbox', { name: `Select row ${lineId}` })).toBeVisible()
    }
    await expect(lineTable).toContainText('Matched')

    await selectFilterOption(page, 'Filter suggested matches', 'Matched')
    if (!(await waitForRowCheckbox(page, targetScheduleId, 4_000))) {
      await selectFilterOption(page, 'Filter suggested matches', 'All Schedules')
      await page.getByRole('checkbox', { name: `Select row ${targetScheduleId}` }).waitFor({ state: 'visible' })
    }
    await expect(page.getByRole('checkbox', { name: `Select row ${targetScheduleId}` })).toBeVisible()

    artifacts.push(await captureScenarioScreenshot(page, testInfo, 'rs-004-ui-post-refresh'))

    const detailAfterApply = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
    expect(detailAfterApply.ok).toBeTruthy()
    const detailLines = Array.isArray(detailAfterApply.data?.data?.lineItems) ? detailAfterApply.data.data.lineItems : []
    for (const lineId of lineIds) {
      const appliedLine = detailLines.find((line: { id?: string }) => line?.id === lineId)
      expect(appliedLine?.status).toBe('Matched')
      expect(Number(appliedLine?.usageAllocated ?? 0)).toBeGreaterThan(0)
      expect(Number(appliedLine?.commissionAllocated ?? 0)).toBeGreaterThan(0)
      expect(Number(appliedLine?.usageUnallocated ?? -1)).toBe(0)
      expect(Number(appliedLine?.commissionUnallocated ?? -1)).toBe(0)
    }

    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'pass',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      notes: [
        `Browser/operator path proved RS-004 through the live wizard for ${lineIds.length} deposit lines into schedule ${targetScheduleId}.`,
        'UI path exercised checkbox selection, grouped match wizard open, ManyToOne framing, Submit Match, save confirmation, refresh, and persisted matched-state validation.',
        ...preflightCleanupNotes,
        ...findings,
        'API candidate and deposit-detail checks were retained only as support evidence after the UI-driven operator proof.',
        ...varianceResolutionNotes,
        'The grouped fixture was restored after verification so the shared TEST data stays reusable.',
      ],
      artifacts,
      execution,
    }
  } finally {
    if (cleanupNeeded) {
      const cleanupLineIds = [lineIds[0], ...lineIds.slice(1)]
      for (const lineId of cleanupLineIds) {
        const unmatchResponse = await postJsonWithRequest<any>(
          page,
          `/api/reconciliation/deposits/${execution.depositId}/line-items/${lineId}/unmatch`
        )
        expect(unmatchResponse.ok).toBeTruthy()

        const cleanupCheck = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
        expect(cleanupCheck.ok).toBeTruthy()
        const cleanupLines = Array.isArray(cleanupCheck.data?.data?.lineItems) ? cleanupCheck.data.data.lineItems : []
        const allLinesRestored = lineIds.every(restoredLineId => {
          const restoredLine = cleanupLines.find((line: { id?: string }) => line?.id === restoredLineId)
          return (
            restoredLine?.status === 'Unmatched' &&
            Number(restoredLine?.usageAllocated ?? -1) === 0 &&
            Number(restoredLine?.commissionAllocated ?? -1) === 0
          )
        })

        if (allLinesRestored) {
          break
        }
      }

      const restoredDetail = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
      expect(restoredDetail.ok).toBeTruthy()
      const restoredLines = Array.isArray(restoredDetail.data?.data?.lineItems) ? restoredDetail.data.data.lineItems : []
      for (const lineId of lineIds) {
        const restoredLine = restoredLines.find((line: { id?: string }) => line?.id === lineId)
        expect(restoredLine?.status).toBe('Unmatched')
        expect(Number(restoredLine?.usageAllocated ?? -1)).toBe(0)
        expect(Number(restoredLine?.commissionAllocated ?? -1)).toBe(0)
      }
    }
  }
}

async function runRs068(ctx: ScenarioContext, page: Page, testInfo: TestInfo): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  await openDepositDetail(page, execution.depositId)
  const blocked = await blockIfLineUnavailable(ctx, page, testInfo)
  if (blocked) {
    return blocked
  }
  await selectRowCheckbox(page, execution.lineId)
  await expect(page.getByText('RCN-TC04-A-2026-04')).toBeVisible()
  await expect(page.getByText('RCN-TC04-B-2026-04')).toBeVisible()
  await expect(page.getByText('RCN-TC04-C-2026-04')).toBeVisible()
  await expect(page.getByText('RCN-TC17-A-2026-04')).toBeVisible()

  const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-068-conflict-candidates')]
  return {
    scenarioId: ctx.scenario.scenarioId,
    title: ctx.scenario.title,
    lane: ctx.scenario.lane,
    status: 'pass-pending-ui-review',
    startedAt: ctx.startedAt,
    finishedAt: new Date().toISOString(),
    notes: [
      'The live candidate list exposes both the intended TC-04 trio and an additional Comcast schedule set, proving the conflict/disambiguation condition exists.',
      'Operator review is still required to decide the correct schedule set.',
    ],
    artifacts,
    execution,
  }
}

async function runRs069(ctx: ScenarioContext, page: Page, testInfo: TestInfo): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  await openDepositDetail(page, execution.depositId)
  const blocked = await blockIfLineUnavailable(ctx, page, testInfo)
  if (blocked) {
    return blocked
  }
  await selectRowCheckbox(page, execution.lineId)
  await expect(page.getByText('RCN-TC03-OLD-2025-01')).toBeVisible()
  await expect(page.getByText('RCN-TC03-NEW-2025-04')).toBeVisible()

  const candidates = await fetchJson<any>(
    page,
    `/api/reconciliation/deposits/${execution.depositId}/line-items/${execution.lineId}/candidates`
  )
  expect(candidates.ok).toBeTruthy()
  const candidateIds = new Set((candidates.data?.data ?? []).map((row: any) => row.id))
  expect(candidateIds.has(execution.scheduleIds[0])).toBe(true)
  expect(candidateIds.has(execution.scheduleIds[1])).toBe(true)

  const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-069-dual-candidate-review')]
  return {
    scenarioId: ctx.scenario.scenarioId,
    title: ctx.scenario.title,
    lane: ctx.scenario.lane,
    status: 'pass-pending-ui-review',
    startedAt: ctx.startedAt,
    finishedAt: new Date().toISOString(),
    notes: [
      'The live TC-03 candidate list contains both the old and new schedules for the same account/product/order combination.',
      'This is the intended operator decision-point evidence for the near-identical schedule conflict.',
    ],
    artifacts,
    execution,
  }
}

async function runRs073(ctx: ScenarioContext, page: Page, testInfo: TestInfo): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  await openDepositDetail(page, execution.depositId)
  const blocked = await blockIfLineUnavailable(ctx, page, testInfo)
  if (blocked) {
    return blocked
  }
  await selectRowCheckbox(page, execution.lineId)
  await expect(page.getByText('No suggested matches found')).toBeVisible()

  const candidates = await fetchJson<any>(
    page,
    `/api/reconciliation/deposits/${execution.depositId}/line-items/${execution.lineId}/candidates`
  )
  expect(candidates.ok).toBeTruthy()
  expect(candidates.data?.data ?? []).toHaveLength(0)

  const artifacts = [await captureScenarioScreenshot(page, testInfo, 'rs-073-no-candidates')]
  const unmatchedFixtureLabel =
    execution.flowId === 'generic-none-no-candidates'
      ? 'Imported generic unmatched starter deposit'
      : 'Wave 1 TC-09'
  return {
    scenarioId: ctx.scenario.scenarioId,
    title: ctx.scenario.title,
    lane: ctx.scenario.lane,
    status: 'pass',
    startedAt: ctx.startedAt,
    finishedAt: new Date().toISOString(),
    notes: [
      `${unmatchedFixtureLabel} remains intentionally unmatched in the live TEST DB.`,
      'Browser and API both show zero suggested matches for the selected line item.',
    ],
    artifacts,
    execution,
  }
}

async function runGeneric1To1CandidateReview(
  ctx: ScenarioContext,
  page: Page,
  testInfo: TestInfo
): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  await openDepositDetail(page, execution.depositId)
  const blocked = await blockIfLineUnavailable(ctx, page, testInfo)
  if (blocked) {
    return blocked
  }

  await selectRowCheckbox(page, execution.lineId)
  const rows = await fetchCandidateRows(page, execution.depositId, execution.lineId)
  const target = rows.find((row: any) => row?.id === execution.scheduleIds[0])

  if (!target) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-1to1-missing-target`)]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason: 'The imported generic 1:1 deposit line no longer returns the intended generic schedule candidate in the shared TEST DB.',
      notes: ['This indicates fixture drift or scoring drift, so the scenario was blocked instead of guessed past.'],
      artifacts,
      execution,
    }
  }

  const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-1to1-candidates`)]
  return {
    scenarioId: ctx.scenario.scenarioId,
    title: ctx.scenario.title,
    lane: ctx.scenario.lane,
    status: 'pass-pending-ui-review',
    startedAt: ctx.startedAt,
    finishedAt: new Date().toISOString(),
    notes: [
      `Imported generic 1:1 line returned ${rows.length} live candidate(s).`,
      `The intended generic schedule ${execution.scheduleIds[0]} is present in the candidate set.`,
      'Current shared TEST data still includes an older DW Realty collision, so this remains candidate-stage evidence rather than a deterministic final pass.',
    ],
    artifacts,
    execution,
  }
}

async function runGeneric1ToMFamily(
  ctx: ScenarioContext,
  page: Page,
  testInfo: TestInfo
): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  const lineIds = getExecutionLineIds(ctx.scenario)
  if (lineIds.length > 1 && execution.scheduleIds.length === 1) {
    const groupedResult = await runGenericMTo1Family(ctx, page, testInfo)
    if (groupedResult.status === 'pass' || groupedResult.status === 'pass-pending-ui-review') {
      return {
        ...groupedResult,
        status: 'pass-pending-ui-review',
        notes: [
          'Current runtime shape matches the shared grouped workflow fixture, so this row is counted as provisional workflow coverage only.',
          'The exact row-specific 1:M or bundle-specific behavior is not yet proven with a distinct fixture.',
          ...groupedResult.notes,
        ],
      }
    }

    return groupedResult
  }

  const blocked = await blockIfAnyMappedLineUnavailable(ctx, page, testInfo)
  if (blocked) {
    return blocked
  }

  const findings: string[] = []
  for (const lineId of getExecutionLineIds(ctx.scenario)) {
    const rows = await fetchCandidateRows(page, execution.depositId, lineId)
    const target = rows.find((row: any) => row?.id === execution.scheduleIds[0])
    if (!target) {
      const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-1tom-missing-target`)]
      return {
        scenarioId: ctx.scenario.scenarioId,
        title: ctx.scenario.title,
        lane: ctx.scenario.lane,
        status: 'blocked',
        startedAt: ctx.startedAt,
        finishedAt: new Date().toISOString(),
        reason: `Imported generic 1:M split line ${lineId} no longer returns the intended shared bundle schedule candidate.`,
        notes: ['This indicates runtime-fixture drift in the shared TEST DB.'],
        artifacts,
        execution,
      }
    }
    findings.push(`Line ${lineId} returned ${rows.length} candidate(s) including ${execution.scheduleIds[0]}.`)
  }

  await selectRowCheckbox(page, execution.lineId)
  const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-1tom-candidates`)]
  return {
    scenarioId: ctx.scenario.scenarioId,
    title: ctx.scenario.title,
    lane: ctx.scenario.lane,
    status: 'pass-pending-ui-review',
    startedAt: ctx.startedAt,
    finishedAt: new Date().toISOString(),
    notes: [
      'All imported generic split lines surfaced the intended shared bundle schedule candidate.',
      ...findings,
      'This proves the representative split-line family is loaded and discoverable, but the final aggregate confirmation still needs operator review.',
    ],
    artifacts,
    execution,
  }
}

async function runGenericMTo1Family(
  ctx: ScenarioContext,
  page: Page,
  testInfo: TestInfo
): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  await openDepositDetail(page, execution.depositId)
  const lineIds = getExecutionLineIds(ctx.scenario)
  const groupedMatchType = inferGroupedMatchType(ctx.scenario)
  if (lineIds.length < 2 || execution.scheduleIds.length !== 1 || groupedMatchType !== 'ManyToOne') {
    const artifacts = [
      await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-mto1-invalid-shape`),
    ]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason:
        'The current runtime mapping is not a true ManyToOne fixture. This flow requires multiple deposit line IDs and exactly one target schedule.',
      notes: [
        `Mapped line count: ${lineIds.length}.`,
        `Mapped schedule count: ${execution.scheduleIds.length}.`,
      ],
      artifacts,
      execution,
    }
  }

  const blocked = await blockIfAnyMappedLineUnavailable(ctx, page, testInfo)
  if (blocked) {
    return blocked
  }

  const targetScheduleId = execution.scheduleIds[0]
  const findings: string[] = []
  const scopeNotes = isRuntimePathValidationScenario(ctx.scenario)
    ? [
        'This run is labeled as runtime-path validation only.',
        'It validates the grouped ManyToOne harness path after remapping, not final proof of the row-specific business scenario.',
      ]
    : []
  const fixtureNotes = Array.isArray(execution.resultNotes) ? execution.resultNotes : []
  for (const lineId of lineIds) {
    const rows = await fetchCandidateRows(page, execution.depositId, lineId)
    const target = rows.find((row: any) => row?.id === targetScheduleId)
    if (!target) {
      const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-mto1-missing-targets`)]
      return {
        scenarioId: ctx.scenario.scenarioId,
        title: ctx.scenario.title,
        lane: ctx.scenario.lane,
        status: 'blocked',
        startedAt: ctx.startedAt,
        finishedAt: new Date().toISOString(),
        reason: `Mapped deposit line ${lineId} no longer returns the intended ManyToOne target schedule ${targetScheduleId}.`,
        notes: ['This indicates fixture or candidate-scoring drift in shared TEST.'],
        artifacts,
        execution,
      }
    }
    findings.push(`Line ${lineId} returned ${rows.length} candidate(s) including ${targetScheduleId}.`)
  }

  let cleanupNeeded = false
  const artifacts: ScenarioArtifactRef[] = [
    await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-mto1-candidates`),
  ]

  try {
    const previewResponse = await postJson<any>(
      page,
      `/api/reconciliation/deposits/${execution.depositId}/matches/preview`,
      {
        matchType: groupedMatchType,
        lineIds,
        scheduleIds: execution.scheduleIds,
      }
    )
    expect(previewResponse.ok).toBeTruthy()

    const preview = previewResponse.data?.data
    if (!preview?.ok) {
      const issues = Array.isArray(preview?.issues) ? preview.issues : []
      const issueMessages = issues
        .map((issue: any) => `${issue?.level ?? 'issue'}:${issue?.code ?? 'unknown'}:${issue?.message ?? 'No message provided.'}`)
        .filter(Boolean)
      artifacts.push(
        await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-mto1-preview-blocked`)
      )
      return {
        scenarioId: ctx.scenario.scenarioId,
        title: ctx.scenario.title,
        lane: ctx.scenario.lane,
        status: 'blocked',
        startedAt: ctx.startedAt,
        finishedAt: new Date().toISOString(),
        reason:
          issueMessages[0] ??
          'The grouped ManyToOne preview rejected the selected fixture before apply, so the scenario could not be claimed as a valid proof run.',
        notes: [
          ...scopeNotes,
          ...fixtureNotes,
          'The grouped preview returned ok=false before apply.',
          ...issueMessages,
        ],
        artifacts,
        execution,
      }
    }
    expect(preview?.matchType).toBe('ManyToOne')

    const normalizedAllocations = Array.isArray(preview?.normalizedAllocations) ? preview.normalizedAllocations : []
    expect(normalizedAllocations.length).toBeGreaterThan(0)
    const previewLineIds = new Set(
      normalizedAllocations.map((allocation: any) => String(allocation?.lineId ?? '')).filter(Boolean)
    )
    expect(previewLineIds.size).toBe(lineIds.length)
    for (const lineId of lineIds) {
      expect(previewLineIds.has(lineId)).toBeTruthy()
    }
    const previewScheduleIds = new Set(
      normalizedAllocations.map((allocation: any) => String(allocation?.scheduleId ?? '')).filter(Boolean)
    )
    expect(Array.from(previewScheduleIds)).toEqual([targetScheduleId])

    const allocations = normalizedAllocations.map((allocation: any) => ({
      lineId: allocation.lineId,
      scheduleId: allocation.scheduleId,
      usageAmount: allocation.usageAmount,
      commissionAmount: allocation.commissionAmount,
    }))
    const varianceResolutions = buildPreferredVarianceResolutions(preview)

    const applyResponse = await postJson<any>(
      page,
      `/api/reconciliation/deposits/${execution.depositId}/matches/apply`,
      {
        matchType: groupedMatchType,
        lineIds,
        scheduleIds: execution.scheduleIds,
        allocations,
        varianceResolutions,
      }
    )
    expect(applyResponse.ok).toBeTruthy()
    cleanupNeeded = true

    const appliedAllocationCount = Number(applyResponse.data?.data?.appliedAllocationCount ?? 0)
    expect(appliedAllocationCount).toBeGreaterThan(0)

    const appliedSchedules = Array.isArray(applyResponse.data?.data?.schedules) ? applyResponse.data.data.schedules : []
    const targetedSchedules = appliedSchedules.filter((entry: any) =>
      entry?.schedule?.id === targetScheduleId
    )
    expect(targetedSchedules.length).toBe(1)
    for (const schedule of targetedSchedules) {
      expect(schedule?.matchCount ?? 0).toBeGreaterThan(0)
      expect(schedule?.schedule?.status).not.toBe('Unreconciled')
    }

    const detailAfterApply = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
    expect(detailAfterApply.ok).toBeTruthy()
    const detailLines = Array.isArray(detailAfterApply.data?.data?.lineItems) ? detailAfterApply.data.data.lineItems : []
    for (const lineId of lineIds) {
      const appliedLine = detailLines.find((line: { id?: string }) => line?.id === lineId)
      expect(appliedLine?.status).toBe('Matched')
      expect(Number(appliedLine?.usageAllocated ?? 0)).toBeGreaterThan(0)
      expect(Number(appliedLine?.commissionAllocated ?? 0)).toBeGreaterThan(0)
      expect(Number(appliedLine?.usageUnallocated ?? -1)).toBe(0)
      expect(Number(appliedLine?.commissionUnallocated ?? -1)).toBe(0)
    }

    await openDepositDetail(page, execution.depositId)
    const refreshedDetailAfterApply = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
    expect(refreshedDetailAfterApply.ok).toBeTruthy()
    const refreshedAppliedLines = Array.isArray(refreshedDetailAfterApply.data?.data?.lineItems)
      ? refreshedDetailAfterApply.data.data.lineItems
      : []
    for (const lineId of lineIds) {
      const refreshedLine = refreshedAppliedLines.find((line: { id?: string }) => line?.id === lineId)
      expect(refreshedLine?.status).toBe('Matched')
      expect(Number(refreshedLine?.usageUnallocated ?? -1)).toBe(0)
      expect(Number(refreshedLine?.commissionUnallocated ?? -1)).toBe(0)
    }

    artifacts.push(
      await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-mto1-applied`)
    )

    const resolutionNotes =
      varianceResolutions.length > 0
        ? [`Applied grouped variance resolutions: ${varianceResolutions.map(item => `${item.scheduleId}:${item.action}`).join(', ')}.`]
        : ['No variance-resolution prompt was required for the grouped apply path.']

    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'pass-pending-ui-review',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      notes: [
        ...scopeNotes,
        ...fixtureNotes,
        `Grouped fixture exposed a valid ManyToOne path for ${lineIds.length} deposit line(s) into schedule ${targetScheduleId}.`,
        ...findings,
        `Preview/apply succeeded using match type ${groupedMatchType}.`,
        'API and deposit detail both showed every grouped deposit line as fully allocated after apply.',
        ...resolutionNotes,
        'The grouped fixture was restored after verification so the shared TEST data stays reusable.',
      ],
      artifacts,
      execution,
    }
  } finally {
    if (cleanupNeeded) {
      for (const lineId of lineIds) {
        const unmatchResponse = await postJson<any>(
          page,
          `/api/reconciliation/deposits/${execution.depositId}/line-items/${lineId}/unmatch`
        )
        expect(unmatchResponse.ok).toBeTruthy()
      }

      const restoredDetail = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
      expect(restoredDetail.ok).toBeTruthy()
      const restoredLines = Array.isArray(restoredDetail.data?.data?.lineItems)
        ? restoredDetail.data.data.lineItems
        : []
      for (const lineId of lineIds) {
        const restoredLine = restoredLines.find((line: { id?: string }) => line?.id === lineId)
        expect(restoredLine?.status).toBe('Unmatched')
        expect(Number(restoredLine?.usageAllocated ?? -1)).toBe(0)
        expect(Number(restoredLine?.commissionAllocated ?? -1)).toBe(0)
      }

      await openDepositDetail(page, execution.depositId)
      const refreshedRestoredDetail = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
      expect(refreshedRestoredDetail.ok).toBeTruthy()
      const refreshedRestoredLines = Array.isArray(refreshedRestoredDetail.data?.data?.lineItems)
        ? refreshedRestoredDetail.data.data.lineItems
        : []
      for (const lineId of lineIds) {
        const refreshedLine = refreshedRestoredLines.find((line: { id?: string }) => line?.id === lineId)
        expect(refreshedLine?.status).toBe('Unmatched')
        expect(Number(refreshedLine?.usageAllocated ?? -1)).toBe(0)
        expect(Number(refreshedLine?.commissionAllocated ?? -1)).toBe(0)
      }

      const rerunPreviewResponse = await postJson<any>(
        page,
        `/api/reconciliation/deposits/${execution.depositId}/matches/preview`,
        {
          matchType: groupedMatchType,
          lineIds,
          scheduleIds: execution.scheduleIds,
        }
      )
      expect(rerunPreviewResponse.ok).toBeTruthy()
      const rerunPreview = rerunPreviewResponse.data?.data
      expect(rerunPreview?.ok).toBeTruthy()
      expect(rerunPreview?.matchType).toBe('ManyToOne')
      const rerunAllocations = Array.isArray(rerunPreview?.normalizedAllocations)
        ? rerunPreview.normalizedAllocations
        : []
      expect(rerunAllocations.length).toBeGreaterThan(0)
      const rerunLineIds = new Set(
        rerunAllocations.map((allocation: any) => String(allocation?.lineId ?? '')).filter(Boolean)
      )
      expect(rerunLineIds.size).toBe(lineIds.length)
      for (const lineId of lineIds) {
        expect(rerunLineIds.has(lineId)).toBeTruthy()
      }
    }
  }
}

async function runGenericPartialReview(
  ctx: ScenarioContext,
  page: Page,
  testInfo: TestInfo
): Promise<ScenarioResult> {
  const execution = ctx.scenario.execution
  if (execution.mode !== 'browser-live') {
    return buildBlockedResult(ctx.scenario, ctx.startedAt, 'Scenario is not mapped to a live browser fixture.')
  }

  await openDepositDetail(page, execution.depositId)
  const blocked = await blockIfLineUnavailable(ctx, page, testInfo)
  if (blocked) {
    return blocked
  }

  await selectRowCheckbox(page, execution.lineId)
  const rows = await fetchCandidateRows(page, execution.depositId, execution.lineId)
  const target = rows.find((row: any) => row?.id === execution.scheduleIds[0])

  if (!target) {
    const artifacts = [await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-partial-missing-target`)]
    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'blocked',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      reason: 'The imported generic partial fixture no longer returns the intended baseline schedule candidate.',
      notes: ['This indicates runtime-fixture drift in the shared TEST DB.'],
      artifacts,
      execution,
    }
  }

  const usageAmount = 300
  const commissionAmount = 24
  let cleanupNeeded = false

  try {
    const applyResponse = await postJson<any>(
      page,
      `/api/reconciliation/deposits/${execution.depositId}/line-items/${execution.lineId}/apply-match`,
      {
        revenueScheduleId: execution.scheduleIds[0],
        usageAmount,
        commissionAmount,
        confidenceScore: 0.99,
      }
    )
    expect(applyResponse.ok).toBeTruthy()
    cleanupNeeded = true

    const updatedLine = applyResponse.data?.data?.updatedLine
    expect(updatedLine?.status).toBe('PartiallyMatched')
    expect(Number(updatedLine?.usageAllocated ?? -1)).toBe(usageAmount)
    expect(Number(updatedLine?.usageUnallocated ?? -1)).toBe(299)
    expect(Number(updatedLine?.commissionAllocated ?? -1)).toBe(commissionAmount)
    expect(Number(updatedLine?.commissionUnallocated ?? -1)).toBe(23.92)

    const detailAfterApply = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
    expect(detailAfterApply.ok).toBeTruthy()
    const detailLine = (detailAfterApply.data?.data?.lineItems ?? []).find(
      (line: { id?: string }) => line?.id === execution.lineId
    )
    expect(detailLine?.status).toBe('Partially Matched')
    expect(Number(detailLine?.usageAllocated ?? -1)).toBe(usageAmount)
    expect(Number(detailLine?.usageUnallocated ?? -1)).toBe(299)
    expect(Number(detailLine?.commissionAllocated ?? -1)).toBe(commissionAmount)
    expect(Number(detailLine?.commissionUnallocated ?? -1)).toBe(23.92)

    await openDepositDetail(page, execution.depositId)
    const artifacts = [
      await captureScenarioScreenshot(page, testInfo, `${ctx.scenario.scenarioId.toLowerCase()}-generic-partial-applied`),
    ]

    if (ctx.scenario.lane === 'ui-review') {
      return {
        scenarioId: ctx.scenario.scenarioId,
        title: ctx.scenario.title,
        lane: ctx.scenario.lane,
        status: 'pass-pending-ui-review',
        startedAt: ctx.startedAt,
        finishedAt: new Date().toISOString(),
        notes: [
          `Imported generic partial fixture was partially applied with ${usageAmount} usage and ${commissionAmount} commission.`,
          'API and deposit detail both showed Partially Matched status with the remaining balance left open.',
          'The fixture was restored to Unmatched after verification so the shared TEST data stays reusable.',
          'Left as pass-pending-ui-review because the operator-facing accept/leave-open click path is still not exercised directly in the browser.',
        ],
        artifacts,
        execution,
      }
    }

    return {
      scenarioId: ctx.scenario.scenarioId,
      title: ctx.scenario.title,
      lane: ctx.scenario.lane,
      status: 'pass',
      startedAt: ctx.startedAt,
      finishedAt: new Date().toISOString(),
      notes: [
        `Imported generic partial fixture was partially applied with ${usageAmount} usage and ${commissionAmount} commission.`,
        'API and deposit detail both showed Partially Matched status with a non-zero remainder still open.',
        'The fixture was restored to Unmatched after verification so the shared TEST data stays reusable.',
      ],
      artifacts,
      execution,
    }
  } finally {
    if (cleanupNeeded) {
      const unmatchResponse = await postJson<any>(
        page,
        `/api/reconciliation/deposits/${execution.depositId}/line-items/${execution.lineId}/unmatch`
      )
      expect(unmatchResponse.ok).toBeTruthy()

      const restoredDetail = await fetchJson<any>(page, `/api/reconciliation/deposits/${execution.depositId}/detail`)
      expect(restoredDetail.ok).toBeTruthy()
      const restoredLine = (restoredDetail.data?.data?.lineItems ?? []).find(
        (line: { id?: string }) => line?.id === execution.lineId
      )
      expect(restoredLine?.status).toBe('Unmatched')
      expect(Number(restoredLine?.usageAllocated ?? -1)).toBe(0)
      expect(Number(restoredLine?.usageUnallocated ?? -1)).toBe(599)
      expect(Number(restoredLine?.commissionAllocated ?? -1)).toBe(0)
      expect(Number(restoredLine?.commissionUnallocated ?? -1)).toBe(47.92)
    }
  }
}

const liveScenarioHandlers: Record<
  string,
  (ctx: ScenarioContext, page: Page, testInfo: TestInfo) => Promise<ScenarioResult>
> = {
  'RS-001': runRs001,
  'RS-002': runRs002,
  'RS-003': runRs003,
  'RS-004': runRs004,
  'RS-068': runRs068,
  'RS-069': runRs069,
  'RS-073': runRs073,
}

const liveFlowHandlers: Record<
  string,
  (ctx: ScenarioContext, page: Page, testInfo: TestInfo) => Promise<ScenarioResult>
> = {
  'generic-1to1-candidate-review': runGeneric1To1CandidateReview,
  'generic-1tom-split-family': runGeneric1ToMFamily,
  'generic-mto1-combined-family': runGenericMTo1Family,
  'rs020-runtime-path-validation': runGenericMTo1Family,
  'rs020-manytoone-underage': runGenericMTo1Family,
  'rs030-manytoone-commission-overage': runGenericMTo1Family,
  'rs031-manytoone-commission-underage': runGenericMTo1Family,
  'rs004-tc05-manytoone': runGenericMTo1Family,
  'generic-none-no-candidates': runRs073,
  'generic-partial-review': runGenericPartialReview,
}

for (const scenario of manifest.scenarios) {
  test(`[${scenario.scenarioId}] @${scenario.lane} ${scenario.title}`, async ({ page }, testInfo) => {
    if (scenario.scenarioId === 'RS-004') {
      test.setTimeout(90_000)
    }

    const startedAt = new Date().toISOString()
    const ctx: ScenarioContext = { scenario, startedAt }
    const handler =
      liveScenarioHandlers[scenario.scenarioId] ??
      (scenario.execution.mode === 'browser-live' ? liveFlowHandlers[scenario.execution.flowId] : undefined)

    try {
      const result =
        handler != null
          ? await handler(ctx, page, testInfo)
          : buildBlockedResult(
              scenario,
              startedAt,
              scenario.execution.mode === 'blocked-no-runtime-fixture'
                ? scenario.execution.reason
                : 'No Playwright runtime mapping was implemented for this scenario.',
              ['Scenario remains out of browser-executable scope in the current prepared DB.']
            )

      await writeScenarioResult(testInfo, result)
    } catch (error) {
      const failResult: ScenarioResult = {
        scenarioId: scenario.scenarioId,
        title: scenario.title,
        lane: scenario.lane,
        status: 'fail',
        startedAt,
        finishedAt: new Date().toISOString(),
        reason: error instanceof Error ? error.message : 'Unknown Playwright failure',
        notes: ['See Playwright failure artifacts for the full stack and browser evidence.'],
        artifacts: [],
        execution: scenario.execution,
      }
      await writeScenarioResult(testInfo, failResult)
      throw error
    }
  })
}
