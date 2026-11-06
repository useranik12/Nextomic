"use client";

import { Modal, ModalContent } from "@heroui/react";
import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { ClassManager } from "../class-manager";
import { ColorsTab } from "./colors-tab";
import { SpacingTab, TypographyTab } from "./scale-tab";
import { VariablesTab } from "./variables-tab";

const TABS = [
  { id: "variables", label: "Variables", hint: "All design tokens" },
  { id: "typography", label: "Typography", hint: "Fluid type scale" },
  { id: "spacing", label: "Spacing", hint: "Fluid spacing scale" },
  { id: "colors", label: "Colors", hint: "Palettes and shades" },
  { id: "classes", label: "Classes", hint: "Global class manager" }
] as const;
type TabId = (typeof TABS)[number]["id"];

/**
 * The Design System page: a large modal over the editor. Everything you create here or from an
 * element (variables, classes) is managed in it; scales and palettes are generated into variables.
 */
export function DesignSystemModal({
  onClose,
  saveNow
}: {
  onClose: () => void;
  saveNow: () => Promise<void>;
}) {
  const [tab, setTab] = useState<TabId>("variables");
  return (
    <Modal
      isOpen
      onClose={onClose}
      size="5xl"
      scrollBehavior="inside"
      classNames={{ base: "h-[80vh] max-h-[80vh]", body: "p-0" }}
    >
      <ModalContent>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-large">
          <nav
            aria-label="Design system"
            className="flex w-52 shrink-0 flex-col gap-1 border-r border-divider p-3"
          >
            <h2 className="flex items-center gap-2 px-2 pb-2 text-medium font-medium">
              <Icon name="ph:palette" width={20} height={20} />
              Design System
            </h2>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-current={tab === t.id}
                onClick={() => setTab(t.id)}
                className={
                  "flex flex-col rounded-medium px-3 py-2 text-left transition-colors duration-300 " +
                  (tab === t.id
                    ? "bg-default-200 text-foreground"
                    : "text-default-600 hover:bg-default-100")
                }
              >
                <span className="text-small font-medium">{t.label}</span>
                <span className="text-tiny text-default-500">{t.hint}</span>
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1">
            {tab === "variables" ? <VariablesTab saveNow={saveNow} /> : null}
            {tab === "typography" ? <TypographyTab /> : null}
            {tab === "spacing" ? <SpacingTab /> : null}
            {tab === "colors" ? <ColorsTab /> : null}
            {tab === "classes" ? <ClassManager saveNow={saveNow} /> : null}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
