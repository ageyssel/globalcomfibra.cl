(() => {
    'use strict';

    const MAX_EMAILS = 10;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

    function tokenizeEmails(value) {
        const raw = Array.isArray(value) ? value : String(value || '').split(/[;,\n\s]+/);
        return raw.map(v => String(v || '').trim().toLowerCase()).filter(Boolean);
    }

    function normalizeEmails(value, { fallback = '', allowEmpty = true } = {}) {
        const raw = tokenizeEmails(value);
        const invalid = raw.filter(email => !EMAIL_RE.test(email));
        if (invalid.length) {
            throw new Error(`Correo(s) inválido(s): ${invalid.join(', ')}`);
        }

        const unique = [...new Set(raw)];
        if (unique.length > MAX_EMAILS) {
            throw new Error(`Solo puedes registrar hasta ${MAX_EMAILS} correos por categoría.`);
        }

        if (!unique.length && fallback) {
            const normalizedFallback = String(fallback).trim().toLowerCase();
            if (EMAIL_RE.test(normalizedFallback)) unique.push(normalizedFallback);
        }

        if (!allowEmpty && !unique.length) {
            throw new Error('Debes registrar al menos un correo válido.');
        }

        return unique;
    }

    function emailValue(value) {
        try {
            return normalizeEmails(value).join(', ');
        } catch (_) {
            return Array.isArray(value) ? value.join(', ') : String(value || '');
        }
    }

    function enhanceEmailInput(input, labelText) {
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
            <span class="text-[10px] font-bold text-blue-600" data-email-counter>0/${MAX_EMAILS}</span>
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
                emails = normalizeEmails(input.value);
                input.classList.remove('border-red-400', 'ring-1', 'ring-red-300');
            } catch (_) {
                emails = [...new Set(tokenizeEmails(input.value))].slice(0, MAX_EMAILS);
                hasError = true;
                input.classList.add('border-red-400', 'ring-1', 'ring-red-300');
            }

            chips.innerHTML = emails.map(email => `
                <span class="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
                    ${email}
                </span>
            `).join('');

            const counter = meta.querySelector('[data-email-counter]');
            counter.textContent = `${emails.length}/${MAX_EMAILS}`;
            counter.className = hasError
                ? 'text-[10px] font-bold text-red-600'
                : 'text-[10px] font-bold text-blue-600';
        };

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
                input.value = normalizeEmails(input.value).join(', ');
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
            enhanceEmailInput(document.getElementById('cCorreosGenerales'));
            enhanceEmailInput(document.getElementById('cCorreosSoporte'));
        }
    }

    function installEditFields() {
        const billing = document.getElementById('eEmailFact');
        if (!billing) return;
        enhanceEmailInput(billing, 'Correos Facturación y Cobranza (máx. 10)');

        if (!document.getElementById('eCorreosGenerales')) {
            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 gap-3';
            grid.appendChild(createEmailField('eCorreosGenerales', 'Correos Generales / Administrativos (máx. 10)'));
            grid.appendChild(createEmailField('eCorreosSoporte', 'Correos Soporte Técnico (máx. 10)', 'orange'));
            billing.closest('.grid')?.insertAdjacentElement('afterend', grid);
            enhanceEmailInput(document.getElementById('eCorreosGenerales'));
            enhanceEmailInput(document.getElementById('eCorreosSoporte'));
        }
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

        const depto = document.getElementById('mailDepto');
        const category = document.getElementById('mailCategoriaDestinatarios');
        const syncCategory = () => {
            const value = depto?.value || '';
            if (value.includes('Facturación')) category.value = 'facturacion';
            else if (value.includes('Soporte')) category.value = 'soporte';
            else category.value = 'general';
            updateMailingSummary();
        };

        depto?.addEventListener('change', syncCategory);
        select.addEventListener('change', updateMailingSummary);
        category.addEventListener('change', updateMailingSummary);
        syncCategory();
    }

    function clientByPortalEmail(email) {
        return (listaClientesCompleta || []).find(cliente => cliente.email === email);
    }

    function emailsForClient(cliente, category) {
        if (!cliente) return [];
        const portal = normalizeEmails(cliente.email);
        const general = normalizeEmails(cliente.correos_generales, { fallback: cliente.email });
        const billing = normalizeEmails(
            cliente.correos_facturacion?.length ? cliente.correos_facturacion : cliente.correo_facturacion,
            { fallback: cliente.email }
        );
        const support = normalizeEmails(cliente.correos_soporte, { fallback: cliente.email });

        if (category === 'facturacion') return billing;
        if (category === 'soporte') return support;
        if (category === 'todos') return [...new Set([...general, ...billing, ...support, ...portal])].slice(0, MAX_EMAILS);
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
            summary.textContent = 'Selecciona un cliente para ver la cantidad de destinatarios.';
            return;
        }

        try {
            const category = document.getElementById('mailCategoriaDestinatarios')?.value || 'general';
            const emails = emailsForClient(clientByPortalEmail(select.value), category);
            summary.textContent = `${emails.length} destinatario(s): ${emails.join(', ')}`;
        } catch (error) {
            summary.textContent = error.message;
        }
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

            const btn = document.getElementById('btnCrearCliente');
            const originalText = btn.textContent;
            btn.textContent = 'Sincronizando...';
            btn.disabled = true;

            try {
                const email = document.getElementById('cEmail').value.trim().toLowerCase();
                if (!EMAIL_RE.test(email)) throw new Error('El Email Portal no es válido.');

                const correosGenerales = normalizeEmails(document.getElementById('cCorreosGenerales').value);
                const correosFacturacion = normalizeEmails(document.getElementById('cEmailFact').value);
                const correosSoporte = normalizeEmails(document.getElementById('cCorreosSoporte').value);
                const password = document.getElementById('cPassword').value;
                const urlContrato = await uploadContract('cArchivoContrato', `contrato_${email}`) || '';

                const clientData = {
                    empresa: document.getElementById('cEmpresa').value,
                    rut: document.getElementById('cRut').value,
                    contacto: document.getElementById('cContacto').value,
                    contacto_facturacion: document.getElementById('cContactoFact').value,
                    correo_facturacion: correosFacturacion[0] || email,
                    correos_generales: correosGenerales,
                    correos_facturacion: correosFacturacion,
                    correos_soporte: correosSoporte,
                    fecha_inicio: document.getElementById('cFecha').value,
                    direccion: document.getElementById('cDireccion').value,
                    contrato_meses: document.getElementById('cContratoMeses').value,
                    dias_pago: parseInt(document.getElementById('cDiasPago').value, 10) || 30,
                    ip: document.getElementById('cIp').value,
                    plan: document.getElementById('cPlan').value,
                    url_dashboard: document.getElementById('cDashboard').value,
                    user_noc: document.getElementById('cUserNoc').value,
                    pass_noc: document.getElementById('cPassNoc').value,
                    url_contrato: urlContrato,
                    estado: 'Activo',
                    id_cliente: `GCOM-${Math.floor(1000 + Math.random() * 9000)}`
                };

                const { data, error } = await adminSupabase.functions.invoke('create-client', {
                    body: { email, password, clientData }
                });
                if (error) throw error;
                if (data?.error) throw new Error(data.error);

                alert('Cliente creado con listas de correos configuradas.');
                form.reset();
                [document.getElementById('cEmailFact'), document.getElementById('cCorreosGenerales'), document.getElementById('cCorreosSoporte')]
                    .forEach(input => input?.dispatchEvent(new Event('input')));
                await cargarListaClientes();
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
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

            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = 'Guardando...';
            btn.disabled = true;

            try {
                const rutOriginal = document.getElementById('editRutOriginal').value;
                const portalEmail = document.getElementById('editEmailOriginal').value;
                const correosGenerales = normalizeEmails(document.getElementById('eCorreosGenerales').value);
                const correosFacturacion = normalizeEmails(document.getElementById('eEmailFact').value);
                const correosSoporte = normalizeEmails(document.getElementById('eCorreosSoporte').value);
                const urlContratoNuevo = await uploadContract('eArchivoContrato', `contrato_${rutOriginal}`);

                const updateData = {
                    empresa: document.getElementById('eEmpresa').value,
                    rut: document.getElementById('eRut').value,
                    contacto: document.getElementById('eContacto').value,
                    contacto_facturacion: document.getElementById('eContactoFact').value,
                    correo_facturacion: correosFacturacion[0] || portalEmail,
                    correos_generales: correosGenerales,
                    correos_facturacion: correosFacturacion,
                    correos_soporte: correosSoporte,
                    fecha_inicio: document.getElementById('eFecha').value,
                    direccion: document.getElementById('eDireccion').value,
                    dias_pago: parseInt(document.getElementById('eDiasPago').value, 10) || 30,
                    contrato_meses: document.getElementById('eMeses').value,
                    ip: document.getElementById('eIp').value,
                    plan: document.getElementById('ePlan').value,
                    url_dashboard: document.getElementById('eDashboard').value,
                    user_noc: document.getElementById('eUserNoc').value,
                    pass_noc: document.getElementById('ePassNoc').value
                };
                if (urlContratoNuevo) updateData.url_contrato = urlContratoNuevo;

                const { error } = await adminSupabase.from('clientes').update(updateData).eq('rut', rutOriginal);
                if (error) throw error;

                alert('Cliente actualizado con sus listas de destinatarios.');
                document.getElementById('modal-detalle').classList.add('hidden');
                await cargarListaClientes();
                await cargarDashboard();
            } catch (error) {
                alert(`Error: ${error.message}`);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        }, true);
    }

    function wrapManageClient() {
        const original = window.gestionarCliente;
        if (typeof original !== 'function' || original.__multiEmailWrapped) return;

        const wrapped = async function(rut) {
            await original(rut);
            const { data: cliente, error } = await adminSupabase.from('clientes').select('*').eq('rut', rut).single();
            if (error || !cliente) return;

            document.getElementById('eCorreosGenerales').value = emailValue(cliente.correos_generales);
            document.getElementById('eEmailFact').value = emailValue(
                cliente.correos_facturacion?.length ? cliente.correos_facturacion : cliente.correo_facturacion
            );
            document.getElementById('eCorreosSoporte').value = emailValue(cliente.correos_soporte);

            ['eCorreosGenerales', 'eEmailFact', 'eCorreosSoporte'].forEach(id => {
                document.getElementById(id)?.dispatchEvent(new Event('input'));
            });
        };
        wrapped.__multiEmailWrapped = true;
        window.gestionarCliente = wrapped;
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
                    resolved = normalizeEmails(manual.value, { allowEmpty: false });
                    manual.value = resolved.join(', ');
                } else if (selected) {
                    const category = document.getElementById('mailCategoriaDestinatarios')?.value || 'general';
                    resolved = emailsForClient(clientByPortalEmail(selected), category);
                    if (!resolved.length) throw new Error('El cliente no tiene destinatarios configurados para esta categoría.');
                }
            } catch (error) {
                alert(error.message);
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
        installMailingCategory();
        installCreateSubmit();
        installEditSubmit();
        wrapManageClient();
        wrapMailing();

        document.getElementById('mailDestinatarioSelect')?.addEventListener('change', updateMailingSummary);
        document.getElementById('mailCategoriaDestinatarios')?.addEventListener('change', updateMailingSummary);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
