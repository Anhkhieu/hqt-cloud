import { supabase } from "@/lib/supabaseClient";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { folderId } = req.query;
  const token = req.headers.authorization?.split(" ")[1];

  // TODO: validate token (same as login.js)

  const fileName = req.headers["x-filename"];
  const contentType = req.headers["content-type"];
  const buffer = Buffer.from(await req.arrayBuffer());

  // upload to Supabase bucket
  const { error } = await supabase.storage
    .from("drive")
    .upload(`${folderId}/${fileName}`, buffer, {
      contentType,
      upsert: true,
    });

  if (error) return res.status(500).json({ error: error.message });

  // ✅ generate signed URL (valid 7 days)
  const { data: signed } = await supabase.storage
    .from("drive")
    .createSignedUrl(`${folderId}/${fileName}`, 60 * 60 * 24 * 7);

  res.json({
    success: true,
    file: {
      name: fileName,
      type: contentType,
      url: signed.signedUrl, // front-end can preview
    },
  });
}
