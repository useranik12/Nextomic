"use client";

import type { ColorMode } from "@nextomic/schema";
import { Radio, RadioGroup } from "@heroui/react";
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
        label="Color mode"
        description="Changes how the builder UI looks. Built sites have their own color modes."
        value={colorMode}
        onValueChange={handleChange}
        isDisabled={isPending}
      >
        <Radio value="dark">Dark</Radio>
        <Radio value="light">Light</Radio>
        <Radio value="system">Match system</Radio>
      </RadioGroup>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
