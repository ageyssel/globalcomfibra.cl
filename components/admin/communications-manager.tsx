"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, LoaderCircle, RefreshCw, Send } from "@/components/icons";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { formatDate } from "@/lib/format";

type Template = { id: string; name: string; category: string; department: string; subject: string; body: string; active: boolean };
type Client = { empresa: string; rut: string; email: string; correo_facturacion: string | null };
type Message = { id: string; recipient: string; subject: string; department: string; status: string; provider_message_id: string | null; error_message: string | null; sent_at: string | null; created_at: string };

const variables = ["EMPRESA","RUT","CONTACTO","PLAN","DIRECCION","PERIODO","NUMERO_FACTURA","MONTO_TOTAL","FECHA_EMISION","FECHA_VENCIMIENTO","DEUDA_TOTAL","ESTADO_CUENTA","LINK_PORTAL","DETALLE"];

export function CommunicationsManager() {
  const [templates,setTemplates]=useState<Template[]>([]);
  const [clients,setClients]=useState<Client[]>([]);
  const [messages,setMessages]=useState<Message[]>([]);
  const [templateId,setTemplateId]=useState("");
  const [clientRut,setClientRut]=useState("");
  const [manualTo,setManualTo]=useState("");
  const [department,setDepartment]=useState("Facturación y Cobranza");
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  const [detail,setDetail]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  const load=useCallback(async()=>{
    const supabase=getSupabaseBrowserClient();
    const [t,c,m]=await Promise.all([
      supabase.from("email_templates").select("*").eq("active",true).order("category").order("name"),
      supabase.from("clientes").select("empresa,rut,email,correo_facturacion").is("deleted_at",null).order("empresa"),
      supabase.from("email_messages").select("id,recipient,subject,department,status,provider_message_id,error_message,sent_at,created_at").order("created_at",{ascending:false}).limit(100),
    ]);
    const first=t.error||c.error||m.error;if(first)setError(first.message);
    setTemplates((t.data??[]) as Template[]);setClients((c.data??[]) as Client[]);setMessages((m.data??[]) as Message[]);
  },[]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedClient=useMemo(()=>clients.find((client)=>client.rut===clientRut),[clients,clientRut]);

  function loadTemplate(id:string){
    setTemplateId(id);const template=templates.find((item)=>item.id===id);
    if(template){setDepartment(template.department);setSubject(template.subject);setBody(template.body);}
  }
  function insertVariable(variable:string){
    setBody((current)=>`${current}${current.endsWith("\n")||!current?"":" "}[${variable}]`);
  }
  async function saveTemplate(){
    const name=window.prompt("Nombre para la plantilla:");
    if(!name||!subject.trim()||!body.trim())return;
    setSaving(true);setError("");
    const {error:insertError}=await getSupabaseBrowserClient().from("email_templates").insert({name,category:"personalizada",department,subject,body,shared:true});
    if(insertError)setError(insertError.message);else{setSuccess("Plantilla guardada para el equipo.");await load();}
    setSaving(false);
  }
  async function sendMessage(event:React.FormEvent){
    event.preventDefault();setSaving(true);setError("");setSuccess("");
    const {data,error:invokeError}=await getSupabaseBrowserClient().functions.invoke("send-globalcom-email",{body:{
      clientRut:clientRut||null,to:clientRut?null:manualTo,department,subject,message:body,detail,
      templateId:templateId||null,messageType:"custom"
    }});
    if(invokeError||data?.error)setError(data?.error??invokeError?.message??"No fue posible enviar.");
    else{setSuccess("Correo enviado correctamente con copia oculta a contacto@globalcomfibra.cl.");setSubject("");setBody("");setDetail("");setTemplateId("");await load();}
    setSaving(false);
  }

  return <div className="admin-page">
    <div className="admin-heading"><div><h1>Central de comunicaciones</h1><p>Correos corporativos, plantillas compartidas, variables por cliente e historial de envíos.</p></div><button className="button-secondary !w-auto" onClick={()=>void load()}><RefreshCw size={17}/> Actualizar</button></div>
    {error&&<div className="alert alert-error">{error}</div>}{success&&<div className="alert alert-success">{success}</div>}
    <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
      <section className="surface p-6">
        <form className="grid gap-4" onSubmit={sendMessage}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="field"><label>Plantilla</label><select value={templateId} onChange={(event)=>loadTemplate(event.target.value)}><option value="">Correo nuevo</option>{templates.map((template)=><option key={template.id} value={template.id}>{template.category} · {template.name}</option>)}</select></div>
            <div className="field"><label>Departamento / firma</label><select value={department} onChange={(event)=>setDepartment(event.target.value)}><option>Facturación y Cobranza</option><option>Gerencia Comercial</option><option>Soporte Técnico - NOC</option><option>Gerencia General</option></select></div>
            <div className="field"><label>Cliente registrado</label><select value={clientRut} onChange={(event)=>{setClientRut(event.target.value);if(event.target.value)setManualTo("");}}><option value="">Destinatario manual</option>{clients.map((client)=><option key={client.rut} value={client.rut}>{client.empresa} · {client.correo_facturacion||client.email}</option>)}</select></div>
            <div className="field"><label>Correo manual</label><input type="email" disabled={Boolean(clientRut)} required={!clientRut} value={manualTo} onChange={(event)=>setManualTo(event.target.value)} placeholder="destinatario@empresa.cl"/></div>
          </div>
          {selectedClient&&<div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm"><strong>{selectedClient.empresa}</strong><span className="ml-2 font-mono text-xs">{selectedClient.rut}</span><span className="block text-xs text-slate-600">Destino: {selectedClient.correo_facturacion||selectedClient.email}</span></div>}
          <div className="field"><label>Asunto</label><input required value={subject} onChange={(event)=>setSubject(event.target.value)}/></div>
          <div><label className="text-sm font-bold">Variables</label><div className="mt-2 flex flex-wrap gap-1">{variables.map((variable)=><button type="button" key={variable} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-blue-100" onClick={()=>insertVariable(variable)}>[{variable}]</button>)}</div></div>
          <div className="field"><label>Mensaje</label><textarea required rows={12} value={body} onChange={(event)=>setBody(event.target.value)} placeholder="Escribe el mensaje. Las variables se reemplazarán en el servidor."/></div>
          <div className="field"><label>Detalle técnico opcional para [DETALLE]</label><textarea rows={3} value={detail} onChange={(event)=>setDetail(event.target.value)}/></div>
          <div className="flex flex-wrap gap-2"><button type="button" className="button-secondary !w-auto" onClick={()=>void saveTemplate()} disabled={saving}><FileText size={17}/> Guardar plantilla</button><button className="button-primary !w-auto" disabled={saving}>{saving?<><LoaderCircle className="animate-spin" size={17}/> Enviando…</>:<><Send size={17}/> Enviar correo</>}</button></div>
          <p className="text-xs text-slate-500">Todos los envíos incorporan el diseño y firma Globalcom, reply-to corporativo y copia oculta a contacto@globalcomfibra.cl.</p>
        </form>
      </section>
      <section className="surface p-5"><h2 className="text-xl font-black">Historial reciente</h2><div className="mt-4 grid max-h-[780px] gap-3 overflow-auto">{messages.length===0?<p className="text-sm text-slate-500">Aún no hay envíos.</p>:messages.map((message)=><div key={message.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><strong className="block text-sm">{message.subject}</strong><span className="block text-xs text-slate-500">{message.recipient}</span></div><span className={`badge ${message.status==="sent"?"badge-green":message.status==="failed"?"badge-red":"badge-blue"}`}>{message.status==="sent"?"Enviado":message.status==="failed"?"Fallido":"En cola"}</span></div><div className="mt-2 text-xs text-slate-500">{message.department} · {formatDate(message.sent_at||message.created_at)}</div>{message.error_message&&<p className="mt-2 text-xs text-red-600">{message.error_message}</p>}</div>)}</div></section>
    </div>
  </div>;
}
