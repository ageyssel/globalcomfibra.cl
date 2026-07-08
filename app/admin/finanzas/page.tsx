import { FinanceManager } from "@/components/admin/finance-manager";
import { requireRoles } from "@/lib/auth";
import { FINANCE_ROLES } from "@/lib/permissions";
export const dynamic = "force-dynamic";
export default async function FinancePage() { await requireRoles(FINANCE_ROLES); return <FinanceManager />; }
