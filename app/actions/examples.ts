"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { query, transaction } from "@/lib/db";
import { deleteObjects } from "@/lib/storage";
import { failure, type ActionResult } from "./result";

// Beispieldaten entfernen (nach dem ersten Swissmedic-Import). Von Hand geänderte Beispiele gelten als „manuell“
// und bleiben erhalten.
export async function removeExamplesAction(): Promise<ActionResult> {
  try {
    const user = await actionUser("admin");
    const { count, keys } = await transaction(async (client) => {
      const images = await query<{ storage_key: string | null; thumb_key: string | null }>(
        `DELETE FROM medbase_images WHERE product_id IN (SELECT id FROM medbase_products WHERE source = 'beispiel')
         RETURNING storage_key, thumb_key`,
        [],
        client,
      );
      const removed = await query("DELETE FROM medbase_products WHERE source = 'beispiel' RETURNING id", [], client);
      await query(
        `DELETE FROM medbase_substances s WHERE NOT EXISTS (SELECT 1 FROM medbase_product_substances ps WHERE ps.substance_id = s.id)`,
        [],
        client,
      );
      await query(
        `DELETE FROM medbase_companies c WHERE NOT EXISTS (SELECT 1 FROM medbase_products p WHERE p.company_id = c.id)`,
        [],
        client,
      );
      await audit(
        user.id,
        "geloescht",
        "beispieldaten",
        null,
        `${removed.length} Beispielarzneimittel entfernt`,
        client,
      );
      return { count: removed.length, keys: images.flatMap((image) => [image.storage_key, image.thumb_key]) };
    });
    await deleteObjects([...new Set(keys)]);
    revalidatePath("/", "layout");
    return { ok: true, message: `${count} Beispielarzneimittel entfernt` };
  } catch (error) {
    return failure(error);
  }
}
