import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET, publicUrl } from "@/lib/supabase/cms";
import { AdminButton, friendlyError } from "@/components/admin/cms";

const ALLOWED: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };
const MAX = 10 * 1024 * 1024;

/** Uploads one image to site-public/portfolio and returns its public URL. Admin-only via storage policies. */
export function UploadImageButton({ onUploaded, label = "Upload image" }: { onUploaded: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(file: File | undefined) {
    if (!file) return;
    const ext = ALLOWED[file.type];
    if (!ext) return void toast.error("Only JPG, PNG, WebP or AVIF images.");
    if (file.size > MAX) return void toast.error("Image is larger than 10 MB.");
    setBusy(true);
    const base = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "image";
    const path = `portfolio/${base}-${Date.now().toString(36)}.${ext}`;
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
    setBusy(false);
    if (input.current) input.current.value = "";
    if (error) return void toast.error(friendlyError(error));
    onUploaded(publicUrl(path));
    toast.success("Image uploaded");
  }
  return (
    <>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" tabIndex={-1} onChange={(e) => pick(e.target.files?.[0])} />
      <AdminButton size="sm" disabled={busy} onClick={() => input.current?.click()}><Upload className="size-3.5" aria-hidden /> {busy ? "Uploading…" : label}</AdminButton>
    </>
  );
}
