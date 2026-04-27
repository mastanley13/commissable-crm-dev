const fs = require('fs')
const path = require('path')
const Papa = require('papaparse')

const rootDir = path.resolve(__dirname, '..', '..')
const sourceCsvPath = path.join(
  rootDir,
  'docs',
  'plans',
  '04-01-2026-Reconciliation_Master_Test_Plan',
  'Commissable_Master_Test_Plan.xlsx - Reconciliation Scenarios (1).csv'
)
const crosswalkCsvPath = path.join(
  rootDir,
  'docs',
  'plans',
  '03-31-2026-Data-Prep-Master-Testing-Prework',
  'generated',
  '03-31-2026_scenario_record_crosswalk.csv'
)
const outputDir = path.join(
  rootDir,
  'docs',
  'plans',
  '04-01-2026-Reconciliation_Master_Test_Plan',
  'generated'
)
const outputPath = path.join(outputDir, 'scenario-manifest.json')

const LIVE_RUNTIME_MAP = {
  'RS-001': {
    flowId: 'tc01-completed-final-state',
    depositId: '3880182d-de21-4edc-935f-72c4921a88c5',
    lineId: '96399ae3-41b0-44f7-94d7-5a94d129294e',
    scheduleIds: ['8fae04fd-1277-4756-bf44-5afd3fd21e73'],
    notes: [
      'Uses the duplicate TC-01 deposit already in completed state to verify exact-match end state without re-mutating the Wave 1 baseline copy.',
      'Verified in current TEST DB on 2026-04-03 against /reconciliation/3880182d-de21-4edc-935f-72c4921a88c5.',
    ],
  },
  'RS-002': {
    flowId: 'rs002-exact-metadata-candidate',
    depositId: '01a6c210-9f8f-4ebf-97eb-d8bec64fdedd',
    lineId: 'ab8e9cad-7aaf-4cb8-9523-903d3e3333a0',
    scheduleIds: ['51219876-e827-4bc0-81d6-ec257caf6391'],
    notes: [
      'Uses the dedicated RS-002 metadata-assisted starter deposit imported on 2026-04-03 to avoid TC-01 fixture drift and generic DW Realty collisions.',
      'Live candidate query currently returns exactly one schedule with both order ID and customer ID evidence.',
    ],
  },
  'RS-003': {
    flowId: 'tc04-1tom-preview',
    depositId: 'e70b304d-a4ab-4367-a983-3040460cbb1e',
    lineId: '3efe948b-cc82-4c21-94f4-b0b9e5a4195a',
    scheduleIds: [
      'c5bacc78-363b-470f-a4ab-1b211184b02f',
      '518caafd-7d8e-4794-83a1-1e50e3468583',
      '1e3f1193-b23c-4e32-bf0a-adb687ce87fc',
    ],
    notes: [
      'Uses the Wave 1 TC-04 pending deposit to verify current 1:M wizard preview across the seeded TC-04 trio.',
      'Live wizard text currently reads "Match 1 line to 3 schedules" and "Match Type 1:M".',
    ],
  },
  'RS-004': {
    lane: 'deterministic',
    flowId: 'rs004-tc05-manytoone',
    depositId: '7c6dbc29-d849-4c71-91a0-afe07db263d3',
    lineId: '2c04f134-0acd-422a-a7a9-2eb1f5a2f0e1',
    lineIds: [
      '2c04f134-0acd-422a-a7a9-2eb1f5a2f0e1',
      '5ec1b060-5c20-48fe-9936-d361575c15f5',
      '08e44224-843c-4bff-9fc8-2fb7f28db323',
    ],
    scheduleIds: ['bc5393d9-891b-4dea-ab07-9fd981017708'],
    notes: [
      'Uses the imported TC-05 pending deposit as the true many-lines-to-one grouped runtime path for RS-004.',
      'This fixture was already proven locally on 2026-04-06 through grouped preview/apply/cleanup/rerun behavior.',
      'RS-004 is now treated as the representative deterministic proof path for the grouped-family cluster.',
    ],
  },
  'RS-019': {
    flowId: 'generic-mto1-combined-family',
    validationScope: 'runtime-path-validation',
    depositId: '75fd941e-8614-40fc-b9ee-39acac07450e',
    lineId: 'b206178c-5f7e-44a4-9455-b017ff854d13',
    lineIds: [
      'b206178c-5f7e-44a4-9455-b017ff854d13',
      '2b4d9b75-d7dc-4125-a199-01d70e0c2c59',
      'fba76747-c604-412c-8f1b-4f03b7600a6e',
    ],
    scheduleIds: ['1274ec2a-54c2-4dcb-9185-6f1cee0de73c'],
    notes: [
      'Uses the imported generic grouped multi-line fixture as the representative ManyToOne runtime path for the blocked grouped-allocation family.',
      'This fixture is physically three deposit lines rolling into one schedule, which matches the runtime shape required by the grouped apply handler.',
      'The scenario title still describes aggregate overage, so the run should be treated as representative grouped-family proof rather than title-perfect variance proof.',
    ],
    resultNotes: [
      'This run validates the grouped ManyToOne runtime path only.',
      'The current RS-019 fixture is a true ManyToOne shape, but it is still representative grouped-family coverage rather than a title-perfect aggregate-overage proof.',
    ],
  },
  'RS-020': {
    lane: 'deterministic',
    flowId: 'rs020-manytoone-underage',
    depositId: '74116291-3f21-4e52-91c5-1953ccf34174',
    lineId: '0c0d7325-3fa6-4684-9d8c-c830d65dcdb0',
    lineIds: [
      '0c0d7325-3fa6-4684-9d8c-c830d65dcdb0',
      '23858a60-20ac-45fc-87b6-679d0f72eb77',
      'b343c07a-e747-4492-bc9f-0a2ece4af8d5',
    ],
    scheduleIds: ['bc5393d9-891b-4dea-ab07-9fd981017708'],
    notes: [
      'Uses the dedicated RS-020 grouped underage fixture imported on 2026-04-06 against the TC-05 single-schedule baseline.',
      'This fixture is a true ManyToOne shape: three deposit lines roll into one schedule, and the combined totals intentionally under-run the schedule expectation.',
      'Fixture totals: 950 usage and 95 commission against schedule RCN-TC05-2026-04 at 1000 usage and 100 commission.',
    ],
    resultNotes: [
      'Fixture semantics: combined deposit totals 950 usage and 95 commission against the target schedule expectation of 1000 usage and 100 commission.',
      'This run uses the intended RS-020 underage ManyToOne fixture, not the earlier harness-correction remap.',
    ],
  },
  'RS-030': {
    lane: 'deterministic',
    flowId: 'rs030-manytoone-commission-overage',
    depositId: '966231bc-cb23-4f41-b443-44136ea118cb',
    lineId: 'f4c68d80-d16d-4fef-a12e-d4e11bb91363',
    lineIds: [
      'f4c68d80-d16d-4fef-a12e-d4e11bb91363',
      'b0dd843b-53d9-4d65-b78d-a8839029b087',
      'cf7c2802-e2ee-44bf-8171-d118e8ca6cc0',
    ],
    scheduleIds: ['bc5393d9-891b-4dea-ab07-9fd981017708'],
    notes: [
      'Uses the dedicated RS-030 grouped commission-overage fixture against the TC-05 single-schedule baseline.',
      'This fixture is a true ManyToOne shape with usage matching expected totals while aggregate commission over-runs the target schedule expectation.',
      'Fixture targets 1000 usage and 104 commission against schedule RCN-TC05-2026-04 at 1000 usage and 100 commission.',
    ],
    resultNotes: [
      'Fixture semantics: combined deposit totals 1000 usage and 104 commission against the target schedule expectation of 1000 usage and 100 commission.',
      'This run uses the intended RS-030 commission-overage ManyToOne fixture, not the older shape-only grouped shortcut.',
    ],
  },
  'RS-031': {
    lane: 'deterministic',
    flowId: 'rs031-manytoone-commission-underage',
    depositId: 'd5a68c1c-5f95-49d2-86d1-a96cb7bba7a0',
    lineId: 'fb645457-ba8c-4639-97cf-4569cebc8846',
    lineIds: [
      'fb645457-ba8c-4639-97cf-4569cebc8846',
      'ad9c0715-9302-4bd8-b670-c3d036d2f354',
      'ec57b3f0-3723-4bbb-a292-4f215ad9aaff',
    ],
    scheduleIds: ['bc5393d9-891b-4dea-ab07-9fd981017708'],
    notes: [
      'Uses the dedicated RS-031 grouped commission-underage fixture against the TC-05 single-schedule baseline.',
      'This fixture is a true ManyToOne shape with usage matching expected totals while aggregate commission under-runs the target schedule expectation.',
      'Fixture targets 1000 usage and 88 commission against schedule RCN-TC05-2026-04 at 1000 usage and 100 commission.',
    ],
    resultNotes: [
      'Fixture semantics: combined deposit totals 1000 usage and 88 commission against the target schedule expectation of 1000 usage and 100 commission.',
      'This run uses the intended RS-031 commission-underage ManyToOne fixture, not the older shape-only grouped shortcut.',
    ],
  },
  'RS-043': {
    lane: 'deterministic',
    flowId: 'rs043-manytoone-weighted-rate',
    depositId: 'f660e6fe-9c1c-45d1-b172-5ed13d89bb2d',
    lineId: '0df95f40-0d53-4d69-b06f-c5c8462d6c59',
    lineIds: [
      '0df95f40-0d53-4d69-b06f-c5c8462d6c59',
      '554730da-eb12-4fcc-9f55-1ed72af29b88',
      '9f64f22e-a9e5-4ec5-b8e6-4ae3f4797d2e',
    ],
    scheduleIds: ['1274ec2a-54c2-4dcb-9185-6f1cee0de73c'],
    notes: [
      'Uses the dedicated RS-043 grouped weighted-rate fixture instead of the shared generic ManyToOne runtime placeholder.',
      'All three deposit lines hold the same 15.00% actual commission rate so grouped preview stays valid without triggering mixed-rate replacement handling.',
      'The target schedule still expects 16.00%, making this a row-specific weighted-rate variance proof rather than generic grouped runtime shape only.',
    ],
    resultNotes: [
      'Dedicated RS-043 fixture totals 1000 usage and 150 commission against a target schedule expecting 1000 usage and 160 commission.',
      'Expected rate should remain 16.0000% while the grouped weighted actual rate should compute to 15.0000%.',
    ],
  },
  'RS-068': {
    flowId: 'tc04-conflict-set',
    depositId: 'e70b304d-a4ab-4367-a983-3040460cbb1e',
    lineId: '3efe948b-cc82-4c21-94f4-b0b9e5a4195a',
    scheduleIds: [
      '5a72fad8-2ad0-4adf-8732-ffb4894e421f',
      'c5bacc78-363b-470f-a4ab-1b211184b02f',
      '518caafd-7d8e-4794-83a1-1e50e3468583',
      '1e3f1193-b23c-4e32-bf0a-adb687ce87fc',
    ],
    notes: [
      'Uses the Wave 1 TC-04 pending deposit because its candidate list exposes both the intended TC-04 trio and an additional Comcast schedule set.',
      'This is suitable for operator-review conflict evidence, not a final deterministic allocation pass.',
    ],
  },
  'RS-069': {
    flowId: 'tc03-dual-candidate-review',
    depositId: '347dd9cf-7111-407b-8b3a-328a642fddd3',
    lineId: '56742e01-8c59-4aba-9562-c00561873d78',
    scheduleIds: [
      '54ce5402-0294-4337-b612-c514ad28865a',
      '7192635a-363e-4ee7-8f03-706686ea6f3e',
    ],
    notes: [
      'Uses the restored Wave 1 TC-03 pending deposit after aligning the stale distributor-side fixture to the Telarus-backed old/new schedule family.',
      'This scenario should surface both the old and new schedule pair for the same account/product/order combination once the RS-069 bootstrap repair script has been applied.',
      'This is a decision-point UI review scenario, not a clean single-candidate exact-match case.',
    ],
    resultNotes: [
      'If the RS-069 repair fixture is healthy, the candidate payload should include both mapped schedule IDs and the browser list should surface the old/new ambiguity for operator review.',
    ],
  },
  'RS-073': {
    flowId: 'generic-none-no-candidates',
    depositId: 'da05d86d-8697-47a9-bffe-60981757ab95',
    lineId: '70905f35-f273-47a0-979c-d53b6df3badf',
    scheduleIds: [],
    notes: [
      'Uses the imported generic unmatched starter deposit instead of the older TC-09 unmatched fixture.',
      'Candidate API currently returns an empty array and the browser shows no suggested matches for the imported generic unmatched line.',
    ],
  },
}

