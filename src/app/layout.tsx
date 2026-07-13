import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeProvider } from "@/components/shared/theme-provider";
import { localeDirection } from "@/lib/i18n/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const direction = localeDirection[locale as keyof typeof localeDirection] ?? "rtl";

  return (
    <html
      lang={locale}
      dir={direction}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable}`}
    >
      <body className="min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
