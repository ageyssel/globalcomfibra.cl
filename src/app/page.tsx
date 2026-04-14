import Link from "next/link";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#f8f9fc] font-sans text-gray-800">
      
      {/* NAVEGACIÓN DEL PORTAL */}
      <nav className="bg-[#1a2a5e] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <img src="/logo.png" alt="Globalcom" className="h-10 object-contain drop-shadow-md brightness-0 invert" />
            <span className="text-sm font-bold border-l border-white/20 pl-4 text-brand-light">Portal Cliente</span>
          </div>
          <div className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/dashboard" className="hover:text-brand-light transition">Mi Panel</Link>
            <Link href="/dashboard/tickets" className="hover:text-brand-light transition">Soporte</Link>
            <button className="text-gray-400 hover:text-white transition">Cerrar Sesión</button>
          </div>
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-[#243b75]">Hola, Empresa SpA</h1>
          <p className="text-gray-500 mt-1 font-medium">Aquí tienes el resumen de tus servicios e infraestructura.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* TARJETA DE ESTADO (Destacada en Dark Mode) */}
          <div className="lg:col-span-2 bg-gradient-to-br from-[#1a2a5e] to-[#243b75] rounded-3xl p-8 shadow-xl relative overflow-hidden border border-white/10">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#61a3d9]/10 rounded-full blur-3xl"></div>
            
            <div className="flex justify-between items-start mb-8 relative z-10">
              <div>
                <span className="text-[#61a3d9] text-xs font-black tracking-widest uppercase block mb-1">• ESTADO DE LA RED</span>
                <h2 className="text-2xl font-bold text-white">Óptimo y Estable</h2>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-white text-xs font-bold">En Línea</span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Uptime SLA</p>
                <p className="text-white font-bold text-xl">99.98%</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Latencia Promedio</p>
                <p className="text-white font-bold text-xl">4 ms</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Tráfico Bajada</p>
                <p className="text-[#61a3d9] font-bold text-xl">842 Mbps</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-gray-400 text-xs mb-1">Tráfico Subida</p>
                <p className="text-[#f25c38] font-bold text-xl">820 Mbps</p>
              </div>
            </div>
          </div>

          {/* TARJETA DE PLAN CONTRATADO */}
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-[#243b75] mb-6 border-b border-gray-100 pb-4">Servicio Contratado</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase">Plan Actual</p>
                <p className="text-gray-900 font-bold">Internet Dedicado 1 Gbps</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase">Dirección</p>
                <p className="text-gray-700 text-sm">Av. Apoquindo 1234, Las Condes</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase">IP Pública Asignada</p>
                <p className="text-gray-700 text-sm font-mono bg-gray-100 px-2 py-1 rounded inline-block mt-1">200.12.45.89</p>
              </div>
            </div>

            <div className="mt-8">
              <button className="w-full bg-[#f8f9fc] border border-gray-200 text-[#243b75] font-bold text-sm px-4 py-3 rounded-xl hover:bg-gray-100 transition">
                Ver Facturación
              </button>
            </div>
          </div>

        </div>

        {/* SECCIÓN DE TICKETS RÁPIDOS */}
        <div className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-[#243b75]">Tickets de Soporte Recientes</h3>
            <Link href="/dashboard/nuevo-ticket" className="bg-[#f25c38] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-orange-600 transition shadow-md shadow-orange-500/20">
              + Abrir Nuevo Ticket
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 rounded-l-lg">ID Ticket</th>
                  <th className="px-4 py-3">Asunto</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 rounded-r-lg">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="hover:bg-gray-50 transition">
                  <td className="px-4 py-4 font-mono text-xs">#T-0092</td>
                  <td className="px-4 py-4 font-medium text-gray-800">Consulta configuración BGP</td>
                  <td className="px-4 py-4">12 Abr 2026</td>
                  <td className="px-4 py-4">
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Resuelto</span>
                  </td>
                  <td className="px-4 py-4">
                    <button className="text-[#61a3d9] hover:underline font-medium text-xs">Ver detalles</button>
                  </td>
                </tr>
                {/* Aquí iteraremos la base de datos de Supabase más adelante */}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}