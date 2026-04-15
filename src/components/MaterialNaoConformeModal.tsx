import { useState } from "react";
import { AlertTriangle, X, CheckCircle, Truck, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NumericKeypad from "@/components/NumericKeypad";

export type MotivoNC =
  | "Erro de Posicionamento (Rack)"
  | "Divergência de Lado (Ficha vs Físico)";

type ModalStep = "validacao" | "motivo" | "confirmacao" | "sucesso";
type Lado = "LE" | "LD" | null;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Se fornecidos, pula a etapa de validação */
  tactoInicial?: string;
  ladoInicial?: Lado;
}

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
    return formatter.format(new Date()).replace(" ", "T") + "-03:00";
  } catch {
    return new Date().toISOString();
  }
};

const MOTIVOS: { id: MotivoNC; descricao: string; cor: string; icon: React.ReactNode }[] = [
  {
    id: "Erro de Posicionamento (Rack)",
    descricao: "Caixa invertida ou bloqueada — exige empilhadeira",
    cor: "border-orange-300 bg-orange-50 hover:bg-orange-100 hover:border-orange-400",
    icon: <Truck className="h-5 w-5 shrink-0 text-orange-600" />,
  },
  {
    id: "Divergência de Lado (Ficha vs Físico)",
    descricao: "Peça física não condiz com a etiqueta ou ficha",
    cor: "border-red-300 bg-red-50 hover:bg-red-100 hover:border-red-400",
    icon: <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />,
  },
];

