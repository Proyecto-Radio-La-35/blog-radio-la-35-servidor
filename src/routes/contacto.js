import express from "express";
import { supabase } from "../db/supabaseClient.js";
import nodemailer from "nodemailer";

const router = express.Router();

// Configurar nodemailer (usando Gmail como ejemplo)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Verificar token de autenticación
const verificarToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const token = authHeader.split(" ")[1];
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return res.status(401).json({ error: "Token inválido" });
  }
  
  req.user = user;
  next();
};

// Endpoint para enviar mensaje de contacto
router.post("/enviar", verificarToken, async (req, res) => {
  const { nombre, correo, asunto, mensaje } = req.body;
  
  // Validar que todos los campos estén completos
  if (!nombre || !correo || !asunto || !mensaje) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  const userId = req.user.id;

  try {
    // Insertar en la tabla mensajes_contacto
    const { data: mensajeData, error: mensajeError } = await supabase
      .from("mensajes_contacto")
      .insert([
        {
          id_usuario: userId,
          asunto: asunto,
          cuerpo_mensaje: mensaje,
          email: correo,
          fecha_publicacion: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (mensajeError) {
      console.error("Error al guardar mensaje:", mensajeError);
      return res.status(500).json({ error: "Error al guardar el mensaje" });
    }

    // Configurar el email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.CONTACT_EMAIL || "radio.la.35@example.com", // Email destino
      subject: `Nuevo mensaje de contacto: ${asunto}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>De:</strong> ${nombre}</p>
        <p><strong>Email:</strong> ${correo}</p>
        <p><strong>Asunto:</strong> ${asunto}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</p>
        <hr>
        <h3>Mensaje:</h3>
        <p>${mensaje}</p>
        <hr>
        <p><small>ID Usuario: ${userId}</small></p>
      `,
    };

    // Enviar el email
    await transporter.sendMail(mailOptions);

    res.json({ 
      success: true, 
      mensaje: "Mensaje enviado correctamente",
      data: mensajeData 
    });

  } catch (error) {
    console.error("Error al procesar mensaje de contacto:", error);
    res.status(500).json({ error: "Error al procesar el mensaje" });
  }
});

// Endpoint para obtener mensajes
router.get("/mensajes", verificarToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("mensajes_contacto")
      .select(`
        *,
        usuarios (nombre_usuario, email)
      `)
      .order("fecha_publicacion", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (error) {
    console.error("Error al obtener mensajes:", error);
    res.status(500).json({ error: "Error al obtener mensajes" });
  }
});

export default router;