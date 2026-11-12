"use client";

import { Dropdown as V3Dropdown, Header, Label, Separator } from "@heroui/react";
import { mergeProps } from "react-aria";
import {
  cloneElement,
  createContext,
  useContext,
  type ComponentProps,
  type ReactElement,
  type ReactNode
} from "react";

// The builder's action menu (HeroUI v3 Dropdown) with the compound shape the screens use:
// <Dropdown><DropdownTrigger>one button</DropdownTrigger><DropdownMenu aria-label onAction>
// <DropdownItem id>...</DropdownItem></DropdownMenu></Dropdown>. Items are identified by `id`.

const PlacementContext = createContext("bottom end");

export interface DropdownProps {
  children: ReactNode;
  placement?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown({
  children,
  placement = "bottom end",
  isOpen,
  onOpenChange
}: DropdownProps) {
  return (
    <PlacementContext.Provider value={placement.replace("-", " ")}>
      <V3Dropdown
        {...(isOpen === undefined ? {} : { isOpen })}
        {...(onOpenChange ? { onOpenChange } : {})}
      >
        {children}
      </V3Dropdown>
    </PlacementContext.Provider>
  );
}

export function DropdownTrigger({ children }: { children: ReactElement<Record<string, unknown>> }) {
  return (
    <V3Dropdown.Trigger
      render={(props) => cloneElement(children, mergeProps(children.props, props))}
    />
  );
}

type MenuProps = Pick<
  ComponentProps<typeof V3Dropdown.Menu>,
  "onAction" | "disabledKeys" | "selectionMode" | "selectedKeys"
> & {
  "aria-label": string;
  children: ReactNode;
  /** Classes for the item list (for a scrolling list: `max-h-[50vh] overflow-y-auto`). */
  className?: string;
};

export function DropdownMenu({ className, children, ...menu }: MenuProps) {
  const placement = useContext(PlacementContext);
  return (
    <V3Dropdown.Popover placement={placement as "bottom end"} className="min-w-44">
      <V3Dropdown.Menu className={className} {...menu}>
        {children}
      </V3Dropdown.Menu>
    </V3Dropdown.Popover>
  );
}

export function DropdownSection({
  title,
  showDivider,
  children
}: {
  title?: string;
  showDivider?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <V3Dropdown.Section>
        {title ? (
          <Header className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{title}</Header>
        ) : null}
        {children}
      </V3Dropdown.Section>
      {showDivider ? <Separator className="my-1" /> : null}
    </>
  );
}

export function DropdownItem({
  id,
  children,
  textValue,
  description,
  startContent,
  endContent,
  color,
  isDisabled,
  className,
  onPress,
  href
}: {
  id: string;
  children: ReactNode;
  textValue?: string;
  description?: ReactNode;
  startContent?: ReactNode;
  endContent?: ReactNode;
  color?: "danger";
  isDisabled?: boolean;
  className?: string;
  onPress?: () => void;
  href?: string;
}) {
  return (
    <V3Dropdown.Item
      id={id}
      textValue={textValue ?? (typeof children === "string" ? children : id)}
      variant={color === "danger" ? "danger" : undefined}
      isDisabled={isDisabled}
      className={className}
      onAction={onPress}
      href={href}
    >
      {startContent}
      <span className="flex min-w-0 flex-1 flex-col">
        <Label>{children}</Label>
        {description ? <span className="text-xs text-muted">{description}</span> : null}
      </span>
      {endContent}
    </V3Dropdown.Item>
  );
}
