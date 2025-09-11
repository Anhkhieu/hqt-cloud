// /api/folders/rename.js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { oldName, newName } = JSON.parse(req.body);
    if (!oldName || !newName) return res.status(400).json({ error: "Missing folder names" });

    const { data, error: listError } = await supabase.storage.from("files").list(oldName);
    if (listError) throw listError;

    // Copy each file to new folder and delete old
    for (const f of data) {
      const from = `${oldName}/${f.name}`;
      const to = `${newName}/${f.name}`;

      const { data: download } = await supabase.storage.from("files").download(from);
      await supabase.storage.from("files").upload(to, download, { upsert: true });
    }
    const paths = data.map((f) => `${oldName}/${f.name}`);
    if (paths.length) await supabase.storage.from("files").remove(paths);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Rename error:", err);
    res.status(500).json({ error: "Failed to rename folder" });
  }
}
