(() => {
    'use strict';

    const MAX_EMAILS_PER_CATEGORY = 10;
    const MAX_EMAIL_RECIPIENTS = 30;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
    const SAFE_CLIENT_COLUMNS = [
        'empresa', 'rut', 'email', 'contacto', 'contacto_facturacion',
        'correo_facturacion', 'correos_generales', 'correos_facturacion',
        'correos_soporte', 'fecha_inicio', 'direccion', 'contrato_meses',
        'dias_pago', 'ip', 'plan', 'url_dashboard', 'url_contrato',
        'estado', 'id_cliente', 'created_at', 'updated_at', 'deleted_at'
    ].join(',');

    function tokenizeEmails(value) {
        const source = Array.isArray(value)
            ? value
            : String(value || '').split(/[;,\n\s]+/);
        return source
            .map(item => String(item || '').trim().toLowerCase())
            .filter(Boolean);
    }

    function normalizeEmails(value, {
        fallback = '',
        allowEmpty = true,
        limit = MAX_EMAILS_PER_CATEGORY
    } = {}) {
        const raw = tokenizeEmails(value);
        const invalid = raw.filter(email => !EMAIL_RE.test(email));
        if (invalid.length) throw new Error(`Correo(s) inválido(s): ${invalid.join(', ')}`);

        const unique = [...new Set(raw)];
        if (!unique.length && fallback) {
            const normalizedFallback = String(fallback).trim().toLowerCase();
            if (EMAIL_RE.test(normalizedFallback)) unique.push(normalizedFallback);
        }
        if (!allowEmpty && !unique.length) throw new Error('Debes registrar al menos un correo válido.');
        if (unique.length > limit) throw new Error(`Solo puedes registrar hasta ${limit} correo(s).`);
        return unique;
    }

    function emailValue(value) {
        try {
            return normalizeEmails(value, { limit: MAX_EMAIL_RECIPIENTS }).join(', ');
        } catch (_) {
            return Array.isArray(value) ? value.join(', ') : String(value || '');
        }
    }

    function setValue(id, value) {
        const element = document.getElementById(id);
        if (element) element.value = value ?? '';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function enhanceEmailInput(input, labelText, limit = MAX_EMAILS_PER_CATEGORY) {
        if (!input || input.dataset.multiEmailReady === 'true') return;
        input.dataset.multiEmailReady = 'true';
        input.type = 'text';
        input.removeAttribute('required');
        input.placeholder = 'correo1@empresa.cl, correo2@empresa.cl';
        input.autocomplete = 'off';

        const label = input.parentElement?.querySelector('label');
        if (label && labelText) label.textContent = labelText;

        const meta = document.createElement('div');
        meta.className = 'mt-2 flex items-center justify-between gap-2';
        meta.innerHTML = `
            <p class="text-[10px] text-slate-500">Separa con coma, punto y coma o Enter.</p>
            <span class="text-[10px] font-bold text-blue-600" data-email-counter>0/${limit}</span>
        `;

        const chips = document.createElement('div');
        chips.className = 'mt-2 flex flex-wrap gap-1.5';
        chips.dataset.emailChips = 'true';

        input.insertAdjacentElement('afterend', chips);
        input.insertAdjacentElement('afterend', meta);

        const render = () => {
            let emails = [];
            let hasError = false;
            try {
                emails = normalizeEmails(input.value, { limit });
                input.classList.remove('border-red-400', 'ring-1', 'ring-red-300');
            } catch (_) {
                emails = [...new Set(tokenizeEmails(input.value))].slice(0, limit);
                hasError = true;
                input.classList.add('border-red-400', 'ring-1', 'ring-red-300');
            }

            chips.innerHTML = emails.map(email => `
                <span class="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
                    ${escapeHtml(email)}
                    <button type="button" data-remove-email="${escapeHtml(email)}" class="font-black text-blue-400 hover:text-red-600" aria-label="Quitar ${escapeHtml(email)}">×</button>
                </span>
            `).join('');

            const counter = meta.querySelector('[data-email-counter]');
            counter.textContent = `${emails.length}/${limit}`;
            counter.className = hasError
                ? 'text-[10px] font-bold text-red-600'
                : 'text-[10px] font-bold text-blue-600';
        };

        chips.addEventListener('click', event => {
            const button = event.target.closest('[data-remove-email]');
            if (!button) return;
            const remove = button.dataset.removeEmail;
            input.value = normalizeEmails(input.value, { limit })
                .filter(email => email !== remove)
                .join(', ');
            render();
        });

        input.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
                event.preventDefault();
                input.value = input.value.replace(/\s+/g, ', ');
                render();
            }
        });
        input.addEventListener('input', render);
        input.addEventListener('blur', () => {
            try {
                input.value = normalizeEmails(input.value, { limit }).join(', ');
            } catch (_) {}
            render();
        });
        render();
    }

    function createEmailField(id, label, accent = 'slate') {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <label class="text-[10px] font-bold text-${accent}-600 uppercase tracking-widest">${label}</label>
            <input type="text" id="${id}" class="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
        `;
        return wrapper;
    }

    function installCreateFields() {
        const billing = document.getElementById('cEmailFact');
        if (!billing) return;
        enhanceEmailInput(billing, 'Correos Facturación y Cobranza (máx. 10)');

        if (!document.getElementById('cCorreosGenerales')) {
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-4';
            grid.appendChild(createEmailField('cCorreosGenerales', 'Correos Generales / Administrativos (máx. 10)'));
            grid.appendChild(createEmailField('cCorreosSoporte', 'Correos Soporte Técnico (máx. 10)', 'orange'));
            billing.closest('.grid')?.insertAdjacentElement('afterend', grid);
        }

        enhanceEmailInput(document.getElementById('cCorreosGenerales'));
        enhanceEmailInput(document.getElementById('cCorreosSoporte'));
    }

    function installEditFields() {
        const billing = document.getElementById('eEmailFact');
        if (!billing) return;
        enhanceEmailInput(billing, 'Correos Facturación y Cobranza (máx. 10)');

        if (!document.getElementById('eEmailPortal')) {
            const hiddenEmail = document.getElementById('editEmailOriginal');
            const profileGrid = document.createElement('div');
            profileGrid.className = 'grid grid-cols-2 gap-3';
            profileGrid.innerHTML = `
                <div><label class="text-[9px] font-bold text-slate-500 uppercase">ID Cliente</label><input type="text" id="eIdCliente" readonly class="w-full mt-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-500"></div>
                <div><label class="text-[9px] font-bold text-slate-500 uppercase">Email Portal</label><input type="email" id="eEmailPortal" readonly class="w-full mt-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-500"></div>
            `;
            hiddenEmail?.insertAdjacentElement('afterend', profileGrid);
        }

        if (!document.getElementById('eCorreosGenerales')) {
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 gap-3';
            grid.appendChild(createEmailField('eCorreosGenerales', 'Correos Generales / Administrativos (máx. 10)'));
            grid.appendChild(createEmailField('eCorreosSoporte', 'Correos Soporte Técnico (máx. 10)', 'orange'));
            billing.closest('.grid')?.insertAdjacentElement('afterend', grid);
        }

        enhanceEmailInput(document.getElementById('eCorreosGenerales'));
        enhanceEmailInput(document.getElementById('eCorreosSoporte'));
    }

    async function cargarListaClientesSegura() {
        const tabla = document.getElementById('tablaClientesBody');
        const selectHistorico = document.getElementById('hCliente');
        const selectMailing = document.getElementById('mailDestinatarioSelect');

        if (tabla) tabla.innerHTML = '<tr><td colspan="2" class="px-4 py-6 text-center text-xs text-slate-400">Cargando clientes…</td></tr>';

        const { data: clientes, error } = await adminSupabase
            .from('clientes')
            .select(SAFE_CLIENT_COLUMNS)
            .is('deleted_at', null)
            .order('empresa', { ascending: true });

        if (error) {
            console.error('Error cargando clientes:', error);
            if (tabla) tabla.innerHTML = `<tr><td colspan="2" class="px-4 py-6 text-center text-xs text-red-600">No se pudieron cargar los clientes: ${escapeHtml(error.message)}</td></tr>`;
            return;
        }

        if (tabla) tabla.innerHTML = '';
        if (selectHistorico) selectHistorico.innerHTML = '<option value="">Seleccione un cliente...</option>';
        if (selectMailing) selectMailing.innerHTML = '<option value="">Seleccione un cliente registrado...</option><option value="MANUAL" class="font-bold text-blue-600">Ingresar correo(s) manualmente...</option>';

        mapaClientes = {};
        mapaDiasPago = {};
        listaClientesCompleta = clientes || [];

        listaClientesCompleta.forEach(cliente => {
            mapaClientes[cliente.email] = cliente.empresa;
            mapaDiasPago[cliente.email] = cliente.dias_pago || 30;
            const activo = !cliente.estado || cliente.estado === 'Activo';
            const statusDot = `<span class="w-2 h-2 rounded-full ${activo ? 'bg-green-500' : 'bg-red-500'} inline-block mr-2"></span>`;

            if (tabla) {
                tabla.innerHTML += `
                    <tr class="hover:bg-slate-50 transition border-b border-slate-100 last:border-0">
                        <td class="px-4 py-4 font-bold text-[#1a1f2e] text-xs flex items-center">${statusDot} ${escapeHtml(cliente.empresa)}</td>
                        <td class="px-4 py-4 text-right"><button onclick="gestionarCliente('${escapeHtml(cliente.rut)}')" class="text-[9px] font-black uppercase bg-white border border-slate-200 text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 px-3 py-1.5 rounded-lg transition tracking-widest shadow-sm">Editar / Gestionar</button></td>
                    </tr>`;
            }

            if (selectHistorico) {
                selectHistorico.innerHTML += `<option value="${escapeHtml(cliente.rut)}" data-email="${escapeHtml(cliente.email)}">${escapeHtml(cliente.empresa)}</option>`;
            }
            if (selectMailing) {
                selectMailing.innerHTML += `<option value="${escapeHtml(cliente.email)}" data-rut="${escapeHtml(cliente.rut)}">${escapeHtml(cliente.empresa)} (${escapeHtml(cliente.email)})</option>`;
            }
        });

        updateMailingSummary();
    }

    function installClientList() {
        window.cargarListaClientes = cargarListaClientesSegura;
    }

    async function invokeClientProfile(body) {
        const { data, error } = await adminSupabase.functions.invoke('manage-client-profile', { body });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return data?.cliente;
    }

    function installManageClient() {
        window.gestionarCliente = async function(rut) {
            const modal = document.getElementById('modal-detalle');
            modal?.classList.remove('hidden');

            try {
                const cliente = await invokeClientProfile({ action: 'get', rut });
                if (!cliente) throw new Error('Cliente no encontrado.');

                document.getElementById('detEmpresa').textContent = cliente.empresa || 'Cliente';
                document.getElementById('detEmail').textContent = cliente.email || '';
                document.getElementById('detIniciales').textContent = String(cliente.empresa || '?').substring(0, 1).toUpperCase();

                setValue('editRutOriginal', cliente.rut);
                setValue('editEmailOriginal', cliente.email);
                setValue('eIdCliente', cliente.id_cliente || '');
                setValue('eEmailPortal', cliente.email || '');
                setValue('eEmpresa', cliente.empresa || '');
                setValue('eRut', cliente.rut || '');
                setValue('eContacto', cliente.contacto || '');
                setValue('eContactoFact', cliente.contacto_facturacion || '');
                setValue('eCorreosGenerales', emailValue(cliente.correos_generales));
                setValue('eEmailFact', emailValue(
                    cliente.correos_facturacion?.length
                        ? cliente.correos_facturacion
                        : cliente.correo_facturacion
                ));
                setValue('eCorreosSoporte', emailValue(cliente.correos_soporte));
                setValue('eFecha', cliente.fecha_inicio || '');
                setValue('eDireccion', cliente.direccion || '');
                setValue('eDiasPago', cliente.dias_pago || 30);
                setValue('eMeses', cliente.contrato_meses || 12);
                setValue('eIp', cliente.ip || '');
                setValue('ePlan', cliente.plan || 'Internet Dedicado 100 Mbps');
                setValue('eDashboard', cliente.url_dashboard || '');
                setValue('eUserNoc', cliente.user_noc || '');
                setValue('ePassNoc', cliente.pass_noc || '');

                ['eCorreosGenerales', 'eEmailFact', 'eCorreosSoporte'].forEach(id => {
                    document.getElementById(id)?.dispatchEvent(new Event('input'));
                });

                const contractButton = document.getElementById('btnVerContratoActual');
                if (cliente.url_contrato) {
                    contractButton.href = cliente.url_contrato;
                    contractButton.classList.remove('hidden');
                } else {
                    contractButton.classList.add('hidden');
                    contractButton.removeAttribute('href');
                }

                actualizarBotonEstado(cliente.estado || 'Activo');

                const collectionButton = document.getElementById('btnEnviarCobranza');
                collectionButton.classList.remove('hidden');
                collectionButton.onclick = () => enviarAvisoCobranza(
                    cliente.rut,
                    cliente.email,
                    cliente.empresa,
                    cliente.dias_pago || 30
                );

                const { data: accesses, error: accessError } = await adminSupabase
                    .from('registro_accesos')
                    .select('created_at,navegador')
                    .eq('email_cliente', cliente.email)
                    .order('created_at', { ascending: false })
                    .limit(5);

                const accessContainer = document.getElementById('listaAccesos');
                accessContainer.innerHTML = '';
                if (!accessError && accesses?.length) {
                    accesses.forEach(access => {
                        const date = new Date(access.created_at).toLocaleString('es-CL', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        });
                        const device = String(access.navegador || '').includes('Mobile') ? 'Móvil' : 'Escritorio';
                        accessContainer.innerHTML += `<div class="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 text-[11px]"><span class="text-slate-600 font-medium">${date}</span><span class="text-slate-400 font-bold uppercase">${device}</span></div>`;
                    });
                } else {
                    accessContainer.innerHTML = '<p class="text-[11px] text-slate-400 italic">Sin ingresos registrados.</p>';
                }

                await cargarFacturasDetalle(cliente.rut, cliente.email, cliente.dias_pago || 30);
            } catch (error) {
                console.error('Error abriendo ficha del cliente:', error);
                alert(`No fue posible cargar la ficha completa: ${error.message || error}`);
                modal?.classList.add('hidden');
            }
        };
    }

    async function uploadContract(inputId, prefix) {
        const file = document.getElementById(inputId)?.files?.[0];
        if (!file) return undefined;
        const fileName = `${prefix}_${Date.now()}.pdf`;
        const { error: uploadError } = await adminSupabase.storage.from('contratos').upload(fileName, file);
        if (uploadError) throw uploadError;
        return adminSupabase.storage.from('contratos').getPublicUrl(fileName).data.publicUrl;
    }

    function installCreateSubmit() {
        const form = document.getElementById('formCrearCliente');
        if (!form || form.dataset.multiEmailSubmit === 'true') return;
        form.dataset.multiEmailSubmit = 'true';

        form.addEventListener('submit', async event => {
            event.preventDefault();
            event.stopImmediatePropagation();

            const button = document.getElementById('btnCrearCliente');
            const originalText = button.textContent;
            button.textContent = 'Sincronizando…';
            button.disabled = true;

            try {
                const email = document.getElementById('cEmail').value.trim().toLowerCase();
                if (!EMAIL_RE.test(email)) throw new Error('El Email Portal no es válido.');

                const billing = normalizeEmails(document.getElementById('cEmailFact').value, { fallback: email });
                const general = normalizeEmails(document.getElementById('cCorreosGenerales').value, { fallback: email });
                const support = normalizeEmails(document.getElementById('cCorreosSoporte').value, { fallback: email });
                const contractUrl = await uploadContract('cArchivoContrato', `contrato_${email}`) || '';

                const clientData = {
                    empresa: document.getElementById('cEmpresa').value,
                    rut: document.getElementById('cRut').value,
                    contacto: document.getElementById('cContacto').value,
                    contacto_facturacion: document.getElementById('cContactoFact').value,
                    correo_facturacion: billing[0] || email,
                    correos_generales: general,
                    correos_facturacion: billing,
                    correos_soporte: support,
                    fecha_inicio: document.getElementById('cFecha').value,
                    direccion: document.getElementById('cDireccion').value,
                    contrato_meses: document.getElementById('cContratoMeses').value,
                    dias_pago: parseInt(document.getElementById('cDiasPago').value, 10) || 30,
                    ip: document.getElementById('cIp').value,
                    plan: document.getElementById('cPlan').value,
                    url_dashboard: document.getElementById('cDashboard').value,
                    user_noc: document.getElementById('cUserNoc').value,
                    pass_noc: document.getElementById('cPassNoc').value,
                    url_contrato: contractUrl,
                    estado: 'Activo',
                    id_cliente: `GCOM-${Math.floor(1000 + Math.random() * 9000)}`
                };

                const { data, error } = await adminSupabase.functions.invoke('create-client', {
                    body: {
                        email,
                        password: document.getElementById('cPassword').value,
                        clientData
                    }
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                alert('Cliente creado con todos sus destinatarios.');
                form.reset();
                ['cEmailFact', 'cCorreosGenerales', 'cCorreosSoporte'].forEach(id => {
                    document.getElementById(id)?.dispatchEvent(new Event('input'));
                });
                await cargarListaClientesSegura();
                await window.refreshFinanceDashboard?.();
            } catch (error) {
                alert(`Error: ${error.message || error}`);
            } finally {
                button.textContent = originalText;
                button.disabled = false;
            }
        }, true);
    }

    function installEditSubmit() {
        const form = document.getElementById('formEditarCliente');
        if (!form || form.dataset.multiEmailSubmit === 'true') return;
        form.dataset.multiEmailSubmit = 'true';

        form.addEventListener('submit', async event => {
            event.preventDefault();
            event.stopImmediatePropagation();

            const button = form.querySelector('button[type="submit"]');
            const originalText = button.textContent;
            button.textContent = 'Guardando…';
            button.disabled = true;

            try {
                const rutOriginal = document.getElementById('editRutOriginal').value;
                const portalEmail = document.getElementById('editEmailOriginal').value.trim().toLowerCase();
                const billing = normalizeEmails(document.getElementById('eEmailFact').value, { fallback: portalEmail });
                const general = normalizeEmails(document.getElementById('eCorreosGenerales').value, { fallback: portalEmail });
                const support = normalizeEmails(document.getElementById('eCorreosSoporte').value, { fallback: portalEmail });
                const contractUrl = await uploadContract('eArchivoContrato', `contrato_${rutOriginal}`);

                const clientData = {
                    email: portalEmail,
                    id_cliente: document.getElementById('eIdCliente')?.value || '',
                    empresa: document.getElementById('eEmpresa').value,
                    rut: document.getElementById('eRut').value,
                    contacto: document.getElementById('eContacto').value,
                    contacto_facturacion: document.getElementById('eContactoFact').value,
                    correo_facturacion: billing[0] || portalEmail,
                    correos_generales: general,
                    correos_facturacion: billing,
                    correos_soporte: support,
                    fecha_inicio: document.getElementById('eFecha').value,
                    direccion: document.getElementById('eDireccion').value,
                    dias_pago: parseInt(document.getElementById('eDiasPago').value, 10) || 30,
                    contrato_meses: parseInt(document.getElementById('eMeses').value, 10) || 12,
                    ip: document.getElementById('eIp').value,
                    plan: document.getElementById('ePlan').value,
                    url_dashboard: document.getElementById('eDashboard').value,
                    user_noc: document.getElementById('eUserNoc').value,
                    pass_noc: document.getElementById('ePassNoc').value,
                    estado: document.getElementById('btnEstadoCliente')?.dataset.estado || 'Activo'
                };
                if (contractUrl) clientData.url_contrato = contractUrl;

                await invokeClientProfile({
                    action: 'update',
                    rutOriginal,
                    portalEmail,
                    clientData
                });

                alert('Cliente actualizado con su ficha completa y listas de destinatarios.');
                document.getElementById('modal-detalle').classList.add('hidden');
                await cargarListaClientesSegura();
                await cargarDashboard();
            } catch (error) {
                alert(`Error: ${error.message || error}`);
            } finally {
                button.textContent = originalText;
                button.disabled = false;
            }
        }, true);
    }

    function installMailingCategory() {
        const select = document.getElementById('mailDestinatarioSelect');
        if (!select || document.getElementById('mailCategoriaDestinatarios')) return;

        const box = document.createElement('div');
        box.id = 'mailCategoriaBox';
        box.className = 'mt-3';
        box.innerHTML = `
            <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lista del cliente</label>
            <select id="mailCategoriaDestinatarios" class="w-full mt-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                <option value="general">Correos generales / administrativos</option>
                <option value="facturacion">Correos de facturación y cobranza</option>
                <option value="soporte">Correos de soporte técnico</option>
                <option value="todos">Todos los correos del cliente</option>
            </select>
            <p id="mailCategoriaResumen" class="text-[10px] text-slate-500 mt-1">Se usarán los destinatarios guardados en la ficha del cliente.</p>
        `;
        select.insertAdjacentElement('afterend', box);

        const department = document.getElementById('mailDepto');
        const category = document.getElementById('mailCategoriaDestinatarios');
        const syncCategory = () => {
            const value = department?.value || '';
            if (value.includes('Facturación')) category.value = 'facturacion';
            else if (value.includes('Soporte')) category.value = 'soporte';
            else category.value = 'general';
            updateMailingSummary();
        };

        department?.addEventListener('change', syncCategory);
        select.addEventListener('change', updateMailingSummary);
        category.addEventListener('change', updateMailingSummary);
        syncCategory();
    }

    function selectedClient() {
        const select = document.getElementById('mailDestinatarioSelect');
        if (!select?.value || select.value === 'MANUAL') return null;
        const rut = select.selectedOptions?.[0]?.dataset?.rut;
        return (listaClientesCompleta || []).find(client => rut && client.rut === rut)
            || (listaClientesCompleta || []).find(client => client.email === select.value);
    }

    function emailsForClient(client, category) {
        if (!client) return [];
        const portal = normalizeEmails(client.email, { limit: MAX_EMAIL_RECIPIENTS });
        const general = normalizeEmails(client.correos_generales, { fallback: client.email });
        const billing = normalizeEmails(
            client.correos_facturacion?.length ? client.correos_facturacion : client.correo_facturacion,
            { fallback: client.email }
        );
        const support = normalizeEmails(client.correos_soporte, { fallback: client.email });

        if (category === 'facturacion') return billing;
        if (category === 'soporte') return support;
        if (category === 'todos') return [...new Set([...general, ...billing, ...support, ...portal])];
        return general;
    }

    function updateMailingSummary() {
        const select = document.getElementById('mailDestinatarioSelect');
        const box = document.getElementById('mailCategoriaBox');
        const summary = document.getElementById('mailCategoriaResumen');
        if (!select || !box || !summary) return;

        if (select.value === 'MANUAL') {
            box.classList.add('hidden');
            return;
        }

        box.classList.remove('hidden');
        if (!select.value) {
            summary.textContent = 'Selecciona un cliente para ver los destinatarios.';
            return;
        }

        try {
            const category = document.getElementById('mailCategoriaDestinatarios')?.value || 'general';
            const emails = emailsForClient(selectedClient(), category);
            summary.textContent = `${emails.length} destinatario(s): ${emails.join(', ')}`;
        } catch (error) {
            summary.textContent = error.message || error;
        }
    }

    function wrapMailing() {
        const originalToggle = window.toggleMailManual;
        if (typeof originalToggle === 'function' && !originalToggle.__multiEmailWrapped) {
            const wrappedToggle = function() {
                originalToggle();
                updateMailingSummary();
            };
            wrappedToggle.__multiEmailWrapped = true;
            window.toggleMailManual = wrappedToggle;
        }

        const originalPreview = window.previsualizarCorreo;
        if (typeof originalPreview !== 'function' || originalPreview.__multiEmailWrapped) return;

        const wrappedPreview = async function() {
            const selected = document.getElementById('mailDestinatarioSelect').value;
            let resolved = null;

            try {
                if (selected === 'MANUAL') {
                    const manual = document.getElementById('mailDestinatarioManual');
                    resolved = normalizeEmails(manual.value, {
                        allowEmpty: false,
                        limit: MAX_EMAIL_RECIPIENTS
                    });
                    manual.value = resolved.join(', ');
                } else if (selected) {
                    const category = document.getElementById('mailCategoriaDestinatarios')?.value || 'general';
                    resolved = emailsForClient(selectedClient(), category);
                    if (!resolved.length) throw new Error('El cliente no tiene destinatarios configurados para esta categoría.');
                }
            } catch (error) {
                alert(error.message || error);
                return;
            }

            await originalPreview();

            if (resolved && !document.getElementById('modal-preview-email').classList.contains('hidden')) {
                ultimoDestinatario = resolved;
                document.getElementById('prevTo').textContent = `${resolved.join(', ')} (${resolved.length} destinatario${resolved.length === 1 ? '' : 's'})`;
            }
        };
        wrappedPreview.__multiEmailWrapped = true;
        window.previsualizarCorreo = wrappedPreview;
    }

    function init() {
        installCreateFields();
        installEditFields();
        installClientList();
        installManageClient();
        installCreateSubmit();
        installEditSubmit();
        installMailingCategory();
        wrapMailing();

        document.getElementById('mailDestinatarioSelect')?.addEventListener('change', updateMailingSummary);
        document.getElementById('mailCategoriaDestinatarios')?.addEventListener('change', updateMailingSummary);

        setTimeout(() => cargarListaClientesSegura(), 0);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
