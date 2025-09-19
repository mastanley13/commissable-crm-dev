"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ListHeader } from "@/components/list-header";
import { DynamicTable, Column } from "@/components/dynamic-table";
import { useTablePreferences } from "@/hooks/useTablePreferences";
import {
  AccountCreateModal,
  AccountFormValues,
} from "@/components/account-create-modal";
import { ColumnChooserModal } from "@/components/column-chooser-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AccountDetailsModal, AccountDetail } from "@/components/account-details-modal";
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
    width: 90,
    minWidth: 80,
    maxWidth: 140,
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
  const [columnFilter, setColumnFilter] = useState<ColumnFilterState>(null);
  const [sortConfig, setSortConfig] = useState<{
    columnId: keyof AccountRow;
    direction: "asc" | "desc";
  } | null>(null);
  const [updatingAccountIds, setUpdatingAccountIds] = useState<Set<string>>(
    new Set(),
  );
  const [accountPendingDeletion, setAccountPendingDeletion] =
    useState<AccountRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showAccountDetailModal, setShowAccountDetailModal] = useState(false);
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<AccountDetail | null>(null);
  const [accountDetailLoading, setAccountDetailLoading] = useState(false);
  const [accountDetailError, setAccountDetailError] = useState<string | null>(null);

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
      columnFilterState: ColumnFilterState,
    ) => {
      let next =
        status === "active"
          ? records.filter((record) => record.active)
          : [...records];

      if (columnFilterState && columnFilterState.value.trim().length > 0) {
        const filterValue = columnFilterState.value.trim().toLowerCase();
        next = next.filter((record) => {
          const recordValue = record[columnFilterState.columnId];
          if (recordValue === undefined || recordValue === null) {
            return false;
          }
          return String(recordValue).toLowerCase().includes(filterValue);
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
    reloadAccounts(query).catch(console.error);
  };

  const handleSort = (columnId: string, direction: "asc" | "desc") => {
    setSortConfig({ columnId: columnId as keyof AccountRow, direction });
  };

  const handleRowClick = useCallback(async (account: AccountRow) => {
    setAccountDetailError(null);
    setAccountDetailLoading(true);
    setShowAccountDetailModal(true);
    try {
      const response = await fetch(`/api/accounts/${account.id}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const message = body?.error ?? "Unable to load account details";
        throw new Error(message);
      }

      const payload = await response.json();
      setSelectedAccountDetail(payload.data as AccountDetail);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Unable to load account details";
      setAccountDetailError(message);
      setSelectedAccountDetail(null);
    } finally {
      setAccountDetailLoading(false);
    }
  }, []);

  const handleCloseAccountDetails = useCallback(() => {
    setShowAccountDetailModal(false);
    setSelectedAccountDetail(null);
    setAccountDetailError(null);
  }, []);
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
  };

  const handleColumnFilter = useCallback(
    (filter: { columnId: string; value: string } | null) => {
      if (!filter || !filter.columnId) {
        setColumnFilter(null);
        setSortConfig(null);
        return;
      }

      if (!filterOptions.some((option) => option.id === filter.columnId)) {
        setColumnFilter(null);
        setSortConfig(null);
        return;
      }

      const trimmedValue = (filter.value ?? "").trim();

      setColumnFilter({
        columnId: filter.columnId as FilterableColumnKey,
        value: trimmedValue,
      });
      setSortConfig({
        columnId: filter.columnId as keyof AccountRow,
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
    setAccountPendingDeletion(account);
    setDeleteError(null);
  }, []);

  const confirmDeleteAccount = useCallback(async () => {
    if (!accountPendingDeletion) {
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    try {
      const response = await fetch(
        `/api/accounts/${accountPendingDeletion.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const message = await response
          .json()
          .then((data: any) => data?.error ?? "Failed to delete account")
          .catch(() => "Failed to delete account");
        throw new Error(message);
      }

      setAccounts((previous) =>
        previous.filter((account) => account.id !== accountPendingDeletion.id),
      );
      setAccountPendingDeletion(null);
    } catch (err) {
      console.error(err);
      setDeleteError(
        err instanceof Error ? err.message : "Unable to delete account",
      );
    } finally {
      setDeleteLoading(false);
    }
  }, [accountPendingDeletion]);

  const cancelDeleteAccount = () => {
    if (!deleteLoading) {
      setAccountPendingDeletion(null);
      setDeleteError(null);
    }
  };

  const filteredAccounts = useMemo(() => {
    const filtered = applyFilters(accounts, activeFilter, columnFilter);

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
  }, [accounts, activeFilter, columnFilter, sortConfig, applyFilters]);

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
              className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={(event) => {
                event.stopPropagation();
                requestAccountDeletion(row);
              }}
            >
              Delete
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
        onApplyColumnFilter={handleColumnFilter}
        columnFilter={
          columnFilter
            ? { columnId: columnFilter.columnId, value: columnFilter.value }
            : null
        }
        statusFilter={activeFilter}
        hasUnsavedTableChanges={hasUnsavedChanges}
        isSavingTableChanges={preferenceSaving}
        lastTableSaved={lastSaved || undefined}
        onSaveTableChanges={saveChanges}
      />

      {(error || preferenceError) && (
        <div className="px-6 text-sm text-red-600">
          {error || preferenceError}
        </div>
      )}

      <div className="flex-1 p-6 min-h-0">
        <DynamicTable
          columns={tableColumns}
          data={filteredAccounts}
          onSort={handleSort}
          onRowClick={handleRowClick}
          loading={tableLoading}
          emptyMessage="No accounts found"
          onColumnsChange={handleColumnsChange}
        />
      </div>


      <AccountDetailsModal
        isOpen={showAccountDetailModal}
        account={selectedAccountDetail}
        loading={accountDetailLoading}
        error={accountDetailError}
        onClose={handleCloseAccountDetails}
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

      <ConfirmDialog
        isOpen={accountPendingDeletion !== null}
        title="Delete Account"
        description={`Are you sure you want to delete ${accountPendingDeletion?.accountName ?? "this account"}? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteAccount}
        onCancel={cancelDeleteAccount}
        loading={deleteLoading}
        error={deleteError}
      />
    </CopyProtectionWrapper>
  );
}






