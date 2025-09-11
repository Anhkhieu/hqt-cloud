import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { folderName } = JSON.parse(req.body);

    if (!folderName) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    // List all files in the folder
    const { data, error: listError } = await supabase.storage
      .from("files")
      .list(folderName);

    if (listError) throw listError;

    // Delete each file in the folder
    const paths = data.map((f) => `${folderName}/${f.name}`);
    const { error: deleteError } = await supabase.storage
      .from("files")
      .remove(paths);

    if (deleteError) throw deleteError;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Folder delete error:", err);
    res.status(500).json({ error: "Failed to delete folder" });
  }
}
