import type { Metadata } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { BootstrapGate } from "@/components/layout/bootstrap-gate";
import { ThemeProvider } from "@/components/layout/theme-provider";

export const metadata: Metadata = {
  title: "Strength Log",
  description: "Mobile-first personal strength workout tracker"
};

const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `
        (function() {
          try {
            const theme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            const palette = localStorage.getItem('palette') || '0';
            document.documentElement.classList.add(theme);
            document.documentElement.setAttribute('data-palette', palette);
          } catch (e) {}
        })()
      `,
    }}
  />
);

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeProvider>
          <AppShell>
            <BootstrapGate>{children}</BootstrapGate>
          </AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
