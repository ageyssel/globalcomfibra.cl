export type AppRole = "superadmin" | "admin" | "finance" | "commercial" | "support" | "readonly" | "client";

export interface UserProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  active: boolean;
}

export interface ClientRecord {
  id?: string | number;
  empresa: string;
  rut: string;
  email: string;
  contacto?: string | null;
  contacto_facturacion?: string | null;
  correo_facturacion?: string | null;
  direccion?: string | null;
  plan?: string | null;
  ip?: string | null;
  estado?: string | null;
  dias_pago?: number | null;
  id_cliente?: string | null;
  fecha_inicio?: string | null;
  contrato_meses?: number | null;
  url_dashboard?: string | null;
  url_contrato?: string | null;
  created_at?: string;
}

export interface TicketRecord {
  id: number;
  email_cliente: string;
  empresa?: string | null;
  asunto: string;
  descripcion?: string | null;
  prioridad: string;
  estado: string;
  seguimiento?: TicketMessage[] | null;
  created_at: string;
}

export interface TicketMessage {
  autor: string;
  mensaje: string;
  fecha: string;
  adjunto?: string | null;
}

export interface SupplierRecord {
  id: string;
  legal_name: string;
  trade_name: string | null;
  rut: string;
  category: string | null;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  bank_name: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  payment_email: string | null;
  active: boolean;
  created_at: string;
}

export interface SupplierInvoiceRecord {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  supplier_rut?: string;
  document_type: string;
  folio: string;
  issue_date: string;
  received_date: string;
  due_date: string;
  net_amount: number;
  exempt_amount: number;
  tax_amount: number;
  other_taxes: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  currency: string;
  status: string;
  category_id: string | null;
  category_name?: string | null;
  cost_center_id: string | null;
  cost_center_name?: string | null;
  related_client_rut: string | null;
  related_service: string | null;
  description: string | null;
  accounting_month: string;
  purchase_order: string | null;
  storage_path: string | null;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  payment_date: string;
  amount: number;
  method: string;
  bank: string | null;
  source_account: string | null;
  operation_number: string | null;
  receipt_storage_path: string | null;
  notes: string | null;
  created_at: string;
}