const GENERIC_RUNTIME_FIXTURES = {
  GENERIC_1_TO_1: {
    flowId: 'generic-1to1-candidate-review',
    depositId: '6eef0836-1147-47ed-8413-e1d089268cf0',
    scheduleIds: ['098200f0-c427-4e12-92d5-1c398263f851'],
    lineIdsByVariant: {
      exact: '4868fa49-89f5-44b7-ab5a-803ca5816e32',
      overage: '42bc2596-04aa-4fb4-b9e2-64c507e0ab03',
      underage: 'fe5e4fe1-d816-4826-ba7f-5dcc73e4e83e',
      tolerance: 'c51b5f32-666f-4ccc-9069-56ba50bdec17',
      negative: '0b3d997c-1fa2-4ec4-b3ef-fb9c55d435b1',
    },
    notes: [
      'Uses the imported generic 1:1 starter deposit to replace the old no-runtime-fixture block with a live candidate check.',
      'Current shared TEST data still surfaces an older DW Realty schedule beside the intended generic schedule, so this family proves candidate presence but not a clean single-candidate final pass.',
    ],
  },
  GENERIC_1_TO_M: {
    flowId: 'generic-1tom-split-family',
    depositId: '75fd941e-8614-40fc-b9ee-39acac07450e',
    lineId: 'b206178c-5f7e-44a4-9455-b017ff854d13',
    lineIds: [
      'b206178c-5f7e-44a4-9455-b017ff854d13',
      '2b4d9b75-d7dc-4125-a199-01d70e0c2c59',
      'fba76747-c604-412c-8f1b-4f03b7600a6e',
    ],
    scheduleIds: ['1274ec2a-54c2-4dcb-9185-6f1cee0de73c'],
    notes: [
      'Uses the imported generic 1:M starter deposit with three split bundle lines sharing one intended bundle schedule.',
      'This family is suitable for proving the split-line candidate stage before any operator-confirmed final allocation.',
    ],
  },
  GENERIC_M_TO_1: {
    flowId: 'generic-mto1-combined-family',
    validationScope: 'runtime-path-validation',
    depositId: '75fd941e-8614-40fc-b9ee-39acac07450e',
    lineId: 'b206178c-5f7e-44a4-9455-b017ff854d13',
    lineIds: [
      'b206178c-5f7e-44a4-9455-b017ff854d13',
      '2b4d9b75-d7dc-4125-a199-01d70e0c2c59',
      'fba76747-c604-412c-8f1b-4f03b7600a6e',
    ],
    scheduleIds: ['1274ec2a-54c2-4dcb-9185-6f1cee0de73c'],
    notes: [
      'Uses the imported generic grouped multi-line fixture as the representative ManyToOne runtime path for rows that still need grouped workflow proof.',
      'This remap intentionally reuses the already-proven shared grouped fixture so stale one-line/three-schedule placeholder mappings no longer block execution.',
    ],
    resultNotes: [
      'This run should be treated as runtime-path validation only.',
      'The mapped generic grouped fixture is now a true ManyToOne shape, but it is still representative grouped-family coverage rather than row-specific business proof.',
    ],
  },
  GENERIC_NONE: {
    flowId: 'generic-none-no-candidates',
    depositId: 'da05d86d-8697-47a9-bffe-60981757ab95',
    lineId: '70905f35-f273-47a0-979c-d53b6df3badf',
    scheduleIds: [],
    notes: [
      'Uses the imported generic unmatched starter deposit instead of relying only on the older TC-09 unmatched fixture.',
      'This family is deterministic because the imported generic unmatched line currently returns zero candidates in TEST.',
    ],
  },
  GENERIC_PARTIAL: {
    flowId: 'generic-partial-review',
    depositId: '699a0e77-69d6-485c-ba8e-ddacd988ecf8',
    lineId: '1c37b342-821a-4b28-9e51-db131e84f780',
    scheduleIds: ['098200f0-c427-4e12-92d5-1c398263f851'],
    notes: [
      'Uses the imported generic partial starter deposit to replace the no-runtime-fixture block with a live candidate-stage check.',
      'The current shared TEST candidate set is still ambiguous, so this family needs end-state validation before any true partial-pass claim.',
    ],
  },
}

