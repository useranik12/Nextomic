"use client";

import type { ElementNode } from "@nextomic/schema";
import { useEditorStore } from "../store/editor-store";
import { DesignField } from "./design-field";
import type { DesignProperty } from "./design-groups";

/**
 * The settings of one Design group. Half-width neighbours (min and max width, the two gaps) share a
 * row; settings of one cluster sit close together and clusters are spaced further apart. Focusing
 * or clicking a setting records it, so the Design tab reopens there for this element.
 */
export function GroupBody({
  node,
  groupId,
  properties
}: {
  node: ElementNode;
  groupId: string;
  properties: DesignProperty[];
}) {
  const remember = useEditorStore((s) => s.rememberDesign);
  const clusters: { id: string; rows: DesignProperty[][] }[] = [];
  for (const property of properties) {
    const id = property.cluster ?? `single:${property.property}`;
    let cluster = clusters[clusters.length - 1];
    if (!cluster || cluster.id !== id) {
      cluster = { id, rows: [] };
      clusters.push(cluster);
    }
    const last = cluster.rows[cluster.rows.length - 1];
    if (property.half && last?.length === 1 && last[0]?.half) last.push(property);
    else cluster.rows.push([property]);
  }

  return (
    <div className="flex flex-col gap-8">
      {clusters.map((cluster) => (
        <div key={cluster.id} className="flex flex-col gap-3">
          {cluster.rows.map((row) => (
            <div
              key={row[0]?.property}
              className={row.length > 1 ? "grid grid-cols-2 items-end gap-2" : undefined}
            >
              {row.map((property) => (
                <div
                  key={property.property}
                  data-design-property={property.property}
                  className="min-w-0"
                  onFocusCapture={() => remember(node.id, groupId, property.property)}
                  onPointerDownCapture={() => remember(node.id, groupId, property.property)}
                >
                  <DesignField node={node} property={property} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
