"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useToasts } from "./toast"
import { EditableSwitch } from "./editable-field"
import { formatCurrencyDisplay, formatDecimalToFixed, formatPercentDisplay, normalizeDecimalInput } from "@/lib/number-format"
import { sortByPicklistName } from "@/lib/picklist-sort"
import { PicklistCombobox } from "./picklist-combobox"
import { SelectCombobox } from "./select-combobox"
import { DropdownChevron } from "./dropdown-chevron"
import { ModalHeader } from "./ui/modal-header"
import { AutosizeTextarea } from "./ui/autosize-textarea"

type SelectOption = { value: string; label: string }

type CatalogProductOption = {
  id: string
  name: string
  productNameHouse?: string | null
  distributorName?: string | null
  vendorName?: string | null
  distributorId?: string | null
  vendorId?: string | null
  productNameVendor?: string | null
  partNumberHouse?: string | null
  partNumberVendor?: string | null
  partNumberOther?: string | null
  productFamilyVendor?: string | null
  productSubtypeVendor?: string | null
  productFamilyHouse?: string | null
  productSubtypeHouse?: string | null
  distributorProductSubtype?: string | null
  productCode?: string | null
  revenueType?: string | null
  priceEach?: number | null
  commissionPercent?: number | null
}

type DedupeCatalogProductOption = CatalogProductOption & {
  dedupeReasons: string[]
}

interface ProductOptionsPayload {
  accounts?: SelectOption[]
  distributorAccounts?: SelectOption[]
  vendorAccounts?: SelectOption[]
  revenueTypes: SelectOption[]
}

interface ProductCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface ProductFormState {
  isActive: boolean
  distributorAccountId: string
  vendorAccountId: string
  productFamilyVendor: string
  productSubtypeVendor: string
  productNameVendor: string
  partNumberVendor: string
  productDescriptionVendor: string
  revenueType: string
  priceEach: string
  commissionPercent: string
  productNameHouse: string
  partNumberHouse: string
  productFamilyHouse: string
  productSubtypeHouse: string
  description: string
}

interface ProductFamilyOption {
  id: string
  name: string
}

interface ProductSubtypeOption {
  id: string
  name: string
  productFamilyId: string | null
  familyName: string | null
}

function getAllowedSubtypesForFamilyName(
  subtypes: ProductSubtypeOption[],
  familyIdByName: Map<string, string>,
  familyName: string
): string[] {
  const trimmedFamily = familyName.trim()
  const familyId = trimmedFamily.length > 0 ? (familyIdByName.get(trimmedFamily) ?? null) : null

  return subtypes
    .filter((subtype) => familyId == null || subtype.productFamilyId == null || subtype.productFamilyId === familyId)
    .map((subtype) => subtype.name)
}

function getPrimaryPartNumber(raw: string): string {
  return raw
    .split(/[\r\n,]+/g)
    .map((v) => v.trim())
    .filter(Boolean)[0] ?? ""
}

