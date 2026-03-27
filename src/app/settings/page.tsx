import { ExportPanel } from "@/components/settings/export-panel";
import { ArchivePanel } from "@/components/settings/archive-panel";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <ExportPanel />
      <ArchivePanel />
    </div>
  );
}
