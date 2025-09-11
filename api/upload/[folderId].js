// api/upload/[folderId].js
import { createClient } from "@supabase/supabase-js";
import formidable from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "files";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const folderId = req.query.folderId;
  if (!folderId) return res.status(400).json({ error: "Missing folderId" });

  // get folder name
  const { data: folder, error: folderErr } = await supabase.from("drive_folders").select("name").eq("id", folderId).single();
  if (folderErr || !folder) {
    return res.status(400).json({ error: "Folder not found" });
  }
  const folderName = folder.name;

  const form = formidable({ multiples: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("form parse err:", err);
      return res.status(500).json({ error: "File parse failed" });
    }
    const fileArray = Array.isArray(files.file) ? files.file : [files.file];

    try {
      const uploaded = [];
      for (const f of fileArray) {
        const buffer = fs.readFileSync(f.filepath);
        const filename = `${Date.now()}-${f.originalFilename}`;
        const path = `${folderName}/${filename}`;

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
          contentType: f.mimetype,
          upsert: true,
        });
        if (upErr) throw upErr;

        // insert record in DB
        const { data: fileRow, error: insertErr } = await supabase
          .from("drive_files")
          .insert([{ folder_id: folderId, name: f.originalFilename, path, mime: f.mimetype, size: f.size }])
          .select()
          .single();
        if (insertErr) throw insertErr;

        // create signed url (1 hour)
        const { data: urlData, error: urlErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
        if (urlErr) throw urlErr;

        uploaded.push({
          id: fileRow.id,
          name: fileRow.name,
          path: fileRow.path,
          mime: fileRow.mime,
          size: fileRow.size,
          url: urlData.signedUrl,
        });
      }
      return res.json({ success: true, files: uploaded });
    } catch (e) {
      console.error("upload handler error:", e);
      return res.status(500).json({ error: "Upload failed" });
    }
  });
}
