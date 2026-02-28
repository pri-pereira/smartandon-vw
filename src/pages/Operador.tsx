import { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import NumericKeypad from "@/components/NumericKeypad";
import AlertModal from "@/components/AlertModal";
import { useToast } from "@/hooks/use-toast";

type Step = "tacto" | "peca" | "success";

interface PendingDelivery {
  id: string;
  nome_peca: string;
  codigo_peca: string;
}

const Operador = () => {
  const [step, setStep] = useState<Step>("tacto");
  const [tacto, setTacto] = useState("");
  const [codigoPeca, setCodigoPeca] = useState("");
  const [pecaEncontrada, setPecaEncontrada] = useState<{ nome: string; cor: string } | null>(null);
  const [pendingDelivery, setPendingDelivery] = useState<PendingDelivery | null>(null);
  const { toast } = useToast();

  // Live search for piece
  useEffect(() => {
    if (codigoPeca.length === 0) {
      setPecaEncontrada(null);
      return;
    }
    const search = async () => {
      const { data } = await supabase
        .from("catalogo_pecas")
        .select("nome, cor")
        .eq("codigo", codigoPeca)
        .maybeSingle();
      setPecaEncontrada(data);
    };
    search();
  }, [codigoPeca]);

  // Realtime listener for double-check deliveries
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
    if (tacto.length >= 3) {
      setStep("peca");
    }
  };

  const handleSubmitChamado = async () => {
    if (!pecaEncontrada) return;

    const { error } = await supabase.from("chamados").insert({
      tacto,
      codigo_peca: codigoPeca,
      nome_peca: pecaEncontrada.nome,
      cor_peca: pecaEncontrada.cor,
    });

    if (error) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
      return;
    }

    setStep("success");
    setTimeout(() => {
      setStep("tacto");
      setTacto("");
      setCodigoPeca("");
      setPecaEncontrada(null);
    }, 2000);
  };

  const handleConfirmDelivery = async () => {
    if (!pendingDelivery) return;
    const now = new Date().toISOString();
    await supabase
      .from("chamados")
      .update({ status: "confirmado", confirmado_at: now })
      .eq("id", pendingDelivery.id);
    setPendingDelivery(null);
    toast({ title: "Recebimento confirmado!" });
  };

  if (step === "success") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center">
          <CheckCircle className="h-32 w-32 text-success animate-check-bounce" />
          <p className="mt-4 text-xl font-bold text-success">Chamado Enviado!</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col items-center p-6 gap-6">
        {step === "tacto" && (
          <>
            <h1 className="text-2xl font-bold text-primary">INFORME O TACTO</h1>
            <div className="w-full max-w-xs bg-secondary rounded-lg p-4 text-center">
              <span className="text-4xl font-mono font-bold text-primary tracking-widest">
                {tacto || "---"}
              </span>
            </div>
            <NumericKeypad value={tacto} onChange={setTacto} maxLength={5} />
            <div className="flex gap-3 w-full max-w-xs">
              <Button
                variant="outline"
                className="flex-1 h-14 text-lg border-2 border-primary"
                onClick={() => setTacto("")}
              >
                LIMPAR
              </Button>
              <Button
                className="flex-1 h-14 text-lg"
                disabled={tacto.length < 3}
                onClick={handleConfirmTacto}
              >
                CONFIRMAR
              </Button>
            </div>
          </>
        )}

        {step === "peca" && (
          <>
            <h1 className="text-2xl font-bold text-primary">NÚMERO DA PEÇA</h1>
            <div className="w-full max-w-xs bg-secondary rounded-lg p-4 text-center">
              <span className="text-4xl font-mono font-bold text-primary tracking-widest">
                {codigoPeca || "---"}
              </span>
            </div>
            {pecaEncontrada && (
              <div
                className="w-full max-w-xs rounded-lg p-3 text-center border-2 border-primary"
                style={{ backgroundColor: pecaEncontrada.cor }}
              >
                <span className="text-lg font-bold text-primary">
                  PEÇA: {pecaEncontrada.nome}
                </span>
              </div>
            )}
            <NumericKeypad value={codigoPeca} onChange={setCodigoPeca} maxLength={4} />
            <div className="flex gap-3 w-full max-w-xs">
              <Button
                variant="outline"
                className="flex-1 h-14 text-lg border-2 border-primary"
                onClick={() => {
                  setCodigoPeca("");
                  setPecaEncontrada(null);
                }}
              >
                LIMPAR
              </Button>
              <Button
                className="flex-1 h-14 text-lg"
                disabled={!pecaEncontrada}
                onClick={handleSubmitChamado}
              >
                ENVIAR
              </Button>
            </div>
          </>
        )}
      </main>

      <AlertModal
        open={!!pendingDelivery}
        title="Confirmação de Entrega"
        description={`Logística informa entrega da peça ${pendingDelivery?.nome_peca || ""}. Confirmar recebimento?`}
        confirmText="Confirmar Recebimento"
        cancelText="Negar"
        onConfirm={handleConfirmDelivery}
        onCancel={() => setPendingDelivery(null)}
      />
    </div>
  );
};

export default Operador;