function normalizeForDedupe(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

function asNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const INITIAL_FORM: ProductFormState = {
  isActive: true,
  distributorAccountId: "",
  vendorAccountId: "",
  productFamilyVendor: "",
  productSubtypeVendor: "",
  productNameVendor: "",
  partNumberVendor: "",
  productDescriptionVendor: "",
  revenueType: "",
  priceEach: "",
  commissionPercent: "",
  productNameHouse: "",
  partNumberHouse: "",
  productFamilyHouse: "",
  productSubtypeHouse: "",
  description: "",
}

const labelCls = "mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500"
const inputCls =
  "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
const selectCls =
  "w-full border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
const textAreaCls =
  "min-h-[28px] w-full resize-none overflow-hidden border-b-2 border-gray-300 bg-transparent px-0 py-1.5 text-xs leading-5 focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
const columnCls = "space-y-1.5 max-w-[420px] w-full mx-auto"

export function ProductCreateModal({ isOpen, onClose, onSuccess }: ProductCreateModalProps) {
  const [form, setForm] = useState<ProductFormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [priceEachFocused, setPriceEachFocused] = useState(false)
  const [commissionPercentFocused, setCommissionPercentFocused] = useState(false)
  const [distributorAccounts, setDistributorAccounts] = useState<SelectOption[]>([])
  const [vendorAccounts, setVendorAccounts] = useState<SelectOption[]>([])
  const [revenueTypes, setRevenueTypes] = useState<SelectOption[]>([])
  const [distributorInput, setDistributorInput] = useState("")
  const [vendorInput, setVendorInput] = useState("")
  const [showDistributorDropdown, setShowDistributorDropdown] = useState(false)
  const [showVendorDropdown, setShowVendorDropdown] = useState(false)
  const [productOptions, setProductOptions] = useState<CatalogProductOption[]>([])
  const [houseFamilyOptions, setHouseFamilyOptions] = useState<string[]>([])
  const [houseProductNameOptions, setHouseProductNameOptions] = useState<string[]>([])
  const [showHouseProductDropdown, setShowHouseProductDropdown] = useState(false)
  const [dedupeExactMatch, setDedupeExactMatch] = useState<DedupeCatalogProductOption | null>(null)
  const [dedupeLikelyMatches, setDedupeLikelyMatches] = useState<DedupeCatalogProductOption[]>([])
  const { showError, showSuccess } = useToasts()
  const [masterFamilies, setMasterFamilies] = useState<ProductFamilyOption[]>([])
  const [masterSubtypes, setMasterSubtypes] = useState<ProductSubtypeOption[]>([])
  const [masterDataError, setMasterDataError] = useState<string | null>(null)


  useEffect(() => {
    if (!isOpen) return
    setForm(INITIAL_FORM)
    setErrors({})
    setDistributorInput("")
    setVendorInput("")
    setProductOptions([])
    setHouseFamilyOptions([])
    setHouseProductNameOptions([])
    setShowDistributorDropdown(false)
    setShowVendorDropdown(false)
    setShowHouseProductDropdown(false)
    setDedupeExactMatch(null)
    setDedupeLikelyMatches([])
    setMasterFamilies([])
    setMasterSubtypes([])
    setMasterDataError(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    setOptionsLoading(true)
    fetch("/api/products/options", { cache: "no-store" })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as
          | ProductOptionsPayload
          | { data?: ProductOptionsPayload; error?: string }
          | null
        if (!res.ok) throw new Error((payload as any)?.error ?? "Failed to load options")

        const distributorOptions =
          Array.isArray((payload as any)?.distributorAccounts) && (payload as any)?.distributorAccounts.length > 0
            ? (payload as any).distributorAccounts
            : Array.isArray((payload as any)?.data?.distributorAccounts)
              ? (payload as any).data.distributorAccounts
              : []

        const vendorOptions =
          Array.isArray((payload as any)?.vendorAccounts) && (payload as any)?.vendorAccounts.length > 0
            ? (payload as any).vendorAccounts
            : Array.isArray((payload as any)?.data?.vendorAccounts)
              ? (payload as any).data.vendorAccounts
              : []

        const fallbackAccounts =
          Array.isArray((payload as any)?.accounts)
            ? (payload as any).accounts
            : Array.isArray((payload as any)?.data?.accounts)
              ? (payload as any).data.accounts
              : []

        setDistributorAccounts(distributorOptions.length > 0 ? distributorOptions : fallbackAccounts)
        setVendorAccounts(vendorOptions.length > 0 ? vendorOptions : fallbackAccounts)

        const revenueTypeOptions =
          Array.isArray((payload as any)?.revenueTypes)
            ? (payload as any).revenueTypes
            : Array.isArray((payload as any)?.data?.revenueTypes)
              ? (payload as any).data.revenueTypes
              : []
        setRevenueTypes(revenueTypeOptions)
      })
      .catch((err) => {
        showError("Unable to load options", err instanceof Error ? err.message : String(err))
      })
      .finally(() => setOptionsLoading(false))
  }, [isOpen, showError])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    fetch("/api/products/master-data", { cache: "no-store" })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(payload => {
        if (cancelled) return
        setMasterDataError(null)
        const families: ProductFamilyOption[] = Array.isArray(payload?.families)
          ? payload.families
              .map((f: any): ProductFamilyOption => ({
                id: String(f.id),
                name: String(f.name ?? ""),
              }))
              .filter((f: ProductFamilyOption) => f.name.trim().length > 0)
          : []
        const subtypes: ProductSubtypeOption[] = Array.isArray(payload?.subtypes)
          ? payload.subtypes
              .map((s: any): ProductSubtypeOption => ({
                id: String(s.id),
                name: String(s.name ?? ""),
                productFamilyId: s.productFamilyId ? String(s.productFamilyId) : null,
                familyName: s.familyName ? String(s.familyName) : null,
              }))
              .filter((s: ProductSubtypeOption) => s.name.trim().length > 0)
          : []
        const sortedFamilies = sortByPicklistName(families)
        const sortedSubtypes = sortByPicklistName(subtypes)
        setMasterFamilies(sortedFamilies)
        setMasterSubtypes(sortedSubtypes)

        const houseFamilies = sortedFamilies.map(f => f.name)
        setHouseFamilyOptions(houseFamilies)
      })
      .catch((error) => {
        if (!cancelled) {
          setMasterDataError(error instanceof Error ? error.message : "Failed to load Product picklists")
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen])

  const familyIdByName = useMemo(
    () => new Map(masterFamilies.map((family) => [family.name, family.id] as const)),
    [masterFamilies]
  )

  const houseSubtypePicklist = useMemo(
    () => getAllowedSubtypesForFamilyName(masterSubtypes, familyIdByName, form.productFamilyHouse),
    [masterSubtypes, familyIdByName, form.productFamilyHouse]
  )

  const dropdownCls =
    "absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
  const optionBtnCls = "w-full px-3 py-2 text-left text-sm hover:bg-primary-50"

  const canSubmit = useMemo(() => {
    if (!form.productNameHouse.trim()) return false
    if (!form.revenueType.trim()) return false
    const price = form.priceEach.trim()
    if (price) {
      const parsed = Number(price)
      if (!Number.isFinite(parsed) || parsed < 0) return false
    }
    const pct = form.commissionPercent.trim()
    if (pct) {
      const parsed = Number(pct)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return false
    }
    return true
  }, [form])

  const handleChange = (field: keyof ProductFormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = event.target.type === "checkbox" ? (event.target as HTMLInputElement).checked : event.target.value
    setForm((prev) => ({ ...prev, [field]: value as any }))
  }

  const handleDecimalChange = (field: keyof ProductFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const normalized = normalizeDecimalInput(event.target.value)
    setForm((prev) => ({ ...prev, [field]: normalized }))
  }

  const handleDecimalBlur = (field: keyof ProductFormState) => () => {
    setForm((prev) => ({ ...prev, [field]: formatDecimalToFixed(String(prev[field] ?? "")) }))
  }

  const handleClose = useCallback(() => {
    if (loading) return
    onClose()
  }, [loading, onClose])

  const displayPriceEach = useMemo(() => {
    const raw = form.priceEach.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (priceEachFocused) {
      return raw
    }

    // When not focused, show formatted currency
    return formatCurrencyDisplay(raw, { alwaysSymbol: true })
  }, [form.priceEach, priceEachFocused])

  const displayCommissionPercent = useMemo(() => {
    const raw = form.commissionPercent.trim()
    if (!raw) return ""

    // When focused, show raw value so user can type freely
    if (commissionPercentFocused) {
      return raw
    }

    // When not focused, show formatted percent
    return formatPercentDisplay(raw, { alwaysSymbol: true })
  }, [form.commissionPercent, commissionPercentFocused])

  const fetchAccounts = useCallback(
    async (type: "Distributor" | "Vendor", query: string) => {
      const params = new URLSearchParams({ page: "1", pageSize: "25", accountType: type })
      if (query.trim()) params.set("q", query.trim())
      const res = await fetch(`/api/accounts?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) return [] as SelectOption[]
      const payload = await res.json().catch(() => null)
      const items: any[] = Array.isArray((payload as any)?.data?.accounts)
        ? (payload as any).data.accounts
        : Array.isArray((payload as any)?.data)
          ? (payload as any).data
          : []
      return items.map((a: any) => ({
        value: a.id,
        label: a.accountName || a.accountLegalName || "Account",
      }))
    },
    []
  )

  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams({ page: "1", pageSize: "25" })
    const filters: Array<{ columnId: string; value: string }> = []
    if (form.distributorAccountId) filters.push({ columnId: "distributorId", value: form.distributorAccountId })
    if (form.vendorAccountId) filters.push({ columnId: "vendorId", value: form.vendorAccountId })
    if (form.productFamilyHouse.trim()) filters.push({ columnId: "productFamilyHouse", value: form.productFamilyHouse.trim() })
    if (form.productSubtypeHouse.trim()) filters.push({ columnId: "productSubtypeHouse", value: form.productSubtypeHouse.trim() })
    if (form.productNameHouse.trim()) filters.push({ columnId: "productNameHouse", value: form.productNameHouse.trim() })
    if (filters.length > 0) params.set("filters", JSON.stringify(filters))
    const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" })
    if (!res.ok) {
      setProductOptions([])
      return
    }
    const payload = await res.json().catch(() => null)
    const items = Array.isArray(payload?.data) ? payload.data : []
    const houseNames = Array.from(
      new Set(
        items
          .map((it: any) => (it.productNameHouse || it.productNameVendor || "") as string)
          .filter((v: string) => v && v.trim().length > 0)
      )
    ) as string[]
    setHouseProductNameOptions(houseNames)
    const mapped: CatalogProductOption[] = items.map((it: any) => ({
      id: it.id,
      name: it.productNameHouse || it.productNameVendor || "Product",
      productNameHouse: it.productNameHouse ?? null,
      distributorName: it.distributorName ?? null,
      vendorName: it.vendorName ?? null,
      distributorId: it.distributorId ?? it.distributorAccountId ?? null,
      vendorId: it.vendorId ?? it.vendorAccountId ?? null,
      productNameVendor: it.productNameVendor ?? null,
      partNumberHouse: asNullableText(it.partNumberHouse),
      partNumberVendor: asNullableText(it.partNumberVendor),
      partNumberOther: asNullableText(it.partNumberOther),
      productFamilyVendor: it.productFamilyVendor ?? null,
      productSubtypeVendor: it.productSubtypeVendor ?? null,
      productFamilyHouse: it.productFamilyHouse ?? null,
      productSubtypeHouse: it.productSubtypeHouse ?? null,
      distributorProductSubtype: it.distributorProductSubtype ?? null,
      productCode: it.partNumberVendor ?? it.productCode ?? null,
      revenueType: it.revenueType ?? null,
      priceEach: typeof it.priceEach === "number" ? it.priceEach : null,
      commissionPercent: typeof it.commissionPercent === "number" ? it.commissionPercent : null,
    }))
    setProductOptions(mapped)
  }, [form.distributorAccountId, form.vendorAccountId, form.productFamilyHouse, form.productSubtypeHouse, form.productNameHouse])

  const runProductDedupe = useCallback(async (): Promise<{ exact: DedupeCatalogProductOption | null; likely: DedupeCatalogProductOption[] }> => {
    const houseName = form.productNameHouse.trim()
    const vendorName = form.productNameVendor.trim()
    const code = getPrimaryPartNumber(form.partNumberVendor)

    const effectiveName = (houseName || vendorName).slice(0, 120)
    const name = effectiveName.trim()

    if (!name && !code) {
      return { exact: null, likely: [] }
    }

    const seen = new Set<string>()
    const collected: CatalogProductOption[] = []

    const fetchByQuery = async (query: string) => {
      const q = query.trim()
      if (!q) return

      const params = new URLSearchParams({ page: "1", pageSize: "50" })
      params.set("q", q)

      const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" })
      if (!res.ok) return
      const payload = await res.json().catch(() => null)
      const items = Array.isArray(payload?.data) ? payload.data : []
      items.forEach((it: any) => {
        const id = String(it.id)
        if (seen.has(id)) return
        seen.add(id)
        collected.push({
          id: it.id,
          name: it.productNameHouse || it.productNameVendor || "Product",
          productNameHouse: it.productNameHouse ?? null,
          distributorName: it.distributorName ?? null,
          vendorName: it.vendorName ?? null,
          distributorId: it.distributorId ?? it.distributorAccountId ?? null,
          vendorId: it.vendorId ?? it.vendorAccountId ?? null,
          productNameVendor: it.productNameVendor ?? null,
          partNumberHouse: asNullableText(it.partNumberHouse),
          partNumberVendor: asNullableText(it.partNumberVendor),
          partNumberOther: asNullableText(it.partNumberOther),
          productFamilyVendor: it.productFamilyVendor ?? null,
          productSubtypeVendor: it.productSubtypeVendor ?? null,
          productFamilyHouse: it.productFamilyHouse ?? null,
          productSubtypeHouse: it.productSubtypeHouse ?? null,
          distributorProductSubtype: it.distributorProductSubtype ?? null,
          productCode: it.partNumberVendor ?? it.productCode ?? null,
          revenueType: it.revenueType ?? null,
          priceEach: typeof it.priceEach === "number" ? it.priceEach : null,
          commissionPercent: typeof it.commissionPercent === "number" ? it.commissionPercent : null,
        })
      })
    }

    if (name) {
      await fetchByQuery(name)
    }
    if (code) {
      await fetchByQuery(code)
    }

    if (collected.length === 0) {
      return { exact: null, likely: [] }
    }

    const normalizedCode = normalizeForDedupe(code)
    const normalizedName = normalizeForDedupe(name)

    const candidates: DedupeCatalogProductOption[] = collected
      .map((product) => {
        const reasons: string[] = []
        const candidateCode = normalizeForDedupe(product.productCode ?? product.partNumberVendor ?? "")
        const candidateHouseName = normalizeForDedupe(product.productNameHouse)
        const candidateVendorName = normalizeForDedupe(product.productNameVendor)

        const hasExactCode = Boolean(normalizedCode && candidateCode === normalizedCode)
        const hasExactName = Boolean(
          normalizedName && (candidateHouseName === normalizedName || candidateVendorName === normalizedName)
        )
        const hasSimilarName = Boolean(
          normalizedName &&
            !hasExactName &&
            ((candidateHouseName && (candidateHouseName.includes(normalizedName) || normalizedName.includes(candidateHouseName))) ||
              (candidateVendorName && (candidateVendorName.includes(normalizedName) || normalizedName.includes(candidateVendorName))))
        )
        const hasSimilarCode = Boolean(
          normalizedCode &&
            !hasExactCode &&
            candidateCode &&
            (candidateCode.includes(normalizedCode) || normalizedCode.includes(candidateCode))
        )

        if (hasExactName) reasons.push("Exact Product Name")
        if (hasExactCode) reasons.push("Exact Part Number")
        if (hasSimilarName) reasons.push("Similar Product Name")
        if (hasSimilarCode) reasons.push("Similar Part Number")

        return { ...product, dedupeReasons: reasons }
      })
      .filter((candidate) => candidate.dedupeReasons.length > 0)

    if (candidates.length === 0) {
      return { exact: null, likely: [] }
    }

    const exact =
      candidates.find((candidate) => candidate.dedupeReasons.includes("Exact Part Number")) ??
      candidates.find((candidate) => candidate.dedupeReasons.includes("Exact Product Name")) ??
      null

    const likely = candidates
      .filter((candidate) => candidate.id !== exact?.id)
      .sort((left, right) => right.dedupeReasons.length - left.dedupeReasons.length)

    return { exact, likely }
  }, [form.productNameHouse, form.productNameVendor, form.partNumberVendor])

  const ensureProductsLoaded = useCallback(() => {
    if (productOptions.length === 0) {
      void fetchProducts()
    }
  }, [productOptions.length, fetchProducts])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const run = async () => {
      const [d, v] = await Promise.all([fetchAccounts("Distributor", distributorInput), fetchAccounts("Vendor", vendorInput)])
      if (!cancelled) {
        if (d.length > 0) setDistributorAccounts(d)
        if (v.length > 0) setVendorAccounts(v)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [isOpen, distributorInput, vendorInput, fetchAccounts])

  useEffect(() => {
    if (!isOpen) return
    const t = setTimeout(() => {
      void fetchProducts()
    }, 200)
    return () => clearTimeout(t)
  }, [isOpen, fetchProducts])

  const applyProductOption = useCallback(
    (option: CatalogProductOption) => {
      const resolvedPartNumberVendor =
        option.partNumberVendor?.trim() ||
        option.partNumberOther?.trim() ||
        option.productCode?.trim() ||
        null
      setDistributorInput(option.distributorName || distributorInput)
      setVendorInput(option.vendorName || vendorInput)
      setForm((prev) => ({
        ...prev,
        distributorAccountId: option.distributorId ?? prev.distributorAccountId,
        vendorAccountId: option.vendorId ?? prev.vendorAccountId,
        productFamilyVendor: option.productFamilyVendor ?? prev.productFamilyVendor,
        productSubtypeVendor: option.productSubtypeVendor ?? prev.productSubtypeVendor,
        productNameVendor: option.productNameVendor ?? prev.productNameVendor,
        partNumberVendor: resolvedPartNumberVendor ?? prev.partNumberVendor,
        partNumberHouse: option.partNumberHouse ?? prev.partNumberHouse,
        productFamilyHouse: option.productFamilyHouse ?? prev.productFamilyHouse,
        productSubtypeHouse: option.productSubtypeHouse ?? prev.productSubtypeHouse,
        productNameHouse: option.name || prev.productNameHouse,
        revenueType: option.revenueType ?? prev.revenueType,
        priceEach: option.priceEach != null ? Number(option.priceEach).toFixed(2) : prev.priceEach,
        commissionPercent: option.commissionPercent != null ? Number(option.commissionPercent).toFixed(2) : prev.commissionPercent,
      }))
    },
    [distributorInput, vendorInput]
  )

  const createProduct = useCallback(async () => {
    const rawPriceEach = form.priceEach.trim()
    const priceEachValue = rawPriceEach ? Number(rawPriceEach) : null

    const rawCommission = form.commissionPercent.trim()
    let commissionPercentValue: number | null = null
    if (rawCommission) {
      const compact = rawCommission.replace(/\s+/g, "")
      const hasPercent = compact.endsWith("%")
      const normalized = hasPercent ? compact.slice(0, -1).trim() : compact
      const parsed = Number(normalized.replace(/[^0-9.-]/g, ""))
      if (Number.isFinite(parsed)) {
        commissionPercentValue =
          parsed === 0 ? 0 : !hasPercent && Math.abs(parsed) <= 1 ? parsed * 100 : parsed
      }
    }

    const derivedProductNameVendor = form.productNameVendor.trim() || form.productNameHouse.trim() || null
    const derivedProductFamilyVendor = form.productFamilyVendor.trim() || form.productFamilyHouse.trim() || null
    const derivedProductSubtypeVendor = form.productSubtypeVendor.trim() || form.productSubtypeHouse.trim() || null

    const payload = {
      isActive: Boolean(form.isActive),
      distributorAccountId: form.distributorAccountId || null,
      vendorAccountId: form.vendorAccountId || null,
      productFamilyVendor: derivedProductFamilyVendor,
      productSubtypeVendor: derivedProductSubtypeVendor,
      productNameVendor: derivedProductNameVendor,
      partNumberVendor: form.partNumberVendor.trim() || null,
      productDescriptionVendor: form.productDescriptionVendor.trim() || null,
      revenueType: form.revenueType,
      priceEach: priceEachValue,
      commissionPercent: commissionPercentValue,
      productNameHouse: form.productNameHouse.trim(),
      partNumberHouse: form.partNumberHouse.trim() || null,
      productFamilyHouse: form.productFamilyHouse.trim() || null,
      productSubtypeHouse: form.productSubtypeHouse.trim() || null,
      description: form.description.trim() || null,
    }

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      const serverErrors = (body?.errors ?? {}) as Record<string, string>
      setErrors(serverErrors)
      if (body?.code === "PRODUCT_EXACT_DUPLICATE") {
        const duplicate = body?.duplicate
        if (duplicate && typeof duplicate === "object") {
          setDedupeExactMatch({
            id: String((duplicate as any).id ?? ""),
            name: String((duplicate as any).productNameHouse ?? (duplicate as any).productNameVendor ?? "Product"),
            productNameHouse: (duplicate as any).productNameHouse ?? null,
            productNameVendor: (duplicate as any).productNameVendor ?? null,
            vendorName: (duplicate as any).vendorName ?? null,
            distributorName: (duplicate as any).distributorName ?? null,
            productFamilyVendor: (duplicate as any).productFamilyVendor ?? null,
            partNumberVendor: (duplicate as any).partNumberVendor ?? null,
            productCode: (duplicate as any).partNumberVendor ?? (duplicate as any).productCode ?? null,
            dedupeReasons: Array.isArray(body?.matchReasons)
              ? body.matchReasons.filter((value: unknown) => typeof value === "string")
              : ["Exact duplicate"],
          })
          setDedupeLikelyMatches([])
        }
        showError(
          "Existing product found",
          body?.error ??
            "We found a product with the same Product Name or Other - Part Number. Use the existing product from the catalog or cancel to avoid duplicates."
        )
        return
      }
      throw new Error(body?.error ?? "Failed to create product")
    }

    showSuccess("Product created", "The product has been added.")
    onSuccess()
    onClose()
  }, [form, onClose, onSuccess, showError, showSuccess])

  const submitWithDedupeCheck = useCallback(
    async (allowLikelyDuplicates: boolean) => {
      if (!canSubmit) return

      setLoading(true)
      setErrors({})

      try {
        const { exact, likely } = await runProductDedupe()
        setDedupeExactMatch(exact)
        setDedupeLikelyMatches(likely)

        if (exact) {
          showError(
            "Existing product found",
            "We found a product with the same Product Name or Other - Part Number. Use the existing product from the catalog or cancel to avoid duplicates."
          )
          return
        }
        if (!allowLikelyDuplicates && likely.length > 0) {
          showError(
            "Possible duplicates found",
            "We found similar products based on Product Name or Other - Part Number. Review the matches, choose one to use, or cancel."
          )
          return
        }

        await createProduct()
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create product"
        showError("Unable to create product", message)
      } finally {
        setLoading(false)
      }
    },
    [canSubmit, createProduct, runProductDedupe, showError]
  )

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      void submitWithDedupeCheck(false)
    },
    [submitWithDedupeCheck]
  )

  const handleProceedAnyway = useCallback(() => {
    void submitWithDedupeCheck(true)
  }, [submitWithDedupeCheck])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 px-4 backdrop-blur-sm">
      <div className="w-[1024px] max-w-5xl h-[900px] max-h-[98vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <ModalHeader kicker="Create Product" title="Create New Product" />

        <form id="product-create-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-3">
          <div className="space-y-3">
            {false && dedupeExactMatch && (
              <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="font-semibold text-amber-900">Existing product found</div>
                <div className="mt-1">
                  A product with the same Product Name or Other - Part Number already exists. Review it in the catalog and use the existing product instead of creating a duplicate, or cancel.
                </div>
                <div className="mt-2">
                  <div className="font-medium text-gray-900">{dedupeExactMatch.name}</div>
                  <div className="text-gray-700">
                    {[dedupeExactMatch.productCode, dedupeExactMatch.vendorName, dedupeExactMatch.productFamilyVendor]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-amber-300 px-3 py-1.5 font-semibold text-amber-800 hover:bg-amber-100"
                    onClick={() => { setDedupeExactMatch(null); setDedupeLikelyMatches([]) }}
                    disabled={loading}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {false && dedupeLikelyMatches.length > 0 && (
              <div className="mb-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                <div className="font-semibold text-yellow-900">Possible duplicates</div>
                <div className="mt-1">
                  We found similar products based on Product Name or Other - Part Number. Review them before creating a new one, choose an existing product to use, or cancel.
                </div>
                <div className="mt-2 space-y-2">
                  {dedupeLikelyMatches.map((match) => (
                    <div key={match.id} className="rounded-md border border-yellow-100 bg-white/70 px-3 py-2">
                      <div className="font-semibold text-gray-900">{match.name}</div>
                      <div className="text-gray-700">
                        {[match.productCode, match.vendorName, match.productFamilyVendor].filter(Boolean).join(" • ")}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-primary-600 px-3 py-1.5 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
                    onClick={handleProceedAnyway}
                    disabled={loading}
                  >
                    Proceed anyway
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-yellow-300 px-3 py-1.5 font-semibold text-yellow-800 hover:bg-yellow-100"
                    onClick={() => setDedupeLikelyMatches([])}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(dedupeExactMatch || dedupeLikelyMatches.length > 0) && (
              <div className="mb-3 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-yellow-900">
                    Duplicate check results ({dedupeExactMatch ? 1 : 0} exact, {dedupeLikelyMatches.length} possible)
                  </div>
                  <div className="relative shrink-0 group">
                    <button
                      type="button"
                      aria-label="How duplicate checks work"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-yellow-300 bg-white font-semibold text-yellow-800 hover:bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    >
                      i
                    </button>
                    <div className="pointer-events-none absolute right-0 top-6 z-20 hidden w-72 rounded-md border border-yellow-300 bg-white p-2 text-[11px] leading-4 text-yellow-900 shadow-md group-hover:block group-focus-within:block">
                      Save checks Product Name and Other - Part Number against existing active products. Exact matches are blocked. Similar matches are warnings, and Proceed anyway still creates the product.
                    </div>
                  </div>
                </div>

                {dedupeExactMatch ? (
                  <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
                    <div className="font-semibold text-amber-900">Existing product found</div>
                    <div className="mt-1">
                      A product with the same Product Name or Other - Part Number already exists. Review it in the catalog and use the existing product instead of creating a duplicate, or cancel.
                    </div>
                    {dedupeExactMatch.dedupeReasons.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {dedupeExactMatch.dedupeReasons.map((reason) => (
                          <span
                            key={`exact-reason-${reason}`}
                            className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2">
                      <div className="font-medium text-gray-900">{dedupeExactMatch.name}</div>
                      <div className="text-gray-700">
                        {[dedupeExactMatch.productCode, dedupeExactMatch.vendorName, dedupeExactMatch.productFamilyVendor]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    </div>
                  </div>
                ) : null}

                {dedupeLikelyMatches.length > 0 ? (
                  <div className={dedupeExactMatch ? "mt-3" : "mt-1"}>
                    <div className="font-semibold text-yellow-900">Possible duplicates</div>
                    <div className="mt-1">
                      We found similar products based on Product Name or Other - Part Number. Review them before creating a new one, choose an existing product to use, or cancel.
                    </div>
                    <div className="mt-2 space-y-2">
                      {dedupeLikelyMatches.map((match) => (
                        <div key={match.id} className="rounded-md border border-yellow-100 bg-white/70 px-3 py-2">
                          <div className="font-semibold text-gray-900">{match.name}</div>
                          {match.dedupeReasons.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {match.dedupeReasons.map((reason) => (
                                <span
                                  key={`${match.id}-${reason}`}
                                  className="inline-flex items-center rounded-full border border-yellow-300 bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-900"
                                >
                                  {reason}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="text-gray-700">
                            {[match.productCode, match.vendorName, match.productFamilyVendor].filter(Boolean).join(" • ")}
                          </div>
                          <div className="mt-2">
                            <button
                              type="button"
                              className="rounded-md border border-yellow-300 px-2.5 py-1 text-[11px] font-semibold text-yellow-800 hover:bg-yellow-100"
                              onClick={() => {
                                applyProductOption(match)
                                setDedupeExactMatch(null)
                                setDedupeLikelyMatches([])
                                showSuccess("Existing product selected", "We applied the selected product details to this form.")
                              }}
                              disabled={loading}
                            >
                              Use this product
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex gap-2">
                  {!dedupeExactMatch && dedupeLikelyMatches.length > 0 ? (
                    <button
                      type="button"
                      className="rounded-md bg-primary-600 px-3 py-1.5 font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
                      onClick={handleProceedAnyway}
                      disabled={loading}
                    >
                      Proceed anyway
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-md border border-yellow-300 px-3 py-1.5 font-semibold text-yellow-800 hover:bg-yellow-100"
                    onClick={() => {
                      setDedupeExactMatch(null)
                      setDedupeLikelyMatches([])
                    }}
                    disabled={loading}
                  >
                    {dedupeExactMatch ? "Dismiss" : "Cancel"}
                  </button>
                </div>
              </div>
            )}

            {masterDataError ? (
              <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                Unable to load Product Family/Subtype picklists from Data Settings. These dropdowns may be unavailable
                until the issue is resolved.
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
              {/* Left Column (House + Account assignments) */}
              <div className={columnCls}>
                <div className="space-y-1">
                  <div className="relative">
                    <span className="absolute -left-6 top-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-[9px] font-bold text-primary-700">1</span>
                    <label className={labelCls}>Distributor Name</label>
                  </div>
                  <div className="relative">
                    <input
                      value={distributorInput}
                      onChange={(e) => {
                        setDistributorInput(e.target.value)
                        setForm((prev) => ({ ...prev, distributorAccountId: "" }))
                        setShowDistributorDropdown(true)
                      }}
                      onFocus={() => setShowDistributorDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDistributorDropdown(false), 200)}
                      placeholder="Type or select distributor"
                      className={`${inputCls} pr-8`}
                    />
                    <DropdownChevron open={showDistributorDropdown} />
                    {showDistributorDropdown && distributorAccounts.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {distributorAccounts
                          .filter((opt) => opt.label.toLowerCase().includes(distributorInput.toLowerCase()))
                          .map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                              onClick={() => {
                                setDistributorInput(opt.label)
                                setForm((prev) => ({ ...prev, distributorAccountId: opt.value }))
                                setShowDistributorDropdown(false)
                              }}
                            >
                              <div className="font-medium text-gray-900">{opt.label}</div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <span className="absolute -left-6 top-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-[9px] font-bold text-primary-700">2</span>
                    <label className={labelCls}>Vendor Name</label>
                  </div>
                  <div className="relative">
                    <input
                      value={vendorInput}
                      onChange={(e) => {
                        setVendorInput(e.target.value)
                        setForm((prev) => ({ ...prev, vendorAccountId: "" }))
                        setShowVendorDropdown(true)
                      }}
                      onFocus={() => setShowVendorDropdown(true)}
                      onBlur={() => setTimeout(() => setShowVendorDropdown(false), 200)}
                      placeholder="Type or select vendor"
                      className={`${inputCls} pr-8`}
                    />
                    <DropdownChevron open={showVendorDropdown} />
                    {showVendorDropdown && vendorAccounts.length > 0 && (
                      <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {vendorAccounts
                          .filter((opt) => opt.label.toLowerCase().includes(vendorInput.toLowerCase()))
                          .map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                              onClick={() => {
                                setVendorInput(opt.label)
                                setForm((prev) => ({ ...prev, vendorAccountId: opt.value }))
                                setShowVendorDropdown(false)
                              }}
                            >
                              <div className="font-medium text-gray-900">{opt.label}</div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <span className="absolute -left-6 top-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-[9px] font-bold text-primary-700">3</span>
                    <label className={labelCls}>House - Product Family</label>
                  </div>
                  <div className="relative">
                    <PicklistCombobox
                      value={form.productFamilyHouse}
                      options={houseFamilyOptions}
                      placeholder="Search or pick a family"
                      disabled={houseFamilyOptions.length === 0}
                      inputClassName={inputCls}
                      dropdownClassName={dropdownCls}
                      optionClassName={optionBtnCls}
                      onChange={(nextFamily) => {
                        setForm((prev) => {
                          const allowedSubtypes = getAllowedSubtypesForFamilyName(
                            masterSubtypes,
                            familyIdByName,
                            nextFamily
                          )
                          const currentSubtype = prev.productSubtypeHouse
                          const keepSubtype = !currentSubtype || allowedSubtypes.includes(currentSubtype)
                          return {
                            ...prev,
                            productFamilyHouse: nextFamily,
                            productSubtypeHouse: nextFamily ? (keepSubtype ? currentSubtype : "") : "",
                          }
                        })
                      }}
                    />
                  </div>
                  {errors.productFamilyHouse ? (
                    <p className="text-[11px] text-rose-600">{errors.productFamilyHouse}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <span className="absolute -left-6 top-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-[9px] font-bold text-primary-700">4</span>
                    <label className={labelCls}>House - Product Subtype</label>
                  </div>
                  <div className="relative">
                    <PicklistCombobox
                      value={form.productSubtypeHouse}
                      options={houseSubtypePicklist}
                      placeholder="Search or pick a subtype"
                      disabled={!form.productFamilyHouse.trim() || houseSubtypePicklist.length === 0}
                      inputClassName={inputCls}
                      dropdownClassName={dropdownCls}
                      optionClassName={optionBtnCls}
                      onChange={(nextSubtype) => setForm((prev) => ({ ...prev, productSubtypeHouse: nextSubtype }))}
                    />
                  </div>
                  {errors.productSubtypeHouse ? (
                    <p className="text-[11px] text-rose-600">{errors.productSubtypeHouse}</p>
                  ) : null}
                </div>

                <div className="space-y-1">
                  <div className="relative">
                    <span className="absolute -left-6 top-0 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-100 text-[9px] font-bold text-primary-700">5</span>
                    <label className={labelCls}>House - Product Name</label>
                  </div>
                  <div className="relative">
                    <input
                      className={inputCls}
                      value={form.productNameHouse}
                      onChange={(e) => {
                        handleChange("productNameHouse")(e)
                        setShowHouseProductDropdown(true)
                      }}
                      onFocus={() => {
                        setShowHouseProductDropdown(true)
                        ensureProductsLoaded()
                      }}
                      onBlur={() => setTimeout(() => setShowHouseProductDropdown(false), 200)}
                      placeholder="Enter product name"
                      disabled={!form.productFamilyHouse.trim()}
                    />
                    {showHouseProductDropdown && form.productFamilyHouse.trim() && (
                      <div className="absolute z-10 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {houseProductNameOptions
                          .filter((name) => name.toLowerCase().includes((form.productNameHouse || "").toLowerCase()))
                          .map((name) => (
                            <button
                              key={name}
                              type="button"
                              className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50"
                              onClick={() => {
                                setForm((prev) => ({ ...prev, productNameHouse: name }))
                                const lower = name.toLowerCase()
                                const matched = productOptions.find((opt) => {
                                  const houseName = (opt.productNameHouse || "").toLowerCase()
                                  const displayName = (opt.name || "").toLowerCase()
                                  return houseName === lower || displayName === lower
                                })
                                if (matched) {
                                  applyProductOption(matched)
                                }
                                setShowHouseProductDropdown(false)
                              }}
                            >
                              <div className="font-medium text-gray-900">{name}</div>
                            </button>
                          ))}
                        {houseProductNameOptions.length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-500">No house product names yet. Keep typing to add one.</div>
                        )}
                      </div>
                    )}
                  </div>
                  {errors.productNameHouse ? <p className="text-[11px] text-rose-600">{errors.productNameHouse}</p> : null}
                </div>

              </div>

              {/* Right Column (Financial + Status) */}
              <div className={columnCls}>
                <div className="space-y-1">
                  <label className={labelCls}>Price Each</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={inputCls}
                    value={displayPriceEach}
                    onChange={handleDecimalChange("priceEach")}
                    onFocus={() => setPriceEachFocused(true)}
                    onBlur={() => {
                      setPriceEachFocused(false)
                      handleDecimalBlur("priceEach")()
                    }}
                    placeholder="$0.00"
                  />
                  {errors.priceEach ? <p className="text-[11px] text-rose-600">{errors.priceEach}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Expected Commission Rate %</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={inputCls}
                    value={displayCommissionPercent}
                    onChange={handleDecimalChange("commissionPercent")}
                    onFocus={() => setCommissionPercentFocused(true)}
                    onBlur={() => {
                      setCommissionPercentFocused(false)
                      handleDecimalBlur("commissionPercent")()
                    }}
                    placeholder="Enter commission rate %"
                  />
                  {errors.commissionPercent ? <p className="text-[11px] text-rose-600">{errors.commissionPercent}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Revenue Type</label>
                  <SelectCombobox
                    value={form.revenueType}
                    options={revenueTypes}
                    placeholder="Select revenue type"
                    disabled={revenueTypes.length === 0}
                    inputClassName={inputCls}
                    dropdownClassName={dropdownCls}
                    optionClassName={optionBtnCls}
                    onChange={(next) => setForm((prev) => ({ ...prev, revenueType: next }))}
                  />
                  {errors.revenueType ? <p className="text-[11px] text-rose-600">{errors.revenueType}</p> : null}
                </div>

                <div className="space-y-1">
                  <label className={labelCls}>Status</label>
                  <div className="flex items-center gap-3 py-1.5">
                    <EditableSwitch checked={form.isActive} onChange={handleChange("isActive") as any} />
                    <span className="text-xs font-semibold text-gray-600">{form.isActive ? "Active" : "Inactive"}</span>
                  </div>
                </div>

                {/* Combined field spanning two rows to align with Product Family + Product Subtype */}
                <div className="space-y-1">
                  <label className={labelCls}>House - Description</label>
                  <AutosizeTextarea
                    maxHeight={180}
                    className={textAreaCls}
                    value={form.description}
                    onChange={handleChange("description")}
                    placeholder="Add description"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-gray-300 pt-6">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className={columnCls}>
                  <div className="space-y-1">
                    <label className={labelCls}>House - Part Number</label>
                    <input className={inputCls} value={form.partNumberHouse} onChange={handleChange("partNumberHouse")} placeholder="Enter house part #" />
                  </div>
                </div>

                <div className={columnCls}>
                  <div className="space-y-1">
                    <label className={labelCls}>Other - Product Name</label>
                    <input
                      className={inputCls}
                      value={form.productNameVendor}
                      onChange={handleChange("productNameVendor")}
                      placeholder="Enter other product name"
                    />
                  </div>
                </div>

                <div className={columnCls}>
                  <div className="space-y-1">
                    <label className={labelCls}>Other - Part Number</label>
                    <input
                      className={inputCls}
                      value={form.partNumberVendor}
                      onChange={handleChange("partNumberVendor")}
                      placeholder="Enter other part number(s)"
                    />
                    {errors.partNumberVendor || errors.productCode ? (
                      <p className="text-[11px] text-rose-600">{errors.partNumberVendor ?? errors.productCode}</p>
                    ) : null}
                    <p className="text-[11px] text-gray-500">Comma/newline separated aliases used by vendors.</p>
                  </div>
                </div>

                <div className={columnCls}>
                  <div className="space-y-1">
                    <label className={labelCls}>Other - Product Description</label>
                    <AutosizeTextarea
                      maxHeight={180}
                      className={textAreaCls}
                      value={form.productDescriptionVendor}
                      onChange={handleChange("productDescriptionVendor")}
                      placeholder="Add other description"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="product-create-form"
            disabled={!canSubmit || loading || optionsLoading}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  )
}
