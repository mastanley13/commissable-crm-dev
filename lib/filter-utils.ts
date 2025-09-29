import type { ColumnFilter } from "@/components/list-header";

function normalizeFilterKey(filter: ColumnFilter) {
  const operator = (filter.operator ?? "contains").toLowerCase();
  const value = (filter.value ?? "").trim().toLowerCase();
  return `${filter.columnId}::${operator}::${value}`;
}

function applyFilter(value: unknown, filter: ColumnFilter): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  const stringValue = String(value).toLowerCase();
  const filterValue = (filter.value ?? "").toLowerCase();

  if (filterValue.length === 0) {
    return false;
  }

  switch (filter.operator) {
    case "equals":
      return stringValue === filterValue;
    case "starts_with":
      return stringValue.startsWith(filterValue);
    case "ends_with":
      return stringValue.endsWith(filterValue);
    case "contains":
    default:
      return stringValue.includes(filterValue);
  }
}

export function dedupeColumnFilters(filters: ColumnFilter[]): ColumnFilter[] {
  const seen = new Set<string>();

  return filters
    .map(filter => ({
      ...filter,
      operator: filter.operator ?? "contains",
      value: (filter.value ?? "").trim(),
    }))
    .filter(filter => filter.value.length > 0)
    .filter(filter => {
      const key = normalizeFilterKey(filter);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

export function applySimpleFilters<T extends Record<string, unknown>>(
  records: T[],
  filters: ColumnFilter[],
): T[] {
  if (filters.length === 0) {
    return records;
  }

  const cleaned = dedupeColumnFilters(filters);

  if (cleaned.length === 0) {
    return records;
  }

  const grouped = cleaned.reduce<Record<string, ColumnFilter[]>>((accumulator, filter) => {
    const key = filter.columnId;
    if (!accumulator[key]) {
      accumulator[key] = [];
    }

    accumulator[key].push(filter);
    return accumulator;
  }, {});

  return records.filter(record => {
    return Object.entries(grouped).every(([columnId, columnFilters]) => {
      const recordValue = record[columnId];
      return columnFilters.every(columnFilter => applyFilter(recordValue, columnFilter));
    });
  });
}
