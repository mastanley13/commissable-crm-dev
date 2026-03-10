import assert from "node:assert/strict"
import test from "node:test"

import { deriveMatchWizardValidationState } from "../lib/matching/match-wizard-validation"

test("returns idle when the wizard cannot validate yet", () => {
  assert.equal(
    deriveMatchWizardValidationState({
      canValidate: false,
      validationLoading: false,
      validationUpToDate: false,
      validationError: null,
      preview: null,
    }),
    "idle",
  )
})

test("returns running while validation is in progress or pending", () => {
  assert.equal(
    deriveMatchWizardValidationState({
      canValidate: true,
      validationLoading: true,
      validationUpToDate: false,
      validationError: null,
      preview: null,
    }),
    "running",
  )

  assert.equal(
    deriveMatchWizardValidationState({
      canValidate: true,
      validationLoading: false,
      validationUpToDate: false,
      validationError: null,
      preview: null,
    }),
    "running",
  )
})

test("returns stale when an older validation result is no longer current", () => {
  assert.equal(
    deriveMatchWizardValidationState({
      canValidate: true,
      validationLoading: false,
      validationUpToDate: false,
      validationError: null,
      preview: { ok: true, issues: [] },
    }),
    "stale",
  )
})

test("returns error for a current blocking validation result even if re-validation is blocked", () => {
  assert.equal(
    deriveMatchWizardValidationState({
      canValidate: false,
      validationLoading: false,
      validationUpToDate: true,
      validationError: null,
      preview: { ok: false, issues: [{ level: "error" }] },
    }),
    "error",
  )
})

test("returns error, warning, valid, and system_error for current results", () => {
  assert.equal(
    deriveMatchWizardValidationState({
      canValidate: true,
      validationLoading: false,
      validationUpToDate: true,
      validationError: null,
      preview: { ok: false, issues: [{ level: "error" }] },
    }),
    "error",
  )

  assert.equal(
    deriveMatchWizardValidationState({
      canValidate: true,
      validationLoading: false,
      validationUpToDate: true,
      validationError: null,
      preview: { ok: true, issues: [{ level: "warning" }] },
    }),
    "warning",
  )

  assert.equal(
    deriveMatchWizardValidationState({
      canValidate: true,
      validationLoading: false,
      validationUpToDate: true,
      validationError: null,
      preview: { ok: true, issues: [] },
    }),
    "valid",
  )

  assert.equal(
    deriveMatchWizardValidationState({
      canValidate: true,
      validationLoading: false,
      validationUpToDate: false,
      validationError: "network",
      preview: { ok: true, issues: [] },
    }),
    "system_error",
  )
})
