import express from "express";
import { supabase } from "../db/supabaseClient.js";

const router = express.Router();

const ADMIN_EMAILS = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map(email => email.trim())
  : [];

// Registro
router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) return res.status(400).json({ error: error.message });

  const isAdmin = ADMIN_EMAILS.includes(email);

  res.json({ user: data.user, isAdmin });
});

// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) return res.status(400).json({ error: error.message });

  const isAdmin = ADMIN_EMAILS.includes(email);

  res.json({ user: data.user, session: data.session, isAdmin });
});

export default router;
