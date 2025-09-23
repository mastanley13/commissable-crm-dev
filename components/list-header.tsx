"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Search, Plus, Settings, ChevronDown, Upload, Download, X } from "lucide-react";
import { TableChangeNotification } from "./table-change-notification";

interface FilterColumnOption {
  id: string;
  label: string;
}

interface ColumnFilter {
  columnId: string;
  value: string;
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
  columnFilters?: ColumnFilter[];
  onColumnFiltersChange?: (filters: ColumnFilter[]) => void;
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
  columnFilters,
  onColumnFiltersChange,
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
  const [selectedColumn, setSelectedColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [activeColumnFilters, setActiveColumnFilters] = useState<ColumnFilter[]>(columnFilters ?? []);

  const columnOptions = useMemo(() => {
    if (Array.isArray(filterColumns) && filterColumns.length > 0) {
      return filterColumns;
    }
    return DEFAULT_FILTER_COLUMNS;
  }, [filterColumns]);

  const columnLabelMap = useMemo(() => {
    return new Map(columnOptions.map(option => [option.id, option.label]));
  }, [columnOptions]);

  useEffect(() => {
    if (statusFilter && statusFilter !== activeFilter) {
      setActiveFilter(statusFilter);
    }
  }, [statusFilter, activeFilter]);

  useEffect(() => {
    setActiveColumnFilters(columnFilters ?? []);
  }, [columnFilters]);

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
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
      return;
    }

    const trimmedValue = filterValue.trim();

    setActiveColumnFilters(previous => {
      const withoutSelected = previous.filter(filter => filter.columnId !== selectedColumn);
      const next = trimmedValue.length > 0
        ? [...withoutSelected, { columnId: selectedColumn, value: trimmedValue }]
        : withoutSelected;

      onColumnFiltersChange?.(next);
      return next;
    });

    setSelectedColumn("");
    setFilterValue("");
  };

  const handleClearFilter = () => {
    setSelectedColumn("");
    setFilterValue("");
    setActiveColumnFilters(previous => {
      if (previous.length > 0) {
        onColumnFiltersChange?.([]);
      }
      return [];
    });
  };

  const handleRemoveFilter = (columnId: string) => {
    setActiveColumnFilters(previous => {
      const next = previous.filter(filter => filter.columnId !== columnId);
      if (next.length !== previous.length) {
        onColumnFiltersChange?.(next);
      }
      return next;
    });
  };

  const hasActiveColumnFilter = activeColumnFilters.length > 0;

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
                  <>
                    <button
                      type="button"
                      onClick={handleClearFilter}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      Clear
                    </button>
                    <div className="flex w-full flex-wrap items-center gap-2 pt-2">
                      {activeColumnFilters.map(filter => {
                        const label = columnLabelMap.get(filter.columnId) ?? filter.columnId;
                        return (
                          <span
                            key={filter.columnId}
                            className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs text-primary-700"
                          >
                            <span className="font-semibold text-primary-800">{label}</span>
                            <span className="max-w-[8rem] truncate text-primary-600">{filter.value}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFilter(filter.columnId)}
                              className="rounded-full text-primary-600 transition-colors hover:text-primary-800"
                              aria-label={`Remove ${label} filter`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </>
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








