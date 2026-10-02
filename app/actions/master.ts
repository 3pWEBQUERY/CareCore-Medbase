"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { deleteMaster, MasterError, mergeMaster, saveMaster, type MasterKind } from "@/lib/admin-master";
import { failure, type ActionResult } from "./result";

const KINDS: MasterKind[] = ["form", "substance", "company", "atc"];
const validId = (kind: MasterKind, id: string) =>
  kind === "form" ? /^\d+$/.test(id) : kind === "atc" ? /^[A-Z0-9]{1,7}$/.test(id) : /^[0-9a-f-]{36}$/.test(id);

export async function saveMasterAction(
  kind: MasterKind,
  id: string | null,
  values: Record<string, unknown>,
): Promise<ActionResult> {
  try {
    const user = await actionUser();
    if (!KINDS.includes(kind) || (id !== null && !validId(kind, id))) return { ok: false, error: "Ungültige Angabe." };
    await saveMaster(user.id, kind, id, values);
    revalidatePath("/", "layout");
    return { ok: true, message: id ? "Änderungen gespeichert" : "Eintrag angelegt" };
  } catch (error) {
    return failure(error, [MasterError]);
  }
}

export async function deleteMasterAction(kind: MasterKind, id: string): Promise<ActionResult> {
  try {
    const user = await actionUser();
    if (!KINDS.includes(kind) || !validId(kind, id)) return { ok: false, error: "Ungültige Angabe." };
    await deleteMaster(user.id, kind, id);
    revalidatePath("/", "layout");
    return { ok: true, message: "Eintrag gelöscht" };
  } catch (error) {
    return failure(error, [MasterError]);
  }
}

export async function mergeMasterAction(
  kind: "substance" | "company",
  sourceId: string,
  targetName: string,
): Promise<ActionResult> {
  try {
    const user = await actionUser();
    if (!["substance", "company"].includes(kind) || !validId(kind, sourceId))
      return { ok: false, error: "Ungültige Angabe." };
    await mergeMaster(user.id, kind, sourceId, targetName);
    revalidatePath("/", "layout");
    return { ok: true, message: "Einträge zusammengeführt" };
  } catch (error) {
    return failure(error, [MasterError]);
  }
}
