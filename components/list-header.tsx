"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Settings, ChevronDown, Upload, Download } from "lucide-react";
import { TableChangeNotification } from "./table-change-notification";

interface FilterColumnOption {
  id: string;
  label: string;
}

interface ListHeaderProps {
  title?: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onFilterChange?: (filter: string) => void;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  onSettingsClick?: () => void;
  filterColumns?: FilterColumnOption[];
  onApplyColumnFilter?: (
    filter: { columnId: string; value: string } | null,
  ) => void;
  columnFilter?: { columnId: string; value: string } | null;
  statusFilter?: "all" | "active";
  // Table change notification props
  hasUnsavedTableChanges?: boolean;
  isSavingTableChanges?: boolean;
  lastTableSaved?: Date;
  onSaveTableChanges?: () => void;
  // Import/Export props
  onImport?: () => void;
  onExport?: () => void;
  canImport?: boolean;
  canExport?: boolean;
}

const DEFAULT_FILTER_COLUMNS: FilterColumnOption[] = [
  { id: "accountName", label: "Account Name" },
  { id: "accountLegalName", label: "Account Legal Name" },
  { id: "accountType", label: "Account Type" },
  { id: "accountOwner", label: "Account Owner" },
  { id: "shippingCity", label: "Shipping City" },
  { id: "shippingState", label: "Shipping State" },
  { id: "shippingZip", label: "Shipping Zip" },
  { id: "shippingStreet", label: "Shipping Street" },
];

export function ListHeader({
  title,
  searchPlaceholder = "Search Here",
  onSearch,
  onFilterChange,
  showCreateButton = true,
  onCreateClick,
  onSettingsClick,
  filterColumns,
  onApplyColumnFilter,
  columnFilter,
  statusFilter,
  hasUnsavedTableChanges,
  isSavingTableChanges,
  lastTableSaved,
  onSaveTableChanges,
  onImport,
  onExport,
  canImport = false,
  canExport = false,
}: ListHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active">(
    statusFilter ?? "all",
  );
  const [selectedColumn, setSelectedColumn] = useState(
    columnFilter?.columnId ?? "",
  );
  const [filterValue, setFilterValue] = useState(columnFilter?.value ?? "");

  const columnOptions = useMemo(() => {
    if (Array.isArray(filterColumns) && filterColumns.length > 0) {
      return filterColumns;
    }
    return DEFAULT_FILTER_COLUMNS;
  }, [filterColumns]);

  useEffect(() => {
    if (statusFilter && statusFilter !== activeFilter) {
      setActiveFilter(statusFilter);
    }
  }, [statusFilter, activeFilter]);

  useEffect(() => {
    if (!columnFilter) {
      setSelectedColumn("");
      setFilterValue("");
      return;
    }

    setSelectedColumn(columnFilter.columnId);
    setFilterValue(columnFilter.value);
  }, [columnFilter]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleStatusFilterChange = (filter: "all" | "active") => {
    setActiveFilter(filter);
    onFilterChange?.(filter);
  };

  const handleApplyFilter = () => {
    if (!selectedColumn) {
      onApplyColumnFilter?.(null);
      return;
    }

    onApplyColumnFilter?.({ columnId: selectedColumn, value: filterValue });
  };

  const handleClearFilter = () => {
    setSelectedColumn("");
    setFilterValue("");
    onApplyColumnFilter?.(null);
  };

  const hasActiveColumnFilter = Boolean(columnFilter);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4 flex-1">
          {title && (
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          )}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={handleSearch}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Table Change Notification - Always show when table preferences are loaded */}
        <div className="flex items-center">
          <TableChangeNotification
            hasUnsavedChanges={hasUnsavedTableChanges || false}
            isSaving={isSavingTableChanges || false}
            lastSaved={lastTableSaved}
            onSave={onSaveTableChanges}
          />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex items-center gap-2">
            {columnOptions.length > 0 && (
              <>
                <div className="relative">
                  <select
                    value={selectedColumn}
                    onChange={(event) => setSelectedColumn(event.target.value)}
                    className="appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Filter By Column</option>
                    {columnOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                </div>

                <input
                  type="text"
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                  placeholder="Enter filter value"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                />

                <button
                  type="button"
                  onClick={handleApplyFilter}
                  className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
                >
                  Apply Filter
                </button>

                {hasActiveColumnFilter && (
                  <button
                    type="button"
                    onClick={handleClearFilter}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    Clear
                  </button>
                )}
              </>
            )}

            {canImport && onImport && (
              <button
                onClick={onImport}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                <Upload className="h-4 w-4" />
                Import
              </button>
            )}

            {canExport && onExport && (
              <button
                onClick={onExport}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            )}

            {showCreateButton && (
              <button
                onClick={onCreateClick}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                <Plus className="h-4 w-4" />
                Create New
              </button>
            )}

            <button
              type="button"
              onClick={onSettingsClick}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleStatusFilterChange("active")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeFilter === "active"
                  ? "bg-primary-100 text-primary-700 border border-primary-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => handleStatusFilterChange("all")}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                activeFilter === "all"
                  ? "bg-primary-100 text-primary-700 border border-primary-300"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              Show All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
