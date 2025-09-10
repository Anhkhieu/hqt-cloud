// /api/list/[folderId].js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // must be service role key
);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { folderId } = req.query;

  try {
    // List all files under the folderId path
    const { data, error } = await supabase.storage
      .from("files") // bucket name must exist
      .list(folderId, {
        limit: 100, // adjust if needed
        offset: 0,
      });

    if (error) {
      console.error("Supabase list error:", error);
      return res.status(500).json({ error: "Failed to fetch files" });
    }

    // Generate signed URLs so previewer can access files
    const filesWithUrls = await Promise.all(
      data.map(async (file) => {
        const { data: urlData } = await supabase.storage
          .from("files")
          .createSignedUrl(`${folderId}/${file.name}`, 60 * 60); // 1 hour expiry

        return {
          name: file.name,
          path: `${folderId}/${file.name}`,
          url: urlData?.signedUrl || null,
          type: guessMimeType(file.name),
          size: file.metadata?.size || 0,
        };
      })
    );

    return res.status(200).json({ files: filesWithUrls });
  } catch (err) {
    console.error("List handler error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Simple MIME type guessing by file extension.
 */
function guessMimeType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "pdf":
      return "application/pdf";
    case "txt":
      return "text/plain";
    case "doc":
    case "docx":
      return "application/msword";
    case "xls":
    case "xlsx":
      return "application/vnd.ms-excel";
    default:
      return "application/octet-stream";
  }
}
