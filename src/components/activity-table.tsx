"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import type { MonitoringActivity } from "@/lib/monitoring";

interface ActivityTableProps {
  activities: MonitoringActivity[];
  role: "DEAN" | "VPSAS";
}

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  return date.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Manila",
    year: "numeric",
  });
}

export function ActivityTable({ activities, role }: ActivityTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<MonitoringActivity>[]>(() => [
    {
      accessorKey: "title",
      header: "Activity",
      cell: ({ row }) => <span className="activity-table-title">{row.original.title}</span>,
    },
    {
      id: "dates",
      accessorFn: (activity) => activity.startDate,
      header: "Dates",
      cell: ({ row }) => `${formatDate(row.original.startDate)} – ${formatDate(row.original.endDate)}`,
    },
    {
      id: "college",
      accessorFn: (activity) => activity.colleges.join(", "),
      header: "College",
      cell: ({ row }) => row.original.colleges.join(", ") || "College association pending",
    },
    {
      accessorKey: "status",
      header: "Status",
    },
    {
      accessorKey: "participantCount",
      header: "Participants",
    },
    {
      accessorKey: "approvalStatus",
      header: "Approval",
    },
    {
      id: "action",
      enableSorting: false,
      header: "Action",
      cell: ({ row }) => (
        <Link
          className="font-semibold text-[#245b4e] underline"
          href={`/${role === "DEAN" ? "dean" : "vpsas"}/activities/${row.original.id}`}
        >
          Monitor
        </Link>
      ),
    },
  ], [role]);
  const table = useReactTable({
    data: activities,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;

  if (!rows.length) {
    return <p className="muted rounded-lg bg-[#f8f6f7] p-3 text-sm">No matching activities in the selected scope.</p>;
  }

  return (
    <>
      <div className="monitoring-table-wrap activity-table-desktop">
        <table className="monitoring-data-table">
          <caption className="sr-only">Authorized activities and their participation and approval status</caption>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const ariaSort = sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";
                  return (
                    <th aria-sort={header.column.getCanSort() ? ariaSort : undefined} key={header.id} scope="col">
                      {header.isPlaceholder ? null : (
                        <button
                          aria-label={header.column.getCanSort()
                            ? `Sort by ${String(header.column.columnDef.header)}${sorted ? `, currently ${sorted}ending` : ""}`
                            : undefined}
                          className={`activity-table-sort${header.column.getCanSort() ? "" : " activity-table-unsortable"}`}
                          disabled={!header.column.getCanSort()}
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() ? (
                            <span aria-hidden="true" className="activity-table-sort-indicator">
                              {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}
                            </span>
                          ) : null}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label="Authorized activities" className="activity-table-mobile">
        {rows.map(({ original: activity }) => (
          <li className="activity-table-mobile-card" key={activity.id}>
            <h3>{activity.title}</h3>
            <p>{formatDate(activity.startDate)} – {formatDate(activity.endDate)}</p>
            <dl>
              <div><dt>Status</dt><dd>{activity.status}</dd></div>
              <div><dt>Participants</dt><dd>{activity.participantCount}</dd></div>
              <div><dt>Approval</dt><dd>{activity.approvalStatus}</dd></div>
              {activity.colleges.length ? (
                <div><dt>College</dt><dd>{activity.colleges.join(", ")}</dd></div>
              ) : null}
            </dl>
            <Link
              className="button-secondary"
              href={`/${role === "DEAN" ? "dean" : "vpsas"}/activities/${activity.id}`}
            >
              Monitor activity
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
