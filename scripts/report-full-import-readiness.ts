import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  validateFullImportFiles,
  type FullImportValidationReport,
} from "./validate-full-import-files"

interface ReportOutputPaths {
  reportJson: string
  reportMarkdown: string
  checklist: string
  defectLog: string
}

interface ReportOptions {
  projectRoot?: string
}

const PACKAGE_RELATIVE_ROOT = path.join("docs", "test-data", "data-settings-imports", "full-import")
const REPORT_JSON_RELATIVE_PATH = path.join(PACKAGE_RELATIVE_ROOT, "readiness_report.json")
const REPORT_MARKDOWN_RELATIVE_PATH = path.join(PACKAGE_RELATIVE_ROOT, "readiness_report.md")
const CHECKLIST_RELATIVE_PATH = path.join("docs", "plans", "2026-04-17-full-import-review-checklist.md")
const DEFECT_LOG_RELATIVE_PATH = path.join("docs", "plans", "2026-04-17-full-import-defect-log.csv")

function toPosix(relativePath: string) {
  return relativePath.split(path.sep).join("/")
}

function escapeMarkdownCell(value: string) {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ")
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, "\"\"")}"`
  }
  return value
}

function formatStatus(status: string) {
  switch (status) {
    case "ready":
    case "pass":
      return "PASS"
    case "warning":
      return "WARN"
    case "not_run":
      return "NOT RUN"
    default:
      return "FAIL"
  }
}

function renderMarkdown(report: FullImportValidationReport) {
  const lines: string[] = []
  const missingFiles = report.files.filter(file => !file.exists)
  const presentBatchFiles = report.files.filter(file => file.kind === "batch")
  const blockerFindings = report.findings.filter(finding => finding.severity === "blocker")
  const warningFindings = report.findings.filter(finding => finding.severity === "warning")

  lines.push("# Full Import Readiness Report")
  lines.push("")
  lines.push(`Overall status: **${report.status === "ready" ? "READY" : "BLOCKED"}**`)
  lines.push("")
  lines.push("## Summary")
  lines.push("")
  lines.push(`- Blockers: ${report.summary.blockerCount}`)
  lines.push(`- Warnings: ${report.summary.warningCount}`)
  lines.push(`- Files checked: ${report.summary.filesChecked}`)
  lines.push(`- Files present: ${report.summary.filesPresent}`)
  lines.push(`- Files missing: ${report.summary.filesMissing}`)
  lines.push(`- Revenue schedule batch files found: ${presentBatchFiles.length}`)
  lines.push("")
  lines.push("## Required Output Inventory")
  lines.push("")
  lines.push("| Group | Status | Required Pattern(s) | Matched Files | Missing Pattern(s) |")
  lines.push("| --- | --- | --- | --- | --- |")
  for (const group of report.requiredOutputGroups) {
    lines.push(
      `| ${escapeMarkdownCell(group.label)} | ${formatStatus(group.status)} | ${escapeMarkdownCell(group.requiredPatterns.join("<br>"))} | ${escapeMarkdownCell(group.matchedFiles.join("<br>") || "None")} | ${escapeMarkdownCell(group.missingPatterns.join("<br>") || "None")} |`
    )
  }
  lines.push("")
  lines.push("## Row Reconciliation")
  lines.push("")
  lines.push("| Entity | Status | Source Rows | Canonical Rows | Exception Rows | Accounted Rows | Unaccounted Rows | Details |")
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |")
  for (const entry of report.reconciliation) {
    lines.push(
      `| ${escapeMarkdownCell(entry.label)} | ${formatStatus(entry.status)} | ${entry.sourceRows} | ${entry.canonicalRows} | ${entry.exceptionRows} | ${entry.accountedRows} | ${entry.unaccountedRows} | ${escapeMarkdownCell(entry.details.join("<br>") || "None")} |`
    )
  }
  lines.push("")
  lines.push("## Cross-file Reference Checks")
  lines.push("")
  lines.push("| Check | Status | Rows Checked | Failures | Notes |")
  lines.push("| --- | --- | ---: | ---: | --- |")
  for (const check of report.crossReferenceChecks) {
    const note =
      check.failures.length > 0
        ? check.failures
            .slice(0, 3)
            .map(failure => `${failure.sourceFile} row ${failure.rowNumber}: ${failure.field}=${failure.value}`)
            .join("<br>")
        : check.notes.join("<br>") || "None"
    lines.push(
      `| ${escapeMarkdownCell(check.label)} | ${formatStatus(check.status)} | ${check.checkedRows} | ${check.failureCount} | ${escapeMarkdownCell(note)} |`
    )
  }
  lines.push("")
  lines.push("## File Validation Details")
  lines.push("")
  lines.push("| File | Kind | Status | Rows | Missing Headers | Blank Required Values | Notes |")
  lines.push("| --- | --- | --- | ---: | --- | --- | --- |")
  for (const file of report.files) {
    const blankDetails =
      file.blankRequiredValues.length > 0
        ? file.blankRequiredValues
            .map(issue => `${issue.field} (${issue.count})`)
            .join("<br>")
        : "None"
    const noteParts = [...file.notes]
    if (!file.exists) {
      noteParts.push("File missing.")
    }
    if (file.batchSummary) {
      noteParts.push(`Batch ${file.batchSummary.batchNumber ?? "?"} / limit ${file.batchSummary.rowLimit}`)
    }
    if (file.parseErrors.length > 0) {
      noteParts.push(`Parse errors: ${file.parseErrors.join("; ")}`)
    }
    lines.push(
      `| ${escapeMarkdownCell(file.relativePath)} | ${escapeMarkdownCell(file.kind)} | ${formatStatus(file.status)} | ${file.rowCount} | ${escapeMarkdownCell(file.missingHeaders.join("<br>") || "None")} | ${escapeMarkdownCell(blankDetails)} | ${escapeMarkdownCell(noteParts.join("<br>") || "None")} |`
    )
  }
  lines.push("")
  lines.push("## Findings")
  lines.push("")

  if (report.findings.length === 0) {
    lines.push("No open findings. The package is ready for the next gate.")
  } else {
    for (const finding of report.findings) {
      lines.push(`### ${finding.id}`)
      lines.push(`- Severity: ${finding.severity}`)
      lines.push(`- Owner: ${finding.owner}`)
      lines.push(`- Area: ${finding.area}`)
      lines.push(`- Summary: ${finding.summary}`)
      lines.push(`- Evidence: ${finding.evidence}`)
      lines.push(`- Next action: ${finding.nextAction}`)
      lines.push("")
    }
  }

  lines.push("## Optional Checks")
  lines.push("")
  for (const check of report.optionalChecks) {
    lines.push(`- ${check.label}: ${check.reason}`)
  }
  lines.push("")
  lines.push("## Execution Gates")
  lines.push("")
  lines.push("| Wave | Owner | Gate | Status | Evidence |")
  lines.push("| --- | --- | --- | --- | --- |")
  for (const gate of report.executionGates) {
    lines.push(
      `| ${escapeMarkdownCell(gate.wave)} | ${escapeMarkdownCell(gate.owner)} | ${escapeMarkdownCell(gate.label)} | ${formatStatus(gate.status)} | ${escapeMarkdownCell(gate.evidence)} |`
    )
  }
  lines.push("")
  lines.push("## Reviewer Readout")
  lines.push("")
  if (blockerFindings.length > 0) {
    lines.push("The package is not ready to import. Review and clear every blocker in the defect log before the next wave.")
  } else if (warningFindings.length > 0) {
    lines.push("The package is structurally ready, but the warnings should be reviewed before wave execution.")
  } else {
    lines.push("The package is ready to proceed to the next import gate.")
  }

  if (missingFiles.length > 0) {
    lines.push("")
    lines.push("Missing files:")
    for (const file of missingFiles) {
      lines.push(`- ${file.relativePath}`)
    }
  }

  return `${lines.join("\n")}\n`
}

