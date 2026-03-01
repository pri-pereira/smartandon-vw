import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeOrders, RealtimeOrder } from "@/hooks/useRealtimeOrders";

interface ConfirmacaoFABProps {
    tacto: string;
    lado: string | null;
}

const getSaoPauloTimestamp = () => {
    try {
        const formatter = new Intl.DateTimeFormat("sv-SE", {
            timeZone: "America/Sao_Paulo",
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
        });
        return formatter.format(new Date()).replace(" ", "T") + "-03:00";
    } catch {
        return new Date().toISOString();
    }
};

const ConfirmacaoFAB = ({ tacto, lado }: ConfirmacaoFABProps) => {
    const { pendingOrders } = useRealtimeOrders(tacto, lado);
    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState<RealtimeOrder | null>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    // No pending orders → nothing to show
    if (pendingOrders.length === 0) return null;

    const first = pendingOrders[0];

    const openModal = (order: RealtimeOrder) => {
        setSelected(order);
        setModalOpen(true);
    };

    const handleConfirm = async () => {
        if (!selected) return;
        setLoading(true);
        const now = getSaoPauloTimestamp();
        const { error } = await supabase
            .from("chamados")
            .update({ status: "concluido", confirmado_at: now })
            .eq("id", selected.id);

        if (error) {
            toast({ title: "Erro ao confirmar", description: error.message, variant: "destructive" });
        } else {
            toast({ title: "✅ Recebimento confirmado!", description: `Peça ${selected.nome_peca} recebida com sucesso.` });
            setModalOpen(false);
            setSelected(null);
        }
        setLoading(false);
    };

    const handleDivergencia = async () => {
        if (!selected) return;
        setLoading(true);
        const { error } = await supabase
            .from("chamados")
            .update({ status: "divergencia" })
            .eq("id", selected.id);

        if (error) {
            toast({ title: "Erro", description: error.message, variant: "destructive" });
        } else {
            toast({
                title: "⚠️ Divergência registrada!",
                description: "A logística foi notificada. Aguarde o atendimento.",
                variant: "destructive",
            });
            setModalOpen(false);
            setSelected(null);
        }
        setLoading(false);
    };

    return (
        <>
            {/* ====== FLOATING ACTION BUTTON ====== */}
            <AnimatePresence>
                <motion.button
                    key="fab"
                    initial={{ scale: 0, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0, opacity: 0, y: 20 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    onClick={() => openModal(first)}
                    className="fixed bottom-6 right-4 z-[9000] flex items-center gap-3 bg-[#001E50] hover:bg-[#00287a] text-white font-black rounded-2xl shadow-2xl px-5 py-4 active:scale-95 transition-colors"
                    style={{ boxShadow: "0 8px 32px rgba(0,30,80,0.45)" }}
                >
                    {/* Pulse ring */}
                    <span className="absolute inset-0 rounded-2xl animate-ping bg-[#001E50]/30 pointer-events-none" />

                    <div className="relative flex-shrink-0">
                        <Package className="h-6 w-6" />
                        {pendingOrders.length > 1 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black rounded-full h-4 w-4 flex items-center justify-center">
                                {pendingOrders.length}
                            </span>
                        )}
                    </div>
                    <div className="text-left leading-tight">
                        <span className="block text-[11px] font-bold text-white/70 uppercase tracking-wider">
                            📦 Confirmar Recebimento
                        </span>
                        <span className="block text-base font-black">
                            Tacto {first.tacto} · {first.lado}
                        </span>
                    </div>
                </motion.button>
            </AnimatePresence>

            {/* ====== CONFIRMATION MODAL ====== */}
            <AnimatePresence>
                {modalOpen && selected && (
                    <motion.div
                        key="modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9500] flex items-center justify-center px-4"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
                    >
                        <motion.div
                            key="modal-content"
                            initial={{ scale: 0.9, opacity: 0, y: 24 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 24 }}
                            transition={{ type: "spring", stiffness: 280, damping: 24 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="bg-[#001E50] px-6 pt-6 pb-5 relative">
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                                >
                                    <X className="h-5 w-5 text-white" />
                                </button>
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-white/15 rounded-xl flex-shrink-0">
                                        <Package className="h-7 w-7 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Entrega no Posto</p>
                                        <h2 className="text-xl font-black text-white leading-tight">
                                            A peça <span className="underline decoration-dotted">{selected.nome_peca}</span> foi recebida no posto?
                                        </h2>
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Details */}
                            <div className="px-6 py-5 flex flex-col gap-4">
                                <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-2 border border-gray-100">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pedido</span>
                                        <span className="text-xs font-bold bg-[#001E50]/10 text-[#001E50] px-2 py-0.5 rounded-full">
                                            TACTO {selected.tacto} · {selected.lado}
                                        </span>
                                    </div>
                                    <p className="text-2xl font-black text-[#001E50] tracking-tight">{selected.codigo_peca}</p>
                                    <p className="text-sm font-bold text-gray-600 leading-snug">{selected.nome_peca}</p>
                                </div>

                                <p className="text-xs text-gray-400 text-center">
                                    Verifique se a peça corresponde ao código na etiqueta física.
                                </p>

                                {/* Action Buttons */}
                                <div className="flex flex-col gap-2.5">
                                    <button
                                        onClick={handleConfirm}
                                        disabled={loading}
                                        className="w-full h-14 bg-green-600 hover:bg-green-700 active:scale-95 text-white font-black text-lg rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                    >
                                        <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                                        {loading ? "Confirmando..." : "Sim, Recebi ✓"}
                                    </button>

                                    <button
                                        onClick={handleDivergencia}
                                        disabled={loading}
                                        className="w-full h-12 bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 font-bold text-sm rounded-2xl border-2 border-red-200 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                                    >
                                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                                        Não recebi (Divergência)
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ConfirmacaoFAB;
