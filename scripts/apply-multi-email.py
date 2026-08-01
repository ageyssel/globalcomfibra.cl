from __future__ import annotations

import re
from pathlib import Path

ADMIN_FILE = Path('admin.html')

FINANCE_SECTION = '''    <section class="max-w-7xl mx-auto px-6 pt-10" id="financeDashboard">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
                <p class="text-[10px] font-black text-blue-600 uppercase tracking-[0.22em]">Control financiero consolidado</p>
                <h1 class="text-3xl font-black text-[#1a1f2e] mt-1">Facturación de clientes y proveedores</h1>
                <p id="financeDashboardStatus" class="text-xs font-semibold text-slate-500 mt-2">Preparando información financiera…</p>
            </div>
            <button type="button" id="btnActualizarFinanzas" onclick="refreshFinanceDashboard()" class="bg-white border border-slate-200 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl shadow-sm hover:bg-blue-600 hover:text-white hover:border-blue-600 transition">Actualizar totales</button>
        </div>

        <div class="grid xl:grid-cols-2 gap-6">
            <article class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="px-6 py-5 bg-gradient-to-r from-blue-700 to-blue-500 text-white flex items-center justify-between">
                    <div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-blue-100">Cuentas por cobrar</p><h2 class="text-xl font-black mt-1">Facturación clientes</h2></div>
                    <span id="finClientCount" class="text-[10px] font-black bg-white/15 px-3 py-1.5 rounded-full">0 documento(s)</span>
                </div>
                <div class="p-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div class="col-span-2 lg:col-span-1 rounded-2xl bg-slate-900 text-white p-5"><p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Total facturado</p><p id="finClientTotal" class="text-2xl font-black mt-2">$0</p></div>
                    <div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-5"><p class="text-[9px] font-black uppercase tracking-widest text-emerald-600">Pagado</p><p id="finClientPaid" class="text-xl font-black text-emerald-700 mt-2">$0</p></div>
                    <div class="rounded-2xl bg-blue-50 border border-blue-100 p-5"><p class="text-[9px] font-black uppercase tracking-widest text-blue-600">Por cobrar</p><p id="finClientBalance" class="text-xl font-black text-blue-700 mt-2">$0</p></div>
                    <div class="rounded-2xl bg-red-50 border border-red-100 p-5"><p class="text-[9px] font-black uppercase tracking-widest text-red-600">Vencido</p><p id="finClientOverdue" class="text-xl font-black text-red-700 mt-2">$0</p></div>
                    <div class="rounded-2xl bg-violet-50 border border-violet-100 p-5"><p class="text-[9px] font-black uppercase tracking-widest text-violet-600">Facturado este mes</p><p id="finClientMonth" class="text-xl font-black text-violet-700 mt-2">$0</p></div>
                </div>
            </article>

            <article class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="px-6 py-5 bg-gradient-to-r from-orange-600 to-amber-500 text-white flex items-center justify-between">
                    <div><p class="text-[10px] font-black uppercase tracking-[0.2em] text-orange-100">Cuentas por pagar</p><h2 class="text-xl font-black mt-1">Facturación proveedores</h2></div>
                    <span id="finSupplierCount" class="text-[10px] font-black bg-white/15 px-3 py-1.5 rounded-full">0 documento(s)</span>
                </div>
                <div class="p-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
                    <div class="col-span-2 lg:col-span-1 rounded-2xl bg-slate-900 text-white p-5"><p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Total recibido</p><p id="finSupplierTotal" class="text-2xl font-black mt-2">$0</p></div>
                    <div class="rounded-2xl bg-emerald-50 border border-emerald-100 p-5"><p class="text-[9px] font-black uppercase tracking-widest text-emerald-600">Pagado</p><p id="finSupplierPaid" class="text-xl font-black text-emerald-700 mt-2">$0</p></div>
                    <div class="rounded-2xl bg-orange-50 border border-orange-100 p-5"><p class="text-[9px] font-black uppercase tracking-widest text-orange-600">Por pagar</p><p id="finSupplierBalance" class="text-xl font-black text-orange-700 mt-2">$0</p></div>
                    <div class="rounded-2xl bg-red-50 border border-red-100 p-5"><p class="text-[9px] font-black uppercase tracking-widest text-red-600">Vencido</p><p id="finSupplierOverdue" class="text-xl font-black text-red-700 mt-2">$0</p></div>
                    <div class="rounded-2xl bg-violet-50 border border-violet-100 p-5"><p class="text-[9px] font-black uppercase tracking-widest text-violet-600">Recibido este mes</p><p id="finSupplierMonth" class="text-xl font-black text-violet-700 mt-2">$0</p></div>
                </div>
            </article>
        </div>

        <!-- Compatibilidad con el dashboard histórico mientras se termina su retiro. -->
        <div class="hidden" aria-hidden="true">
            <span id="statTotalPagado">$0</span>
            <span id="statTotalPendiente">$0</span>
            <span id="statTotalVencido">$0</span>
            <span id="statTicketsAlta">0</span>
        </div>
    </section>'''

