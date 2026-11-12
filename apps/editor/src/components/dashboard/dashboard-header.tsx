"use client";

import { buttonVariants, Dropdown, Label, Separator } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrandAsset } from "@/lib/assets";
import { Icon } from "@/lib/icons/Icon";
import { ActionButton } from "@/components/ui/controls";
import { Hint } from "@/components/ui/hint";
import { UserAvatar } from "@/components/ui/user-avatar";
import { authClient } from "@/lib/auth-client";

export interface DashboardHeaderProps {
  userName: string;
  userEmail: string;
  userImage?: string | null;
}

const ICON_TRIGGER =
  buttonVariants({ variant: "ghost", size: "sm", isIconOnly: true }) +
  " flex h-9 w-9 shrink-0 items-center justify-center rounded-full p-0";

const ICON = "size-5!";

const SHORTCUTS = [
  { key: "new-project", label: "New Project", href: "/projects?new=1" },
  { key: "all-projects", label: "All Projects", href: "/projects" },
  { key: "settings", label: "Settings", href: "/settings" }
];

export function DashboardHeader({ userName, userEmail, userImage }: DashboardHeaderProps) {
  const router = useRouter();
  const firstName = userName.trim().split(/\s+/)[0] || "User";

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-border px-8 py-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" aria-label="Dashboard home">
          <Image
            src={getBrandAsset("mascot", "light")}
            alt=""
            width={32}
            height={32}
            priority
            className="hidden dark:block"
          />
          <Image
            src={getBrandAsset("mascot", "dark")}
            alt=""
            width={32}
            height={32}
            priority
            className="dark:hidden"
          />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Welcome {firstName}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Hint content="Search projects">
          <ActionButton
            tone="ghost"
            isIconOnly
            href="/projects"
            aria-label="Search projects"
            className="flex shrink-0 items-center justify-center rounded-full"
          >
            <Icon name="ph:magnifying-glass" label="Search" className={ICON} />
          </ActionButton>
        </Hint>

        <Dropdown>
          <Dropdown.Trigger aria-label="Shortcuts" className={ICON_TRIGGER}>
            <Icon name="ph:squares-four" label="Shortcuts" className={ICON} />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" className="min-w-44">
            <Dropdown.Menu aria-label="Shortcuts" onAction={(key) => router.push(String(key))}>
              {SHORTCUTS.map((item) => (
                <Dropdown.Item key={item.key} id={item.href} textValue={item.label}>
                  <Label>{item.label}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>

        <Hint content="Settings">
          <ActionButton
            tone="ghost"
            isIconOnly
            href="/settings"
            aria-label="Settings"
            className="flex shrink-0 items-center justify-center rounded-full"
          >
            <Icon name="ph:gear-six" label="Settings" className={ICON} />
          </ActionButton>
        </Hint>

        <Dropdown>
          <Dropdown.Trigger aria-label="Account menu" className={ICON_TRIGGER}>
            <UserAvatar name={userName} image={userImage} />
          </Dropdown.Trigger>
          <Dropdown.Popover placement="bottom end" className="min-w-60">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <UserAvatar name={userName} image={userImage} size="md" />
              <div className="min-w-0">
                <span className="block max-w-48 truncate text-sm font-semibold text-foreground">
                  {userName}
                </span>
                <span className="block max-w-48 truncate text-xs text-muted">{userEmail}</span>
              </div>
            </div>
            <Separator />
            <Dropdown.Menu
              aria-label="Account"
              onAction={(key) =>
                key === "sign-out" ? void handleSignOut() : router.push("/settings")
              }
            >
              <Dropdown.Item id="settings" textValue="Settings">
                <Icon name="ph:gear-six" className="text-muted" />
                <Label>Settings</Label>
              </Dropdown.Item>
              <Dropdown.Item id="sign-out" textValue="Sign out" variant="danger">
                <Icon name="ph:sign-out" />
                <Label>Sign out</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    </header>
  );
}
