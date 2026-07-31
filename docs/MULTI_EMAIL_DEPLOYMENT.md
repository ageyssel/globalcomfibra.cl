# Correos múltiples por cliente

## Alcance

Cada cliente dispone de tres listas independientes, con un máximo de 10 direcciones únicas por categoría:

- correos generales o administrativos;
- correos de facturación y cobranza;
- correos de soporte técnico.

El `email` principal permanece único porque identifica la cuenta de acceso del portal y conserva la relación histórica con facturas, tickets y registros de acceso.

## Compatibilidad

La migración conserva el campo histórico `correo_facturacion` y lo utiliza para poblar la nueva lista `correos_facturacion` en clientes existentes. Cuando una categoría no tiene direcciones registradas, las funciones usan el email principal del portal como respaldo.

## Despliegue

Desde la rama `mejora/globalcom-produccion`:

```bash
git pull origin mejora/globalcom-produccion
bash scripts/deploy-multi-email.sh
```

El script:

1. verifica la Supabase CLI;
2. vincula el proyecto `eejsdoeuovcrjicrgxmo`;
3. aplica la migración SQL;
4. despliega las funciones Edge modificadas.

No publica el sitio web ni modifica la rama `main`.

## Funciones desplegadas

- `create-client`
- `process-invoice`
- `send-invoice-notification`
- `send-custom-email`
- `send-collection-email`
- `notify-ticket-update`

## Prueba mínima obligatoria

Usar un cliente de prueba y registrar dos direcciones distintas en cada categoría.

1. Guardar la ficha y volver a abrirla para confirmar persistencia.
2. Enviar un correo general desde Central de Comunicaciones.
3. Enviar un correo de facturación desde Central de Comunicaciones.
4. Procesar una factura de prueba y comprobar que llegue a todos los correos de facturación.
5. Enviar un aviso de cobranza y comprobar la misma lista.
6. Responder un ticket y comprobar los correos de soporte.
7. Confirmar que cada destinatario recibe un mensaje individual y no ve las otras direcciones.
8. Probar once correos en una categoría y confirmar que el sistema lo rechaza.
9. Probar correos duplicados y confirmar que se eliminan.
10. Confirmar que el acceso al portal sigue funcionando con el email principal.

## Reversión

Antes del merge, el sitio productivo continúa usando `main`. Para revertir los cambios de base de datos después de una prueba controlada, no se recomienda eliminar inmediatamente las columnas porque las funciones nuevas pueden depender de ellas. Primero se deben volver a desplegar las funciones anteriores y luego evaluar una migración de reversión.
