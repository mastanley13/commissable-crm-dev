"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { DeletionConstraint } from "@/lib/deletion";
import { CopyProtectionWrapper } from "@/components/copy-protection";


interface AccountRow {
  id: string;
  active: boolean;
  accountName: string;
  accountLegalName: string;
  accountType: string;
  accountOwner: string;
  shippingState: string;
  shippingCity: string;
  shippingZip: string;
  shippingStreet: string;
  shippingStreet2: string;
}

type FilterableColumnKey =
  | "accountName"
  | "accountLegalName"
  | "accountType"
  | "accountOwner"
  | "shippingState"
  | "shippingCity"
  | "shippingZip"
  | "shippingStreet"
  | "shippingStreet2";

const accountColumns: Column[] = [
  {
    id: "active",
    label: "Active",
    width: 100,
    minWidth: 80,
    maxWidth: 140,
    type: "toggle",
    accessor: "active",
  },
  {
    id: "action",
    label: "Action",
    width: 120,
    minWidth: 100,
    maxWidth: 160,
    type: "action",
  },
  {
    id: "accountName",
    label: "Account Name",
    width: 180,
    minWidth: 120,
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
    minWidth: 120,
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
    id: "accountType",
    label: "Account Type",
    width: 140,
    minWidth: 100,
    maxWidth: 220,
    sortable: true,
    type: "text",
  },
  {
    id: "accountOwner",
    label: "Account Owner",
    width: 160,
    minWidth: 120,
    maxWidth: 250,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingState",
    label: "Shipping State",
    width: 130,
    minWidth: 100,
    maxWidth: 180,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingCity",
    label: "Shipping City",
    width: 150,
    minWidth: 110,
    maxWidth: 220,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingZip",
    label: "Shipping Zip",
    width: 130,
    minWidth: 100,
    maxWidth: 180,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingStreet",
    label: "Shipping Street",
    width: 220,
    minWidth: 180,
    maxWidth: 360,
    sortable: true,
    type: "text",
  },
  {
    id: "shippingStreet2",
    label: "Shipping Street 2",
    width: 220,
    minWidth: 180,
    maxWidth: 360,
    sortable: true,
    type: "text",
  },
];

const filterOptions: { id: FilterableColumnKey; label: string }[] = [
  { id: "accountName", label: "Account Name" },
  { id: "accountLegalName", label: "Account Legal Name" },
  { id: "accountType", label: "Account Type" },
  { id: "accountOwner", label: "Account Owner" },
  { id: "shippingCity", label: "Shipping City" },
  { id: "shippingState", label: "Shipping State" },
  { id: "shippingZip", label: "Shipping Zip" },
  { id: "shippingStreet", label: "Shipping Street" },
  { id: "shippingStreet2", label: "Shipping Street 2" },
];

type ColumnFilterState = {
  columnId: FilterableColumnKey;
  value: string;
} | null;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "active">("all");
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showColumnSettings, setShowColumnSettings] = useState<boolean>(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    columnId: keyof AccountRow;
    direction: "asc" | "desc";
  } | null>(null);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [updatingAccountIds, setUpdatingAccountIds] = useState<Set<string>>(
    new Set(),
  );
  const [accountToDelete, setAccountToDelete] = useState<AccountRow | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const router = useRouter();

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
  } = useTablePreferences("accounts:list", accountColumns);

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
      setError(null);
    } catch (err) {
      console.error(err);
      setAccounts([]);
      setError("Unable to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadAccounts().catch(console.error);
  }, [reloadAccounts]);

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

  const handleSoftDelete = useCallback(async (
    accountId: string, 
    bypassConstraints?: boolean
  ): Promise<{ success: boolean, constraints?: DeletionConstraint[], error?: string }> => {
    try {
      const url = `/api/accounts/${accountId}?stage=soft${bypassConstraints ? '&bypassConstraints=true' : ''}`;
      const response = await fetch(url, { method: "DELETE" });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409 && data.constraints) {
          return { success: false, constraints: data.constraints };
        }
        return { success: false, error: data.error || "Failed to delete account" };
      }

      // Update the account status in the local state
      setAccounts((previous) =>
        previous.map((account) =>
          account.id === accountId 
            ? { ...account, active: false }
            : account
        )
      );

      return { success: true };
    } catch (err) {
      console.error(err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : "Unable to delete account" 
      };
    }
  }, []);

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
  };

  const filteredAccounts = useMemo(() => {
    const filtered = applyFilters(accounts, activeFilter, columnFilters);

    if (!sortConfig) {
      return filtered;
    }

    const { columnId, direction } = sortConfig;

    return [...filtered].sort((a, b) => {
      const aValue = a[columnId];
      const bValue = b[columnId];

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
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
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
          render: (_value: unknown, row: AccountRow) => (
            <button
              type="button"
              className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                row.active 
                  ? "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-700"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                requestAccountDeletion(row);
              }}
            >
              {row.active ? "Delete" : "Manage"}
            </button>
          ),
        };
      }

      return column;
    });
  }, [
    preferenceColumns,
    updatingAccountIds,
    handleToggleActive,
    requestAccountDeletion,
  ]);

  return (
    <CopyProtectionWrapper className="dashboard-page-container">
      <ListHeader
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
      />

      {(error || preferenceError) && (
        <div className="px-4 text-sm text-red-600">
          {error || preferenceError}
        </div>
      )}

      <div className="flex-1 p-4 min-h-0">
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
          alwaysShowPagination
        />
      </div>

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

      <TwoStageDeleteDialog
        isOpen={showDeleteDialog}
        onClose={closeDeleteDialog}
        entity="Account"
        entityName={accountToDelete?.accountName || "Unknown Account"}
        entityId={accountToDelete?.id || ""}
        isDeleted={!accountToDelete?.active}
        onSoftDelete={handleSoftDelete}
        onPermanentDelete={handlePermanentDelete}
        onRestore={handleRestore}
        userCanPermanentDelete={true} // TODO: Check user permissions
      />
    </CopyProtectionWrapper>
  );
}










