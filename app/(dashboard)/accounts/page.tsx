"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ListHeader } from "@/components/list-header";
import { DynamicTable, Column, PaginationInfo } from "@/components/dynamic-table";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import {
  AccountCreateModal,
  AccountFormValues,
} from "@/components/account-create-modal";
import { ColumnChooserModal } from "@/components/column-chooser-modal";
import { TwoStageDeleteDialog } from "@/components/two-stage-delete-dialog";
import type { DeletionConstraint } from "@/lib/deletion";
import { CopyProtectionWrapper } from "@/components/copy-protection";
import { useToasts } from "@/components/toast";
import { AccountEditModal } from "@/components/account-edit-modal";
import { AccountBulkOwnerModal } from "@/components/account-bulk-owner-modal";
import { AccountReassignmentModal } from "@/components/account-reassignment-modal";
import { AccountBulkStatusModal } from "@/components/account-bulk-status-modal";
import { Trash2, Check } from "lucide-react";
import { isRowInactive } from "@/lib/row-state";
import { calculateMinWidth } from "@/lib/column-width-utils";
import { cn } from "@/lib/utils";
import { buildStandardBulkActions } from "@/components/standard-bulk-actions";
import { PermissionGate, RoleGate } from "@/components/auth/permission-gate";


interface AccountRow {
  id: string;
  select: boolean;
  active: boolean;
  status: string;
  accountName: string;
  accountLegalName: string;
  accountType: string;
  accountTypeId: string | null;
  accountOwner: string;
  accountOwnerId: string | null;
  accountNumber?: string;
  parentAccount?: string;
  parentAccountId?: string | null;
  shippingState: string;
  shippingCity: string;
  shippingZip: string;
  shippingStreet: string;
  shippingStreet2: string;
  shippingCountry?: string;
  billingStreet?: string;
  billingStreet2?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  industry?: string;
  websiteUrl?: string;
  description?: string;
  isDeleted: boolean;
}

type FilterableColumnKey =
  | "accountName"
  | "accountLegalName"
  | "accountType"
  | "accountOwner"
  | "accountNumber"
  | "parentAccount"
  | "industry"
  | "websiteUrl"
  | "shippingState"
  | "shippingCity"
  | "shippingZip"
  | "shippingStreet"
  | "shippingStreet2"
  | "billingStreet"
  | "billingStreet2"
  | "billingCity"
  | "billingState"
  | "billingZip"
  | "billingCountry"
  | "shippingCountry";

interface AccountOptions {
  accountTypes: Array<{ id: string; name: string }>;
  industries: Array<{ id: string; name: string }>;
  parentAccounts: Array<{ id: string; accountName: string }>;
  owners: Array<{ id: string; fullName: string }>;
}

const ACCOUNT_DEFAULT_VISIBLE_COLUMN_IDS = new Set<string>([
  "accountName",
  "accountLegalName",
  "accountType",
  "accountOwner",
  "shippingStreet",
  "shippingStreet2",
  "shippingCity",
  "shippingState",
  "shippingZip",
])

