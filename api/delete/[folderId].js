// api/delete/[folderId].js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "files";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
  try {
    const folderId = req.query.folderId;
    const { fileId } = req.body || JSON.parse(req.body || "{}");
    if (!folderId || !fileId) return res.status(400).json({ error: "folderId and fileId required" });

    const { data: fileRow, error: qErr } = await supabase.from("drive_files").select("path").eq("id", fileId).single();
    if (qErr) throw qErr;
    if (!fileRow) return res.status(404).json({ error: "File not found" });

    // remove storage object
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([fileRow.path]);
    if (rmErr) console.warn("storage remove error", rmErr);

    // delete DB row
    const { error: delErr } = await supabase.from("drive_files").delete().eq("id", fileId);
    if (delErr) throw delErr;

    return res.json({ success: true });
  } catch (err) {
    console.error("delete handler err:", err);
    return res.status(500).json({ error: "Failed to delete file" });
  }
}
