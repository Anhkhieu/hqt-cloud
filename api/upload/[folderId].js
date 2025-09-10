// /api/upload/[folderId].js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // must be the service role key
);

export const config = {
  api: {
    bodyParser: false, // we handle file streams manually
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { folderId } = req.query;

  try {
    // Parse multipart/form-data using formidable
    const formidable = (await import("formidable")).default;
    const form = formidable({ multiples: true });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error("Form parse error:", err);
        return res.status(500).json({ error: "File parsing failed" });
      }

      // Ensure files exist
      if (!files.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Handle multiple or single files
      const fileArray = Array.isArray(files.file) ? files.file : [files.file];
      const uploadedFiles = [];

      for (const f of fileArray) {
        const fs = await import("fs");
        const path = f.filepath || f.path;
        const fileBuffer = fs.readFileSync(path);

        // Generate unique filename
        const fileName = `${Date.now()}-${f.originalFilename}`;
        const storagePath = `${folderId}/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("files") // bucket name must exist in Supabase
          .upload(storagePath, fileBuffer, {
            contentType: f.mimetype,
            upsert: true,
          });

        if (uploadError) {
          console.error("Supabase upload error:", uploadError);
          return res.status(500).json({ error: "Upload failed" });
        }

        uploadedFiles.push({
          name: f.originalFilename,
          path: storagePath,
          type: f.mimetype,
        });
      }

      return res.status(200).json({ success: true, files: uploadedFiles });
    });
  } catch (error) {
    console.error("Handler error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
}
