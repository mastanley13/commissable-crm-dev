"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Search, Settings, ChevronDown, X, Upload, Download } from "lucide-react";
import { BulkActionsGrid, type BulkActionsGridProps } from "./bulk-actions-grid";

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
  showStatusFilter?: boolean; // new: allow hiding default Active/Inactive toggle
  showColumnFilters?: boolean; // new: allow hiding column filter UI
  showCreateButton?: boolean;
  onCreateClick?: () => void;
  createButtonLabel?: string;
  onSettingsClick?: () => void;
  filterColumns?: FilterColumnOption[];
  columnFilters?: ColumnFilter[];
  onColumnFiltersChange?: (filters: ColumnFilter[]) => void;
  statusFilter?: "active" | "inactive" | "all";
  /**
   * Optional override for which status options to render.
   * Defaults to ["active", "inactive"] to preserve existing 2-state behavior.
   * Use ["active", "all", "inactive"] for 3-state Active / All / Inactive controls.
   */
  statusFilterOptions?: Array<"active" | "inactive" | "all">;
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
  compact?: boolean;
  inTab?: boolean; // When true, uses px-3 instead of px-4 to align with tabs
  bulkActions?: BulkActionsGridProps;
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
  showStatusFilter = true,
  showColumnFilters = true,
  showCreateButton = true,
  onCreateClick,
  createButtonLabel = "Create New",
  onSettingsClick,
  filterColumns,
  columnFilters,
  onColumnFiltersChange,
  statusFilter,
  statusFilterOptions,
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
  compact = false,
  inTab = false,
  bulkActions,
}: ListHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"active" | "inactive" | "all">("active");
  const [selectedColumn, setSelectedColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [activeColumnFilters, setActiveColumnFilters] = useState<ColumnFilter[]>(columnFilters ?? []);
  const [showSavedFilters, setShowSavedFilters] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState("");

  const effectiveStatusOptions: Array<"active" | "inactive" | "all"> = useMemo(() => {
    if (Array.isArray(statusFilterOptions) && statusFilterOptions.length > 0) {
      const seen = new Set<"active" | "inactive" | "all">();
      const cleaned: Array<"active" | "inactive" | "all"> = [];
      for (const value of statusFilterOptions) {
        if (!seen.has(value)) {
          seen.add(value);
          cleaned.push(value);
        }
      }
      return cleaned;
    }
    // Backwards-compatible default: 2-state Active / Show Inactive
    return ["active", "inactive"];
  }, [statusFilterOptions]);

  const columnOptions = useMemo(() => {
    if (!showColumnFilters) return [] as FilterColumnOption[];
    if (Array.isArray(filterColumns) && filterColumns.length > 0) {
      return filterColumns;
    }
    return DEFAULT_FILTER_COLUMNS;
  }, [filterColumns, showColumnFilters]);

  const columnLabelMap = useMemo(() => {
    return new Map(columnOptions.map(option => [option.id, option.label]));
  }, [columnOptions]);

  useEffect(() => {
    if (!statusFilter) return;

    if (effectiveStatusOptions.includes(statusFilter)) {
      // When the provided status is one of the configured options, track it directly.
      if (statusFilter !== activeFilter) {
        setActiveFilter(statusFilter);
      }
      return;
    }

    // Backwards compatibility: when using 2-state controls and statusFilter === "all",
    // treat it as selecting the "inactive" pill (historically used as "Show All" in some views).
    if (statusFilter === "all" && !effectiveStatusOptions.includes("all")) {
      if (activeFilter !== "inactive") {
        setActiveFilter("inactive");
      }
      return;
    }

    // Fallback: default to "active"
    if (activeFilter !== "active") {
      setActiveFilter("active");
    }
  }, [statusFilter, activeFilter, effectiveStatusOptions]);

  useEffect(() => {
    setActiveColumnFilters(columnFilters ?? []);
  }, [columnFilters]);

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleStatusFilterChange = (filter: "active" | "inactive" | "all") => {
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

  const padY = compact ? "py-1" : "py-2"
  const gap = compact ? "gap-1.5" : "gap-2"
  const stackGap = compact ? "gap-0.5" : "gap-1"
  const inputYPadding = compact ? "py-1" : "py-1.5"
  const btnPad = compact ? "px-2.5 py-1" : "px-3 py-1.5"
  const iconBtnPad = compact ? "p-1" : "p-1.5"
  const horizontalPadding = inTab ? "px-0" : "px-4"

  const renderStatusLabel = (value: "active" | "inactive" | "all") => {
    switch (value) {
      case "active":
        return "Active"
      case "inactive":
        return "Show Inactive"
      case "all":
        return "Show All"
      default:
        return value
    }
  }

  const mergedBulkActions =
    bulkActions && bulkActions.actions.length > 0
      ? {
          ...bulkActions,
          density: bulkActions.density ?? (compact || inTab ? "compact" : "default"),
        }
      : null;

  return (
    <div className={`bg-white ${horizontalPadding} ${padY}`}>
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
      )}

      <div className={`flex flex-wrap items-end ${gap}`}>
        <div className={`flex min-w-0 flex-col ${stackGap}`}>
          {pageTitle && (
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{pageTitle}</p>
          )}

          <div className={`flex flex-wrap items-center ${gap}`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={handleSearch}
                className={`w-64 rounded border border-gray-300 ${inputYPadding} pl-10 pr-4 text-sm outline-none transition-all focus:border-primary-500 focus:ring-1 focus:ring-primary-500`}
              />
            </div>
            {leftAccessory}
            {showStatusFilter && (
              <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-0.5">
                {effectiveStatusOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => handleStatusFilterChange(option)}
                    className={`${btnPad} text-sm font-medium transition-all duration-200 rounded-md ${
                      activeFilter === option
                        ? "bg-primary-600 text-white shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {renderStatusLabel(option)}
                  </button>
                ))}
              </div>
            )}

            {showCreateButton && (
              <button
                onClick={onCreateClick}
                className={`rounded bg-primary-600 ${btnPad} text-sm font-medium text-white transition-colors hover:bg-primary-700`}
              >
                {createButtonLabel}
              </button>
            )}

            {mergedBulkActions && (
              <BulkActionsGrid {...mergedBulkActions} />
            )}

            <button
              type="button"
              onClick={onSettingsClick}
              className={`rounded ${iconBtnPad} text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-600`}
              title="Column Settings"
            >
              <Settings className="h-4 w-4" />
            </button>

            {(canImport || canExport) && (
              <div className={`flex items-center ${gap}`}>
                {canImport && (
                  <button
                    type="button"
                    onClick={onImport}
                    disabled={!onImport}
                    className={`flex items-center gap-1 rounded border border-gray-300 ${compact ? 'px-2 py-0.5' : 'px-2 py-1'} text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50`}
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
                    className={`flex items-center gap-1 rounded border border-gray-300 ${compact ? 'px-2 py-0.5' : 'px-2 py-1'} text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <Download className="h-3.5 w-3.5 text-gray-500" />
                    <span>Export</span>
                  </button>
                )}
              </div>
            )}

            {showColumnFilters && columnOptions.length > 0 && (
              <>
                <div className="relative">
                  <select
                    value={selectedColumn}
                    onChange={(event) => setSelectedColumn(event.target.value)}
                    className={`appearance-none rounded border border-gray-300 bg-white px-3 ${inputYPadding} pr-8 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500`}
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
                  className={`w-40 rounded border border-gray-300 px-3 ${inputYPadding} text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500`}
                />

                <button
                  type="button"
                  onClick={handleApplyFilter}
                  disabled={!selectedColumn || !filterValue.trim()}
                  className={`rounded bg-primary-600 ${btnPad} text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Apply Filter
                </button>

                {showColumnFilters && savedFilterSets && savedFilterSets.length > 0 && (
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
                  <>
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="px-2 text-xs font-medium text-gray-600 hover:text-gray-800"
                    >
                      Clear
                    </button>
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
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* search moved to the left group */}
      </div>

      {/* Tags now render inline next to the Clear button above */}
    </div>
  );
}

export type { ColumnFilter, FilterGroup, SavedFilterSet, FilterColumnOption };
