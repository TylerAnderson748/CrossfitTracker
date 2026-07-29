"use client";

import { PlanRow } from "@/lib/types";

export type PlanDayStatus = "done" | "missed" | "today" | "upcoming";

interface PlanTableProps {
  rows: PlanRow[];
  // Optional per-date status (from workout logs) - adds a Status column
  statusByDate?: Record<string, PlanDayStatus>;
}

// Stable color per phase, assigned in order of first appearance
const PHASE_STYLES = [
  "bg-blue-50 text-blue-700",
  "bg-purple-50 text-purple-700",
  "bg-amber-50 text-amber-700",
  "bg-green-50 text-green-700",
  "bg-rose-50 text-rose-700",
  "bg-cyan-50 text-cyan-700",
  "bg-indigo-50 text-indigo-700",
];

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PlanTable({ rows, statusByDate }: PlanTableProps) {
  const today = localToday();

  // Assign a color to each phase in order of appearance
  const phaseColor = new Map<string, string>();
  rows.forEach(r => {
    if (!phaseColor.has(r.phase)) {
      phaseColor.set(r.phase, PHASE_STYLES[phaseColor.size % PHASE_STYLES.length]);
    }
  });

  const isRest = (row: PlanRow) => row.session.toLowerCase().includes("rest");

  const statusBadge = (row: PlanRow) => {
    if (!statusByDate) return null;
    if (isRest(row)) return <span className="text-gray-300">—</span>;
    const status = row.date === today ? "today" : statusByDate[row.date] || (row.date < today ? "missed" : "upcoming");
    switch (status) {
      case "done":
        return <span className="text-green-600 font-bold" title="Logged">✓</span>;
      case "missed":
        return <span className="text-red-400 font-bold" title="No log found">✗</span>;
      case "today":
        return <span className="text-blue-600 font-bold" title="Today">●</span>;
      default:
        return <span className="text-gray-300">—</span>;
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {statusByDate && <th className="px-2 py-2 text-center">✓</th>}
            <th className="px-2 py-2 whitespace-nowrap">Date</th>
            <th className="px-2 py-2">Day</th>
            <th className="px-2 py-2 text-center">Wk</th>
            <th className="px-2 py-2">Phase</th>
            <th className="px-2 py-2 whitespace-nowrap">Session</th>
            <th className="px-2 py-2 min-w-[280px]">Detailed Plan</th>
            <th className="px-2 py-2 text-right">Mi</th>
            <th className="px-2 py-2 text-center whitespace-nowrap">RPE</th>
            <th className="px-2 py-2 text-right">Min</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isToday = row.date === today;
            const rest = isRest(row);
            const isEvent = row.session === row.session.toUpperCase() && /[A-Z]/.test(row.session) && !rest;
            return (
              <tr
                key={`${row.date}-${idx}`}
                className={`border-t border-gray-100 align-top ${
                  isToday
                    ? "bg-blue-50/70 ring-1 ring-inset ring-blue-200"
                    : rest
                    ? "bg-gray-50/60"
                    : isEvent
                    ? "bg-yellow-50"
                    : "bg-white"
                }`}
              >
                {statusByDate && <td className="px-2 py-2 text-center">{statusBadge(row)}</td>}
                <td className={`px-2 py-2 whitespace-nowrap font-mono text-xs ${isToday ? "font-bold text-blue-700" : "text-gray-600"}`}>
                  {row.date.slice(5)}
                </td>
                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{row.day.slice(0, 3)}</td>
                <td className="px-2 py-2 text-center text-gray-500">{row.week}</td>
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${phaseColor.get(row.phase) || "bg-gray-100 text-gray-600"}`}>
                    {row.phase}
                  </span>
                </td>
                <td className={`px-2 py-2 whitespace-nowrap font-medium ${rest ? "text-gray-400" : isEvent ? "text-amber-700 font-bold" : "text-gray-900"}`}>
                  {row.session}
                </td>
                <td className={`px-2 py-2 text-xs leading-relaxed ${rest ? "text-gray-400" : "text-gray-700"}`}>
                  {row.detail}
                  {row.reason && (
                    <div className="text-[11px] text-gray-400 italic mt-1">Why: {row.reason}</div>
                  )}
                </td>
                <td className="px-2 py-2 text-right text-gray-700 font-mono text-xs">
                  {row.runMiles ? row.runMiles : ""}
                </td>
                <td className="px-2 py-2 text-center text-gray-500 text-xs whitespace-nowrap">{row.targetRPE || ""}</td>
                <td className="px-2 py-2 text-right text-gray-500 font-mono text-xs">{row.estMinutes || ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
