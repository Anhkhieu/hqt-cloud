// api/folders/delete.js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "files";

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { id } = req.body || JSON.parse(req.body || "{}");
    if (!id) return res.status(400).json({ error: "id required" });

    // get files under folder
    const { data: files } = await supabase.from("drive_files").select("id,path").eq("folder_id", id);
    const paths = (files || []).map((f) => f.path);

    if (paths.length) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (rmErr) console.warn("remove files error:", rmErr);
      // delete file records
      await supabase.from("drive_files").delete().in("id", files.map((f) => f.id));
    }

    // delete folder row
    const { error: delErr } = await supabase.from("drive_folders").delete().eq("id", id);
    if (delErr) throw delErr;

    return res.json({ success: true });
  } catch (err) {
    console.error("folders/delete error:", err);
    return res.status(500).json({ error: "Failed to delete folder" });
  }
}
