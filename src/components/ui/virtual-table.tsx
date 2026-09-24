import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  width?: string;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
}

export function VirtualTable<T extends { id?: string | number }>({
  data,
  columns,
  pageSize = 15,
  searchPlaceholder = "Search records...",
  searchFilter,
}: VirtualTableProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    if (searchFilter) {
      return data.filter((row) => searchFilter(row, search));
    }
    const q = search.toLowerCase();
    return data.filter((row) =>
      Object.values(row as any).some((val) => val && String(val).toLowerCase().includes(q)),
    );
  }, [data, search, searchFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const visibleData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative w-full sm:w-72">
        <Search className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="pl-9 h-9 text-xs"
        />
      </div>

      {/* Table Render */}
      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b text-muted-foreground uppercase font-semibold">
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} className="p-3" style={{ width: col.width }}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    No matching records found.
                  </td>
                </tr>
              ) : (
                visibleData.map((row, rowIdx) => (
                  <tr key={row.id ?? rowIdx} className="hover:bg-muted/30 transition-colors">
                    {columns.map((col, colIdx) => (
                      <td key={colIdx} className="p-3">
                        {col.cell
                          ? col.cell(row)
                          : col.accessorKey
                            ? String(row[col.accessorKey] ?? "—")
                            : null}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Showing {Math.min((currentPage - 1) * pageSize + 1, filteredData.length)} to{" "}
            {Math.min(currentPage * pageSize, filteredData.length)} of {filteredData.length} entries
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="size-8 p-0"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="size-8 p-0"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
