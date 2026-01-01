import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import contenidoRoutes from "./routes/contenido.js";
import contactoRoutes from "./routes/contacto.js";
import adminsRoutes from "./routes/admins.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: ["http://localhost:3000", "https://radio-la-35.netlify.app", "https://radio-la-35.vercel.app"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

app.use(express.json());

app.use("/auth", authRoutes);
app.use("/contenido", contenidoRoutes);
app.use("/contacto", contactoRoutes);
app.use("/admins", adminsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Servidor iniciado en puerto ${PORT}`));
