import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import OneSignal from "react-onesignal";

// ── Carregamento imediato (páginas leves / fluxo crítico) ──────────────────
import Index from "./pages/Index";
import Operador from "./pages/Operador";
import Logistica from "./pages/Logistica";
import Login from "./pages/Login";
import LoginLogistica from "./pages/LoginLogistica";
import NotFound from "./pages/NotFound";

// ── Lazy loading (páginas pesadas, acessadas apenas por admins) ─────────────
// Só são carregadas quando o usuário navega até elas, reduzindo o bundle inicial.
const Relatorios = lazy(() => import("./pages/Relatorios"));
const PartsCatalog = lazy(() => import("./pages/PartsCatalog"));
const Ajuda = lazy(() => import("./pages/Ajuda"));

// Fallback simples enquanto o chunk é baixado
const PageLoader = () => (
  <div className="min-h-screen bg-white flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-[#001E50] border-t-transparent rounded-full animate-spin" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evita re-fetch desnecessário ao re-focar a janela
      refetchOnWindowFocus: false,
      staleTime: 30_000, // 30 segundos de cache padrão
    },
  },
});

const App = () => {
  useEffect(() => {
    // Inicializa o OneSignal Push Notifications
    const initOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: import.meta.env.VITE_ONESIGNAL_APP_ID || "COLOQUE_SEU_APP_ID_AQUI",
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: false, // Vamos usar nosso próprio botão na tela de Logística
          },
        });
        console.log("OneSignal inicializado com sucesso.");
      } catch (error) {
        console.error("Erro ao inicializar OneSignal:", error);
      }
    };
    initOneSignal();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Páginas críticas — carregadas imediatamente */}
            <Route path="/" element={<Index />} />
            <Route path="/operador" element={<Operador />} />
            <Route path="/logistica" element={<Logistica />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login-logistica" element={<LoginLogistica />} />

            {/* Páginas pesadas — carregadas sob demanda */}
            <Route path="/relatorios" element={
              <Suspense fallback={<PageLoader />}>
                <Relatorios />
              </Suspense>
            } />
            <Route path="/admin/pecas" element={
              <Suspense fallback={<PageLoader />}>
                <PartsCatalog />
              </Suspense>
            } />
            <Route path="/ajuda" element={
              <Suspense fallback={<PageLoader />}>
                <Ajuda />
              </Suspense>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
