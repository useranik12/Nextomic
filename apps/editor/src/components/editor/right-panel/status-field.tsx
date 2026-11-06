"use client";

import { DatePicker } from "@heroui/react";
import { fromDate, getLocalTimeZone, type ZonedDateTime } from "@internationalized/date";
import { ITEM_STATUSES, ITEM_STATUS_LABELS, isLive, type ItemStatus } from "@nextomic/schema";
import { SelectField } from "@/components/ui/controls";

const ONE_HOUR = 60 * 60 * 1000;

const toValue = (iso: string | null): ZonedDateTime | null => {
  const at = iso ? new Date(iso) : null;
  return at && !Number.isNaN(at.getTime()) ? fromDate(at, getLocalTimeZone()) : null;
};

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
  const value = toValue(scheduledAt);
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
          <DatePicker
            aria-label="Go live at"
            label="Go live at"
            labelPlacement="outside"
            variant="bordered"
            size="sm"
            granularity="minute"
            hideTimeZone
            value={value}
            onChange={(next) =>
              onChange({
                status: "scheduled",
                scheduledAt: next ? next.toDate().toISOString() : null
              })
            }
            classNames={{
              label: "pb-0.5 text-tiny font-medium !text-default-600",
              inputWrapper:
                "h-8 min-h-8 rounded-full border border-default-200 bg-transparent px-3 shadow-none data-[hover=true]:border-default-400 group-data-[focus=true]:border-default-800",
              popoverContent: "rounded-large border border-default-200 bg-content1 shadow-xl"
            }}
          />
          <p className="text-tiny text-default-500">
            {value === null
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