const LIVE_DB_INVENTORY_NOTE =
  'Current TEST DB inventory captured on 2026-04-03 now includes the imported generic reconciliation starter deposits plus the older Wave 1 TC-01, TC-03, TC-04, and TC-09 fixtures. Scenarios without a runtime mapping still lack a prepared browser fixture or a safe live assertion path.'

const KNOWN_BUG_NOTES = [
  'March 16-18 notes record stale within-tolerance assertion drift, rate-discrepancy audit payload drift, and mixed-rate bundle provenance instability in automation. Those note-level risks were not re-executed in this browser run unless a live fixture mapped directly.',
]

function formatScenarioId(value) {
  const numeric = String(value ?? '').trim()
  return `RS-${numeric.padStart(3, '0')}`
}

function defaultLaneFor(row) {
  const group = String(row.Group ?? '').trim()
  const matchType = String(row['Match Type'] ?? '').trim()

  if (matchType === 'M:1') {
    return 'needs-clarification'
  }

  if (['Data Quality', 'Matching Conflict', 'Decision Paths'].includes(group)) {
    return 'ui-review'
  }

  return 'deterministic'
}

function splitBulletText(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return []
  return raw
    .replace(/\r/g, '')
    .split(/\n|•|;/)
    .map(part => part.trim())
    .filter(Boolean)
}

