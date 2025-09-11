import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;

  const { data: user, error } = await supabase.auth.admin.getUserByEmail(email);

  if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.session) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '24h' });

  res.status(200).json({ token });
}