function renderChecklistMarkdown(report: FullImportValidationReport) {
  const blockingFindings = report.findings.filter(finding => finding.severity === "blocker")
  const gateByWave = new Map(report.executionGates.map(gate => [gate.wave, gate]))

  const lines = [
    "# 2026-04-17 Full Import Review Checklist",
    "",
    `Current package status: **${report.status === "ready" ? "READY" : "BLOCKED"}**`,
    "",
    "## Preflight",
    "",
    "| Check | Status | Evidence |",
    "| --- | --- | --- |",
    `| Source workbooks present and readable | ${formatStatus(report.sourceSheets.every(sheet => sheet.status === "pass") ? "pass" : "fail")} | ${escapeMarkdownCell(
      report.sourceSheets
        .map(sheet => `${sheet.workbook} :: ${sheet.sheet} (${sheet.rows} rows)`)
        .join("<br>")
    )} |`,
    `| Required output files present | ${formatStatus(report.requiredOutputGroups.every(group => group.status === "pass") ? "pass" : "fail")} | ${escapeMarkdownCell(
      report.requiredOutputGroups
        .filter(group => group.status !== "pass")
        .map(group => `${group.label}: ${group.missingPatterns.join(", ")}`)
        .join("<br>") || "All required output groups are present."
    )} |`,
    `| Row counts reconcile to source | ${formatStatus(report.reconciliation.every(item => item.status === "pass") ? "pass" : "fail")} | ${escapeMarkdownCell(
      report.reconciliation
        .filter(item => item.status !== "pass")
        .map(item => `${item.label}: ${item.unaccountedRows} unaccounted rows`)
        .join("<br>") || "All entity totals reconcile."
    )} |`,
    `| Cross-file references pass | ${formatStatus(report.crossReferenceChecks.every(item => item.status === "pass") ? "pass" : "fail")} | ${escapeMarkdownCell(
      report.crossReferenceChecks
        .filter(item => item.status !== "pass")
        .map(item => `${item.label}: ${item.failureCount} failures (${item.status})`)
        .join("<br>") || "All cross-file reference checks passed."
    )} |`,
    `| Human environment/reset approval captured | ${formatStatus(gateByWave.get("0")?.status ?? "not_run")} | ${escapeMarkdownCell(
      gateByWave.get("0")?.evidence ?? "Human signoff has not been captured."
    )} |`,
    "",
    "## Wave Signoff",
    "",
    "| Wave | Owner | Gate | Current Status | Reviewer Signoff |",
    "| --- | --- | --- | --- | --- |",
    `| 0 | Human + Agent C | Environment readiness confirmed | ${formatStatus(gateByWave.get("0")?.status ?? "not_run")} | Pending |`,
    `| 1 | Agent A | Canonical files and exception files generated | ${formatStatus(gateByWave.get("1")?.status ?? "fail")} | Pending |`,
    `| 2 | Agent B | Importer hardening complete | ${formatStatus(gateByWave.get("2")?.status ?? "not_run")} | Pending |`,
    `| 3 | Agent C | Dry-run readiness report clear of blockers | ${formatStatus(gateByWave.get("3")?.status ?? "fail")} | Pending |`,
    `| 4-10 | Human + team | Import waves and rerun proof | NOT RUN | Pending |`,
    "",
    "## Blocking Findings",
    "",
  ]

  if (blockingFindings.length === 0) {
    lines.push("No blockers are open.")
  } else {
    for (const finding of blockingFindings) {
      lines.push(`- ${finding.id}: ${finding.summary} Owner=${finding.owner}. Next action=${finding.nextAction}`)
    }
  }

  lines.push("")
  lines.push("## Reviewer Questions")
  lines.push("")
  lines.push("- Did the team create every required output for the current wave?")
  lines.push("- Are all exceptions explicit and categorized?")
  lines.push("- Do source, canonical, and exception totals reconcile without hidden gaps?")
  lines.push("- Can the next wave proceed without manual cleanup outside the documented steps?")
  lines.push("- Is the defect log current with severity, owner, status, and next action?")

  return `${lines.join("\n")}\n`
}

