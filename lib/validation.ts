import { z } from "zod";

export const clientSchema = z.object({
  empresa: z.string().trim().min(2).max(160),
  rut: z.string().trim().min(7).max(14),
  email: z.email(),
  password: z.string().min(10).max(128),
  contacto: z.string().trim().max(120).optional(),
  correo_facturacion: z.email().optional().or(z.literal("")),
  direccion: z.string().trim().max(240).optional(),
  plan: z.string().trim().max(100).optional(),
  dias_pago: z.coerce.number().int().min(0).max(180).default(30)
});

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(100),
  company: z.string().trim().min(2).max(160),
  email: z.email(),
  phone: z.string().trim().min(8).max(30),
  commune: z.string().trim().min(2).max(100),
  service: z.string().trim().min(2).max(100),
  message: z.string().trim().max(1500).optional(),
  website: z.string().max(0).optional()
});
