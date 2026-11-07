"use client";

import { ITEM_STATUSES, ITEM_STATUS_LABELS, isLive, type ItemStatus } from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";
import { DateTimeField } from "@/components/ui/date-time-field";

const ONE_HOUR = 60 * 60 * 1000;

/**
 * Draft, Published or Scheduled. Scheduled shows a date and time picker; the item goes live from
 * that moment (it is part of the next publish and is served once the time has come).
 */
export function StatusField({
  status,
  scheduledAt,
  onChange,
  tip
}: {
  status: ItemStatus;
  scheduledAt: string | null;
  onChange: (change: { status: ItemStatus; scheduledAt: string | null }) => void;
  tip?: string;
}) {
  const waiting = status === "scheduled" && !isLive({ status, scheduledAt });
  return (
    <div className="flex flex-col gap-2">
      <SelectField
        compact
        label="Status"
        value={status}
        options={ITEM_STATUSES.map((s) => ({ value: s, label: ITEM_STATUS_LABELS[s] }))}
        onValueChange={(next) => {
          const s = next as ItemStatus;
          // Scheduling starts one hour from now so the picker never opens empty.
          const start = scheduledAt ?? new Date(Date.now() + ONE_HOUR).toISOString();
          onChange({ status: s, scheduledAt: s === "scheduled" ? start : scheduledAt });
        }}
      />
      {tip ? <p className="text-tiny text-default-500">{tip}</p> : null}
      {status === "scheduled" ? (
        <>
          <DateTimeField
            label="Go live at"
            value={scheduledAt}
            onChange={(iso) => onChange({ status: "scheduled", scheduledAt: iso })}
          />
          <p className="text-tiny text-default-500">
            {scheduledAt === null
              ? "Pick the date and time it goes live."
              : waiting
                ? "Goes live at this time, once the project is published."
                : "This time has passed, so it is live."}
          </p>
        </>
      ) : null}
    </div>
  );
}
