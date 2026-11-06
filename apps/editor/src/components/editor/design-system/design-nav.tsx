"use client";

import { createContext, useContext } from "react";
import type { DesignTabId } from "./design-tabs";

export interface DesignNavParams {
  /** Classes tab: show only these classes (for example the ones that use a font), with a label for the chip. */
  classNames?: string[];
  classLabel?: string;
  /** Variables tab: filter to and open this variable. */
  variable?: string;
  /** Classes tab: filter to and select this class. */
  className?: string;
}

export interface DesignNav {
  go: (tab: DesignTabId, params?: DesignNavParams) => void;
  params: DesignNavParams;
}

const Context = createContext<DesignNav>({ go: () => undefined, params: {} });

export const DesignNavProvider = Context.Provider;

/** Lets one Design System tab open another (for example Fonts > Show classes). */
export const useDesignNav = (): DesignNav => useContext(Context);
