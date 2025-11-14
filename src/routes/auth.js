import express from "express";
import { supabase } from "../db/supabaseClient.js";

const router = express.Router();

function getAdmins() {
  try {
    const data = fs.readFileSync(adminFilePath, "utf8");  // Leer el archivo JSON
    const parsedData = JSON.parse(data);  // Parsear el JSON
    return parsedData.admins || [];  // Devolver la lista de administradores
  } catch (error) {
    console.error("Error al leer el archivo de administradores:", error);
    return [];  // Retornar un array vacío en caso de error
  }
}

const ADMIN_EMAILS = getAdmins();

// Registro
router.post("/register", async (req, res) => {
  const { email, password, userName } = req.body;
  
  // Realizar el registro en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) return res.status(400).json({ error: authError.message });

  const userId = authData.user.id;
  const isAdmin = ADMIN_EMAILS.includes(email); // Verifica si es admin

  if (userId) {
    // Insertar en la tabla 'usuarios'
    const { data: usuarioData, error: usuarioError } = await supabase
      .from("usuarios")
      .insert([{
        id_usuario: userId,
        nombre_usuario: userName,
        contrasenia: password,
        email: email,
        fecha_registro: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);

    if (usuarioError) {
      return res.status(500).json({ error: usuarioError.message });
    }

    // Si es un administrador, insertar también en la tabla 'administradores'
    if (isAdmin) {
      const { data: adminData, error: adminError } = await supabase
        .from("administradores")
        .insert([{
          id_miembro: userId,
          id_usuario: userId, 
          nombre: userName.split(" ")[0],
          apellido: userName.split(" ")[1] || "",
          biografia: "",
          foto_url: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (adminError) {
        return res.status(500).json({ error: adminError.message });
      }
    }
  }

  res.json({ 
    user: authData.user, 
    isAdmin, 
    userName
  });
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
  const userId = data.user.id;
  let userName = null;

  if (userId) {
    const { data: usuario, error: usuarioError } = await supabase
      .from("usuarios")
      .select("nombre_usuario")
      .eq("id_usuario", userId)
      .single();

    if (usuario && !usuarioError) {
      userName = usuario.nombre_usuario;
    }
  }

  res.json({ 
    user: data.user, 
    session: data.session, 
    isAdmin, 
    userName
  });
});

export default router;