CREATE_EMAIL_GRID = '''                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Correos Facturación y Cobranza (máx. 10)</label><input type="text" id="cEmailFact" placeholder="facturacion@empresa.cl, pagos@empresa.cl" class="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"></div>
                        <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fecha Habilitación</label><input type="date" id="cFecha" required class="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"></div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Correos Generales / Administrativos (máx. 10)</label><input type="text" id="cCorreosGenerales" placeholder="administracion@empresa.cl, gerencia@empresa.cl" class="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"></div>
                        <div><label class="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Correos Soporte Técnico (máx. 10)</label><input type="text" id="cCorreosSoporte" placeholder="soporte@empresa.cl, ti@empresa.cl" class="w-full mt-1 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"></div>
                    </div>'''

EDIT_PROFILE_GRID = '''                            <input type="hidden" id="editRutOriginal">
                            <input type="hidden" id="editEmailOriginal">
                            <div class="grid grid-cols-2 gap-3">
                                <div><label class="text-[9px] font-bold text-slate-500 uppercase">ID Cliente</label><input type="text" id="eIdCliente" readonly class="w-full mt-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-500"></div>
                                <div><label class="text-[9px] font-bold text-slate-500 uppercase">Email Portal</label><input type="email" id="eEmailPortal" readonly class="w-full mt-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-500"></div>
                            </div>'''

EDIT_EMAIL_GRID = '''                            <div class="grid grid-cols-2 gap-3">
                                <div><label class="text-[9px] font-bold text-slate-500 uppercase">Correos Facturación y Cobranza (máx. 10)</label><input type="text" id="eEmailFact" placeholder="facturacion@empresa.cl, pagos@empresa.cl" class="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1"></div>
                                <div><label class="text-[9px] font-bold text-slate-500 uppercase">Fecha Habilitación</label><input type="date" id="eFecha" class="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1"></div>
                            </div>
                            <div class="grid grid-cols-1 gap-3">
                                <div><label class="text-[9px] font-bold text-slate-500 uppercase">Correos Generales / Administrativos (máx. 10)</label><input type="text" id="eCorreosGenerales" placeholder="administracion@empresa.cl, gerencia@empresa.cl" class="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1"></div>
                                <div><label class="text-[9px] font-bold text-orange-600 uppercase">Correos Soporte Técnico (máx. 10)</label><input type="text" id="eCorreosSoporte" placeholder="soporte@empresa.cl, ti@empresa.cl" class="w-full mt-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1"></div>
                            </div>'''

SCRIPT_TAGS = '''    <script src="admin-finance-dashboard.js?v=20260801-1"></script>
    <script src="admin-multi-email.js?v=20260801-2"></script>
'''


def replace_once(content: str, old: str, new: str, label: str) -> str:
    if old not in content:
        raise SystemExit(f'No se encontró el bloque esperado: {label}')
    return content.replace(old, new, 1)


def main() -> None:
    content = ADMIN_FILE.read_text(encoding='utf-8')
    original = content

    if 'id="financeDashboard"' not in content:
        pattern = re.compile(
            r'    <section class="max-w-7xl mx-auto px-6 pt-10">.*?^    </section>',
            re.MULTILINE | re.DOTALL,
        )
        content, replacements = pattern.subn(FINANCE_SECTION, content, count=1)
        if replacements != 1:
            raise SystemExit('No se pudo reemplazar el dashboard financiero histórico.')

    if 'id="cCorreosGenerales"' not in content:
        old_create = '''                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Facturación</label><input type="email" id="cEmailFact" required class="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"></div>
                        <div><label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fecha Habilitación</label><input type="date" id="cFecha" required class="w-full mt-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"></div>
                    </div>'''
        content = replace_once(content, old_create, CREATE_EMAIL_GRID, 'correos en alta de cliente')

    if 'id="eIdCliente"' not in content:
        old_hidden = '''                            <input type="hidden" id="editRutOriginal">
                            <input type="hidden" id="editEmailOriginal"> '''
        content = replace_once(content, old_hidden, EDIT_PROFILE_GRID, 'identificación en ficha de cliente')

    if 'id="eCorreosGenerales"' not in content:
        old_edit = '''                            <div class="grid grid-cols-2 gap-3">
                                <div><label class="text-[9px] font-bold text-slate-500 uppercase">Email Facturación</label><input type="email" id="eEmailFact" class="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1"></div>
                                <div><label class="text-[9px] font-bold text-slate-500 uppercase">Fecha Habilitación</label><input type="date" id="eFecha" class="w-full mt-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1"></div>
                            </div>'''
        content = replace_once(content, old_edit, EDIT_EMAIL_GRID, 'correos en ficha de cliente')

    content = re.sub(
        r'\s*<script src="admin-finance-dashboard\.js\?v=[^"]+"></script>\n?',
        '\n',
        content,
    )
    content = re.sub(
        r'\s*<script src="admin-multi-email\.js\?v=[^"]+"></script>\n?',
        '\n',
        content,
    )
    content = replace_once(content, '</body>', f'{SCRIPT_TAGS}</body>', 'cierre de admin.html')

    if content == original:
        print('admin.html ya está actualizado.')
        return

    ADMIN_FILE.write_text(content, encoding='utf-8')
    print('Dashboard financiero y ficha completa de cliente actualizados.')


if __name__ == '__main__':
    main()
