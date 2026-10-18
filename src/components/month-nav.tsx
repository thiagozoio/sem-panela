import Link from "next/link";
import { addMonths, monthLabel } from "@/lib/format";

export function MonthNav({ month }: { month: string }) {
  return (
    <div className="flex items-center justify-between">
      <Link className="rounded-xl px-3 py-2 text-pitch-700 hover:bg-pitch-50" href={`?mes=${addMonths(month, -1).slice(0, 7)}`}>
        ‹
      </Link>
      <h2 className="font-semibold">{monthLabel(month)}</h2>
      <Link className="rounded-xl px-3 py-2 text-pitch-700 hover:bg-pitch-50" href={`?mes=${addMonths(month, 1).slice(0, 7)}`}>
        ›
      </Link>
    </div>
  );
}
