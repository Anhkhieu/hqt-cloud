import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // List root folders (simulate folders by prefixes in bucket)
    const { data, error } = await supabase.storage
      .from("files")
      .list("", { limit: 100, offset: 0 });

    if (error) throw error;

    const folders = data.filter((item) => item.name && item.id === null); // Supabase marks folders differently
    return res.status(200).json({ folders });
  } catch (err) {
    console.error("Folder list error:", err);
    res.status(500).json({ error: "Failed to list folders" });
  }
}
