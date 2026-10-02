"use server";

import { revalidatePath } from "next/cache";
import { actionUser, currentSessionHash } from "@/lib/auth";
import { changeOwnPassword, deleteUser, saveUser, UserError } from "@/lib/admin-users";
import { failure, type ActionResult } from "./result";

const validId = (value: string) => /^[0-9a-f-]{36}$/.test(value);

export async function saveUserAction(id: string | null, values: Record<string, unknown>): Promise<ActionResult> {
  try {
    const user = await actionUser("admin");
    if (id !== null && !validId(id)) return { ok: false, error: "Ungültiges Konto." };
    await saveUser(user.id, id, values);
    revalidatePath("/admin/benutzer");
    return { ok: true, message: id ? "Konto gespeichert" : "Konto angelegt" };
  } catch (error) {
    return failure(error, [UserError]);
  }
}

export async function deleteUserAction(id: string): Promise<ActionResult> {
  try {
    const user = await actionUser("admin");
    if (!validId(id)) return { ok: false, error: "Ungültiges Konto." };
    await deleteUser(user.id, id);
    revalidatePath("/admin/benutzer");
    return { ok: true, message: "Konto gelöscht" };
  } catch (error) {
    return failure(error, [UserError]);
  }
}

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  try {
    const user = await actionUser();
    await changeOwnPassword(
      user.id,
      String(current).slice(0, 200),
      String(next).slice(0, 200),
      await currentSessionHash(),
    );
    return { ok: true, message: "Passwort geändert. Andere Geräte wurden abgemeldet." };
  } catch (error) {
    return failure(error, [UserError]);
  }
}
