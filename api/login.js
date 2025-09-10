// api/login.js
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || "local_dev_secret";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  try {
    // Sign in via Supabase: signInWithPassword (v2 client)
    const { data: signData, error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signErr || !signData?.user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = signData.user;

    // Lookup role from profiles table
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error("Profile lookup error:", profileErr);
      return res.status(500).json({ message: "Server error" });
    }

    const role = profile?.role;
    if (!role) {
      return res.status(403).json({ message: "No role assigned to user" });
    }

    // Create JWT to return to frontend (signed by your JWT_SECRET)
    const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: "12h" });

    return res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role },
    });
  } catch (err) {
    console.error("Login exception:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
