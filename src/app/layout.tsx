import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { BootstrapGate } from "@/components/layout/bootstrap-gate";
import { RegisterSW } from "@/components/layout/register-sw";
import { ThemeProvider } from "@/components/layout/theme-provider";

export const metadata: Metadata = {
  title: "Strength Log",
  description: "Mobile-first personal strength workout tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Strength Log",
  },
};

export const viewport: Viewport = {
  themeColor: "#131519",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <link rel="apple-touch-icon" href="/icon-512.svg" />
      </head>
      <body>
        <ThemeProvider>
          <AppShell>
            <BootstrapGate>{children}</BootstrapGate>
          </AppShell>
        </ThemeProvider>
        <RegisterSW />
      </body>
    </html>
  );
}

