import express from "express";
import { supabase } from "../db/supabaseClient.js";

const router = express.Router();

const ADMIN_EMAILS = process.env.ADMIN_EMAILS
  ? process.env.ADMIN_EMAILS.split(",").map(email => email.trim())
  : [];

// Middleware para verificar admin
const verificarAdmin = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ error: "No autorizado. Token requerido." });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error("Error al verificar usuario:", error);
      return res.status(401).json({ error: "Token inválido o expirado." });
    }

    if (!ADMIN_EMAILS.includes(user.email)) {
      return res.status(403).json({ error: "Acceso denegado. Solo administradores pueden realizar esta acción." });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Error en middleware de verificación:", err);
    return res.status(500).json({ error: "Error al verificar credenciales." });
  }
};

// Crear contenido (noticia, entrada o evento)
router.post("/crear", verificarAdmin, async (req, res) => {
  const { tipo, titulo, contenido, imagen } = req.body;

  console.log("Recibiendo solicitud de creación:", { tipo, titulo: titulo?.substring(0, 30) });

  // Validar tipo
  if (!["noticia", "entrada", "evento"].includes(tipo)) {
    return res.status(400).json({ error: "Tipo inválido. Debe ser 'noticia', 'entrada' o 'evento'." });
  }

  // Validar campos requeridos
  if (!titulo || !titulo.trim()) {
    return res.status(400).json({ error: "El título es requerido." });
  }

  if (!contenido || !contenido.trim()) {
    return res.status(400).json({ error: "El contenido es requerido." });
  }

  try {
    // Preparar datos para insertar
    const datosInsertar = {
      tipo,
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      imagen: imagen && imagen.trim() ? imagen.trim() : null,
      autor_email: req.user.email,
      created_at: new Date().toISOString()
    };

    console.log("Insertando en Supabase:", datosInsertar);

    const { data, error } = await supabase
      .from("publicaciones")
      .insert([datosInsertar])
      .select();

    if (error) {
      console.error("Error al insertar en Supabase:", error);
      return res.status(500).json({ 
        error: `Error al guardar en la base de datos: ${error.message}`,
        details: error 
      });
    }

    if (!data || data.length === 0) {
      console.error("No se retornaron datos después de la inserción");
      return res.status(500).json({ error: "Error: No se recibió confirmación de la base de datos." });
    }

    console.log("Contenido creado exitosamente:", data[0].id);
    res.status(201).json({ 
      success: true, 
      message: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} creada exitosamente`,
      data: data[0] 
    });
  } catch (err) {
    console.error("Error al crear contenido:", err);
    res.status(500).json({ 
      error: "Error interno del servidor al crear el contenido.",
      details: err.message 
    });
  }
});

// Obtener todo el contenido o filtrado por tipo
router.get("/", async (req, res) => {
  const { tipo } = req.query;

  try {
    let query = supabase
      .from("publicaciones")
      .select("*")
      .order("created_at", { ascending: false });

    if (tipo && ["noticia", "entrada", "evento"].includes(tipo)) {
      query = query.eq("tipo", tipo);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error al obtener contenido:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ 
      success: true,
      count: data.length,
      data 
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Obtener contenido por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("contenido")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error al obtener contenido:", error);
      return res.status(404).json({ error: "Contenido no encontrado." });
    }

    res.json({ 
      success: true,
      data 
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Actualizar contenido
router.put("/:id", verificarAdmin, async (req, res) => {
  const { id } = req.params;
  const { titulo, contenido, imagen } = req.body;

  try {
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (titulo !== undefined) updateData.titulo = titulo.trim();
    if (contenido !== undefined) updateData.contenido = contenido.trim();
    if (imagen !== undefined) updateData.imagen = imagen && imagen.trim() ? imagen.trim() : null;

    const { data, error } = await supabase
      .from("contenido")
      .update(updateData)
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error al actualizar:", error);
      return res.status(500).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Contenido no encontrado." });
    }

    res.json({ 
      success: true, 
      message: "Contenido actualizado exitosamente",
      data: data[0] 
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

// Eliminar contenido
router.delete("/:id", verificarAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from("contenido")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error al eliminar:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ 
      success: true, 
      message: "Contenido eliminado exitosamente" 
    });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Error interno del servidor." });
  }
});

export default router;
