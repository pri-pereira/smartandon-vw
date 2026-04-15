import { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import NumericKeypad from "@/components/NumericKeypad";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { getCardColorClasses } from "@/utils/colorMap";
import { getTerminalId, saveActiveChamadoId } from "@/utils/terminalId";
import ConfirmacaoFAB from "@/components/ConfirmacaoFAB";
import MaterialNaoConformeModal from "@/components/MaterialNaoConformeModal";

type Step = "tacto" | "peca" | "success";
type Lado = "LE" | "LD" | null;

interface PendingDelivery {
  id: string;
  nome_peca: string;
  codigo_peca: string;
}

interface PecaItem {
  id: string;
  Codigo_Peca: string;
  Nome_Peca: string;
  CC_Number: string;
  Cor: string;
}

const Operador = () => {
  const [step, setStep] = useState<Step>("tacto");
  const [tacto, setTacto] = useState("");
  const [lado, setLado] = useState<Lado>(null);
  const [catalogoPecas, setCatalogoPecas] = useState<PecaItem[]>([]);
  const [tactoError, setTactoError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [naoConformeOpen, setNaoConformeOpen] = useState(false);
  const { toast } = useToast();

  // Load parts and validate Poka-Yoke when Tacto or Lado changes
  useEffect(() => {
    const validateTacto = async () => {
      // Basic check
      if (tacto.length < 3) {
        setTactoError(null);
        setCatalogoPecas([]);
        return;
      }

      setIsValidating(true);

      // Consult base_pecas_andon by Tacto
      const { data: tactoData, error: tactoErrorSupabase } = await supabase
        .from("base_pecas_andon")
        .select("*")
        .eq("Tacto", tacto);

      if (tactoErrorSupabase || !tactoData || tactoData.length === 0) {
        setTactoError(`Tacto ${tacto} não registrado`);
        setCatalogoPecas([]);
        setIsValidating(false);
        return;
      }

      // If Tacto exists, clear Tacto error.
      setTactoError(null);

      // Filter by Lado if selected
      if (lado) {
        const filteredParts = tactoData.filter((p) => p.Lado === lado);
        setCatalogoPecas(filteredParts as PecaItem[]);
      } else {
        // Just the tacto is valid, but no parts to show yet until Lado is chosen
        setCatalogoPecas([]);
      }

      setIsValidating(false);
    };

    // Debounce to avoid validating every single keystroke excessively
    const timeoutId = setTimeout(() => {
      validateTacto();
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [tacto, lado]);



  const handleConfirmTacto = () => {
    // Only proceed if there's no error, tacto is filled, lado is selected, and we found parts
    if (tacto.length >= 3 && lado && !tactoError && catalogoPecas.length > 0) {
      setStep("peca");
    } else if (tacto.length >= 3 && lado && !tactoError && catalogoPecas.length === 0) {
      toast({
        title: "Atenção",
        description: `Nenhuma peça cadastrada para Tacto ${tacto} no Lado ${lado}`,
        variant: "destructive"
      });
    }
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
    const { data: inserted, error } = await supabase.from("chamados").insert({
      tacto,
      lado,
      codigo_peca: peca.Codigo_Peca,
      nome_peca: peca.Nome_Peca,
      cost_center: peca.CC_Number,
      cor_peca: peca.Cor,
      rack_location: "N/A",
      barcode_value: peca.Codigo_Peca,
      created_at: getSaoPauloTimestamp(),
      terminal_id: getTerminalId(),
    }).select("id").single();

    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }

    // ── Salva o ID no localStorage para recuperar no reload ──
    if (inserted?.id) {
      saveActiveChamadoId(inserted.id);
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
    <div className="min-h-screen flex flex-col bg-[#FFFFFF] font-sans selection:bg-[#001E50] selection:text-white pb-6 overflow-x-hidden">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto flex flex-col items-center px-4 sm:px-6 mt-4 md:mt-8 gap-4 sm:gap-6">

        {step === "tacto" && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full flex flex-col items-center gap-4 sm:gap-6"
          >
            <div className="w-full text-center max-w-lg">
              <h2 className="text-lg md:text-xl font-bold text-[#001E50] mb-3 sm:mb-4">SELECIONE O LADO</h2>
              {/* Segmented Control for Lado */}
              <div className="flex bg-slate-100 rounded-3xl p-1.5 w-full mx-auto shadow-sm">
                <button
                  onClick={() => setLado("LE")}
                  className={`flex-1 py-3 md:py-4 text-base md:text-lg font-bold rounded-3xl transition-all duration-200 ${lado === "LE"
                    ? "bg-[#001E50] text-white shadow-md transform scale-[1.02]"
                    : "text-gray-500 hover:text-[#001E50]"
                    }`}
                >
                  LE (Esquerdo)
                </button>
                <button
                  onClick={() => setLado("LD")}
                  className={`flex-1 py-3 md:py-4 text-base md:text-lg font-bold rounded-3xl transition-all duration-200 ${lado === "LD"
                    ? "bg-[#001E50] text-white shadow-md transform scale-[1.02]"
                    : "text-gray-500 hover:text-[#001E50]"
                    }`}
                >
                  LD (Direito)
                </button>
              </div>
            </div>

            <div className="w-full text-center mt-1 sm:mt-2 max-w-lg">
              <h2 className="text-lg md:text-xl font-bold text-[#001E50] mb-3 sm:mb-4">INFORME O TACTO</h2>
              <div className={`w-full bg-slate-50 rounded-3xl py-4 sm:py-6 text-center border-2 transition-colors shadow-sm ${tactoError ? "border-red-500 bg-red-50 focus-within:border-red-600" : "border-transparent focus-within:border-[#001E50]"}`}>
                <span className={`text-4xl sm:text-5xl font-mono font-bold tracking-widest ${tactoError ? "text-red-500" : "text-[#001E50]"}`}>
                  {tacto || "---"}
                </span>
              </div>

              {/* Feedback de Poka-Yoke Status */}
              <div className="h-8 mt-2 flex items-center justify-center">
                {tactoError ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center text-red-500 font-bold gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>{tactoError}</span>
                  </motion.div>
                ) : tacto.length > 2 && lado && isValidating ? (
                  <span className="text-gray-400 font-medium animate-pulse">Verificando...</span>
                ) : tacto.length > 2 && !lado ? (
                  <span className="text-[#001E50] font-medium font-bold">Selecione o Lado</span>
                ) : tacto.length > 2 && lado && catalogoPecas.length === 0 ? (
                  <span className="text-orange-500 font-bold">Sem peças para o Lado selecionado</span>
                ) : (
                  <span className="text-transparent">N/A</span>
                )}
              </div>
            </div>

            <div className="w-full max-w-lg transform scale-[0.85] sm:scale-100 origin-top -mt-2 sm:-mt-0 mb-2 sm:mb-8">
              <NumericKeypad value={tacto} onChange={setTacto} maxLength={5} />
            </div>

            {/* Botão Material Não Conforme */}
            <div className="w-full max-w-lg">
              <button
                onClick={() => setNaoConformeOpen(true)}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 text-orange-700 font-black text-base transition-all active:scale-95 shadow-sm"
              >
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Material não conforme
              </button>
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
                className={`flex-1 h-16 text-xl rounded-2xl shadow-md transition-all ${tacto.length >= 3 && lado && !tactoError && catalogoPecas.length > 0
                  ? "bg-[#001E50] hover:bg-[#001538] text-white"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                  }`}
                disabled={!(tacto.length >= 3 && lado && !tactoError && catalogoPecas.length > 0)}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 w-full px-2">
              {catalogoPecas.map((peca) => (
                <div
                  key={peca.id}
                  className="w-full flex"
                >
                  <button
                    onClick={() => handleSubmitChamado(peca)}
                    className={`w-full h-auto min-h-[160px] md:min-h-[200px] flex flex-col items-center justify-center py-6 px-4 md:py-8 md:px-6 rounded-2xl md:rounded-3xl shadow-lg relative transition-all hover:brightness-105 active:scale-95 gap-2 md:gap-3 ${getCardColorClasses(peca.Cor)}`}
                  >
                    <span className="text-2xl md:text-4xl font-extrabold z-10 drop-shadow-sm tracking-tight text-center break-words w-full">
                      {peca.Codigo_Peca}
                    </span>
                    <span className="text-lg md:text-2xl font-black text-center z-10 leading-snug w-full px-2">
                      {peca.Nome_Peca}
                    </span>
                    <span className="text-sm md:text-base font-bold mt-2 md:mt-4 z-10 opacity-70 uppercase tracking-widest w-full text-center">
                      CC: {peca.CC_Number}
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

      {/* ── Double Check FAB: aparece quando a logística sinaliza entrega ── */}
      <ConfirmacaoFAB />

      {/* ── Modal: Material Não Conforme ── */}
      <MaterialNaoConformeModal
        isOpen={naoConformeOpen}
        onClose={() => setNaoConformeOpen(false)}
        tactoInicial={tacto}
        ladoInicial={lado}
      />
    </div>
  );
};

export default Operador;
