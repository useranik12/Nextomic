"use client";

import { ComboBox, Header, Input, Label, ListBox } from "@heroui/react";
import { useIgnoreOpeningScroll } from "./select-field";
import { InfoTip } from "./info-tip";

export interface SearchSelectSection {
  title: string;
  /** `hint` is shown beside the label and is never part of the text the field takes. */
  options: { value: string; label: string; hint?: string }[];
}

// A small searchable dropdown (HeroUI v3 ComboBox) with titled sections, the same 32px pill as the
// other fields. Typing filters the options; the value is controlled.

export function SearchSelect({
  label,
  placeholder,
  sections,
  value,
  onValueChange,
  isDisabled,
  emptyText = "Nothing matches.",
  tip,
  hideLabel,
  allowCustom
}: {
  label: string;
  placeholder?: string;
  sections: SearchSelectSection[];
  value: string;
  onValueChange: (value: string) => void;
  isDisabled?: boolean;
  emptyText?: string;
  /** Info tip beside the label. */
  tip?: string;
  hideLabel?: boolean;
  /** The text may be typed freely; the options are suggestions (the value is the written text). */
  allowCustom?: boolean;
}) {
  const shown = sections.filter((s) => s.options.length > 0);
  const markOpened = useIgnoreOpeningScroll();
  return (
    <ComboBox
      fullWidth
      aria-label={label}
      isDisabled={isDisabled}
      onOpenChange={markOpened}
      {...(allowCustom
        ? {
            allowsCustomValue: true,
            inputValue: value,
            onInputChange: onValueChange,
            onChange: (key: unknown) => {
              if (key !== null) onValueChange(String(key));
            }
          }
        : {
            value: value || null,
            onChange: (key: unknown) => {
              if (key !== null) onValueChange(String(key));
            }
          })}
    >
      {hideLabel ? null : (
        <span className="flex items-center gap-1.5">
          <Label className="text-xs font-medium text-muted">{label}</Label>
          {tip ? <InfoTip text={tip} label={label} /> : null}
        </span>
      )}
      <ComboBox.InputGroup>
        <Input placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover placement="bottom start" offset={6}>
        <ListBox
          renderEmptyState={() => <p className="px-2.5 py-2 text-sm text-muted">{emptyText}</p>}
        >
          {shown.map((section) => (
            <ListBox.Section key={section.title}>
              <Header className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
                {section.title}
              </Header>
              {section.options.map((option) => (
                <ListBox.Item
                  key={option.value}
                  id={option.value}
                  textValue={option.label}
                  className="text-body data-[selected=true]:font-medium data-[selected=true]:text-foreground"
                >
                  {option.label}
                  {option.hint ? (
                    <span className="ml-2 text-xs text-muted">{option.hint}</span>
                  ) : null}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox.Section>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
