import test from "node:test"
import assert from "node:assert/strict"

import { normalizePhoneExtension, phoneExtensionDigits, PHONE_EXTENSION_MAX_DIGITS } from "../lib/phone-extension"
import { validateContactData } from "../lib/validation"

test("normalizePhoneExtension strips to digits and enforces max length", () => {
  assert.equal(normalizePhoneExtension(undefined), null)
  assert.equal(normalizePhoneExtension(null), null)
  assert.equal(normalizePhoneExtension(""), null)
  assert.equal(normalizePhoneExtension("   "), null)
  assert.equal(normalizePhoneExtension("123"), "123")
  assert.equal(normalizePhoneExtension("Ext 123"), "123")
  assert.equal(normalizePhoneExtension("abc"), null)
  assert.equal(normalizePhoneExtension("123456789012345"), "1234567890")
})

test("phoneExtensionDigits returns only digits", () => {
  assert.equal(phoneExtensionDigits("Ext 12-3"), "123")
})

test("validateContactData flags extension with no digits or too many digits", () => {
  const base = { firstName: "A", lastName: "B", accountId: "acct_1" }

  const noDigits = validateContactData({ ...base, workPhoneExt: "abc" })
  assert.equal(noDigits.isValid, false)
  assert.ok(noDigits.errors.some(error => error.field === "Work Phone Extension"))

  const tooLong = validateContactData({ ...base, workPhoneExt: "1".repeat(PHONE_EXTENSION_MAX_DIGITS + 1) })
  assert.equal(tooLong.isValid, false)
  assert.ok(tooLong.errors.some(error => error.field === "Work Phone Extension"))

  const ok = validateContactData({ ...base, workPhoneExt: "Ext 1234" })
  assert.equal(ok.isValid, true)
})

