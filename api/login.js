import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { username, password } = req.body;

  // TODO: Replace with Supabase auth check
  // Example: allow only 2 users for demo
  let user = null;
  if (username === "submitter" && password === "123") user = { username, role: "submitter" };
  else if (username === "previewer" && password === "123") user = { username, role: "previewer" };
  else return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "12h" });

  res.json({ token, user });
}
