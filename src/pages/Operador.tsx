import { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import NumericKeypad from "@/components/NumericKeypad";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

type Step = "tacto" | "peca" | "success";
type Lado = "LE" | "LD" | null;

interface PendingDelivery {
  id: string;
  nome_peca: string;
  codigo_peca: string;
}

interface PecaItem {
  id: string;
  part_number: string;
  rack_location: string;
  description: string;
  cost_center: string;
  barcode_value: string;
  cor: string;
}

const Operador = () => {
  const [step, setStep] = useState<Step>("tacto");
  const [tacto, setTacto] = useState("");
  const [lado, setLado] = useState<Lado>(null);
  const [catalogoPecas, setCatalogoPecas] = useState<PecaItem[]>([]);
  const [pendingDelivery, setPendingDelivery] = useState<PendingDelivery | null>(null);
  const { toast } = useToast();

  // Load all parts on mount
  useEffect(() => {
    const fetchCatalog = async () => {
      const { data, error } = await supabase.from("logistics_inventory").select("*");
      if (!error && data) {
        setCatalogoPecas(data as PecaItem[]);
      }
    };
    fetchCatalog();
  }, []);

  // Realtime listener for logistics double-check deliveries
  useEffect(() => {
    const channel = supabase
      .channel("operador-delivery")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chamados",
          filter: "status=eq.entregue",
        },
        (payload) => {
          const record = payload.new as any;
          if (record.status === "entregue") {
            setPendingDelivery({
              id: record.id,
              nome_peca: record.nome_peca,
              codigo_peca: record.codigo_peca,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleConfirmTacto = () => {
    if (tacto.length >= 3 && lado) {
      setStep("peca");
    }
  };

  const getTextColor = (hex: string) => {
    if (!hex) return "#001E50";
    const hexClean = hex.replace("#", "");
    const r = parseInt(hexClean.slice(0, 2), 16) || 0;
    const g = parseInt(hexClean.slice(2, 4), 16) || 0;
    const b = parseInt(hexClean.slice(4, 6), 16) || 0;
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "#001E50" : "#FFFFFF";
  };

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

  const handleSubmitChamado = async (peca: PecaItem) => {
    const { error } = await supabase.from("chamados").insert({
      tacto,
      lado,
      codigo_peca: peca.part_number,
      nome_peca: peca.description,
      cor_peca: peca.cor,
      cost_center: peca.cost_center,
      barcode_value: peca.barcode_value,
      rack_location: peca.rack_location,
      created_at: getSaoPauloTimestamp(),
    });

    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }

    setStep("success");
    setTimeout(() => {
      setStep("tacto");
      setTacto("");
      setLado(null);
    }, 2000);
  };

  const handleConfirmDelivery = async () => {
    if (!pendingDelivery) return;
    const now = getSaoPauloTimestamp();
    await supabase
      .from("chamados")
      .update({ status: "confirmado", confirmado_at: now })
      .eq("id", pendingDelivery.id);
    setPendingDelivery(null);
    toast({ title: "Recebimento confirmado!" });
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex flex-col bg-[#FFFFFF] font-sans">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center -mt-16">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="flex flex-col items-center"
          >
            <CheckCircle className="h-32 w-32 text-green-500 mb-6" />
            <h1 className="text-3xl font-bold text-[#001E50]">Chamado Enviado!</h1>
            <p className="text-gray-500 mt-2 text-lg">A logística já foi notificada.</p>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFFFF] font-sans selection:bg-[#001E50] selection:text-white pb-10 overflow-x-hidden">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto flex flex-col items-center px-6 mt-6 md:mt-12 gap-8">

        {step === "tacto" && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full flex flex-col items-center gap-8"
          >
            <div className="w-full text-center max-w-lg">
              <h2 className="text-xl md:text-2xl font-bold text-[#001E50] mb-6">SELECIONE O LADO</h2>
              {/* Segmented Control for Lado */}
              <div className="flex bg-slate-100 rounded-3xl p-1.5 w-full mx-auto shadow-sm">
                <button
                  onClick={() => setLado("LE")}
                  className={`flex-1 py-4 text-lg font-bold rounded-3xl transition-all duration-200 ${lado === "LE"
                    ? "bg-[#001E50] text-white shadow-md transform scale-[1.02]"
                    : "text-gray-500 hover:text-[#001E50]"
                    }`}
                >
                  LE (Esquerdo)
                </button>
                <button
                  onClick={() => setLado("LD")}
                  className={`flex-1 py-4 text-lg font-bold rounded-3xl transition-all duration-200 ${lado === "LD"
                    ? "bg-[#001E50] text-white shadow-md transform scale-[1.02]"
                    : "text-gray-500 hover:text-[#001E50]"
                    }`}
                >
                  LD (Direito)
                </button>
              </div>
            </div>

            <div className="w-full text-center mt-2 max-w-lg">
              <h2 className="text-xl md:text-2xl font-bold text-[#001E50] mb-6">INFORME O TACTO</h2>
              <div className="w-full bg-slate-50 rounded-3xl py-6 text-center border-2 border-transparent focus-within:border-[#001E50] transition-colors shadow-sm">
                <span className="text-5xl font-mono font-bold text-[#001E50] tracking-widest">
                  {tacto || "---"}
                </span>
              </div>
            </div>

            <div className="w-full max-w-lg transform scale-110 md:scale-125 origin-top mt-4 mb-16 md:mb-24">
              <NumericKeypad value={tacto} onChange={setTacto} maxLength={5} />
            </div>

            <div className="flex gap-4 w-full max-w-lg">
              <Button
                variant="outline"
                className="flex-1 h-16 text-xl rounded-2xl border-2 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                onClick={() => { setTacto(""); setLado(null); }}
              >
                LIMPAR
              </Button>
              <Button
                className={`flex-1 h-16 text-xl rounded-2xl shadow-md transition-all ${tacto.length >= 3 && lado
                  ? "bg-[#001E50] hover:bg-[#001538] text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                disabled={!(tacto.length >= 3 && lado)}
                onClick={handleConfirmTacto}
              >
                CONFIRMAR
              </Button>
            </div>
          </motion.div>
        )}

        {step === "peca" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full flex flex-col items-center gap-8"
          >
            {/* Header context recap */}
            <div className="flex gap-2 w-full justify-center mb-2">
              <span className="bg-slate-100 text-[#001E50] px-4 py-1.5 rounded-full text-sm font-bold">
                LADO: {lado}
              </span>
              <span className="bg-slate-100 text-[#001E50] px-4 py-1.5 rounded-full text-sm font-bold">
                TACTO: {tacto}
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-[#001E50] mb-2 text-center">
              CATÁLOGO DE PEÇAS
            </h2>
            <p className="text-gray-500 text-center mb-4">
              Toque na peça correspondente para confirmar o envio imediato.
            </p>

            {/* Bento Grid layout for Parts */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full">
              {catalogoPecas.map((peca) => (
                <div
                  key={peca.id}
                  className="w-full"
                >
                  <button
                    onClick={() => handleSubmitChamado(peca)}
                    className="w-full h-full min-h-[160px] flex flex-col items-center justify-center p-6 rounded-3xl border border-white/20 shadow-lg relative overflow-hidden transition-all hover:brightness-105"
                    style={{
                      backgroundColor: peca.cor,
                      color: getTextColor(peca.cor)
                    }}
                  >
                    <span className="text-3xl font-extrabold mb-2 z-10 drop-shadow-sm">
                      {peca.part_number}
                    </span>
                    <span className="text-lg font-medium text-center z-10 leading-tight">
                      {peca.description}
                    </span>
                    <span className="text-xs font-bold opacity-70 mt-6 z-10">
                      Cod: {peca.part_number}
                    </span>
                  </button>
                </div>
              ))}

              {catalogoPecas.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500">
                  Nenhuma peça cadastrada no catálogo. Verifique o banco de dados.
                </div>
              )}
            </div>

            <div className="w-full mt-4 flex justify-center pb-8">
              <Button
                variant="outline"
                className="h-16 w-full max-w-sm text-xl rounded-2xl border-2 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                onClick={() => setStep("tacto")}
              >
                VOLTAR PARA O TACTO
              </Button>
            </div>
          </motion.div>
        )}
      </main>

      {/* High-Performance Action Overlay for Delivery Confirmation */}
      <AnimatePresence>
        {pendingDelivery && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            /* Brutal backdrop blur for 100% focus */
            className="fixed inset-0 z-50 flex items-end justify-center bg-transparent backdrop-blur-2xl px-4 pb-4"
          >
            <motion.div
              /* Slide up animation */
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="w-full max-w-md bg-[#001E50] rounded-[2rem] p-8 flex flex-col items-center justify-center text-white shadow-2xl relative overflow-hidden"
            >
              {/* Glossy light effect softly bleeding from the top */}
              <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

              <h2 className="text-3xl font-bold mb-4 text-center mt-4">Peça na Célula!</h2>
              <p className="text-xl mb-12 text-center text-white/80 leading-relaxed font-light z-10">
                A logística sinalizou a entrega da <br />
                <strong className="text-white font-bold text-3xl mt-2 block">{pendingDelivery.nome_peca}</strong>
              </p>

              <Button
                onClick={handleConfirmDelivery}
                className="w-full h-20 text-xl font-bold rounded-[1.5rem] bg-white text-[#001E50] hover:bg-gray-100 hover:scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95 transition-all text-wrap z-10"
              >
                CONFIRMAR RECEBIMENTO
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Operador;
