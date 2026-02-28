import { useState, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import AlertModal from "@/components/AlertModal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Package, CheckCircle, Clock } from "lucide-react";

interface Chamado {
  id: string;
  tacto: string;
  codigo_peca: string;
  nome_peca: string;
  cor_peca: string;
  celula: string;
  status: string;
  created_at: string;
  tempo_entrega: number | null;
}

const Logistica = () => {
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [deliveryTarget, setDeliveryTarget] = useState<Chamado | null>(null);
  const { toast } = useToast();

  const fetchChamados = async () => {
    const startOfDay = `${selectedDate}T00:00:00`;
    const endOfDay = `${selectedDate}T23:59:59`;
    const { data } = await supabase
      .from("chamados")
      .select("*")
      .gte("created_at", startOfDay)
      .lte("created_at", endOfDay)
      .order("created_at", { ascending: false });
    if (data) setChamados(data);
  };

  useEffect(() => {
    fetchChamados();
  }, [selectedDate]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("logistica-chamados")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chamados" },
        () => fetchChamados()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  const total = chamados.length;
  const concluidos = chamados.filter((c) => c.status === "confirmado").length;
  const pendentes = chamados.filter((c) => c.status === "pendente").length;

  const handleRegisterDelivery = async () => {
    if (!deliveryTarget) return;
    const now = new Date();
    const createdAt = new Date(deliveryTarget.created_at);
    const tempoEntrega = Math.round((now.getTime() - createdAt.getTime()) / 1000);

    await supabase
      .from("chamados")
      .update({
        status: "entregue",
        entregue_at: now.toISOString(),
        tempo_entrega: tempoEntrega,
      })
      .eq("id", deliveryTarget.id);

    setDeliveryTarget(null);
    toast({ title: "Entrega registrada. Aguardando confirmação do operador." });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 space-y-4">
        {/* Date Filter */}
        <div className="flex items-center gap-3">
          <label className="font-bold text-primary">Data:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border-2 border-primary rounded-lg px-3 py-2 text-primary font-medium"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-secondary rounded-lg p-4 text-center">
            <Package className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-primary">{total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
          <div className="bg-success/10 rounded-lg p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto text-success mb-1" />
            <p className="text-2xl font-bold text-success">{concluidos}</p>
            <p className="text-sm text-muted-foreground">Concluídos</p>
          </div>
          <div className="bg-warning/10 rounded-lg p-4 text-center">
            <Clock className="h-6 w-6 mx-auto text-warning mb-1" />
            <p className="text-2xl font-bold text-warning">{pendentes}</p>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="p-3 text-left">Peça</th>
                <th className="p-3 text-left">Código</th>
                <th className="p-3 text-left">Tacto</th>
                <th className="p-3 text-left">Horário</th>
                <th className="p-3 text-left">Célula</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Ação</th>
              </tr>
            </thead>
            <tbody>
              {chamados.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-secondary/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full inline-block border"
                        style={{ backgroundColor: c.cor_peca }}
                      />
                      {c.nome_peca}
                    </div>
                  </td>
                  <td className="p-3 font-mono font-bold">{c.codigo_peca}</td>
                  <td className="p-3">{c.tacto}</td>
                  <td className="p-3">{format(new Date(c.created_at), "HH:mm:ss")}</td>
                  <td className="p-3">{c.celula}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        c.status === "confirmado"
                          ? "bg-success/20 text-success"
                          : c.status === "entregue"
                          ? "bg-primary/20 text-primary"
                          : "bg-warning/20 text-warning"
                      }`}
                    >
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3">
                    {c.status === "pendente" && (
                      <Button
                        size="sm"
                        onClick={() => setDeliveryTarget(c)}
                      >
                        Entregar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {chamados.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Nenhum chamado nesta data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      <AlertModal
        open={!!deliveryTarget}
        title="Registrar Entrega"
        description={`Confirmar entrega da peça ${deliveryTarget?.nome_peca || ""} (${deliveryTarget?.codigo_peca || ""})?`}
        confirmText="Registrar Entrega"
        onConfirm={handleRegisterDelivery}
        onCancel={() => setDeliveryTarget(null)}
      />
    </div>
  );
};

export default Logistica;
