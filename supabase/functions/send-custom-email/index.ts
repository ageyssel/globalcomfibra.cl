import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, email, errorResponse, handleOptions, htmlEscape, HttpError, json, requireIdentity, sendEmail, text } from "../_shared/platform.ts";
serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== "POST") return json(req,{error:"Método no permitido."},405);
  try {
    const { user, admin } = await requireIdentity(req,["superadmin","admin","finance","commercial","support"]); const body=await req.json(); const to=email(body.to ?? body.email); const subject=text(body.subject ?? body.asunto,180); const message=text(body.message ?? body.mensaje,5000);
    if(subject.length<3 || message.length<1) throw new HttpError(400,"Asunto y mensaje son obligatorios.");
    await sendEmail({to,subject,html:`<div style="font-family:Arial,sans-serif;line-height:1.6">${htmlEscape(message).replaceAll("\n","<br>")}</div>`});
    await audit(admin,user,"send_email","communications",{record_type:"email",record_label:subject,to}); return json(req,{success:true});
  } catch(cause){return errorResponse(req,cause);}
});
