"use client";

import { Chip } from "@heroui/react";
import type { EmailLogEntry } from "@/server/mail/queue";

const STATUS_COLOR = {
  sent: "success",
  failed: "danger",
  queued: "warning",
  sending: "default"
} as const;

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The latest emails: when, what kind, to whom, how it went. No message content is kept. */
export function EmailLog({
  entries,
  accountNames,
  kindLabels
}: {
  entries: EmailLogEntry[];
  accountNames: Record<string, string>;
  kindLabels: Record<string, string>;
}) {
  if (entries.length === 0)
    return <p className="py-6 text-small text-default-500">No emails sent yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-left text-small">
        <thead className="text-tiny uppercase tracking-wide text-default-500">
          <tr className="border-b border-divider">
            <th className="py-2 pr-3 font-semibold">Time</th>
            <th className="py-2 pr-3 font-semibold">Kind</th>
            <th className="py-2 pr-3 font-semibold">To</th>
            <th className="py-2 pr-3 font-semibold">Account</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            <th className="py-2 font-semibold">Details</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-b border-divider align-top last:border-b-0">
              <td className="whitespace-nowrap py-2 pr-3 text-default-600">{when(e.createdAt)}</td>
              <td className="py-2 pr-3">{kindLabels[e.kind] ?? e.kind}</td>
              <td className="max-w-48 truncate py-2 pr-3">{e.to}</td>
              <td className="max-w-40 truncate py-2 pr-3 text-default-600">
                {e.sentWith ? (accountNames[e.sentWith] ?? "Deleted account") : "-"}
              </td>
              <td className="py-2 pr-3">
                <Chip size="sm" variant="flat" color={STATUS_COLOR[e.status]}>
                  {e.status}
                </Chip>
              </td>
              <td className="py-2 text-tiny text-default-500">
                {e.status === "sent" && e.sentAt ? `Sent ${when(e.sentAt)}` : null}
                {e.lastError ? <span className="text-danger">{e.lastError}</span> : null}
                {e.attempts > 1 ? ` · ${e.attempts} attempts` : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
