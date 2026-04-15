import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Package, CheckCircle, Clock, AlertTriangle, LogOut, RotateCcw, Siren } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getCardColorClasses } from "@/utils/colorMap";
import { playNewOrderAlert } from "@/utils/alertSound";
import OneSignal from "react-onesignal";

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

interface NaoConformidade {
  id: string;
  motivo: string;
  tacto: string;
  lado: string;
  created_at: string;
}

const Logistica = () => {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [naoConformidades, setNaoConformidades] = useState<NaoConformidade[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [now, setNow] = useState(new Date());
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

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

    // Check OneSignal permission on mount with polling for init
    const checkOneSignal = async () => {
      let retries = 0;
      const interval = setInterval(() => {
        if (OneSignal.initialized) {
          setNotificationsEnabled(OneSignal.Notifications.hasPermission);
          clearInterval(interval);
        }
        retries++;
        if (retries > 20) clearInterval(interval); // give up after 10s
      }, 500);
    };
    checkOneSignal();

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
      .in("status", ["pendente", "entregue_no_posto", "aguardando_confirmacao"])
      .order("created_at", { ascending: true }); // We will sort manually by urgency anyway

    if (data) setChamados(data as Chamado[]);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchActiveChamados();
    // Pequeno delay para a animação ficar visível
    setTimeout(() => {
      setIsRefreshing(false);
      toast({
        title: "Atualizado",
        description: "A lista de pedidos foi sincronizada.",
      });
    }, 500);
  };

  const handleEnableNotifications = async () => {
    try {
      if (!OneSignal.initialized) {
        toast({ title: "Aguarde...", description: "Conectando ao serviço de notificações." });
        return;
      }

      // No OneSignal react-onesignal v3, promptPush() não resolve com booleano em todos os browsers.
      // O melhor é escutar o evento ou apenas aguardar e checar o hasPermission atualizado.
      await OneSignal.Slidedown.promptPush();

      // Vamos checar agora se a permissão foi concedida.
      // Algumas vezes o OneSignal demora uns ms para atualizar o objeto local
      setTimeout(() => {
        if (OneSignal.Notifications.hasPermission) {
          setNotificationsEnabled(true);
          // Associe o Push Notification a este usuário
          if (session?.user?.id) {
            OneSignal.login(session.user.id);
          }
          toast({
            title: "Tudo certo! 🎉",
            description: "Você receberá alertas em tempo real de novos chamados.",
          });
        } else {
          toast({
            variant: "destructive",
            title: "Permissão Pendente ou Negada",
            description: "Não foi possível confirmar a permissão. Verifique no ícone do cadeado da barra de endereços.",
          });
        }
      }, 500);

    } catch (error) {
      console.error("Erro ao solicitar permissão de push:", error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Ocorreu um erro ao conectar. Tente recarregar a página."
      });
    }
  };

  useEffect(() => {
    fetchActiveChamados();
  }, []);

  // Buscar não conformidades do turno (últimas 8h)
  const fetchNaoConformidadesTurno = async () => {
    const oitoHorasAtras = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("nao_conformidades")
      .select("id, motivo, tacto, lado, created_at")
      .gte("created_at", oitoHorasAtras)
      .order("created_at", { ascending: false });
    if (data) setNaoConformidades(data as NaoConformidade[]);
  };

  useEffect(() => {
    fetchNaoConformidadesTurno();
  }, []);

  // Realtime: atualizar alerta de reincidência ao vivo
  useEffect(() => {
    const channel = supabase
      .channel("logistica-nao-conformidades")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "nao_conformidades" },
        () => fetchNaoConformidadesTurno()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Realtime subscription for chamados
  useEffect(() => {
    const channel = supabase
      .channel("logistica-chamados-active")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chamados" },
        () => {
          // ── Novo pedido do operador: toca alerta sonoro e atualiza lista ──
          playNewOrderAlert();
          fetchActiveChamados();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chamados" },
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
    // 2-step flow: sinaliza entrega → operador confirma via Double Check
    await supabase
      .from("chamados")
      .update({
        status: "entregue_no_posto",
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
  const aguardando = chamados.filter((c) => c.status === "entregue_no_posto" || c.status === "aguardando_confirmacao").length;

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

        {/* ── Banner de Reincidência ── */}
        {(() => {
          // Agrupar por motivo e verificar se algum >= 3 ocorrências no turno
          const motivoCounts: Record<string, number> = {};
          naoConformidades.forEach(nc => {
            motivoCounts[nc.motivo] = (motivoCounts[nc.motivo] || 0) + 1;
          });
          const reincidentes = Object.entries(motivoCounts).filter(([, count]) => count >= 3);
          if (reincidentes.length === 0) return null;
          return (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full bg-red-600 text-white rounded-2xl p-4 flex items-start gap-3 shadow-lg animate-pulse"
              >
                <div className="p-2 bg-white/20 rounded-xl shrink-0">
                  <Siren className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase tracking-wider">
                    ⚠ ALERTA DE REINCIDÊNCIA
                  </p>
                  {reincidentes.map(([motivo, count]) => (
                    <p key={motivo} className="text-xs font-bold opacity-90 mt-0.5">
                      "{motivo}" registrado {count}× neste turno — Possível falha de conferência no recebimento ou carregamento.
                    </p>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          );
        })()}

        {/* Superior Dashboard Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
          <div className="flex justify-between w-full md:w-auto items-start md:items-end gap-4">
            <div className="w-full">
              <h1 className="text-2xl md:text-3xl font-bold text-[#001E50] tracking-tight">Rastreamento de Peças</h1>
              <p className="text-sm md:text-base text-gray-500 mt-1">SLA Operacional: 10 Minutos</p>
            </div>
          </div>

          <div className="flex flex-wrap md:flex-nowrap w-full md:w-auto gap-3 md:gap-4">
            <div className="flex-1 bg-white rounded-2xl p-3 md:p-4 shadow-sm border flex items-center gap-3 md:gap-4 min-w-[130px]">
              <div className="bg-orange-100 p-2 md:p-3 rounded-xl text-orange-600">
                <AlertTriangle className="h-5 w-5 md:h-6 w-6" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-bold text-gray-500">Pendentes</p>
                <p className="text-2xl md:text-3xl font-extrabold text-[#001E50]">{pendentes}</p>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-2xl p-3 md:p-4 shadow-sm border flex items-center gap-3 md:gap-4 min-w-[130px]">
              <div className="bg-blue-100 p-2 md:p-3 rounded-xl text-blue-600">
                <Clock className="h-5 w-5 md:h-6 w-6" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-bold text-gray-500">Na Célula</p>
                <p className="text-2xl md:text-3xl font-extrabold text-[#001E50]">{aguardando}</p>
              </div>
            </div>
            <div className="flex gap-2 w-full md:w-auto md:ml-4">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-auto w-full md:w-auto flex-1 rounded-2xl px-4 py-4 md:py-0 border-gray-200 text-gray-500 hover:text-[#001E50] hover:border-[#001E50] transition-colors shadow-sm"
              >
                <RotateCcw className={`h-5 w-5 md:h-6 w-6 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                className="h-auto w-full md:w-auto flex-1 rounded-2xl px-4 py-4 md:py-0 border-gray-200 text-gray-500 hover:text-red-600 hover:border-red-600 transition-colors shadow-sm"
              >
                <LogOut className="h-5 w-5 md:h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>

        {/* Notificação Push Prompt Row - Desabilitado temporariamente */}
        {/* !notificationsEnabled && (
          <div className="w-full bg-blue-50 border border-blue-100 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 -mt-2">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full"><Package className="h-5 w-5 text-blue-600" /></div>
              <div>
                <h3 className="font-bold text-blue-900 text-sm md:text-base">Habilitar Notificações em Tempo Real</h3>
                <p className="text-blue-700 text-xs md:text-sm">Receba alertas de peças instantaneamente, mesmo com o app minimizado.</p>
              </div>
            </div>
            <Button onClick={handleEnableNotifications} className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-10 w-full md:w-auto">
              Ativar Alertas
            </Button>
          </div>
        )*/}

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
                      } ${chamado.isCritical && !chamado.isWaiting ? "animate-pulse ring-4 ring-red-500 ring-offset-2 border-red-500" : "border-transparent"} ${chamado.cor_peca?.startsWith('#') ? "border-l-8 border-l-gray-300" : getCardColorClasses(chamado.cor_peca)}`}
                    style={chamado.cor_peca?.startsWith('#') ? { backgroundColor: chamado.cor_peca, color: "#ffffff" } : {}}
                  >
                    {/* Main Content Area */}
                    <div className="flex-1 p-2 flex flex-col gap-2 relative z-10 font-bold">

                      {/* Flex Header & Actions */}
                      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-2 w-full border-b border-black/10 pb-3 md:pb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`${chamado.cor_peca?.startsWith('#') ? "bg-white/20" : "bg-black/10"} text-xs md:text-base font-black px-2 py-1 rounded-md`}>
                            TACTO: {chamado.tacto}
                          </span>
                          <span className={`${chamado.cor_peca?.startsWith('#') ? "bg-white/20" : "bg-black/10"} text-xs md:text-base font-black px-2 py-1 rounded-md`}>
                            LADO: {chamado.lado}
                          </span>
                          <span className={`${chamado.cor_peca?.startsWith('#') ? "bg-white/20" : "bg-black/10"} text-[10px] md:text-xs font-bold px-2 py-1 rounded-md opacity-70`}>
                            Cor DB: {chamado.cor_peca || "N/A"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto mt-1 md:mt-0">
                          <div className="flex flex-col flex-1 md:flex-initial md:items-end">
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
                              className="h-10 md:h-8 px-4 w-full md:w-auto ml-2 md:max-w-xs rounded-lg text-sm md:text-xs font-black shadow-md transition-transform hover:scale-105 active:scale-95 bg-black text-white hover:bg-black/80"
                              onClick={() => handleRegisterDelivery(chamado.id, chamado.cor_peca)}
                            >
                              CONFIRMAR
                            </Button>
                          ) : (
                            <div className={`h-10 md:h-8 px-4 w-full md:w-auto ml-2 rounded-lg flex items-center justify-center text-xs md:text-[10px] font-black border-2 ${chamado.cor_peca?.startsWith('#') ? "border-white text-white" : "border-black text-black"}`}>
                              <Package className="mr-2 md:mr-1 h-3 w-3 md:h-3 md:w-3" />
                              AGUARDANDO
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Flex Body: Part Code & Name */}
                      <div className="flex flex-col items-center justify-center py-1 w-full flex-1">
                        <div className="text-xl md:text-2xl font-black tracking-widest mb-1 px-3 py-1 bg-white/40 rounded-lg text-[#001E50]">
                          {chamado.codigo_peca}
                        </div>
                        <h3 className="text-lg md:text-xl font-black text-center mt-0.5 leading-none">
                          {chamado.nome_peca}
                        </h3>
                      </div>

                      {/* Footer: Operador / Time */}
                      <div className="flex flex-col md:flex-row items-center justify-between w-full mt-1 pt-2 border-t border-black/10 gap-2">
                        <div className="flex flex-col md:flex-row gap-2">
                          <span className={`${chamado.cor_peca?.startsWith('#') ? "bg-white/20" : "bg-black/10"} text-xs uppercase font-black px-2 py-1 rounded-md mb-2 md:mb-0`}>
                            CÓD: {chamado.codigo_peca}
                          </span>
                          <span className={`${chamado.cor_peca?.startsWith('#') ? "bg-white/20" : "bg-black/10"} text-xs uppercase font-black px-2 py-1 rounded-md mb-2 md:mb-0`}>
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
      </main >
    </div >
  );
};

export default Logistica;