function parseScenarioRefs(value) {
  const matches = String(value ?? '').match(/RS-\d+/gi) ?? []
  return matches.map(match => {
    const numeric = match.replace(/[^0-9]/g, '')
    return `RS-${numeric.padStart(3, '0')}`
  })
}

function loadGenericFamilyScenarioIds() {
  if (!fs.existsSync(crosswalkCsvPath)) {
    return {}
  }

  const csv = fs.readFileSync(crosswalkCsvPath, 'utf8')
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
  const familyMap = {}

  for (const row of parsed.data) {
    const familyId = String(row['Scenario ID'] ?? '').trim()
    if (!GENERIC_RUNTIME_FIXTURES[familyId]) {
      continue
    }

    familyMap[familyId] = parseScenarioRefs(row['Source Ref(s)'])
  }

  return familyMap
}

const GENERIC_FAMILY_SCENARIO_IDS = loadGenericFamilyScenarioIds()

function inferGenericOneToOneVariant(row) {
  const haystack = [
    row['Scenario Name'],
    row.Group,
    row['What Should the System Do?'],
    row['Expected Status'],
  ]
    .map(value => String(value ?? '').toLowerCase())
    .join(' ')

  if (/(negative|credit|claw\s*back|clawback|chargeback|zero reported usage)/.test(haystack)) {
    return 'negative'
  }

  if (/(pennies|rounding|tolerance|within tolerance|cent residual|adjusted)/.test(haystack)) {
    return 'tolerance'
  }

  if (/(above|higher|overage|overpaid|too much|receives too much|sum above)/.test(haystack)) {
    return 'overage'
  }

  if (/(below|lower|underage|underpaid|too little|receives too little|sum below)/.test(haystack)) {
    return 'underage'
  }

  return 'exact'
}

