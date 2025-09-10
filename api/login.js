// /api/login.js
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

// Initialize Supabase client with SERVICE_ROLE_KEY
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method Not Allowed" });

  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: "Email and password required" });

  try {
    // Try signing in with Supabase Auth
    const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !session.user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = session.user;

    // Optional: check role from your Supabase users table
    // For example, you have a 'profiles' table with roles
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData?.role) {
      return res.status(403).json({ message: "No role assigned to user" });
    }

    const role = profileData.role; // submitter / previewer

    // Create a JWT for front-end usage
    const token = jwt.sign(
      { id: user.id, email: user.email, role },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, role },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}
