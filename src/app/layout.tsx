import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={GeistSans.variable}>
      <head>
        <script
          id="theme-script"
          suppressHydrationWarning
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
        <link rel="apple-touch-icon" href="/icon-512.svg" />
      </head>
      <body suppressHydrationWarning className={GeistSans.className}>
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
