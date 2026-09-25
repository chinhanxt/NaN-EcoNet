import * as React from "react";
import {
  Table as TableIcon,
  Eye,
  KeyRound,
  Link2,
  Search,
  ChevronRight,
  ChevronDown,
  Layers
} from "lucide-react";
import { DatabaseDwhSvg } from "./SvgIcons";

export type PostgresDataType =
  | "uuid"
  | "varchar"
  | "text"
  | "numeric"
  | "integer"
  | "bigint"
  | "boolean"
  | "timestamptz"
  | "jsonb";

export interface ColumnSchema {
  name: string;
  dataType: PostgresDataType;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignReference?: string;
  isNullable: boolean;
  defaultValue?: string;
}

export interface TableCatalog {
  id: string;
  schemaName: string;
  name: string;
  type: "BASE TABLE" | "VIEW";
  approxRowCount: number;
  sizeBytes: string;
  description?: string;
  columns: ColumnSchema[];
}

export function SchemaCatalogViewer({ catalog }: { catalog: TableCatalog[] }) {
  const [search, setSearch] = React.useState("");
  const [selectedTableId, setSelectedTableId] = React.useState<string>(catalog[0]?.id || "");
  const [expandedSchemas, setExpandedSchemas] = React.useState<Record<string, boolean>>({
    public: true,
    finance: true,
  });

  const schemasGrouped = React.useMemo(() => {
    const groups: Record<string, TableCatalog[]> = {};
    for (const item of catalog) {
      if (!groups[item.schemaName]) groups[item.schemaName] = [];
      if (
        search === "" ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.columns.some((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      ) {
        groups[item.schemaName].push(item);
      }
    }
    return groups;
  }, [catalog, search]);

  const selectedTable = catalog.find((t) => t.id === selectedTableId);

  const toggleSchema = (schemaName: string) => {
    setExpandedSchemas((prev) => ({ ...prev, [schemaName]: !prev[schemaName] }));
  };

  return (
    <div className="w-full border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-xs flex flex-col md:flex-row h-[460px] font-sans my-2">
      {/* CỘT TRÁI: Schema & Table Tree Navigator */}
      <div className="w-full md:w-72 border-r border-slate-200 bg-slate-50/80 flex flex-col shrink-0">
        <div className="p-3 border-b border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-950 whitespace-nowrap">
            <DatabaseDwhSvg size={14} className="text-slate-900" />
            <span>PostgreSQL Catalog</span>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 stroke-[2.2]" />
            <input
              type="text"
              placeholder="Lọc bảng hoặc cột..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
          {Object.entries(schemasGrouped).map(([schema, tables]) => {
            const isExpanded = expandedSchemas[schema] ?? true;
            return (
              <div key={schema} className="space-y-0.5">
                <button
                  onClick={() => toggleSchema(schema)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-200/70 font-extrabold text-slate-900 cursor-pointer whitespace-nowrap"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 stroke-[2.2]" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 stroke-[2.2]" />
                  )}
                  <Layers className="w-3.5 h-3.5 text-slate-600 stroke-[2.2]" />
                  <span>{schema}</span>
                  <span className="ml-auto text-[10px] text-slate-400 font-mono font-bold">
                    ({tables.length})
                  </span>
                </button>

                {isExpanded && (
                  <div className="ml-3 pl-2 border-l border-slate-200 space-y-0.5">
                    {tables.map((t) => {
                      const isSelected = t.id === selectedTableId;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTableId(t.id)}
                          className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-left transition cursor-pointer whitespace-nowrap ${
                            isSelected
                              ? "bg-slate-950 text-white font-bold shadow-xs"
                              : "text-slate-700 hover:bg-slate-200/50 font-semibold"
                          }`}
                        >
                          {t.type === "VIEW" ? (
                            <Eye className="w-3 h-3 shrink-0 opacity-80 stroke-[2.2]" />
                          ) : (
                            <TableIcon className="w-3 h-3 shrink-0 opacity-80 stroke-[2.2]" />
                          )}
                          <span className="truncate">{t.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CỘT PHẢI: Table Schema & Columns Detail View */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedTable ? (
          <>
            {/* Header info */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400 font-bold">{selectedTable.schemaName}.</span>
                  <h3 className="text-base font-black text-slate-950 whitespace-nowrap">
                    {selectedTable.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 whitespace-nowrap">
                    {selectedTable.type}
                  </span>
                </div>
                {selectedTable.description && (
                  <p className="text-xs text-slate-500 font-medium mt-1">{selectedTable.description}</p>
                )}
              </div>

              <div className="flex items-center gap-4 text-xs font-mono font-bold text-slate-600">
                <div className="whitespace-nowrap">
                  <span className="text-slate-400 font-normal">Bản ghi: </span>
                  <span className="text-slate-950 tabular-nums">{selectedTable.approxRowCount.toLocaleString()}</span>
                </div>
                <div className="whitespace-nowrap">
                  <span className="text-slate-400 font-normal">Dung lượng: </span>
                  <span className="text-slate-950">{selectedTable.sizeBytes}</span>
                </div>
              </div>
            </div>

            {/* Columns List Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100/95 border-b border-slate-200 text-slate-700 font-extrabold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4 whitespace-nowrap">Tên Cột (Column)</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Kiểu Dữ Liệu</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Ràng Buộc (Keys)</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Nullable</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Mặc Định</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {selectedTable.columns.map((col) => (
                    <tr key={col.name} className="hover:bg-slate-50 transition">
                      <td className="py-2.5 px-4 font-bold text-slate-950 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {col.isPrimaryKey && (
                            <KeyRound className="w-3.5 h-3.5 text-slate-950 shrink-0 stroke-[2.2]" />
                          )}
                          {col.isForeignKey && (
                            <Link2 className="w-3.5 h-3.5 text-slate-500 shrink-0 stroke-[2.2]" />
                          )}
                          <span>{col.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-900 border border-slate-200">
                          {col.dataType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-600">
                        {col.isPrimaryKey ? (
                          <span className="font-extrabold text-slate-950">PRIMARY KEY</span>
                        ) : col.isForeignKey ? (
                          <span>FK → {col.foreignReference}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-600 font-bold">
                        {col.isNullable ? "YES" : "NO"}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-400">
                        {col.defaultValue || "NULL"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs font-semibold">
            Chọn một bảng từ danh mục bên trái
          </div>
        )}
      </div>
    </div>
  );
}
