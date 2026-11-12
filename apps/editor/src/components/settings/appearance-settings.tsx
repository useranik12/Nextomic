"use client";

import type { ColorMode } from "@nextomic/schema";
import { Description, Label, Radio, RadioGroup } from "@heroui/react";
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
    <div className="flex flex-col gap-2">
      <RadioGroup
        value={colorMode}
        onChange={handleChange}
        isDisabled={isPending}
        aria-label="Color mode"
      >
        <Label className="text-sm font-medium text-body">Color mode</Label>
        <Description>
          Changes how the builder UI looks. Built sites have their own color modes.
        </Description>
        {(
          [
            ["dark", "Dark"],
            ["light", "Light"],
            ["system", "Match system"]
          ] as const
        ).map(([value, text]) => (
          <Radio key={value} value={value}>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            <Radio.Content>
              <Label className="text-sm font-normal text-body">{text}</Label>
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
