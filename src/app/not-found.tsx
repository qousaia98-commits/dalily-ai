import Link from "next/link";
import Image from "next/image";
import { BRAND } from "@/lib/brand/tokens";

export default function NotFoundPage() {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>{BRAND.nameAr} — الصفحة غير موجودة</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body className="flex min-h-screen flex-col items-center justify-center gap-8 bg-white px-4 text-center font-sans text-[#0B1526] antialiased">
        <Image src="/logo-dark.svg" alt={BRAND.name} width={200} height={55} unoptimized priority />
        <div className="space-y-2">
          <p className="text-sm font-medium text-[#C4A052]">404</p>
          <h1 className="text-3xl font-bold tracking-tight">الصفحة غير موجودة</h1>
          <p className="max-w-md text-[#5C6478]">Page not found</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0B1526] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          العودة للرئيسية / Back home
        </Link>
      </body>
    </html>
  );
}
