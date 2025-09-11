import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { folderName } = JSON.parse(req.body);

    if (!folderName) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    // Upload an empty placeholder file so Supabase creates the folder
    const { error } = await supabase.storage
      .from("files")
      .upload(`${folderName}/.keep`, new Uint8Array());

    if (error) throw error;

    return res.status(200).json({ success: true, folder: folderName });
  } catch (err) {
    console.error("Folder create error:", err);
    res.status(500).json({ error: "Failed to create folder" });
  }
}
