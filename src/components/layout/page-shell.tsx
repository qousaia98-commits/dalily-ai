import { AppHeader } from "@/components/layout/app-header";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      {children}
    </div>
  );
}
