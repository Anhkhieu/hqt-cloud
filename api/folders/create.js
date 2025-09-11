// api/folders/create.js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { folderName } = req.body || JSON.parse(req.body || "{}");
    if (!folderName) return res.status(400).json({ error: "folderName required" });

    const { data, error } = await supabase.from("drive_folders").insert({ name: folderName }).select("id,name").single();
    if (error) {
      // if unique constraint violation, return existing
      if (error.code === "23505") {
        const { data: existing } = await supabase.from("drive_folders").select("id,name").eq("name", folderName).single();
        return res.json({ folder: existing });
      }
      throw error;
    }
    return res.json({ folder: data });
  } catch (err) {
    console.error("folders/create error:", err);
    return res.status(500).json({ error: "Failed to create folder" });
  }
}
