import { UserAdmin } from "@/app/components/user-admin";
import { listUsers } from "@/lib/admin-users";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Benutzer" };

export default async function UsersPage() {
  const me = await requireUser("admin");
  const users = await listUsers();
  return (
    <main className="workspace">
      <div className="page-heading">
        <div className="heading-copy">
          <p className="eyebrow">Verwaltung</p>
          <h1>Benutzer</h1>
          <p>Konten der Verwaltung. Der Katalog ist ohne Anmeldung zugänglich.</p>
        </div>
      </div>
      <section className="card">
        <UserAdmin users={users} selfId={me.id} />
      </section>
    </main>
  );
}
