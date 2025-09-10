// api/upload.js
// Note: This demo expects JSON body with `folderId`, `name`, `type`, `url`
// The frontend will POST FormData or JSON here. For simplicity, we accept JSON.

let driveState = {
  folders: [
    { id: "1", name: "Folder 1", files: [] },
    { id: "2", name: "Folder 2", files: [] },
  ],
};

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ message: "Unauthorized" });

  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  try {
    const { folderId } = req.query || {};
    // Accept both JSON and raw body: prefer req.body if present
    const body = req.body || (await parseJson(req));
    const filename = body.name || req.headers["x-filename"] || "file";
    const contentType = body.type || req.headers["content-type"] || "application/octet-stream";
    const publicUrl = body.url || `/uploads/${Date.now()}-${filename}`;

    const folder = driveState.folders.find((f) => f.id === (folderId || body.folderId)) || driveState.folders[0];

    const file = {
      id: Date.now().toString(),
      name: filename,
      type: contentType,
      url: publicUrl,
      addedAt: Date.now(),
    };

    folder.files.push(file);
    return res.json({ files: folder.files });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ message: "Upload failed" });
  }
}

async function parseJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}