const MaterialNaoConformeModal = ({
  isOpen,
  onClose,
  tactoInicial = "",
  ladoInicial = null,
}: Props) => {
  const temContexto = !!tactoInicial && !!ladoInicial;

  const [step, setStep] = useState<ModalStep>(temContexto ? "motivo" : "validacao");
  const [tacto, setTacto] = useState(tactoInicial);
  const [lado, setLado] = useState<Lado>(ladoInicial);
  const [motivo, setMotivo] = useState<MotivoNC | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { toast } = useToast();

  const ladoLabel = lado === "LE" ? "Esquerdo (LE)" : lado === "LD" ? "Direito (LD)" : "";
  const canProceed = tacto.length >= 1 && lado !== null;

  const handleClose = () => {
    const novoStep: ModalStep = tactoInicial && ladoInicial ? "motivo" : "validacao";
    setStep(novoStep);
    setTacto(tactoInicial);
    setLado(ladoInicial);
    setMotivo(null);
    setEnviando(false);
    onClose();
  };

  const handleSelectMotivo = (m: MotivoNC) => {
    setMotivo(m);
    setStep("confirmacao");
  };

  const handleConfirmar = async () => {
    if (!motivo || !lado) return;
    setEnviando(true);
    const now = getSaoPauloTimestamp();

    const isDivergencia = motivo === "Divergência de Lado (Ficha vs Físico)";
    const ladoOposto = lado === "LE" ? "LD" : "LE";

    // Registro principal
    const registros = [
      {
        tacto,
        lado,
        motivo,
        status: "aguardando_inspecao",
        tipo_acao: isDivergencia ? "reversa" : null,
        created_at: now,
      },
    ];

    // Se divergência de lado: gera também abastecimento urgente no lado correto
    if (isDivergencia) {
      registros.push({
        tacto,
        lado: ladoOposto,
        motivo,
        status: "aguardando_inspecao",
        tipo_acao: "urgente",
        created_at: now,
      });
    }

    const { error } = await supabase.from("nao_conformidades").insert(registros);

    if (error) {
      toast({
        title: "Erro ao registrar",
        description: error.message,
        variant: "destructive",
      });
      setEnviando(false);
      return;
    }

    setStep("sucesso");
    setTimeout(() => {
      handleClose();
    }, 2800);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] sm:max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 pt-5 sm:pt-6 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-2.5 bg-orange-100 rounded-2xl">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#001E50]">
                    Material Não Conforme
                  </h2>
                  <p className="text-xs text-gray-400 font-medium">
                    {step === "validacao" && "Passo 1 — Identificação do Tacto"}
                    {step === "motivo" && "Selecione o tipo de ocorrência"}
                    {step === "confirmacao" && "Confirmar registro"}
                    {step === "sucesso" && "Registrado com Sucesso"}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Badge de contexto (quando tacto/lado já estão preenchidos) */}
            {temContexto && step !== "sucesso" && (
              <div className="px-6 pt-4 flex gap-2">
                <span className="bg-[#001E50]/10 text-[#001E50] px-3 py-1.5 rounded-full text-xs font-black">
                  TACTO: {tacto}
                </span>
                <span className="bg-[#001E50]/10 text-[#001E50] px-3 py-1.5 rounded-full text-xs font-black">
                  LADO: {lado}
                </span>
              </div>
            )}

            {/* ─── STEP 1: Validação manual (quando tacto/lado não estão pré-selecionados) ─── */}
            {step === "validacao" && (
              <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 flex-1 overflow-y-auto scrollbar-hide sm:custom-scrollbar">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                    Lado do Tacto
                  </label>
                  <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
                    <button
                      onClick={() => setLado("LE")}
                      className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                        lado === "LE"
                          ? "bg-[#001E50] text-white shadow-md scale-[1.02]"
                          : "text-gray-500 hover:text-[#001E50]"
                      }`}
                    >
                      LE — Esquerdo
                    </button>
                    <button
                      onClick={() => setLado("LD")}
                      className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-200 ${
                        lado === "LD"
                          ? "bg-[#001E50] text-white shadow-md scale-[1.02]"
                          : "text-gray-500 hover:text-[#001E50]"
                      }`}
                    >
                      LD — Direito
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">
                    Número do Tacto
                  </label>
                  <div className="w-full bg-slate-50 rounded-2xl py-4 text-center border-2 border-transparent focus-within:border-[#001E50] transition-colors">
                    <span className="text-4xl font-mono font-black text-[#001E50] tracking-widest">
                      {tacto || "---"}
                    </span>
                  </div>
                </div>

                <div className="transform scale-[0.85] sm:scale-95 origin-top -mt-2 sm:-mt-0 -mb-6 sm:-mb-0">
                  <NumericKeypad value={tacto} onChange={setTacto} maxLength={5} />
                </div>

                <button
                  disabled={!canProceed}
                  onClick={() => setStep("motivo")}
                  className={`w-full h-14 rounded-2xl font-black text-base transition-all ${
                    canProceed
                      ? "bg-[#001E50] text-white hover:bg-[#001538] active:scale-95"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
                >
                  Próximo
                </button>
              </div>
            )}

            {/* ─── STEP 2: Seleção de Motivo ─── */}
            {step === "motivo" && (
              <div className="p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 flex-1 overflow-y-auto scrollbar-hide sm:custom-scrollbar">
                {!temContexto && (
                  <div className="flex gap-2 mb-1">
                    <span className="bg-slate-100 text-[#001E50] px-3 py-1.5 rounded-full text-xs font-bold">
                      TACTO: {tacto}
                    </span>
                    <span className="bg-slate-100 text-[#001E50] px-3 py-1.5 rounded-full text-xs font-bold">
                      LADO: {lado}
                    </span>
                  </div>
                )}

                <p className="text-sm text-gray-500 font-medium mt-1">
                  Selecione o tipo de ocorrência:
                </p>

                {MOTIVOS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSelectMotivo(m.id)}
                    className={`w-full p-4 sm:p-5 rounded-2xl border-2 transition-all active:scale-95 text-left group ${m.cor}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white/60 rounded-xl mt-0.5 shrink-0">{m.icon}</div>
                      <div className="flex-1 min-w-0">
                        <span className="block font-black text-gray-800 text-sm sm:text-base leading-snug break-words">
                          {m.id}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500 mt-1 block leading-snug break-words">
                          {m.descricao}
                        </span>
                        {m.id === "Divergência de Lado (Ficha vs Físico)" && (
                          <span className="mt-2 inline-flex items-center gap-1 bg-red-200 text-red-800 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider break-words flex-wrap">
                            <Zap className="h-3 w-3 shrink-0" />
                            Gera logística reversa + abastecimento urgente
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}

                {!temContexto && (
                  <button
                    onClick={() => setStep("validacao")}
                    className="w-full h-11 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm hover:bg-gray-50 transition-colors"
                  >
                    Voltar
                  </button>
                )}
              </div>
            )}

            {/* ─── STEP 3: Confirmação ─── */}
            {step === "confirmacao" && (
              <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-5 flex-1 overflow-y-auto scrollbar-hide sm:custom-scrollbar">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-2">
                    Resumo do Registro
                  </p>
                  <p className="text-sm text-gray-700 font-medium leading-relaxed">
                    Chamado de Qualidade registrado:{" "}
                    <strong className="text-[#001E50]">{motivo}</strong> no Tacto{" "}
                    <strong className="text-[#001E50]">{tacto}</strong> — Lado{" "}
                    <strong className="text-[#001E50]">{ladoLabel}</strong>.
                  </p>

                  {motivo === "Divergência de Lado (Ficha vs Físico)" && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 bg-red-100 text-red-800 text-xs font-black px-3 py-1.5 rounded-lg">
                        <Truck className="h-3.5 w-3.5" />
                        Logística Reversa: remoção do rack incorreto
                      </div>
                      <div className="flex items-center gap-2 bg-blue-100 text-blue-800 text-xs font-black px-3 py-1.5 rounded-lg">
                        <Zap className="h-3.5 w-3.5" />
                        Abastecimento Urgente: pedido para lado correto
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-400 text-center font-medium">
                  Confirmar envio para a equipe de qualidade?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("motivo")}
                    className="flex-1 h-12 rounded-2xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleConfirmar}
                    disabled={enviando}
                    className="flex-1 h-12 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black transition-all active:scale-95 disabled:opacity-60"
                  >
                    {enviando ? "Enviando..." : "Confirmar Envio"}
                  </button>
                </div>
              </div>
            )}

            {/* ─── Sucesso ─── */}
            {step === "sucesso" && (
              <div className="p-8 flex flex-col items-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                >
                  <CheckCircle className="h-20 w-20 text-green-500" />
                </motion.div>
                <h3 className="text-xl font-black text-[#001E50] text-center">
                  Chamado registrado!
                </h3>
                <p className="text-sm text-gray-500 text-center leading-relaxed">
                  <strong>{motivo}</strong> no Tacto{" "}
                  <strong>{tacto}</strong> — Lado <strong>{ladoLabel}</strong>
                  {motivo === "Divergência de Lado (Ficha vs Físico)" && (
                    <>
                      <br />
                      <span className="text-orange-500 font-bold">
                        Logística Reversa + Abastecimento Urgente gerados.
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MaterialNaoConformeModal;
