"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { deleteProduct, SaveError, saveProduct, validateProduct } from "@/lib/admin-products";
import { failure, type ActionResult } from "./result";

export async function saveProductAction(
  id: string | null,
  payload: unknown,
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const user = await actionUser();
    if (id !== null && !/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: "Ungültiges Arzneimittel." };
    const { input, errors } = validateProduct(payload);
    if (Object.keys(errors).length)
      return { ok: false, error: "Bitte die markierten Felder prüfen.", fieldErrors: errors };
    const saved = await saveProduct(user.id, id, input);
    revalidatePath("/", "layout");
    return { ok: true, message: id ? "Änderungen gespeichert" : "Arzneimittel angelegt", data: saved };
  } catch (error) {
    return failure(error, [SaveError]);
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    const user = await actionUser();
    if (!/^[0-9a-f-]{36}$/.test(id)) return { ok: false, error: "Ungültiges Arzneimittel." };
    const deleted = await deleteProduct(user.id, id);
    revalidatePath("/", "layout");
    return deleted
      ? { ok: true, message: "Arzneimittel gelöscht" }
      : { ok: false, error: "Das Arzneimittel gibt es nicht mehr." };
  } catch (error) {
    return failure(error);
  }
}
