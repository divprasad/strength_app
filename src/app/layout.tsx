import type { Metadata } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { BootstrapGate } from "@/components/layout/bootstrap-gate";

export const metadata: Metadata = {
  title: "Strength Log",
  description: "Mobile-first personal strength workout tracker"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>
          <BootstrapGate>{children}</BootstrapGate>
        </AppShell>
      </body>
    </html>
  );
}
