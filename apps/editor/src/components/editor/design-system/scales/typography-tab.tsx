"use client";

import { FrameworkGate } from "../framework/framework-gate";
import { ScaleEditor } from "./scale-editor";

/** Design System > Typography: the fluid text scale of the theme's framework. */
export function TypographyTab() {
  return (
    <FrameworkGate title="Typography">
      {(props) => <ScaleEditor kind="text" {...props} />}
    </FrameworkGate>
  );
}
