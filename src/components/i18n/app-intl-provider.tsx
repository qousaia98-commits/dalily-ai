"use client";

import { useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { localeDirection, type Locale } from "@/lib/i18n/config";
import { getI18nMessageFallback, onI18nError } from "@/lib/i18n/error-handling";

type Props = {
  locale: string;
  messages: AbstractIntlMessages;
  children: React.ReactNode;
};

export function AppIntlProvider({ locale, messages, children }: Props) {
  useEffect(() => {
    const dir = localeDirection[locale as Locale] ?? "rtl";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={onI18nError}
      getMessageFallback={getI18nMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