const accountColumns: Column[] = [
  {
    id: "multi-action",
    label: "Select All",
    width: 200,
    minWidth: calculateMinWidth({ label: "Select All", type: "multi-action", sortable: false }),
    maxWidth: 240,
    type: "multi-action",
    accessor: "select",
  },
  {
    id: "accountName",
    label: "Account Name",
    width: 180,
    minWidth: calculateMinWidth({ label: "Account Name", type: "text", sortable: true }),
    maxWidth: 300,
    sortable: true,
    type: "text",
    hideable: false,
    render: (value) => (
      <span className="cursor-pointer font-medium text-blue-600 hover:text-blue-800">
        {value}
      </span>
    ),
  },
  {
    id: "accountLegalName",
    label: "Account Legal Name",
    width: 180,
    minWidth: calculateMinWidth({ label: "Account Legal Name", type: "text", sortable: true }),
    maxWidth: 300,
    sortable: true,
    type: "text",
    render: (value) => (
      <span className="cursor-pointer text-blue-600 hover:text-blue-800">
        {value}
      </span>
    ),
  },
  {
    id: "accountNumber",
    label: "Account Number",
    width: 160,
    minWidth: calculateMinWidth({ label: "Account Number", type: "text", sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "accountType",
    label: "Account Type",
    width: 140,
    minWidth: calculateMinWidth({ label: "Account Type", type: "text", sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: "text",
  },
  {
    id: "accountOwner",
    label: "Account Owner",
    width: 160,
    minWidth: calculateMinWidth({ label: "Account Owner", type: "text", sortable: true }),
    maxWidth: 250,
    sortable: true,
    type: "text",
  },
  {
    id: "accountStatus",
    label: "Active (Y/N)",
    width: 140,
    minWidth: calculateMinWidth({ label: "Active (Y/N)", type: "text", sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: "text",
    hidden: true,
    accessor: "active",
    render: (_value, row: AccountRow) => (row.active ? "Yes" : "No"),
  },
  {
    id: "parentAccount",
    label: "Parent Account",
    width: 200,
    minWidth: calculateMinWidth({ label: "Parent Account", type: "text", sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "industry",
    label: "Industry",
    width: 200,
    minWidth: calculateMinWidth({ label: "Industry", type: "text", sortable: true }),
    maxWidth: 280,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "websiteUrl",
    label: "Website URL",
    width: 220,
    minWidth: calculateMinWidth({ label: "Website URL", type: "text", sortable: true }),
    maxWidth: 320,
    sortable: true,
    type: "text",
    hidden: true,
    render: (value: string) =>
      value ? (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          className="text-blue-600 hover:text-blue-800 underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {value}
        </a>
      ) : (
        ""
      ),
  },
  {
    id: "description",
    label: "Description",
    width: 260,
    minWidth: calculateMinWidth({ label: "Description", type: "text", sortable: true }),
    maxWidth: 420,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "shippingState",
    label: "Shipping State",
    width: 130,
    minWidth: calculateMinWidth({ label: "Shipping State", type: "text", sortable: true }),
    maxWidth: 180,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingCity",
    label: "Shipping City",
    width: 150,
    minWidth: calculateMinWidth({ label: "Shipping City", type: "text", sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingZip",
    label: "Shipping Zip",
    width: 130,
    minWidth: calculateMinWidth({ label: "Shipping Zip", type: "text", sortable: true }),
    maxWidth: 180,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingStreet",
    label: "Shipping Street",
    width: 220,
    minWidth: calculateMinWidth({ label: "Shipping Street", type: "text", sortable: true }),
    maxWidth: 360,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingStreet2",
    label: "Shipping Street 2",
    width: 220,
    minWidth: calculateMinWidth({ label: "Shipping Street 2", type: "text", sortable: true }),
    maxWidth: 360,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingCountry",
    label: "Shipping Country",
    width: 180,
    minWidth: calculateMinWidth({ label: "Shipping Country", type: "text", sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "billingStreet",
    label: "Billing Street",
    width: 220,
    minWidth: calculateMinWidth({ label: "Billing Street", type: "text", sortable: true }),
    maxWidth: 360,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "billingStreet2",
    label: "Billing Street 2",
    width: 220,
    minWidth: calculateMinWidth({ label: "Billing Street 2", type: "text", sortable: true }),
    maxWidth: 360,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "billingCity",
    label: "Billing City",
    width: 150,
    minWidth: calculateMinWidth({ label: "Billing City", type: "text", sortable: true }),
    maxWidth: 220,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "billingState",
    label: "Billing State",
    width: 130,
    minWidth: calculateMinWidth({ label: "Billing State", type: "text", sortable: true }),
    maxWidth: 180,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "billingZip",
    label: "Billing Zip",
    width: 130,
    minWidth: calculateMinWidth({ label: "Billing Zip", type: "text", sortable: true }),
    maxWidth: 180,
    sortable: true,
    type: "text",
    hidden: true,
  },
  {
    id: "billingCountry",
    label: "Billing Country",
    width: 180,
    minWidth: calculateMinWidth({ label: "Billing Country", type: "text", sortable: true }),
    maxWidth: 260,
    sortable: true,
    type: "text",
    hidden: true,
  },
];

const filterOptions: { id: FilterableColumnKey; label: string }[] = [
  { id: "accountName", label: "Account Name" },
  { id: "accountLegalName", label: "Account Legal Name" },
  { id: "accountType", label: "Account Type" },
  { id: "accountOwner", label: "Account Owner" },
  { id: "accountNumber", label: "Account Number" },
  { id: "parentAccount", label: "Parent Account" },
  { id: "industry", label: "Industry" },
  { id: "websiteUrl", label: "Website URL" },
  { id: "shippingCity", label: "Shipping City" },
  { id: "shippingState", label: "Shipping State" },
  { id: "shippingZip", label: "Shipping Zip" },
  { id: "shippingStreet", label: "Shipping Street" },
  { id: "shippingStreet2", label: "Shipping Street 2" },
  { id: "shippingCountry", label: "Shipping Country" },
  { id: "billingStreet", label: "Billing Street" },
  { id: "billingStreet2", label: "Billing Street 2" },
  { id: "billingCity", label: "Billing City" },
  { id: "billingState", label: "Billing State" },
  { id: "billingZip", label: "Billing Zip" },
  { id: "billingCountry", label: "Billing Country" },
];

type ColumnFilterState = {
  columnId: FilterableColumnKey;
  value: string;
} | null;

const TABLE_BOTTOM_RESERVE = 110
const TABLE_MIN_BODY_HEIGHT = 320

export default function AccountsPage() {
  const router = useRouter();
  const { showSuccess, showError, ToastContainer } = useToasts();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [accountOptions, setAccountOptions] = useState<AccountOptions | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<AccountRow[]>([]);
  const [showBulkOwnerModal, setShowBulkOwnerModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showBulkStatusModal, setShowBulkStatusModal] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'active'>('active');
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showColumnSettings, setShowColumnSettings] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState[]>([]);
  const [sortConfig, setSortConfig] = useState<{ columnId: keyof AccountRow; direction: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [updatingAccountIds, setUpdatingAccountIds] = useState<Set<string>>(new Set());
  const [accountToDelete, setAccountToDelete] = useState<AccountRow | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [accountToEdit, setAccountToEdit] = useState<AccountRow | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [accountColumnsNormalized, setAccountColumnsNormalized] = useState(false);
  const [tableBodyHeight, setTableBodyHeight] = useState<number>();
  const tableAreaNodeRef = useRef<HTMLDivElement | null>(null);
  const selectedAccountRows = useMemo(
    () => accounts.filter(account => selectedAccounts.includes(account.id)),
    [accounts, selectedAccounts]
  );

  const {
    columns: preferenceColumns,
    loading: preferenceLoading,
    error: preferenceError,
    saving: preferenceSaving,
    hasUnsavedChanges,
    lastSaved,
    handleColumnsChange,
    saveChanges,
    saveChangesOnModalClose,
  } = useTablePreferences('accounts:list', accountColumns);

  useEffect(() => {
    if (accountColumnsNormalized) {
      return;
    }
    if (preferenceLoading) {
      return;
    }
    if (!preferenceColumns || preferenceColumns.length === 0) {
      return;
    }

    const normalized = preferenceColumns.map(column => {
      if (column.id === "multi-action") {
        return column;
      }

      if (ACCOUNT_DEFAULT_VISIBLE_COLUMN_IDS.has(column.id)) {
        return column.hidden ? { ...column, hidden: false } : column;
      }

      return column.hidden === true ? column : { ...column, hidden: true };
    });

    const changed = normalized.some((column, index) => column.hidden !== preferenceColumns[index].hidden);

    if (changed) {
      handleColumnsChange(normalized);
    }

    setAccountColumnsNormalized(true);
  }, [preferenceColumns, preferenceLoading, handleColumnsChange, accountColumnsNormalized]);

  const measureTableArea = useCallback(() => {
    const node = tableAreaNodeRef.current
    if (!node || typeof window === 'undefined') {
      return
    }

    const rect = node.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
    if (viewportHeight <= 0) {
      return
    }

    const available = viewportHeight - rect.top - TABLE_BOTTOM_RESERVE
    if (!Number.isFinite(available)) {
      return
    }

    const nextHeight = Math.max(TABLE_MIN_BODY_HEIGHT, Math.floor(available))
    if (nextHeight !== tableBodyHeight) {
      setTableBodyHeight(nextHeight)
    }
  }, [tableBodyHeight])

  const tableAreaRef = useCallback(
    (node: HTMLDivElement | null) => {
      tableAreaNodeRef.current = node
      if (node) {
        window.requestAnimationFrame(() => {
          measureTableArea()
        })
      }
    },
    [measureTableArea],
  )

  useLayoutEffect(() => {
    measureTableArea()
  }, [measureTableArea])

  useEffect(() => {
    const handleResize = () => measureTableArea()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [measureTableArea])

  useEffect(() => {
    window.requestAnimationFrame(() => {
      measureTableArea()
    })
  }, [
    measureTableArea,
    accounts.length,
    selectedAccounts.length,
    loading,
    preferenceLoading,
    page,
    pageSize,
  ])

  const applyFilters = useCallback(
    (
      records: AccountRow[],
      status: "all" | "active",
      columnFilterState: ColumnFilterState[],
    ) => {
      let next =
        status === "active"
          ? records.filter((record) => record.active)
          : [...records];

      if (Array.isArray(columnFilterState) && columnFilterState.length > 0) {
        columnFilterState.forEach((filter) => {
          if (!filter) return;
          const trimmed = filter.value.trim().toLowerCase();
          if (trimmed.length === 0) {
            return;
          }

          next = next.filter((record) => {
            const recordValue = record[filter.columnId];
            if (recordValue === undefined || recordValue === null) {
              return false;
            }
            return String(recordValue).toLowerCase().includes(trimmed);
          });
        });
      }

      return next;
    },
    [],
  );

  const loadOptions = useCallback(async () => {
    try {
      const response = await fetch("/api/accounts/options", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load account options");
      }
      const data = await response.json();
      setAccountOptions(data);
    } catch (err) {
      console.error("Failed to load account options", err);
    }
  }, []);

  const reloadAccounts = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query && query.trim().length > 0) {
        params.set("q", query.trim());
      }
      const queryString = params.toString();
      const url =
        queryString.length > 0
          ? `/api/accounts?${queryString}`
          : "/api/accounts";

      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load accounts");
      }

      const payload = await response.json();
      const rows: AccountRow[] = Array.isArray(payload?.data)
        ? payload.data
        : [];

      setAccounts(rows);
      setSelectedAccounts(prev => prev.filter(id => rows.some(row => row.id === id)));
      setBulkDeleteTargets(prev => prev.filter(account => rows.some(row => row.id === account.id)));
      setError(null);
    } catch (err) {
      console.error(err);
      setAccounts([]);
      setSelectedAccounts([]);
      setBulkDeleteTargets([]);
      setError("Unable to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadAccounts().catch(console.error);
  }, [reloadAccounts]);

  useEffect(() => {
    loadOptions().catch(console.error);
  }, [loadOptions]);

  const handleSearch = (query: string) => {
    setPage(1);
    reloadAccounts(query).catch(console.error);
  };

  const handleSort = (columnId: string, direction: "asc" | "desc") => {
    setPage(1);
    setSortConfig({ columnId: columnId as keyof AccountRow, direction });
  };

  const handlePageChange = (nextPage: number) => {
    setPage(Math.max(1, nextPage));
  };

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize);
    setPage(1);
  };

  const handleRowClick = useCallback(
    (account: AccountRow) => {
      router.push(`/accounts/${account.id}`);
    },
    [router],
  );

  const handleCreateAccountClick = () => {
    setShowCreateModal(true);
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
  };

  const handleAccountSelect = useCallback((accountId: string, selected: boolean) => {
    setSelectedAccounts((previous) => {
      if (selected) {
        if (previous.includes(accountId)) {
          return previous;
        }
        return [...previous, accountId];
      }

      if (!previous.includes(accountId)) {
        return previous;
      }

      return previous.filter((id) => id !== accountId);
    });
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected) {
      setSelectedAccounts(accounts.map((account) => account.id));
      return;
    }
    setSelectedAccounts([]);
  }, [accounts]);


  const openBulkDeleteDialog = useCallback(() => {
    if (selectedAccounts.length === 0) {
      showError("No accounts selected", "Select at least one account to delete.");
      return;
    }

    const targets = accounts.filter((account) => selectedAccounts.includes(account.id));

    if (targets.length === 0) {
      showError(
        "Accounts unavailable",
        "Unable to locate the selected accounts. Refresh the page and try again."
      );
      return;
    }

    setBulkDeleteTargets(targets);
    setAccountToDelete(null);
    setShowDeleteDialog(true);
  }, [accounts, selectedAccounts, showError]);

  const handleBulkExportCsv = useCallback(() => {
    if (selectedAccounts.length === 0) {
      showError("No accounts selected", "Select at least one account to export.");
      return;
    }

    const rows = accounts.filter((account) => selectedAccounts.includes(account.id));

    if (rows.length === 0) {
      showError(
        "Accounts unavailable",
        "Unable to locate the selected accounts. Refresh the page and try again."
      );
      return;
    }

    const headers = [
      "Account Name",
      "Account Legal Name",
      "Account Type",
      "Owner",
      "Status",
      "Shipping City",
      "Shipping State",
      "Shipping Zip",
      "Shipping Street",
      "Shipping Street 2",
    ];

    const escapeCsv = (value: string | null | undefined) => {
      if (value === null || value === undefined) {
        return "";
      }

      const stringValue = String(value);
      if (stringValue.includes("\"") || stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\r")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        [
          row.accountName,
          row.accountLegalName,
          row.accountType,
          row.accountOwner,
          row.status,
          row.shippingCity,
          row.shippingState,
          row.shippingZip,
          row.shippingStreet,
          row.shippingStreet2,
        ]
          .map(escapeCsv)
          .join(","),
      ),
    ];

    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0];
    link.href = url;
    link.download = `accounts-export-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    showSuccess(
      `Exported ${rows.length} account${rows.length === 1 ? "" : "s"}`,
      "Check your downloads for the CSV file."
    );
  }, [accounts, selectedAccounts, showError, showSuccess]);

  const handleBulkOwnerUpdate = useCallback(async (ownerId: string | null) => {
    if (selectedAccounts.length === 0) {
      showError("No accounts selected", "Select at least one account to update.");
      return;
    }

    setBulkActionLoading(true);

    try {
      const outcomes = await Promise.allSettled(
        selectedAccounts.map(async (accountId) => {
          const response = await fetch(`/api/accounts/${accountId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ownerId }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || "Failed to update account owner");
          }

          return accountId;
        })
      );

      const successes: string[] = [];
      const failures: Array<{ accountId: string; message: string }> = [];

      outcomes.forEach((result, index) => {
        const accountId = selectedAccounts[index];
        if (result.status === "fulfilled") {
          successes.push(accountId);
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error";
          failures.push({ accountId, message });
        }
      });

      if (successes.length > 0) {
        const successSet = new Set(successes);
        const ownerOption = ownerId
          ? accountOptions?.owners.find((owner) => owner.id === ownerId)
          : undefined;
        const ownerName = ownerOption?.fullName ?? "";
        const toastLabel = ownerId ? ownerName || "Selected owner" : "Unassigned";

        setAccounts((previous) =>
          previous.map((account) =>
            successSet.has(account.id)
              ? {
                  ...account,
                  accountOwnerId: ownerId,
                  accountOwner: ownerId ? ownerName : "",
                }
              : account
          )
        );

        showSuccess(
          `Updated ${successes.length} account${successes.length === 1 ? "" : "s"}`,
          `New owner: ${toastLabel}.`
        );
      }

      if (failures.length > 0) {
        const nameMap = new Map(
          accounts.map((account) => [account.id, account.accountName || "Account"])
        );
        const detail = failures
          .map(({ accountId, message }) => `${nameMap.get(accountId) || "Account"}: ${message}`)
          .join("; ");
        showError("Failed to update owner for some accounts", detail);
      }

      const remaining = failures.map(({ accountId }) => accountId);
      setSelectedAccounts(remaining);
      if (failures.length === 0) {
        setShowBulkOwnerModal(false);
      }
    } catch (error) {
      console.error("Bulk owner update failed", error);
      showError(
        "Bulk owner update failed",
        error instanceof Error ? error.message : "Unable to update account owners."
      );
    } finally {
      setBulkActionLoading(false);
    }
  }, [accounts, accountOptions, selectedAccounts, showError, showSuccess]);

  const handleBulkStatusUpdate = useCallback(async (isActive: boolean) => {
    if (selectedAccounts.length === 0) {
      showError("No accounts selected", "Select at least one account to update.");
      return;
    }

    setBulkActionLoading(true);

    try {
      const outcomes = await Promise.allSettled(
        selectedAccounts.map(async (accountId) => {
          const response = await fetch(`/api/accounts/${accountId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ active: isActive }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error || "Failed to update account status");
          }

          return accountId;
        })
      );

      const successes: string[] = [];
      const failures: Array<{ accountId: string; message: string }> = [];

      outcomes.forEach((result, index) => {
        const accountId = selectedAccounts[index];
        if (result.status === "fulfilled") {
          successes.push(accountId);
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : "Unexpected error";
          failures.push({ accountId, message });
        }
      });

      if (successes.length > 0) {
        const successSet = new Set(successes);
        setAccounts((previous) =>
          previous.map((account) =>
            successSet.has(account.id)
              ? {
                  ...account,
                  active: isActive,
                  status: isActive ? "Active" : "Inactive",
                  isDeleted: !isActive,
                }
              : account
          )
        );

        const label = isActive ? "active" : "inactive";
        showSuccess(
          `Marked ${successes.length} account${successes.length === 1 ? "" : "s"} as ${label}`,
          "The Active toggle has been updated."
        );
      }

      if (failures.length > 0) {
        const nameMap = new Map(
          accounts.map((account) => [account.id, account.accountName || "Account"])
        );
        const detail = failures
          .map(({ accountId, message }) => `${nameMap.get(accountId) || "Account"}: ${message}`)
          .join("; ");
        showError("Failed to update status for some accounts", detail);
      }

      const remaining = failures.map(({ accountId }) => accountId);
      setSelectedAccounts(remaining);
      if (failures.length === 0) {
        setShowBulkStatusModal(false);
      }
    } catch (error) {
      console.error("Bulk status update failed", error);
      showError(
        "Bulk status update failed",
        error instanceof Error ? error.message : "Unable to update account status."
      );
    } finally {
      setBulkActionLoading(false);
    }
  }, [accounts, selectedAccounts, showError, showSuccess]);
  const handleSubmitNewAccount = useCallback(
    async (values: AccountFormValues) => {
      try {
        const response = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountName: values.accountName,
            accountLegalName: values.accountLegalName || undefined,
            parentAccountId: values.parentAccountId || undefined,
            accountTypeId: values.accountTypeId,
            ownerId: values.ownerId || undefined,
            industryId: values.industryId || undefined,
            websiteUrl: values.websiteUrl || undefined,
            description: values.description || undefined,
            active: values.active,
            billingSameAsShipping: values.billingSameAsShipping,
            shippingAddress: values.shippingAddress,
            billingAddress: values.billingAddress,
          }),
        });

        if (!response.ok) {
          const message = await response
            .json()
            .then((data: any) => data?.error ?? "Failed to create account")
            .catch(() => "Failed to create account");
          throw new Error(message);
        }

        const payload = await response.json();
        const newRow: AccountRow | null = payload?.data ?? null;

        if (newRow) {
          setAccounts((previous) => {
            const withoutDuplicate = previous.filter(
              (account) => account.id !== newRow.id,
            );
            return [newRow, ...withoutDuplicate];
          });
        }

        setShowCreateModal(false);
      } catch (error) {
        console.error("Failed to create account", error);
        throw error instanceof Error
          ? error
          : new Error("Failed to create account");
      }
    },
    [],
  );

  const handleStatusFilterChange = (filter: string) => {
    setActiveFilter(filter === "active" ? "active" : "all");
    setPage(1);
  };

  const handleColumnFilters = useCallback(
    (filters: { columnId: string; value: string }[]) => {
      setPage(1);
      if (!Array.isArray(filters) || filters.length === 0) {
        setColumnFilters([]);
        setSortConfig(null);
        return;
      }

      const sanitized = filters
        .filter((filter) => filterOptions.some((option) => option.id === filter.columnId))
        .map((filter) => ({
          columnId: filter.columnId as FilterableColumnKey,
          value: (filter.value ?? "").trim(),
        }))
        .filter((filter) => filter.value.length > 0);

      setColumnFilters(sanitized);

      if (sanitized.length === 0) {
        setSortConfig(null);
        return;
      }

      const lastFilter = sanitized[sanitized.length - 1];
      setSortConfig({
        columnId: lastFilter.columnId,
        direction: "desc",
      });
    },
    [],
  );

  const markAccountUpdating = useCallback(
    (accountId: string, updating: boolean) => {
      setUpdatingAccountIds((previous) => {
        const next = new Set(previous);
        if (updating) {
          next.add(accountId);
        } else {
          next.delete(accountId);
        }
        return next;
      });
    },
    [],
  );

  const handleToggleActive = useCallback(
    async (account: AccountRow, nextActive: boolean) => {
      markAccountUpdating(account.id, true);
      try {
        const response = await fetch(`/api/accounts/${account.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: nextActive }),
        });

        if (!response.ok) {
          const message = await response
            .json()
            .then((data: any) => data?.error ?? "Failed to update account")
            .catch(() => "Failed to update account");
          throw new Error(message);
        }

        const payload = await response.json();
        const updatedRow: AccountRow | null = payload?.data ?? null;

        if (updatedRow) {
          setAccounts((previous) =>
            previous.map((item) =>
              item.id === updatedRow.id ? updatedRow : item,
            ),
          );
        }
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to update account status",
        );
      } finally {
        markAccountUpdating(account.id, false);
      }
    },
    [markAccountUpdating],
  );

  const requestAccountDeletion = useCallback((account: AccountRow) => {
    setAccountToDelete(account);
    setShowDeleteDialog(true);
  }, []);

  const requestAccountEdit = useCallback((account: AccountRow) => {
    setAccountToEdit(account);
    setShowEditModal(true);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setShowEditModal(false);
    setAccountToEdit(null);
    reloadAccounts().catch(console.error);
  }, [reloadAccounts]);

  const softDeleteAccountRequest = useCallback(async (
    accountId: string,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    try {
      const url = `/api/accounts/${accountId}?stage=soft${bypassConstraints ? "&bypassConstraints=true" : ""}`;
      const response = await fetch(url, { method: "DELETE" });

      if (!response.ok) {
        let data: any = null;
        try {
          data = await response.json();
        } catch (_) {
          // ignore json parse errors
        }

        if (response.status === 409 && Array.isArray(data?.constraints)) {
          return { success: false, constraints: data.constraints as DeletionConstraint[] };
        }

        const message = typeof data?.error === "string" && data.error.length > 0
          ? data.error
          : "Failed to delete account";

        return { success: false, error: message };
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete account";
      return { success: false, error: message };
    }
  }, []);
  const deactivateAccountRequest = useCallback(async (accountId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const message = typeof data?.error === "string" && data.error.length > 0
          ? data.error
          : "Failed to deactivate account";
        return { success: false, error: message };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to deactivate account";
      return { success: false, error: message };
    }
  }, []);

  const handleSoftDelete = useCallback(async (
    accountId: string,
    bypassConstraints?: boolean
  ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
    const result = await softDeleteAccountRequest(accountId, bypassConstraints);

    if (result.success) {
      setAccounts((previous) =>
        previous.map((account) =>
          account.id === accountId
            ? { ...account, active: false, status: "Inactive", isDeleted: true }
            : account
        )
      );
      setSelectedAccounts((prev) => prev.filter((id) => id !== accountId));
      showSuccess("Account deleted", "The account has been soft deleted and can be restored if needed.");
    }

    return result;
  }, [setAccounts, setSelectedAccounts, showSuccess, softDeleteAccountRequest]);

  const executeBulkSoftDelete = useCallback(
    async (
      targets: AccountRow[],
      bypassConstraints?: boolean
    ): Promise<{ success: boolean; constraints?: DeletionConstraint[]; error?: string }> => {
      if (!targets || targets.length === 0) {
        showError("No accounts selected", "Select at least one account to delete.");
        return { success: false, error: "No accounts selected" };
      }

      setBulkActionLoading(true);

      try {
        const deactivateCandidates = targets.filter((account) => account.active);
        const deletionCandidates = targets.filter((account) => !account.active);

        const deactivatedIds: string[] = [];
        const deactivationFailures: Array<{ account: AccountRow; message: string }> = [];

        if (deactivateCandidates.length > 0) {
          const results = await Promise.allSettled(
            deactivateCandidates.map((account) => deactivateAccountRequest(account.id))
          );

          results.forEach((result, index) => {
            const account = deactivateCandidates[index];
            if (result.status === "fulfilled" && result.value.success) {
              deactivatedIds.push(account.id);
            } else {
              const message =
                result.status === "fulfilled"
                  ? result.value.error || "Failed to deactivate account"
                  : result.reason instanceof Error
                    ? result.reason.message
                    : "Failed to deactivate account";

              deactivationFailures.push({ account, message });
            }
          });

          if (deactivatedIds.length > 0) {
            const updatedAccounts = new Set(deactivatedIds);
            setAccounts((previous) =>
              previous.map((account) =>
                updatedAccounts.has(account.id)
                  ? { ...account, active: false, status: "Inactive", isDeleted: true }
                  : account
              )
            );

            showSuccess(
              `Marked ${deactivatedIds.length} account${deactivatedIds.length === 1 ? "" : "s"} inactive`,
              "Inactive accounts can be deleted if needed."
            );
          }
        }

        const softDeleteSuccessIds: string[] = [];
        const softDeleteFailures: Array<{ account: AccountRow; message: string }> = [];
        const constraintResults: Array<{ account: AccountRow; constraints: DeletionConstraint[] }> = [];

        for (const account of deletionCandidates) {
          const result = await softDeleteAccountRequest(account.id, bypassConstraints);

          if (result.success) {
            softDeleteSuccessIds.push(account.id);
          } else if (result.constraints && result.constraints.length > 0) {
            constraintResults.push({ account, constraints: result.constraints });
          } else {
            softDeleteFailures.push({
              account,
              message: result.error || "Failed to delete account",
            });
          }
        }

        if (softDeleteSuccessIds.length > 0) {
          const successSet = new Set(softDeleteSuccessIds);
          setAccounts((previous) =>
            previous.map((account) =>
              successSet.has(account.id)
                ? { ...account, active: false, status: "Inactive", isDeleted: true }
                : account
            )
          );

          showSuccess(
            `Soft deleted ${softDeleteSuccessIds.length} account${softDeleteSuccessIds.length === 1 ? "" : "s"}`,
            "Deleted accounts can be restored later if needed."
          );
        }

        const failureIds = [
          ...deactivationFailures.map(({ account }) => account.id),
          ...softDeleteFailures.map(({ account }) => account.id),
          ...constraintResults.map(({ account }) => account.id),
        ];
        const failureIdSet = new Set(failureIds);

        setSelectedAccounts((previous) => previous.filter((id) => failureIdSet.has(id)));
        setBulkDeleteTargets(targets.filter((account) => failureIdSet.has(account.id)));

        if (deactivationFailures.length > 0 || softDeleteFailures.length > 0) {
          const message = [
            ...deactivationFailures.map(({ account, message }) => `${account.accountName || "Account"}: ${message}`),
            ...softDeleteFailures.map(({ account, message }) => `${account.accountName || "Account"}: ${message}`),
          ]
            .filter(Boolean)
            .join("; ");

          if (message.length > 0) {
            showError("Bulk delete failed", message);
          }
        }

        if (constraintResults.length > 0) {
          const aggregatedConstraints = constraintResults.flatMap(({ account, constraints }) =>
            constraints.map((constraint) => ({
              ...constraint,
              message: `${account.accountName || "Account"}: ${constraint.message}`,
            }))
          );

          return { success: false, constraints: aggregatedConstraints };
        }

        if (failureIds.length > 0) {
          return { success: false, error: "Some accounts could not be deleted." };
        }

        return { success: deactivatedIds.length > 0 || softDeleteSuccessIds.length > 0 };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to delete selected accounts.";
        showError("Bulk delete failed", message);
        return { success: false, error: message };
      } finally {
        setBulkActionLoading(false);
      }
    },
    [
      deactivateAccountRequest,
      softDeleteAccountRequest,
      setAccounts,
      setBulkActionLoading,
      setBulkDeleteTargets,
      setSelectedAccounts,
      showError,
      showSuccess,
    ],
  );


  const handlePermanentDelete = useCallback(async (
    accountId: string
  ): Promise<{ success: boolean, error?: string }> => {
    try {
      const response = await fetch(`/api/accounts/${accountId}?stage=permanent`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Failed to permanently delete account" };
      }

      // Remove the account from local state
      setAccounts((previous) =>
        previous.filter((account) => account.id !== accountId)
      );

      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to permanently delete account" 
      };
    }
  }, []);

  const handleRestore = useCallback(async (
    accountId: string
  ): Promise<{ success: boolean, error?: string }> => {
    try {
      const response = await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore" })
      });

      if (!response.ok) {
        const data = await response.json();
        return { success: false, error: data.error || "Failed to restore account" };
      }

      const payload = await response.json();
      const restoredAccount = payload.data;

      if (restoredAccount) {
        // Update the account in local state
        setAccounts((previous) =>
          previous.map((account) =>
            account.id === accountId ? restoredAccount : account
          )
        );
      }

      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to restore account" 
      };
    }
  }, []);

  const closeDeleteDialog = () => {
    setShowDeleteDialog(false);
    setAccountToDelete(null);
    setBulkDeleteTargets([]);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setAccountToEdit(null);
  };

  const filteredAccounts = useMemo(() => {
    const filtered = applyFilters(accounts, activeFilter, columnFilters);

    if (!sortConfig) {
      return filtered;
    }

    const { columnId, direction } = sortConfig;

    return [...filtered].sort((a, b) => {
      const aValue = (a[columnId] ?? '').toString();
      const bValue = (b[columnId] ?? '').toString();

      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [accounts, activeFilter, columnFilters, sortConfig, applyFilters]);

  useEffect(() => {
    const total = filteredAccounts.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    } else if (page < 1 && totalPages >= 1) {
      setPage(1);
    }
  }, [filteredAccounts.length, page, pageSize]);

  const paginatedAccounts = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return filteredAccounts.slice(startIndex, startIndex + pageSize);
  }, [filteredAccounts, page, pageSize]);

  const paginationInfo: PaginationInfo = useMemo(() => {
    const total = filteredAccounts.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      page,
      pageSize,
      total,
      totalPages
    };
  }, [filteredAccounts.length, page, pageSize]);

  const tableLoading = loading || preferenceLoading;

  const tableColumns = useMemo(() => {
    return preferenceColumns.map((column) => {
      if (column.id === "multi-action") {
        return {
          ...column,
          render: (_value: unknown, row: AccountRow, index: number) => {
            const rowId = row.id;
            const checked = selectedAccounts.includes(rowId);
            const activeValue = row.active;
            const isUpdating = updatingAccountIds.has(row.id);

            return (
              <div className="flex items-center gap-2" data-disable-row-click="true">
                {/* Checkbox */}
                <label className="flex cursor-pointer items-center justify-center" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    aria-label={`Select account ${row.accountName || rowId}`}
                    onChange={() => handleAccountSelect(rowId, !checked)}
                  />
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                      checked
                        ? "border-primary-500 bg-primary-600 text-white"
                        : "border-gray-300 bg-white text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                </label>

                {/* Active Toggle - Improved */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!isUpdating) {
                      handleToggleActive(row, !row.active);
                    }
                  }}
                  className="relative inline-flex items-center cursor-pointer"
                  disabled={isUpdating}
                  title={activeValue ? "Active" : "Inactive"}
                >
                  <span
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      activeValue ? "bg-primary-600" : "bg-gray-300",
                      isUpdating ? "opacity-50" : ""
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                        activeValue ? "translate-x-5" : "translate-x-1"
                      )}
                    />
                  </span>
                </button>

                {/* Delete action - only for inactive */}
                {isRowInactive(row) && (
                  <div className="flex gap-0.5">
                    <button
                      type="button"
                      className="p-1 rounded transition-colors text-red-500 hover:text-red-700"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        requestAccountDeletion(row);
                      }}
                      aria-label="Delete account"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          },
        };
      }

      if (column.id === "active") {
        return {
          ...column,
          render: (_value: boolean, row: AccountRow) => {
            const isUpdating = updatingAccountIds.has(row.id);
            return (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!isUpdating) {
                    handleToggleActive(row, !row.active);
                  }
                }}
                className="flex items-center gap-2"
                disabled={isUpdating}
              >
                <span
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    row.active ? "bg-primary-600" : "bg-gray-300"
                  } ${isUpdating ? "opacity-60" : ""}`}
                >
                  <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-300 ease-in-out ${
                        row.active ? "translate-x-5" : "translate-x-1"
                      }`}
                  />
                </span>
                <span className="text-xs text-gray-500">
                  {isUpdating
                    ? "Updating..."
                    : row.active
                      ? "Active"
                      : "Inactive"}
                </span>
              </button>
            );
          },
        };
      }

      if (column.id === "action") {
        return {
          ...column,
          render: (_value: unknown, row: AccountRow) => {
            if (!isRowInactive(row)) return null;
            return (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="p-1 rounded transition-colors text-red-500 hover:text-red-700"
                  onClick={(event) => {
                    event.stopPropagation();
                    requestAccountDeletion(row);
                  }}
                  aria-label="Delete account"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          },
        };
      }

      return column;
    });
  }, [
    preferenceColumns,
    selectedAccounts,
    updatingAccountIds,
    handleAccountSelect,
    handleToggleActive,
    requestAccountDeletion,
  ]);

  const accountBulkActions = buildStandardBulkActions({
    selectedCount: selectedAccounts.length,
    isBusy: bulkActionLoading,
    entityLabelPlural: "accounts",
    labels: {
      delete: "Delete",
      reassign: "Reassign",
      status: "Status",
      export: "Export",
    },
    tooltips: {
      delete: (count) => `Soft delete ${count} account${count === 1 ? "" : "s"}`,
      status: (count) => `Update status for ${count} account${count === 1 ? "" : "s"}`,
      export: (count) => `Export ${count} account${count === 1 ? "" : "s"} to CSV`,
    },
    wrappers: {
      reassign: (button) => (
        <RoleGate
          roles={["ADMIN", "SALES_MGMT"]}
          fallback={
            <PermissionGate permissions={["accounts.reassign", "accounts.bulk"]}>
              {button}
            </PermissionGate>
          }
        >
          {button}
        </RoleGate>
      ),
    },
    onDelete: openBulkDeleteDialog,
    onReassign: () => setShowReassignModal(true),
    onStatus: () => setShowBulkStatusModal(true),
    onExport: handleBulkExportCsv,
  });

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
        pageTitle="ACCOUNTS LIST"
        searchPlaceholder="Search Here"
        onSearch={handleSearch}
        onFilterChange={handleStatusFilterChange}
        onCreateClick={handleCreateAccountClick}
        onSettingsClick={() => setShowColumnSettings(true)}
        filterColumns={filterOptions}
        columnFilters={columnFilters.filter((f): f is NonNullable<typeof f> => f !== null)}
        onColumnFiltersChange={handleColumnFilters}
        statusFilter={activeFilter}
        hasUnsavedTableChanges={hasUnsavedChanges}
        isSavingTableChanges={preferenceSaving}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
        bulkActions={accountBulkActions}
      />

      {(error || preferenceError) && (
        <div className="px-4 text-sm text-red-600">
          {error || preferenceError}
        </div>
      )}

      <div className="flex-1 min-h-0 p-4 pt-0 flex flex-col gap-4">
      <AccountReassignmentModal
        isOpen={showReassignModal}
        selectedAccountIds={selectedAccounts}
        selectedAccountRows={selectedAccountRows}
        onClose={() => setShowReassignModal(false)}
        onConfirm={async (data) => {
          setBulkActionLoading(true)
          try {
            const response = await fetch('/api/accounts/bulk-reassign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accountIds: selectedAccounts,
                newOwnerId: data.newOwnerId,
                assignmentRole: data.assignmentRole,
                effectiveDate: data.effectiveDate.toISOString(),
                transferCommissions: data.transferCommissions,
                notifyUsers: data.notifyUsers,
                reason: data.reason,
                commissionOption: data.commissionOption,
                houseDummyRepId: data.houseDummyRepId
              })
            })

            if (!response.ok) {
              const err = await response.json().catch(() => ({}))
              throw new Error(err?.error || 'Reassignment failed')
            }

            await reloadAccounts()
            setSelectedAccounts([])
          } finally {
            setBulkActionLoading(false)
          }
        }}
      />

        <div ref={tableAreaRef} className="flex-1 min-h-0">
          <DynamicTable
            columns={tableColumns}
            data={paginatedAccounts}
            onSort={handleSort}
            onRowClick={handleRowClick}
            loading={tableLoading}
            emptyMessage="No accounts found"
            onColumnsChange={handleColumnsChange}
            pagination={paginationInfo}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            selectedItems={selectedAccounts}
            onItemSelect={handleAccountSelect}
            onSelectAll={handleSelectAll}
            onToggle={(row, columnId, value) => {
              if (columnId === "active") {
                handleToggleActive(row as AccountRow, value);
              }
            }}
            fillContainerWidth
            autoSizeColumns={false}
            alwaysShowPagination
            maxBodyHeight={tableBodyHeight}
          />
        </div>
      </div>

      <AccountBulkOwnerModal
        isOpen={showBulkOwnerModal}
        owners={(accountOptions?.owners ?? []).map((owner) => ({
          value: owner.id,
          label: owner.fullName || "Unknown Owner",
        }))}
        onClose={() => setShowBulkOwnerModal(false)}
        onSubmit={handleBulkOwnerUpdate}
        isSubmitting={bulkActionLoading}
      />

      <AccountBulkStatusModal
        isOpen={showBulkStatusModal}
        onClose={() => setShowBulkStatusModal(false)}
        onSubmit={handleBulkStatusUpdate}
        isSubmitting={bulkActionLoading}
      />

      <AccountCreateModal
        isOpen={showCreateModal}
        onClose={handleModalClose}
        onSubmit={handleSubmitNewAccount}
      />

      <ColumnChooserModal
        isOpen={showColumnSettings}
        columns={preferenceColumns}
        onApply={handleColumnsChange}
        onClose={async () => {
          setShowColumnSettings(false)
          await saveChangesOnModalClose()
        }}
      />

      <AccountEditModal
        isOpen={showEditModal}
        onClose={closeEditModal}
        onSuccess={handleEditSuccess}
        account={accountToEdit}
      />

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Account"
        entityName={
          bulkDeleteTargets.length > 0
            ? `${bulkDeleteTargets.length} account${bulkDeleteTargets.length === 1 ? "" : "s"}`
            : accountToDelete?.accountName || "Unknown Account"
        }
        entityId={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets[0]?.id || ""
            : accountToDelete?.id || ""
        }
        multipleEntities={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.map((account) => ({
                id: account.id,
                name: account.accountName || "Unknown Account",
              }))
            : undefined
        }
        entityLabelPlural="Accounts"
        isDeleted={
          bulkDeleteTargets.length > 0
            ? bulkDeleteTargets.every((account) => !account.active)
            : accountToDelete ? !accountToDelete.active : false
        }
        onSoftDelete={handleSoftDelete}
        onBulkSoftDelete={
          bulkDeleteTargets.length > 0
            ? (entities, bypassConstraints) =>
                executeBulkSoftDelete(
                  bulkDeleteTargets.filter((account) =>
                    entities.some((entity) => entity.id === account.id)
                  ),
                  bypassConstraints
                )
            : undefined
        }
        onPermanentDelete={handlePermanentDelete}
        onRestore={handleRestore}
        userCanPermanentDelete={true} // TODO: Check user permissions
      />
      <ToastContainer />
    </CopyProtectionWrapper>
  );
}















  const selectedAccountRows = useMemo(
    () => accounts.filter(account => selectedAccounts.includes(account.id)),
    [accounts, selectedAccounts]
  );
