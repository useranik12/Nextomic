"use client";

import { DatePicker } from "@heroui/react";
import { fromDate, getLocalTimeZone, now, type ZonedDateTime } from "@internationalized/date";

const toValue = (iso: string | null): ZonedDateTime | null => {
  const at = iso ? new Date(iso) : null;
  return at && !Number.isNaN(at.getTime()) ? fromDate(at, getLocalTimeZone()) : null;
};

/** Calendar look of the builder: neutral surfaces, the white-shade accent for the chosen day. */
const CALENDAR_CLASSES = {
  base: "bg-content1 shadow-none rounded-large",
  headerWrapper: "bg-content1 pt-3 pb-1",
  header: "text-small font-medium text-foreground",
  title: "text-small font-medium",
  prevButton: "text-default-500 data-[hover=true]:bg-default-100",
  nextButton: "text-default-500 data-[hover=true]:bg-default-100",
  gridHeader: "bg-content1 shadow-none border-b border-divider",
  gridHeaderCell: "text-[10px] font-semibold uppercase tracking-wider text-default-400",
  cellButton:
    "rounded-full text-small text-default-700 data-[hover=true]:bg-default-100 data-[hover=true]:text-foreground " +
    "data-[today=true]:ring-1 data-[today=true]:ring-default-400 data-[today=true]:bg-transparent " +
    "data-[selected=true]:!bg-default-800 data-[selected=true]:!text-default-50 data-[selected=true]:font-semibold " +
    "data-[disabled=true]:opacity-30 data-[unavailable=true]:opacity-30",
  pickerWrapper: "bg-content1",
  pickerItem: "text-small data-[hover=true]:bg-default-100"
};

/**
 * A date and time in the builder's style: pill field, calendar in the neutral palette, minutes,
 * local time zone. Values are ISO strings. `future` blocks moments that have passed.
 */
export function DateTimeField({
  label,
  value,
  onChange,
  future = false,
  hideLabel = false
}: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  future?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <DatePicker
      aria-label={label}
      label={hideLabel ? undefined : label}
      labelPlacement="outside"
      variant="bordered"
      size="sm"
      granularity="minute"
      hideTimeZone
      showMonthAndYearPickers
      minValue={future ? now(getLocalTimeZone()) : undefined}
      value={toValue(value)}
      onChange={(next) => onChange(next ? next.toDate().toISOString() : null)}
      classNames={{
        label: "pb-0.5 text-tiny font-medium !text-default-600",
        inputWrapper:
          "h-8 min-h-8 rounded-full border border-default-200 bg-transparent px-3 shadow-none data-[hover=true]:border-default-400 group-data-[focus=true]:border-default-800",
        input: "text-small text-default-700",
        selectorButton: "text-default-500 data-[hover=true]:bg-default-100",
        popoverContent: "rounded-large border border-default-200 bg-content1 p-0 shadow-2xl",
        calendar: "shadow-none",
        calendarContent: "bg-content1",
        timeInputLabel: "text-tiny text-default-500",
        timeInput: "text-small"
      }}
      calendarProps={{ classNames: CALENDAR_CLASSES }}
      timeInputProps={{
        classNames: {
          inputWrapper:
            "h-8 min-h-8 rounded-full border border-default-200 bg-transparent shadow-none data-[hover=true]:border-default-400"
        }
      }}
    />
  );
}