function renderDefectLogCsv(report: FullImportValidationReport) {
  const rows = [
    ["Defect ID", "Severity", "Area", "Owner", "Status", "Summary", "Evidence", "Next Action"],
    ...report.findings.map(finding => [
      finding.id,
      finding.severity,
      finding.area,
      finding.owner,
      finding.status,
      finding.summary,
      finding.evidence,
      finding.nextAction,
    ]),
  ]

  return `${rows
    .map(columns => columns.map(value => escapeCsvValue(value)).join(","))
    .join("\n")}\n`
}

export function writeFullImportReadinessOutputs(options: ReportOptions = {}) {
  const projectRoot = options.projectRoot ? path.resolve(options.projectRoot) : process.cwd()
  const report = validateFullImportFiles({ projectRoot })

  const outputs: ReportOutputPaths = {
    reportJson: path.join(projectRoot, REPORT_JSON_RELATIVE_PATH),
    reportMarkdown: path.join(projectRoot, REPORT_MARKDOWN_RELATIVE_PATH),
    checklist: path.join(projectRoot, CHECKLIST_RELATIVE_PATH),
    defectLog: path.join(projectRoot, DEFECT_LOG_RELATIVE_PATH),
  }

  fs.mkdirSync(path.join(projectRoot, PACKAGE_RELATIVE_ROOT), { recursive: true })
  fs.mkdirSync(path.dirname(outputs.checklist), { recursive: true })

  fs.writeFileSync(outputs.reportJson, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(outputs.reportMarkdown, renderMarkdown(report))
  fs.writeFileSync(outputs.checklist, renderChecklistMarkdown(report))
  fs.writeFileSync(outputs.defectLog, renderDefectLogCsv(report))

  return {
    report,
    outputs: {
      reportJson: toPosix(path.relative(projectRoot, outputs.reportJson)),
      reportMarkdown: toPosix(path.relative(projectRoot, outputs.reportMarkdown)),
      checklist: toPosix(path.relative(projectRoot, outputs.checklist)),
      defectLog: toPosix(path.relative(projectRoot, outputs.defectLog)),
    },
  }
}

function main() {
  const result = writeFullImportReadinessOutputs()
  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
