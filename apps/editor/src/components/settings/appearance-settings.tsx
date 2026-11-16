"use client";

import type { ColorMode } from "@nextomic/schema";
import { Label, Radio, RadioGroup } from "@heroui/react";
import { useTheme } from "next-themes";
import { useState, useTransition } from "react";
import { updateColorModeAction } from "@/app/(builder)/(dashboard)/settings/actions";

export function AppearanceSettings({ initialColorMode }: { initialColorMode: ColorMode }) {
  const { setTheme } = useTheme();
  const [colorMode, setColorMode] = useState<ColorMode>(initialColorMode);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(value: string) {
    const next = value as ColorMode;
    setColorMode(next);
    setTheme(next);
    setError(null);
    startTransition(async () => {
      const result = await updateColorModeAction(next);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-separator bg-surface/40">
      <div className="flex flex-col gap-0.5 border-b border-separator px-5 py-4">
        <h3 className="text-sm font-medium text-foreground">Color mode</h3>
        <p className="text-xs text-muted">
          Changes how the builder UI looks. Built sites have their own color modes.
        </p>
      </div>
      <div className="p-5">
        <RadioGroup
          value={colorMode}
          onChange={handleChange}
          isDisabled={isPending}
          aria-label="Color mode"
          orientation="horizontal"
          className="flex flex-row flex-wrap gap-3"
        >
          {(
            [
              ["dark", "Dark"],
              ["light", "Light"],
              ["system", "Match system"]
            ] as const
          ).map(([value, text]) => (
            <Radio
              key={value}
              value={value}
              className="rounded-xl border border-separator px-4 py-2.5 data-[selected=true]:border-focus"
            >
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content>
                <Label className="text-sm font-normal text-body">{text}</Label>
              </Radio.Content>
            </Radio>
          ))}
        </RadioGroup>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </div>
    </div>
  );
}
