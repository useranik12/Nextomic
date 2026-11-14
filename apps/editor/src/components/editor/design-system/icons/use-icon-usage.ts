"use client";

import { useEffect, useState } from "react";
import { iconLibraryUsageAction } from "@/app/(builder)/editor/[id]/icon-actions";

interface Usage {
  checking: boolean;
  used: boolean;
  list: { kind: "page" | "template" | "action"; id: string; name: string }[];
  error: string | null;
}

const NONE: Usage = { checking: false, used: false, list: [], error: null };

/**
 * Where an icon library is used, asked each time a removal is opened. While the answer is not in,
 * or when it could not be asked, the caller treats the library as not removable.
 */
export function useIconUsage(projectId: string, key: string | null): Usage {
  const [usage, setUsage] = useState<Usage>(NONE);
  useEffect(() => {
    if (key === null) {
      setUsage(NONE);
      return;
    }
    let current = true;
    setUsage({ ...NONE, checking: true });
    void iconLibraryUsageAction(projectId, key).then((res) => {
      if (!current) return;
      if (res.error !== null) setUsage({ ...NONE, used: true, error: res.error });
      else setUsage({ checking: false, used: res.data.length > 0, list: res.data, error: null });
    });
    return () => {
      current = false;
    };
  }, [projectId, key]);
  return usage;
}
