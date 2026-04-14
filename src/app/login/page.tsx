'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase"; // Importamos tu cliente de Supabase

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Conexión con la autenticación de Supabase
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Correo o contraseña incorrectos. Por favor, verifica tus datos.");
      setLoading(false);
    } else if (data.session) {
      // Si el login es exitoso, redirigimos al dashboard
      router.push("/dashboard");
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f9fc] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/">
            <img src="/img/logo.png" alt="Globalcom" className="mx-auto h-24 w-auto object-contain drop-shadow-md" />
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-[#243b75]">
          Portal de Clientes
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 font-medium">
          Ingresa para gestionar tus servicios y soporte corporativo
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow-xl shadow-[#243b75]/5 sm:rounded-2xl sm:px-10 border border-gray-100">
          
          {/* Mensaje de error dinámico */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg font-medium">
              {error}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-bold text-[#1a2a5e]">
                Correo corporativo
              </label>
              <div className="mt-2">
                <input 
                  id="email" 
                  name="email" 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#61a3d9] focus:border-transparent text-sm transition-all"
                  placeholder="usuario@empresa.cl"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-[#1a2a5e]">
                Contraseña
              </label>
              <div className="mt-2">
                <input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#61a3d9] focus:border-transparent text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center">
                <input id="remember-me" name="remember-me" type="checkbox" className="h-4 w-4 text-[#f25c38] focus:ring-[#f25c38] border-gray-300 rounded" />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 font-medium">
                  Recordarme
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-bold text-[#61a3d9] hover:text-[#243b75] transition-colors">
                  ¿Olvidó su contraseña?
                </a>
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-[#243b75]/20 text-sm font-bold text-white bg-[#243b75] hover:bg-[#1a2a5e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#243b75] transition-all disabled:opacity-70"
              >
                {loading ? "Verificando credenciales..." : "Ingresar al Panel"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}