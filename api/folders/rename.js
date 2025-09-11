// api/folders/rename.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "files";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { id, newName } = req.body || JSON.parse(req.body || "{}");
    if (!id || !newName) return res.status(400).json({ error: "id and newName required" });

    // get old folder
    const { data: folder } = await supabase.from("drive_folders").select("name").eq("id", id).single();
    if (!folder) return res.status(404).json({ error: "Folder not found" });
    const oldName = folder.name;

    // list files metadata in DB
    const { data: files } = await supabase.from("drive_files").select("*").eq("folder_id", id);

    // move each file in storage and update DB path
    for (const f of files || []) {
      const oldPath = f.path; // stored path
      const fileName = f.name;
      const newPath = `${newName}/${fileName}`;

      // download file from storage
      const { data: downloadData, error: dlErr } = await supabase.storage.from(BUCKET).download(oldPath);
      if (dlErr) {
        console.error("download error:", dlErr);
        throw dlErr;
      }

      // upload to new path
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, downloadData, { upsert: true });
      if (upErr) throw upErr;

      // remove old file
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([oldPath]);
      if (rmErr) console.warn("remove old file warning:", rmErr);

      // update DB record path
      const { error: updateErr } = await supabase.from("drive_files").update({ path: newPath }).eq("id", f.id);
      if (updateErr) throw updateErr;
    }

    // rename folder row
    const { data: updated, error: updateFolderErr } = await supabase.from("drive_folders").update({ name: newName }).eq("id", id).select("id,name").single();
    if (updateFolderErr) throw updateFolderErr;

    return res.json({ folder: updated });
  } catch (err) {
    console.error("folders/rename error:", err);
    return res.status(500).json({ error: "Failed to rename folder" });
  }
}
