(() => {
    'use strict';

    const byId = id => document.getElementById(id);
    const money = value => new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0
    }).format(Number(value || 0));

    function setText(id, value) {
        const element = byId(id);
        if (element) element.textContent = value;
    }

    function setLoading(loading) {
        const button = byId('btnActualizarFinanzas');
        if (!button) return;
        button.disabled = loading;
        button.textContent = loading ? 'Actualizando…' : 'Actualizar totales';
        button.classList.toggle('opacity-60', loading);
    }

    function renderGroup(prefix, data = {}) {
        setText(`${prefix}Total`, money(data.total_invoiced));
        setText(`${prefix}Paid`, money(data.total_paid));
        setText(`${prefix}Balance`, money(data.balance_due));
        setText(`${prefix}Overdue`, money(data.overdue_balance));
        setText(`${prefix}Month`, money(data.current_month_invoiced));
        setText(`${prefix}Count`, `${Number(data.invoice_count || 0).toLocaleString('es-CL')} documento(s)`);
    }

    async function refreshFinanceDashboard() {
        const status = byId('financeDashboardStatus');
        setLoading(true);
        if (status) {
            status.textContent = 'Consultando información financiera…';
            status.className = 'text-xs font-semibold text-slate-500';
        }

        try {
            const { data, error } = await adminSupabase.rpc('admin_finance_dashboard');
            if (error) throw error;

            const payload = Array.isArray(data) ? data[0] : data;
            if (!payload || typeof payload !== 'object') {
                throw new Error('Supabase no devolvió los totales esperados.');
            }

            renderGroup('finClient', payload.clients);
            renderGroup('finSupplier', payload.suppliers);

            const generatedAt = payload.generated_at ? new Date(payload.generated_at) : new Date();
            if (status) {
                status.textContent = `Actualizado ${generatedAt.toLocaleString('es-CL')}`;
                status.className = 'text-xs font-semibold text-emerald-600';
            }
        } catch (error) {
            console.error('Error cargando dashboard financiero:', error);
            if (status) {
                status.textContent = `No fue posible cargar los totales: ${error.message || error}`;
                status.className = 'text-xs font-semibold text-red-600';
            }

            ['finClient', 'finSupplier'].forEach(prefix => {
                ['Total', 'Paid', 'Balance', 'Overdue', 'Month'].forEach(suffix => {
                    setText(`${prefix}${suffix}`, 'Error');
                });
                setText(`${prefix}Count`, 'Consulta fallida');
            });
        } finally {
            setLoading(false);
        }
    }

    window.refreshFinanceDashboard = refreshFinanceDashboard;

    const originalDashboard = window.cargarDashboard;
    if (typeof originalDashboard === 'function' && !originalDashboard.__financeWrapped) {
        const wrapped = async function(...args) {
            let result;
            try {
                result = await originalDashboard.apply(this, args);
            } finally {
                await refreshFinanceDashboard();
            }
            return result;
        };
        wrapped.__financeWrapped = true;
        window.cargarDashboard = wrapped;
    }

    async function init() {
        const { data: { session } } = await adminSupabase.auth.getSession();
        if (!session) return;
        await refreshFinanceDashboard();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
