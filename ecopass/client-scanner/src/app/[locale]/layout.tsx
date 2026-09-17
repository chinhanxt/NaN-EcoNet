import "@/app/globals.css";
import { MotionConfig } from "motion/react";
import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { monaSans } from "@/app/fonts";

export async function generateMetadata(): Promise<Metadata> {
  return {
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "EcoPass",
    },
    applicationName: "EcoPass",
    description: "EcoPass - Vietnam Phygital Waste-to-Reward & Survey Platform",
    icons: {
      apple: "../img/icon.png",
      icon: "../favicon.ico",
    },
    manifest: "/manifest.json",
    openGraph: {
      siteName: "EcoPass",
      title: "EcoPass",
      type: "website",
    },
    title: "EcoPass - Scan & Earn Rewards",
  };
}

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: [
    { color: "#f4f8fb", media: "(prefers-color-scheme: light)" },
    { color: "#13171e", media: "(prefers-color-scheme: dark)" },
  ],
  viewportFit: "cover",
  width: "device-width",
};

/**
 * Applies the stored OLED preference before first paint, so a true-black
 * theme never flashes through the default dark surface.
 */
const oledPrepaintScript = `try{if(localStorage.getItem("oled")==="true"){document.documentElement.setAttribute("data-theme","oled")}}catch(e){}`;

export default async function LocaleLayout(props: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const params = await props.params;
  const { locale } = params;
  const { children } = props;
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: "Layout" });

  // "cz" is the URL segment; the BCP 47 language code for Czech is "cs".
  const htmlLang = locale === "cz" ? "cs" : locale;

  return (
    <html className={monaSans.variable} lang={htmlLang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: oledPrepaintScript }} />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <MotionConfig reducedMotion="user">
            <a
              className="sr-only-focusable bg-accent text-accent-foreground focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:font-medium focus:text-sm focus:shadow-elev-3 focus:transition-none"
              href="#main"
            >
              {t("skiptomain")}
            </a>
            {children}
          </MotionConfig>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
