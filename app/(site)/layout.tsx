import { AppShell } from "@/app/components/app-shell";
import { currentUser } from "@/lib/auth";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  return (
    <AppShell user={user ? { displayName: user.displayName, username: user.username, role: user.role } : null}>
      {children}
    </AppShell>
  );
}
