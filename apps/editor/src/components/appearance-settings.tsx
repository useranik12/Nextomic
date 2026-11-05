"use client";

import { useEffect, useState } from "react";

type Appearance = "dark" | "light" | "system";

const preferenceKey = "nextomic-builder-appearance";

function applyAppearance(preference: Appearance): void {
  const systemIsDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = preference === "dark" || (preference === "system" && systemIsDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", !dark);
}

export function AppearanceSettings(): React.JSX.Element {
  const [appearance, setAppearance] = useState<Appearance>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(preferenceKey);
    if (stored === "dark" || stored === "light" || stored === "system") {
      setAppearance(stored);
      applyAppearance(stored);
    }
  }, []);

  function updateAppearance(next: Appearance): void {
    setAppearance(next);
    window.localStorage.setItem(preferenceKey, next);
    applyAppearance(next);
  }

  return (
    <section aria-labelledby="appearance-heading" className="settings-card">
      <div>
        <h1 id="appearance-heading">Appearance</h1>
        <p>Choose the color mode for the builder UI. This does not change a built site’s preview mode.</p>
      </div>
      <fieldset className="appearance-options">
        <legend>Builder color mode</legend>
        {(["dark", "light", "system"] as const).map((option) => (
          <label className="appearance-option" key={option}>
            <input
              checked={appearance === option}
              name="appearance"
              onChange={() => updateAppearance(option)}
              type="radio"
              value={option}
            />
            <span>{option[0]?.toUpperCase()}{option.slice(1)}</span>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
