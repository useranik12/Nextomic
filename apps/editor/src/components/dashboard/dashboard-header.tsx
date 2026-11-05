"use client";

import {
  Avatar,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Tooltip
} from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrandAsset } from "@/lib/assets";
import { Icon } from "@/lib/icons/Icon";
import { authClient } from "@/lib/auth-client";

export interface DashboardHeaderProps {
  userName: string;
  userImage?: string | null;
}

const SHORTCUTS = [
  { key: "new-project", label: "New Project", href: "/projects?new=1" },
  { key: "all-projects", label: "All Projects", href: "/projects" },
  { key: "settings", label: "Settings", href: "/settings" }
];

export function DashboardHeader({ userName, userImage }: DashboardHeaderProps) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-divider px-8 py-4">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" aria-label="Dashboard home">
          <Image src={getBrandAsset("name-logo", "dark")} alt="" width={32} height={32} priority />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Welcome {userName}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Tooltip content="Search projects">
          <Button
            isIconOnly
            variant="light"
            as={Link}
            href="/projects"
            aria-label="Search projects"
          >
            <Icon name="ph:magnifying-glass" label="Search" />
          </Button>
        </Tooltip>

        <Dropdown>
          <DropdownTrigger>
            <Button isIconOnly variant="light" aria-label="Shortcuts">
              <Icon name="ph:squares-four" label="Shortcuts" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Shortcuts" items={SHORTCUTS}>
            {(item) => (
              <DropdownItem key={item.key} href={item.href}>
                {item.label}
              </DropdownItem>
            )}
          </DropdownMenu>
        </Dropdown>

        <Tooltip content="Settings">
          <Button isIconOnly variant="light" as={Link} href="/settings" aria-label="Settings">
            <Icon name="ph:gear-six" label="Settings" />
          </Button>
        </Tooltip>

        <Dropdown>
          <DropdownTrigger>
            <Button isIconOnly variant="light" aria-label="Account menu" className="rounded-full">
              <Avatar size="sm" src={userImage ?? undefined} name={userName} />
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Account">
            <DropdownItem key="settings" href="/settings">
              Appearance settings
            </DropdownItem>
            <DropdownItem
              key="sign-out"
              color="danger"
              startContent={<Icon name="ph:sign-out" />}
              onPress={handleSignOut}
            >
              Sign out
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </header>
  );
}
