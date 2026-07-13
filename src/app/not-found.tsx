import Link from "next/link";

export default function NotFoundPage() {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-4 text-center font-sans text-neutral-900 antialiased">
        <div className="space-y-2">
          <p className="text-sm font-medium text-blue-600">404</p>
          <h1 className="text-3xl font-bold tracking-tight">الصفحة غير موجودة</h1>
          <p className="max-w-md text-neutral-600">Page not found</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center rounded-xl bg-blue-600 px-6 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          العودة للرئيسية / Back home
        </Link>
      </body>
    </html>
  );
}
