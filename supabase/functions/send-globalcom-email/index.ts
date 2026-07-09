import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { audit, email, errorResponse, handleOptions, HttpError, json, requireIdentity, text } from "../_shared/platform.ts";

type ClientRow = {
  empresa: string;
  rut: string;
  email: string;
  correo_facturacion?: string | null;
  contacto?: string | null;
  plan?: string | null;
  direccion?: string | null;
  dias_pago?: number | null;
};

function formatClp(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(value: unknown) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  };

  return String(value ?? "").replace(
    /[&<>'"]/g,
    (character) => entities[character] ?? character,
  );
}

function compactRut(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^0-9K]/g, "");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }

  return btoa(binary);
}

function replaceAll(source: string, values: Record<string, string>) {
  let result = source;
  for (const [key, value] of Object.entries(values)) result = result.replaceAll(`[${key}]`, value);
  return result;
}

serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return json(req, { error: "Método no permitido." }, 405);

  try {
    const { user, admin } = await requireIdentity(req, ["superadmin", "admin", "finance", "commercial", "support"]);
    const body = await req.json();
    const department = text(body.department, 100) || "Gerencia General";
    const messageType = text(body.messageType, 50) || "custom";
    const clientRut = text(body.clientRut, 30);
    const manualRecipient = text(body.to, 254);
    const invoiceId = text(body.invoiceId, 100);
    const detail = text(body.detail, 2000);

    let client: ClientRow | null = null;
    if (clientRut) {
      const compact = clientRut.toUpperCase().replace(/[^0-9K]/g, "");
      const { data, error: clientError } = await admin.from("clientes")
        .select("empresa,rut,email,correo_facturacion,contacto,plan,direccion,dias_pago");
      if (clientError) throw clientError;
      client = (data ?? []).find((item) => String(item.rut ?? "").toUpperCase().replace(/[^0-9K]/g, "") === compact) ?? null;
      if (!client) throw new HttpError(404, "Cliente no encontrado.");
    }

    const recipient = email(manualRecipient || client?.correo_facturacion || client?.email);
    let invoices: Array<Record<string, unknown>> = [];

    if (client) {
      const [{ data }, { data: sameEmailClients }] = await Promise.all([
        admin.from("facturas")
          .select("id,email_cliente,cliente_rut,mes_anio,folio,fecha_emision,fecha_vencimiento,valor_total,estado,storage_path,url_archivo")
          .eq("email_cliente", client.email)
          .is("deleted_at", null)
          .order("fecha_emision", { ascending: false }),
        admin.from("clientes")
          .select("rut")
          .eq("email", client.email)
          .is("deleted_at", null),
      ]);

      const uniqueEmailOwner = (sameEmailClients ?? []).length === 1;
      invoices = (data ?? []).filter((invoice) =>
        invoice.cliente_rut
          ? compactRut(invoice.cliente_rut) === compactRut(client?.rut)
          : uniqueEmailOwner
      );
    }

    const pending = invoices.filter((invoice) => String(invoice.estado).toLowerCase() !== "pagada");
    const debt = pending.reduce((sum, invoice) => sum + Number(invoice.valor_total ?? 0), 0);

    const stateRows = pending.length
      ? pending.map((invoice) => `<tr>
          <td style="padding:9px;border-bottom:1px solid #e2e8f0">${escapeHtml(invoice.mes_anio ?? invoice.folio ?? "Factura")}</td>
          <td style="padding:9px;border-bottom:1px solid #e2e8f0">${escapeHtml(invoice.fecha_vencimiento ?? "—")}</td>
          <td style="padding:9px;border-bottom:1px solid #e2e8f0">${escapeHtml(invoice.estado ?? "Pendiente")}</td>
          <td style="padding:9px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${formatClp(Number(invoice.valor_total ?? 0))}</td>
        </tr>`).join("")
      : `<tr><td colspan="4" style="padding:14px;text-align:center;color:#166534">Cuenta al día, sin documentos pendientes.</td></tr>`;

    const stateTable = `<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:12px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:9px;text-align:left">Documento</th>
        <th style="padding:9px;text-align:left">Vencimiento</th>
        <th style="padding:9px;text-align:left">Estado</th>
        <th style="padding:9px;text-align:right">Monto</th>
      </tr></thead><tbody>${stateRows}</tbody></table>`;

    let invoiceLink = "";
    let invoiceRecord: Record<string, unknown> | null = null;
    if (invoiceId) {
      const { data } = await admin.from("facturas")
        .select("id,cliente_rut,mes_anio,folio,fecha_emision,fecha_vencimiento,valor_total,storage_path,url_archivo,email_cliente")
        .eq("id", invoiceId).maybeSingle();

      if (
        data &&
        client &&
        data.cliente_rut &&
        compactRut(data.cliente_rut) !== compactRut(client.rut)
      ) {
        throw new HttpError(400, "La factura no pertenece al cliente seleccionado.");
      }

      invoiceRecord = data;
      const path = text(data?.storage_path ?? data?.url_archivo, 700);
      if (path && !path.startsWith("http") && !path.startsWith("#")) {
        const { data: signed } = await admin.storage.from("customer-invoices").createSignedUrl(path, 60 * 60 * 24 * 7);
        invoiceLink = signed?.signedUrl ?? "";
      } else if (path.startsWith("http")) invoiceLink = path;
    }

    const values: Record<string, string> = {
      EMPRESA: client?.empresa ?? "Cliente",
      RUT: client?.rut ?? "",
      CONTACTO: client?.contacto ?? "Estimados",
      PLAN: client?.plan ?? "",
      DIRECCION: client?.direccion ?? "",
      PERIODO: text(invoiceRecord?.mes_anio, 80),
      NUMERO_FACTURA: text(invoiceRecord?.folio, 80),
      MONTO_TOTAL: invoiceRecord ? formatClp(Number(invoiceRecord.valor_total ?? 0)) : "",
      FECHA_EMISION: text(invoiceRecord?.fecha_emision, 20),
      FECHA_VENCIMIENTO: text(invoiceRecord?.fecha_vencimiento, 20),
      DEUDA_TOTAL: formatClp(debt),
      LINK_PORTAL: "https://globalcomfibra.cl/portal",
      DETALLE: detail,
      ESTADO_CUENTA: "__GLOBALCOM_STATE_TABLE__",
    };

    const subject = replaceAll(text(body.subject, 180), values);
    const message = replaceAll(text(body.message, 10000), values);
    if (subject.length < 3 || message.length < 1) throw new HttpError(400, "Asunto y mensaje son obligatorios.");

    let messageHtml = escapeHtml(message).replaceAll("\n", "<br>");
    messageHtml = messageHtml.replaceAll("__GLOBALCOM_STATE_TABLE__", stateTable);

    const actionButton = invoiceLink
      ? `<div style="text-align:center;margin:28px 0"><a href="${invoiceLink}" style="display:inline-block;background:#1d4ed8;color:white;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:700">Descargar factura</a></div>`
      : "";

    const attachments: Array<{ filename: string; content: string }> = [];
    const invoicePath = text(
      invoiceRecord?.storage_path ?? invoiceRecord?.url_archivo,
      700,
    );

    if (invoicePath && !invoicePath.startsWith("http") && !invoicePath.startsWith("#")) {
      const { data: invoiceFile, error: downloadError } = await admin.storage
        .from("customer-invoices")
        .download(invoicePath);

      if (downloadError) throw downloadError;

      if (invoiceFile && invoiceFile.size <= 15 * 1024 * 1024) {
        const bytes = new Uint8Array(await invoiceFile.arrayBuffer());
        attachments.push({
          filename: `Factura-${text(invoiceRecord?.folio ?? invoiceRecord?.mes_anio, 80) || "Globalcom"}.pdf`,
          content: bytesToBase64(bytes),
        });
      }
    }

    const headerColor = department.includes("Facturación") ? "#1d4ed8"
      : department.includes("Soporte") ? "#ea580c"
      : department.includes("Comercial") ? "#0f766e"
      : "#111827";

    const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#334155;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
      <div style="background:${headerColor};padding:24px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:white;letter-spacing:1px">GLOBALCOM</div>
        <div style="margin-top:6px;color:#e2e8f0;font-size:11px;text-transform:uppercase;letter-spacing:2px">${escapeHtml(department)}</div>
      </div>
      <div style="padding:30px;font-size:14px;line-height:1.65">
        ${messageHtml}
        ${actionButton}
        <div style="margin-top:42px;padding-top:18px;border-top:1px solid #e2e8f0">
          <table style="width:100%"><tr>
            <td style="width:150px;padding-right:18px;border-right:2px solid #e2e8f0">
              <img src="https://globalcomfibra.cl/img/logo.png" alt="Globalcom" style="max-width:135px;height:auto">
            </td>
            <td style="padding-left:18px">
              <strong style="color:#0f172a">${escapeHtml(department)}</strong><br>
              <span style="font-size:12px;color:#64748b">Servicio de Telecomunicaciones Globalcom Ltda.</span><br>
              <a href="mailto:contacto@globalcomfibra.cl" style="font-size:12px;color:#2563eb">contacto@globalcomfibra.cl</a>
            </td>
          </tr></table>
        </div>
      </div>
    </div>`;

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY no configurada.");

    const { data: log, error: logError } = await admin.from("email_messages").insert({
      client_rut: client?.rut ?? null,
      recipient,
      cc: [],
      bcc: ["contacto@globalcomfibra.cl"],
      subject,
      department,
      template_id: body.templateId || null,
      message_type: messageType,
      status: "queued",
      related_invoice_id: invoiceId || null,
      sent_by: user.id,
    }).select("id").single();
    if (logError) throw logError;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("MAIL_FROM") ?? "Globalcom Fibra <contacto@globalcomfibra.cl>",
        to: [recipient],
        bcc: ["contacto@globalcomfibra.cl"],
        reply_to: "contacto@globalcomfibra.cl",
        subject,
        html,
        attachments,
      }),
    });

    const provider = await response.json().catch(() => ({}));
    if (!response.ok) {
      await admin.from("email_messages").update({
        status: "failed",
        error_message: `Resend ${response.status}`,
      }).eq("id", log.id);
      throw new Error(`Proveedor de correo respondió ${response.status}.`);
    }

    await admin.from("email_messages").update({
      status: "sent",
      provider_message_id: provider.id ?? null,
      sent_at: new Date().toISOString(),
    }).eq("id", log.id);

    if (invoiceId) {
      await admin.from("facturas").update({
        email_status: "sent",
        email_provider_id: provider.id ?? null,
        sent_at: new Date().toISOString(),
      }).eq("id", invoiceId);
    }

    await audit(admin, user, "send_email", "communications", {
      record_type: "email_messages",
      record_id: log.id,
      record_label: subject,
      recipient,
      client_rut: client?.rut,
      invoice_id: invoiceId || null,
    });

    return json(req, { success: true, messageId: provider.id ?? null });
  } catch (cause) {
    return errorResponse(req, cause);
  }
});
