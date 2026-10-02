"use client";

import { useRouter } from "next/navigation";
import { UploadZone } from "./upload-zone";

// Hochladen ohne Arzneimittel (Medienbibliothek); danach die Seite neu laden.
export function LibraryUpload() {
  const router = useRouter();
  return <UploadZone productId={null} onUploaded={() => router.refresh()} />;
}
