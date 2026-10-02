import { requireUser } from "@/lib/auth";

export const metadata = {
  title: { default: "Verwaltung", template: "%s · Verwaltung · CareCore Medbase" },
  robots: { index: false },
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireUser();
  return children;
}
