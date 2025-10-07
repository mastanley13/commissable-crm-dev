"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Search, Settings, ChevronDown, X, Upload, Download } from "lucide-react";

interface FilterColumnOption {
  id: string;
  label: string;
}

interface ColumnFilter {
  columnId: string;
  value: string;
  operator?: "equals" | "contains" | "starts_with" | "ends_with";
}

interface FilterGroup {
  id: string;
  logic: "AND" | "OR";
  filters: ColumnFilter[];
}

interface SavedFilterSet {
  id: string;
  name: string;
  filterGroups: FilterGroup[];
  searchQuery?: string;
}

interface ListHeaderProps {
  title?: string;
  pageTitle?: string;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onFilterChange?: (filter: string) => void;
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  onSettingsClick?: () => void;
  filterColumns?: FilterColumnOption[];
  columnFilters?: ColumnFilter[];
  onColumnFiltersChange?: (filters: ColumnFilter[]) => void;
  statusFilter?: "active" | "inactive" | "all";
  savedFilterSets?: SavedFilterSet[];
  onSaveFilterSet?: (name: string) => void;
  onLoadFilterSet?: (filterSet: SavedFilterSet) => void;
  onDeleteFilterSet?: (id: string) => void;
  onImport?: () => void;
  onExport?: () => void;
  canImport?: boolean;
  canExport?: boolean;
  leftAccessory?: ReactNode;
  hasUnsavedTableChanges?: boolean;
  isSavingTableChanges?: boolean;
  lastTableSaved?: Date;
  onSaveTableChanges?: () => Promise<void>;
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
  pageTitle,
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
  savedFilterSets,
  onSaveFilterSet,
  onLoadFilterSet,
  onDeleteFilterSet,
  onImport,
  onExport,
  canImport = false,
  canExport = false,
  leftAccessory,
  hasUnsavedTableChanges = false,
  isSavingTableChanges = false,
  lastTableSaved,
  onSaveTableChanges,
}: ListHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive">("active");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [activeColumnFilters, setActiveColumnFilters] = useState<ColumnFilter[]>(columnFilters ?? []);
  const [showSavedFilters, setShowSavedFilters] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");

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
      setActiveFilter(statusFilter === "active" ? "active" : "inactive");
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

  const handleStatusFilterChange = (filter: "active" | "inactive") => {
    setActiveFilter(filter);
    onFilterChange?.(filter);
  };

  const handleApplyFilter = () => {
    if (!selectedColumn || !filterValue.trim()) {
      return;
    }

    const trimmedValue = filterValue.trim();
    const lowerValue = trimmedValue.toLowerCase();
    const nextFilter: ColumnFilter = {
      columnId: selectedColumn,
      value: trimmedValue,
      operator: "contains",
    };

    setActiveColumnFilters(previous => {
      const exists = previous.some(filter =>
        filter.columnId === nextFilter.columnId &&
        filter.value.trim().toLowerCase() === lowerValue,
      );

      if (exists) {
        setFilterValue("");
        return previous;
      }

      const next = [...previous, nextFilter];
      onColumnFiltersChange?.(next);
      setFilterValue("");
      return next;
    });
  };

  const handleClearFilters = () => {
    setActiveColumnFilters(previous => {
      if (previous.length > 0) {
        onColumnFiltersChange?.([]);
      }
      return [];
    });
  };

  const handleRemoveColumnFilter = (columnId: string) => {
    setActiveColumnFilters(previous => {
      const next = previous.filter(filter => filter.columnId !== columnId);
      onColumnFiltersChange?.(next);
      return next;
    });
  };

  const groupedColumnFilters = useMemo(() => {
    const groups = new Map<string, { columnId: string; label: string; values: string[] }>();

    for (const filter of activeColumnFilters) {
      const key = filter.columnId;
      const label = columnLabelMap.get(filter.columnId) ?? filter.columnId;
      const entry = groups.get(key);
      const normalizedValue = filter.value.trim();

      if (!entry) {
        groups.set(key, { columnId: key, label, values: normalizedValue ? [normalizedValue] : [] });
      } else if (normalizedValue && !entry.values.includes(normalizedValue)) {
        entry.values.push(normalizedValue);
      }
    }

    return Array.from(groups.values());
  }, [activeColumnFilters, columnLabelMap]);

  const handleSaveCurrentFilters = () => {
    if (!saveFilterName.trim()) {
      return;
    }

    onSaveFilterSet?.(saveFilterName.trim());
    setSaveFilterName("");
    setShowSavedFilters(false);
  };

  const handleLoadFilterSet = (filterSet: SavedFilterSet) => {
    if (filterSet.searchQuery) {
      setSearchQuery(filterSet.searchQuery);
      onSearch?.(filterSet.searchQuery);
    }

    const flattened = filterSet.filterGroups?.flatMap(group => group.filters ?? []) ?? [];
    setActiveColumnFilters(flattened);
    onColumnFiltersChange?.(flattened);

    onLoadFilterSet?.(filterSet);
    setShowSavedFilters(false);
  };

  const handleRemoveSavedFilter = (id: string) => {
    onDeleteFilterSet?.(id);
  };

  const hasFiltersApplied = groupedColumnFilters.length > 0;

  return (
    <div className="bg-white border-b border-blue-900 px-6 py-2">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          {pageTitle && (
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{pageTitle}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {leftAccessory}
            <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-0.5">
              <button
                onClick={() => handleStatusFilterChange("active")}
                className={`px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-md ${
                  activeFilter === "active"
                    ? "bg-primary-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => handleStatusFilterChange("inactive")}
                className={`px-3 py-1.5 text-sm font-medium transition-all duration-200 rounded-md ${
                  activeFilter === "inactive"
                    ? "bg-primary-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Show Inactive
              </button>
            </div>

            {showCreateButton && (
              <button
                onClick={onCreateClick}
                className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                Create New
              </button>
            )}

            <button
              type="button"
              onClick={onSettingsClick}
              className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <Settings className="h-4 w-4" />
            </button>

            {(canImport || canExport) && (
              <div className="flex items-center gap-1">
                {canImport && (
                  <button
                    type="button"
                    onClick={onImport}
                    disabled={!onImport}
                    className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Upload className="h-3.5 w-3.5 text-gray-500" />
                    <span>Import</span>
                  </button>
                )}
                {canExport && (
                  <button
                    type="button"
                    onClick={onExport}
                    disabled={!onExport}
                    className="flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5 text-gray-500" />
                    <span>Export</span>
                  </button>
                )}
              </div>
            )}

            {columnOptions.length > 0 && (
              <>
                <div className="relative">
                  <select
                    value={selectedColumn}
                    onChange={(event) => setSelectedColumn(event.target.value)}
                    className="appearance-none rounded border border-gray-300 bg-white px-3 py-1.5 pr-8 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="">Filter By Column</option>
                    {columnOptions.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                </div>

                <input
                  type="text"
                  value={filterValue}
                  onChange={(event) => setFilterValue(event.target.value)}
                  placeholder="Enter filter value"
                  className="w-40 rounded border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                />

                <button
                  type="button"
                  onClick={handleApplyFilter}
                  disabled={!selectedColumn || !filterValue.trim()}
                  className="rounded bg-primary-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply Filter
                </button>

                {savedFilterSets && savedFilterSets.length > 0 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSavedFilters(previous => !previous)}
                      className="rounded bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
                    >
                      Saved
                    </button>
                    {showSavedFilters && (
                      <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded border border-gray-200 bg-white shadow-lg">
                        <div className="space-y-3 p-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-gray-700">Save Current Filters</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={saveFilterName}
                                onChange={(event) => setSaveFilterName(event.target.value)}
                                placeholder="Enter filter name..."
                                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
                              />
                              <button
                                type="button"
                                onClick={handleSaveCurrentFilters}
                                disabled={!saveFilterName.trim()}
                                className="rounded bg-primary-600 px-2 py-1 text-sm text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>

                          {savedFilterSets.length > 0 && (
                            <div className="border-t border-gray-200 pt-3">
                              <label className="mb-2 block text-xs font-medium text-gray-700">Load Saved Filters</label>
                              <div className="space-y-1">
                                {savedFilterSets.map(filterSet => (
                                  <div key={filterSet.id} className="flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => handleLoadFilterSet(filterSet)}
                                      className="flex-1 rounded px-2 py-1 text-left text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                      {filterSet.name}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSavedFilter(filterSet.id)}
                                      className="rounded p-1 text-red-600 hover:text-red-800"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {hasFiltersApplied && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-2 text-xs font-medium text-gray-600 hover:text-gray-800"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="relative ml-auto self-end">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={handleSearch}
            className="w-64 rounded border border-gray-300 py-1.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {hasFiltersApplied && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {groupedColumnFilters.map(group => (
            <span
              key={group.columnId}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs"
            >
              <span className="font-medium text-blue-900">{group.label}:</span>
              <span className="text-blue-700">{group.values.join(", ")}</span>
              <button
                type="button"
                onClick={() => handleRemoveColumnFilter(group.columnId)}
                className="ml-1 text-blue-600 hover:text-blue-800"
                aria-label={`Remove filter for ${group.label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export type { ColumnFilter, FilterGroup, SavedFilterSet, FilterColumnOption };
