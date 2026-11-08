"use client";

import { Autocomplete, AutocompleteItem, AutocompleteSection } from "@heroui/react";
import { Icon } from "@/lib/icons/Icon";
import { useIgnoreOpeningScroll } from "./controls";

export interface SearchSelectSection {
  title: string;
  options: { value: string; label: string }[];
}

// A small searchable dropdown (HeroUI Autocomplete) with titled sections, styled like SelectField:
// pill trigger, compact by default. Typing filters the options; the value is controlled.

const INPUT_CLASSES = {
  label: "pb-0.5 text-tiny font-medium !text-default-600",
  inputWrapper:
    "h-8 min-h-8 rounded-full border border-default-200 bg-transparent px-3 shadow-none " +
    "data-[hover=true]:border-default-400 group-data-[focus=true]:border-default-800",
  input: "text-small"
};

export function SearchSelect({
  label,
  placeholder,
  sections,
  value,
  onValueChange,
  isDisabled,
  emptyText = "Nothing matches."
}: {
  label: string;
  placeholder?: string;
  sections: SearchSelectSection[];
  value: string;
  onValueChange: (value: string) => void;
  isDisabled?: boolean;
  emptyText?: string;
}) {
  const shown = sections.filter((s) => s.options.length > 0);
  const markOpened = useIgnoreOpeningScroll();
  return (
    <Autocomplete
      aria-label={label}
      label={label}
      labelPlacement="outside"
      placeholder={placeholder}
      variant="bordered"
      size="sm"
      isDisabled={isDisabled}
      onOpenChange={markOpened}
      selectedKey={value || null}
      onSelectionChange={(key) => {
        if (key !== null) onValueChange(String(key));
      }}
      inputProps={{ classNames: INPUT_CLASSES }}
      popoverProps={{ offset: 6, placement: "bottom-start" }}
      listboxProps={{ emptyContent: emptyText }}
      selectorIcon={<Icon name="ph:caret-down" width={14} height={14} />}
    >
      {shown.map((section) => (
        <AutocompleteSection key={section.title} title={section.title}>
          {section.options.map((option) => (
            <AutocompleteItem key={option.value} textValue={option.label}>
              {option.label}
            </AutocompleteItem>
          ))}
        </AutocompleteSection>
      ))}
    </Autocomplete>
  );
}
