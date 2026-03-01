import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Package, CheckCircle, Clock, AlertTriangle, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Chamado {
  id: string;
  tacto: string;
  lado: string | null;
  codigo_peca: string;
  nome_peca: string;
  cor_peca: string;
  status: string;
  created_at: string;
  tempo_entrega: number | null;
  cost_center: string;
  barcode_value: string;
  rack_location: string;
}

const Logistica = () => {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();
  const { toast } = useToast();

  // Authentication check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
      if (!session) {
        navigate("/login-logistica");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        navigate("/login-logistica");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch active chamados only (pendente or entregue/aguardando_confirmacao)
  const fetchActiveChamados = async () => {
    // For logistics dashboard, we only care about today's active tickets or tickets that haven't been completed
    const startOfDay = `${format(new Date(), "yyyy-MM-dd")}T00:00:00`;
    const { data } = await supabase
      .from("chamados")
      .select("*")
      .gte("created_at", startOfDay)
      .in("status", ["pendente", "entregue", "aguardando_confirmacao"])
      .order("created_at", { ascending: true }); // We will sort manually by urgency anyway

    if (data) setChamados(data as Chamado[]);
  };

  useEffect(() => {
    fetchActiveChamados();
  }, []);

  // Realtime subscription for chamados
  useEffect(() => {
    const channel = supabase
      .channel("logistica-chamados-active")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chamados" },
        () => fetchActiveChamados()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // High precision clock for MM:SS
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getSaoPauloTimestamp = () => {
    try {
      const formatter = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const formatted = formatter.format(new Date());
      return formatted.replace(" ", "T") + "-03:00";
    } catch {
      return new Date().toISOString();
    }
  };

  const handleRegisterDelivery = async (id: string, cor: string) => {
    // 2-step flow: update to 'entregue' (which maps to aguardando_confirmacao visually and functionally)
    await supabase
      .from("chamados")
      .update({
        status: "entregue",
        entregue_at: getSaoPauloTimestamp(),
      })
      .eq("id", id);

    // Because of our realtime channel, fetchActiveChamados will run automatically
    toast({
      title: "Sinalizado!",
      description: "Aguardando confirmação do Operador na célula.",
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loadingAuth || !session) {
    return null;
  }

  // Calculate stats
  const pendentes = chamados.filter((c) => c.status === "pendente").length;
  const aguardando = chamados.filter((c) => c.status === "entregue" || c.status === "aguardando_confirmacao").length;

  // Enhance chamados with time data and urgency sorting
  const MAX_TIME_S = 600; // 10 minutes

  const chamadosWithTime = chamados.map((c) => {
    const createdAtTime = new Date(c.created_at).getTime();
    // Use the component's 'now' state to force re-renders, comparing against the static created_at
    const elapsedSeconds = Math.floor((now.getTime() - createdAtTime) / 1000);
    // Limit to max time visually
    const cappedElapsed = Math.min(elapsedSeconds, MAX_TIME_S);

    // SLA thresholds
    let barColor = "bg-green-500";
    if (cappedElapsed >= 300 && cappedElapsed < 480) { // 50%
      barColor = "bg-yellow-400";
    } else if (cappedElapsed >= 480) { // 80%
      barColor = "bg-red-500";
    }

    // Remaining time formatted MM:SS
    const remainingSeconds = Math.max(MAX_TIME_S - elapsedSeconds, 0);
    const mins = Math.floor(remainingSeconds / 60).toString().padStart(2, "0");
    const secs = (remainingSeconds % 60).toString().padStart(2, "0");

    return {
      ...c,
      elapsedSeconds,
      percentComplete: Math.min((cappedElapsed / MAX_TIME_S) * 100, 100),
      barColor,
      isCritical: cappedElapsed >= 550, // Very critical
      timeString: `${mins}:${secs}`,
      isWaiting: c.status === "entregue" || c.status === "aguardando_confirmacao"
    };
  });

  // Urgency sorting: least time remaining at the top (highest elapsed time)
  // Ensure that items waiting for confirmation drop below pending items
  const sortedChamados = [...chamadosWithTime].sort((a, b) => {
    if (a.isWaiting && !b.isWaiting) return 1;
    if (!a.isWaiting && b.isWaiting) return -1;
    return b.elapsedSeconds - a.elapsedSeconds;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F4F5] font-sans selection:bg-[#001E50] selection:text-white">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto flex flex-col px-4 md:px-6 py-6 gap-6">

        {/* Superior Dashboard Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
          <div className="flex justify-between w-full md:w-auto items-start md:items-end gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#001E50] tracking-tight">Rastreamento de Peças</h1>
              <p className="text-gray-500 mt-1">SLA Operacional: 10 Minutos</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border flex items-center gap-4 min-w-[140px]">
              <div className="bg-orange-100 p-3 rounded-xl text-orange-600">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">Pendentes</p>
                <p className="text-3xl font-extrabold text-[#001E50]">{pendentes}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border flex items-center gap-4 min-w-[140px]">
              <div className="bg-blue-100 p-3 rounded-xl text-blue-600">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500">Na Célula</p>
                <p className="text-3xl font-extrabold text-[#001E50]">{aguardando}</p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={handleLogout} className="h-full rounded-2xl px-4 py-4 md:py-0 border-gray-200 text-gray-500 hover:text-[#001E50] hover:border-[#001E50] transition-colors ml-4 shadow-sm">
              <LogOut className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Priority Vertical List */}
        <div className="flex-1 w-full flex flex-col gap-4 mt-2 mb-12">
          {sortedChamados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <CheckCircle size={64} className="text-green-500 mb-4 opacity-50" />
              <h2 className="text-2xl font-bold text-[#001E50]">Linha Abastecida</h2>
              <p className="text-gray-500">Nenhum chamado ativo no momento.</p>
            </div>
          ) : (
            <AnimatePresence>
              {sortedChamados.map((chamado) => {
                return (
                  <motion.div
                    key={chamado.id}
                    layout // Automagically animate reordering
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className={`relative w-full rounded-3xl shadow-lg border-2 overflow-hidden flex flex-col ${chamado.isWaiting ? "opacity-75 grayscale-[30%]" : ""
                      } ${chamado.isCritical && !chamado.isWaiting ? "animate-pulse border-red-500" : "border-transparent"}`}
                    style={{ backgroundColor: chamado.cor_peca, color: "#000000" }}
                  >
                    {/* Main Content Area */}
                    <div className="flex-1 p-2 flex flex-col gap-2 relative z-10 font-bold">

                      {/* Flex Header & Actions */}
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 w-full border-b border-black/10 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm md:text-base font-black bg-black/10 px-2 py-1 rounded-md">
                            TACTO: {chamado.tacto}
                          </span>
                          <span className="text-sm md:text-base font-black bg-black/10 px-2 py-1 rounded-md">
                            LADO: {chamado.lado}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] uppercase tracking-widest opacity-80 mb-0">
                              {chamado.isWaiting ? "Sinalizado" : "Tempo"}
                            </span>
                            <span className={`text-xl md:text-2xl font-mono font-black tabular-nums tracking-tighter ${chamado.isWaiting ? "opacity-50" : ""
                              }`}>
                              {chamado.timeString}
                            </span>
                          </div>

                          {!chamado.isWaiting ? (
                            <Button
                              size="sm"
                              className="h-8 px-4 rounded-lg text-xs font-black shadow-md transition-transform hover:scale-105 active:scale-95 ml-2 bg-black text-white hover:bg-black/80"
                              onClick={() => handleRegisterDelivery(chamado.id, chamado.cor_peca)}
                            >
                              CONFIRMAR
                            </Button>
                          ) : (
                            <div className="h-8 px-3 rounded-lg flex items-center justify-center text-[10px] font-black border-2 border-black text-black ml-2">
                              <Package className="mr-1 h-3 w-3" />
                              AGUARDANDO
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Flex Body: Part Code & Name */}
                      <div className="flex flex-col items-center justify-center py-1 w-full flex-1">
                        <div className="text-xl md:text-2xl font-black tracking-widest mb-1 px-3 py-1 bg-white/40 rounded-lg">
                          {chamado.codigo_peca}
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-center mt-0.5 leading-none">
                          {chamado.nome_peca}
                        </h3>
                      </div>

                      {/* Footer: Operador / Time */}
                      <div className="flex flex-col md:flex-row items-center justify-between w-full mt-1 pt-2 border-t border-black/10 gap-2">
                        <div className="flex flex-col md:flex-row gap-2">
                          <span className="text-xs uppercase font-black bg-black/10 px-2 py-1 rounded-md mb-2 md:mb-0">
                            CÓD: {chamado.codigo_peca}
                          </span>
                          <span className="text-xs uppercase font-black bg-black/10 px-2 py-1 rounded-md mb-2 md:mb-0">
                            CC: {chamado.cost_center || "N/A"}
                          </span>
                        </div>
                        <div className="font-mono text-center md:text-right border-t md:border-none pt-2 md:pt-0 border-black/10 w-full md:w-auto">
                          <span className="block text-[8px] uppercase tracking-wider opacity-90 leading-none">
                            Abertura
                          </span>
                          <span className="block text-sm font-black tracking-widest leading-none mt-0.5">
                            {format(new Date(chamado.created_at), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Semaphoric Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/10">
                      <div
                        className={`h-full ${chamado.barColor} transition-all duration-1000 ease-linear`}
                        style={{ width: `${chamado.percentComplete}%` }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </main>
    </div>
  );
};

export default Logistica;
