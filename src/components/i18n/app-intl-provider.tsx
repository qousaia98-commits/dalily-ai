"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { getI18nMessageFallback, onI18nError } from "@/lib/i18n/error-handling";

type Props = {
  messages: AbstractIntlMessages;
  children: React.ReactNode;
};

export function AppIntlProvider({ messages, children }: Props) {
  return (
    <NextIntlClientProvider
      messages={messages}
      onError={onI18nError}
      getMessageFallback={getI18nMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
