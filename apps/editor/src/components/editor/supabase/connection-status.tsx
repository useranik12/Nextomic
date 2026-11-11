"use client";

import { Chip, Spinner } from "@heroui-v2/react";
import { Icon } from "@/lib/icons/Icon";

/** Where the Supabase connection stands, checked live with the connection test. */
export type ConnectionStatus =
  | { kind: "none" }
  | { kind: "checking" }
  | { kind: "connected"; message: string }
  | { kind: "warning"; message: string }
  | { kind: "failed"; message: string };

/** Green check when connected, yellow warning, red cross on failure, grey minus when not set up. */
export function ConnectionStatusChip({ status }: { status: ConnectionStatus }) {
  if (status.kind === "checking")
    return (
      <Chip size="sm" variant="flat" startContent={<Spinner size="sm" className="scale-75" />}>
        Checking
      </Chip>
    );
  const look = {
    none: {
      color: "default",
      icon: <Icon name="ph:minus-circle-fill" width={14} height={14} className="ml-1" />,
      label: "Not connected",
      tip: "No Supabase project is connected yet."
    },
    connected: {
      color: "success",
      icon: <Icon name="ph:check-circle" width={14} height={14} className="ml-1" />,
      label: "Connected",
      tip: ""
    },
    warning: {
      color: "warning",
      icon: <Icon name="ph:warning" width={14} height={14} className="ml-1" />,
      label: "Needs attention",
      tip: ""
    },
    failed: {
      color: "danger",
      icon: <Icon name="ph:x-circle" width={14} height={14} className="ml-1" />,
      label: "Failed",
      tip: ""
    }
  } as const;
  const shown = look[status.kind];
  const tip = "message" in status ? status.message : shown.tip;
  return (
    <Chip
      size="sm"
      variant="flat"
      color={shown.color}
      data-tip={tip}
      aria-label={`${shown.label}. ${tip}`}
      className={status.kind === "none" ? "opacity-70" : undefined}
      startContent={shown.icon}
    >
      {shown.label}
    </Chip>
  );
}
