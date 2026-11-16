/** Where the builder search can jump to: the settings sections (ids match the settings page). */
export interface SearchTarget {
  id: string;
  label: string;
  /** Extra words that also find it. */
  keywords: string;
  href: string;
}

export const SETTINGS_TARGETS: readonly SearchTarget[] = [
  {
    id: "profile",
    label: "Profile",
    keywords: "name image avatar photo email",
    href: "/settings#profile"
  },
  {
    id: "security",
    label: "Security",
    keywords: "password two-factor 2fa passkey sign in",
    href: "/settings#security"
  },
  {
    id: "appearance",
    label: "Appearance",
    keywords: "color mode dark light theme system",
    href: "/settings#appearance"
  },
  {
    id: "dependencies",
    label: "Dependencies",
    keywords: "packages libraries versions licenses",
    href: "/settings#dependencies"
  }
];

/** The settings sections that match the typed text (all of them for an empty text). */
export function matchSettings(text: string): SearchTarget[] {
  const needle = text.trim().toLowerCase();
  if (needle === "") return [...SETTINGS_TARGETS];
  return SETTINGS_TARGETS.filter((t) => `${t.label} ${t.keywords}`.toLowerCase().includes(needle));
}
