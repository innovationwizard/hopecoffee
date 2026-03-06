import { requireAuth } from "@/lib/services/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();

  return <AppShell session={session}>{children}</AppShell>;
}
