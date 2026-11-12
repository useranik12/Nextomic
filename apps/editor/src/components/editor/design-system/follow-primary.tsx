"use client";

import {
  canOfferFollow,
  followLoss,
  startFollowing,
  stopFollowing,
  type Theme
} from "@nextomic/schema";
import { useState } from "react";
import { ActionButton } from "@/components/ui/controls";
import { Dialog } from "@/components/ui/dialog";
import { SwitchRow } from "@/components/ui/switch-row";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What turning Follow Primary on will replace, in words the owner of the theme can weigh. */
function lossLines(theme: Theme): string[] {
  const loss = followLoss(theme);
  const lines: string[] = [];
  if (loss.variables > 0)
    lines.push(`its framework (${plural(loss.variables, "variable", "variables")})`);
  if (loss.classRules) lines.push("its framework classes (CSS)");
  if (loss.scales > 0)
    lines.push(`its ${plural(loss.scales, "fluid scale", "fluid scales")} (text, space, radius)`);
  if (loss.overrides > 0)
    lines.push(`its ${plural(loss.overrides, "variable override", "variable overrides")}`);
  return lines;
}

/**
 * Follow Primary switch for a theme that is not the primary. Turning it on asks first, because
 * the theme's own framework and variable values are replaced. The Design System is a draft until
 * Save, so Discard brings everything back.
 */
export function FollowPrimary({
  theme,
  themes,
  primaryName,
  onChange
}: {
  theme: Theme;
  themes: readonly Theme[];
  primaryName: string;
  onChange: (next: Theme) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  if (theme.isDefault || (!theme.followPrimary && !canOfferFollow(themes))) return null;
  const lines = lossLines(theme);

  return (
    <>
      <SwitchRow
        label="Follow the primary theme"
        tip={`On: this theme uses the same variables, colors, scales, classes and fonts as ${primaryName}, and keeps following them when ${primaryName} changes. You can still change values here, such as a different brand color. Off: the theme has its own framework and values.`}
        selected={theme.followPrimary}
        onChange={(on) => {
          if (on) setConfirming(true);
          else onChange(stopFollowing(theme, themes));
        }}
      />
      <Dialog
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title={`Follow ${primaryName}?`}
        description={`${theme.name} will use the look of ${primaryName}.`}
        size="sm"
        footer={
          <>
            <ActionButton size="sm" tone="secondary" onPress={() => setConfirming(false)}>
              Cancel
            </ActionButton>
            <ActionButton
              size="sm"
              tone="danger"
              onPress={() => {
                onChange(startFollowing(theme));
                setConfirming(false);
              }}
            >
              Replace and follow
            </ActionButton>
          </>
        }
      >
        {lines.length > 0 ? (
          <p className="text-sm text-body">
            This replaces {lines.join(", ")} with the ones from {primaryName}. Names, classes and
            structure will then come from {primaryName}, and only values can differ in {theme.name}.
          </p>
        ) : (
          <p className="text-sm text-body">
            {theme.name} has no styles of its own yet, so nothing is lost. Names, classes and
            structure will come from {primaryName}, and only values can differ in {theme.name}.
          </p>
        )}
        <p className="text-sm text-muted">
          Nothing is written until you press Save in the Design System. Close without saving, or
          discard, and {theme.name} keeps what it has now.
        </p>
      </Dialog>
    </>
  );
}
