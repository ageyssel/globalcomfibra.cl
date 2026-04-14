'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function NuevoTicket() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    const payload = {
      asunto: formData.get('asunto'),
      prioridad: formData.get('prioridad'),
      descripcion: formData.get('descripcion'),
      cliente_id: 'ID_DE_PRUEBA_O_SESION', 
    };

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccess(true);
        (e.target as HTMLFormElement).reset();
      }
    } catch (error) {
      console.error('Error al enviar el ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] font-sans text-gray-800">
      <nav className="bg-[#1a2a5e] text-white shadow-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-[#61a3d9] hover:text-white transition font-semibold text-sm flex items-center">
            ← Volver al Panel
          </Link>
          <span className="text-sm font-bold">Soporte Técnico</span>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="bg-white rounded-3xl p-10 shadow-sm border border-gray-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#243b75] to-[#61a3d9]"></div>
          
          <h1 className="text-2xl font-bold text-[#1a2a5e] mb-2">Abrir un nuevo requerimiento</h1>
          <p className="text-gray-500 text-sm mb-8">
            Describe tu problema técnico detalladamente. Nuestro equipo SLA te responderá según la prioridad asignada.
          </p>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-6 py-4 rounded-xl mb-8 font-medium text-sm">
              ✅ Ticket generado con éxito. Hemos notificado al equipo de soporte.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-[#1a2a5e] mb-2">Asunto del problema</label>
                <input 
                  type="text" 
                  name="asunto" 
                  required 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#61a3d9] transition-all"
                  placeholder="Ej: Caída de enlace en sede norte"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-[#1a2a5e] mb-2">Nivel de Prioridad</label>
                <select 
                  name="prioridad" 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#61a3d9] transition-all"
                >
                  <option value="Baja">Baja - Consultas generales o intermitencia leve</option>
                  <option value="Media">Media - Degradación del servicio</option>
                  <option value="Alta">Alta - Caída total del enlace (Emergencia)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-[#1a2a5e] mb-2">Descripción detallada</label>
                <textarea 
                  name="descripcion" 
                  rows={5} 
                  required 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#61a3d9] transition-all resize-none"
                  placeholder="Por favor indica hora de inicio, luces del equipo (ONT) y pruebas realizadas..."
                ></textarea>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={loading}
                className="bg-[#243b75] text-white font-bold text-sm px-10 py-4 rounded-full hover:bg-[#1a2a5e] transition-all duration-300 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Generando ticket...' : 'Enviar Requerimiento'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}