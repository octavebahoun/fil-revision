import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import { cookies, headers } from "next/headers";
import type { CSSProperties } from "react";
import { DISPLAY_COOKIE, parseDisplayCookie } from "@/lib/settings";
import { Providers } from "@/components/providers/providers";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Fil", template: "%s · Fil" },
  description: "Fil t'aide à réviser tes cours, une chose à la fois. Reprends le fil.",
  applicationName: "Fil",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Fil", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1b202a" },
  ],
};

/**
 * Script de démarrage (avant le premier rendu) : résout le thème « système »
 * pour éviter tout flash clair → sombre au chargement.
 */
const BOOT = `(function(){try{var d=document.documentElement;var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){if(d.getAttribute('data-theme-pref')==='system'){d.setAttribute('data-theme',m.matches?'dark':'light')}}a();m.addEventListener('change',a);}catch(e){}})();`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const nonce = h.get("x-nonce") ?? undefined;
  const prefs = parseDisplayCookie(c.get(DISPLAY_COOKIE)?.value);
  const style = {
    "--reading-size": `${(1.125 * prefs.fontScale).toFixed(3)}rem`,
    "--reading-leading": String(prefs.lineHeight),
  } as CSSProperties;

  return (
    <html
      lang="fr"
      data-theme={prefs.theme === "system" ? "light" : prefs.theme}
      data-theme-pref={prefs.theme}
      data-font={prefs.font}
      data-motion={prefs.motion}
      className={atkinson.variable}
      style={style}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}
