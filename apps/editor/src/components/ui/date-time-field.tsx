"use client";

import { Calendar, DateField, DatePicker, Label } from "@heroui/react";
import { TOP_LAYER } from "./top-layer";
import { fromDate, getLocalTimeZone, now, type ZonedDateTime } from "@internationalized/date";

const toValue = (iso: string | null): ZonedDateTime | null => {
  const at = iso ? new Date(iso) : null;
  return at && !Number.isNaN(at.getTime()) ? fromDate(at, getLocalTimeZone()) : null;
};

/**
 * A date and time in the builder's style (HeroUI v3 DatePicker): the 32px pill field with minute
 * segments, a calendar popover with a year picker, local time zone. Values are ISO strings.
 * `future` blocks moments that have passed.
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
    <DatePicker<ZonedDateTime>
      aria-label={label}
      granularity="minute"
      hideTimeZone
      minValue={future ? now(getLocalTimeZone()) : undefined}
      value={toValue(value)}
      onChange={(next) => onChange(next ? next.toDate().toISOString() : null)}
      className="flex w-full flex-col gap-1"
    >
      {hideLabel ? null : <Label className="text-xs font-medium text-muted">{label}</Label>}
      <DateField.Group fullWidth>
        <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
        <DateField.Suffix>
          <DatePicker.Trigger>
            <DatePicker.TriggerIndicator />
          </DatePicker.Trigger>
        </DateField.Suffix>
      </DateField.Group>
      <DatePicker.Popover {...TOP_LAYER}>
        <Calendar aria-label={label}>
          <Calendar.Header>
            <Calendar.YearPickerTrigger>
              <Calendar.YearPickerTriggerHeading />
              <Calendar.YearPickerTriggerIndicator />
            </Calendar.YearPickerTrigger>
            <Calendar.NavButton slot="previous" />
            <Calendar.NavButton slot="next" />
          </Calendar.Header>
          <Calendar.Grid>
            <Calendar.GridHeader>
              {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
            </Calendar.GridHeader>
            <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
          </Calendar.Grid>
          <Calendar.YearPickerGrid>
            <Calendar.YearPickerGridBody>
              {({ year }) => <Calendar.YearPickerCell year={year} />}
            </Calendar.YearPickerGridBody>
          </Calendar.YearPickerGrid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}
