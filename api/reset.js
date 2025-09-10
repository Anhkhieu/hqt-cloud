let driveState = { folders: [{ id: "1", name: "Folder 1", files: [] }] };

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  driveState = { folders: [{ id: "1", name: "Folder 1", files: [] }] };
  res.json({ folders: driveState.folders });
}
