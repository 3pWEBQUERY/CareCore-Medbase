"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { deleteImage, ImageError, moveImage, setPrimaryImage, updateImage } from "@/lib/admin-images";
import { failure, type ActionResult } from "./result";

const validId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value);

async function run(work: (userId: string) => Promise<unknown>, message: string): Promise<ActionResult> {
  try {
    const user = await actionUser();
    await work(user.id);
    revalidatePath("/", "layout");
    return { ok: true, message };
  } catch (error) {
    return failure(error, [ImageError]);
  }
}

export async function updateImageAction(id: string, changes: { altText?: string; productId?: string | null }) {
  if (!validId(id) || (changes.productId != null && !validId(changes.productId)))
    return { ok: false, error: "Ungültige Angabe." } satisfies ActionResult;
  return run((userId) => updateImage(userId, id, changes), "Bild gespeichert");
}

export async function setPrimaryImageAction(id: string) {
  if (!validId(id)) return { ok: false, error: "Ungültiges Bild." } satisfies ActionResult;
  return run((userId) => setPrimaryImage(userId, id), "Hauptbild festgelegt");
}

export async function moveImageAction(id: string, direction: "up" | "down") {
  if (!validId(id) || !["up", "down"].includes(direction))
    return { ok: false, error: "Ungültiges Bild." } satisfies ActionResult;
  return run((userId) => moveImage(userId, id, direction), "Reihenfolge geändert");
}

export async function deleteImageAction(id: string) {
  if (!validId(id)) return { ok: false, error: "Ungültiges Bild." } satisfies ActionResult;
  return run((userId) => deleteImage(userId, id), "Bild gelöscht");
}
