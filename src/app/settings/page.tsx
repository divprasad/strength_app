import { ExportPanel } from "@/components/settings/export-panel";
import { ArchivePanel } from "@/components/settings/archive-panel";
import { GymFeePanel } from "@/components/settings/gym-fee-panel";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <GymFeePanel />
      <ExportPanel />
      <ArchivePanel />
    </div>
  );
}
