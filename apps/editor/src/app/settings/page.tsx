import { AppearanceSettings } from "@/components/appearance-settings";

export default function SettingsPage(): React.JSX.Element {
  return (
    <main className="settings-page">
      <a className="back-link" href="/projects">← All Projects</a>
      <AppearanceSettings />
    </main>
  );
}
