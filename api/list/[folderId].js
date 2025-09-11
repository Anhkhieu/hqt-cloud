// api/list/[folderId].js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "files";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const folderId = req.query.folderId;
  if (!folderId) return res.status(400).json({ error: "Missing folderId" });

  try {
    const { data: files, error } = await supabase.from("drive_files").select("*").eq("folder_id", folderId).order("created_at", { ascending: true });
    if (error) throw error;

    const filesWithUrls = await Promise.all((files || []).map(async (f) => {
      const { data: urlData, error: urlErr } = await supabase.storage.from(BUCKET).createSignedUrl(f.path, 60 * 60);
      if (urlErr) {
        console.warn("signed url err", urlErr);
      }
      return {
        id: f.id,
        name: f.name,
        path: f.path,
        url: urlData?.signedUrl || null,
        mime: f.mime,
        size: f.size,
        created_at: f.created_at,
      };
    }));

    return res.json({ files: filesWithUrls });
  } catch (err) {
    console.error("list handler err:", err);
    return res.status(500).json({ error: "Failed to list files" });
  }
}