function buildGenericRuntime(row, scenarioId) {
  for (const [familyId, fixture] of Object.entries(GENERIC_RUNTIME_FIXTURES)) {
    const scenarioIds = GENERIC_FAMILY_SCENARIO_IDS[familyId] ?? []
    if (!scenarioIds.includes(scenarioId)) {
      continue
    }

    if (familyId === 'GENERIC_1_TO_1') {
      const variant = inferGenericOneToOneVariant(row)
      return {
        flowId: fixture.flowId,
        depositId: fixture.depositId,
        lineId: fixture.lineIdsByVariant[variant] ?? fixture.lineIdsByVariant.exact,
        scheduleIds: fixture.scheduleIds,
        validationScope: fixture.validationScope,
        resultNotes: fixture.resultNotes,
        notes: [
          ...fixture.notes,
          `Representative generic 1:1 variant selected for this row: ${variant}.`,
        ],
      }
    }

    return {
      flowId: fixture.flowId,
      depositId: fixture.depositId,
      lineId: fixture.lineId,
      lineIds: fixture.lineIds,
      scheduleIds: fixture.scheduleIds,
      validationScope: fixture.validationScope,
      resultNotes: fixture.resultNotes,
      notes: fixture.notes,
    }
  }

  return null
}

function buildGenericBrowserSteps(row, lane) {
  const scenarioId = formatScenarioId(row['#'])
  const title = String(row['Scenario Name'] ?? '').trim()
  const steps = [
    'Open the mapped reconciliation deposit detail in the browser.',
    'Verify the seeded line item metadata matches the scenario family before interacting.',
  ]

  if (lane === 'deterministic') {
    steps.push('Select the relevant line item and inspect the live candidate or final-state evidence.')
    steps.push('Verify deterministic state through the browser plus same-origin reconciliation API payloads.')
  } else if (lane === 'ui-review') {
    steps.push('Select the relevant line item and reach the candidate or wizard decision point in the browser.')
    steps.push('Capture a screenshot at the decision point and mark the scenario pass-pending-ui-review unless the deterministic conditions fail.')
  } else if (lane === 'needs-clarification') {
    steps.push('Run the live flow only far enough to expose the current workflow shape.')
    steps.push('Capture evidence of the current behavior and block the scenario instead of guessing past the workflow mismatch.')
  } else if (lane === 'known-bug') {
    steps.push('Open the mapped flow only to reproduce the documented blocker.')
    steps.push('Capture failure evidence and block without attempting workaround data creation.')
  }

  steps.push(`Record a structured scenario artifact for ${scenarioId} (${title}).`)
  return steps
}

function buildGenericDeterministicAssertions(row) {
  const assertions = splitBulletText(row['What Should the System Do?'])
  const expectedStatus = String(row['Expected Status'] ?? '').trim()
  if (expectedStatus) {
    assertions.push(`Expected status should align with "${expectedStatus}".`)
  }
  return assertions.length ? assertions : ['Verify the live reconciliation state matches the scenario expectation.']
}

function buildManifestEntry(row) {
  const scenarioId = formatScenarioId(row['#'])
  const runtime = LIVE_RUNTIME_MAP[scenarioId] ?? buildGenericRuntime(row, scenarioId)
  const lane = runtime?.lane ?? defaultLaneFor(row)
  const group = String(row.Group ?? '').trim()
  const title = String(row['Scenario Name'] ?? '').trim()
  const shortGoal = String(row['What Should the System Do?'] ?? '').trim() || title
  const preconditions = splitBulletText(row['What Needs to Be True?'])
  const deterministicAssertions = lane === 'ui-review' ? [] : buildGenericDeterministicAssertions(row)
  const uiAssertions = lane === 'ui-review' || lane === 'needs-clarification'
    ? [
        'Visible labels, candidate wording, and decision-path framing should be captured exactly at the operator decision point.',
        'The final artifact should indicate whether the scenario is pass-pending-ui-review, blocked, or failed.',
      ]
    : []

  const notes = []
  notes.push(`Source row ${row['#']} from the 105-scenario reconciliation CSV.`)
  if (runtime) {
    notes.push(...runtime.notes)
  } else {
    notes.push(LIVE_DB_INVENTORY_NOTE)
    notes.push('No aligned prepared deposit fixture was found for this scenario in the current browser-testable DB state.')
  }

  if (lane === 'needs-clarification') {
    notes.push('Current notes warn that older many-to-one or bundle assumptions may conflict with the newer workflow. This scenario is blocked for clarification instead of guessed.')
  }

  if (lane === 'known-bug') {
    notes.push(...KNOWN_BUG_NOTES)
  }

  return {
    scenarioId,
    group,
    title,
    lane,
    shortGoal,
    preconditions,
    browserSteps: buildGenericBrowserSteps(row, lane),
    deterministicAssertions,
    uiAssertions,
    artifactsRequired: [
      'scenario-result.json',
      'decision-point screenshot when applicable',
      'failure screenshot and Playwright trace on failure',
    ],
    notes,
    execution: runtime
      ? {
          mode: 'browser-live',
      flowId: runtime.flowId,
      depositId: runtime.depositId,
      lineId: runtime.lineId,
      lineIds: runtime.lineIds,
      scheduleIds: runtime.scheduleIds,
      validationScope: runtime.validationScope,
      resultNotes: runtime.resultNotes,
    }
      : {
          mode: 'blocked-no-runtime-fixture',
          reason: LIVE_DB_INVENTORY_NOTE,
        },
  }
}

function summarizeByLane(entries) {
  return entries.reduce((acc, entry) => {
    acc[entry.lane] = (acc[entry.lane] ?? 0) + 1
    return acc
  }, {})
}

function main() {
  const csv = fs.readFileSync(sourceCsvPath, 'utf8')
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true })
  const rows = parsed.data.filter(row => String(row['#'] ?? '').trim())
  const scenarios = rows.map(buildManifestEntry)
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceCsv: path.relative(rootDir, sourceCsvPath).replace(/\\/g, '/'),
    notes: [
      'Manifest generated for the Playwright QA runner on 2026-04-03.',
      LIVE_DB_INVENTORY_NOTE,
    ],
    laneCounts: summarizeByLane(scenarios),
    liveScenarioIds: scenarios
      .filter(scenario => scenario.execution.mode === 'browser-live')
      .map(scenario => scenario.scenarioId),
    scenarios,
  }

  fs.mkdirSync(outputDir, { recursive: true })
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  console.log(`Generated scenario manifest: ${outputPath}`)
}

main()
