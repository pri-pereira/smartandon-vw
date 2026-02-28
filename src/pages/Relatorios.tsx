import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { LogOut, TrendingUp, AlertTriangle, Clock, BarChart3 } from "lucide-react";

interface Chamado {
  id: string;
  tacto: string;
  codigo_peca: string;
  nome_peca: string;
  status: string;
  created_at: string;
  tempo_entrega: number | null;
}

const Relatorios = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [trendData, setTrendData] = useState<{ dia: string; total: number }[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      if (!roles || roles.length === 0) { navigate("/login"); }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const fetchDay = async () => {
      const { data } = await supabase
        .from("chamados")
        .select("*")
        .gte("created_at", `${selectedDate}T00:00:00`)
        .lte("created_at", `${selectedDate}T23:59:59`)
        .order("created_at", { ascending: false });
      if (data) setChamados(data);
    };
    fetchDay();
  }, [selectedDate]);

  useEffect(() => {
    const fetchTrend = async () => {
      const days: { dia: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        const { count } = await supabase
          .from("chamados")
          .select("*", { count: "exact", head: true })
          .gte("created_at", `${d}T00:00:00`)
          .lte("created_at", `${d}T23:59:59`);
        days.push({ dia: format(subDays(new Date(), i), "dd/MM"), total: count || 0 });
      }
      setTrendData(days);
    };
    fetchTrend();
  }, []);

  const total = chamados.length;
  const concluidos = chamados.filter((c) => c.status === "confirmado").length;
  const taxaConclusao = total > 0 ? ((concluidos / total) * 100).toFixed(1) : "0";
  const temposEntrega = chamados.filter((c) => c.tempo_entrega !== null).map((c) => c.tempo_entrega!);
  const tempoMedio = temposEntrega.length > 0 ? Math.round(temposEntrega.reduce((a, b) => a + b, 0) / temposEntrega.length) : 0;
  const excedidos = chamados.filter((c) => c.tempo_entrega && c.tempo_entrega > 600);
  const taxaRisco = total > 0 ? ((excedidos.length / total) * 100).toFixed(1) : "0";
  const media7dias = trendData.length > 0 ? Math.round(trendData.reduce((a, b) => a + b.total, 0) / trendData.length) : 0;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 p-4 space-y-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Relatórios de Gestão</h1>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <label className="font-bold text-primary">Data:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border-2 border-primary rounded-lg px-3 py-2 text-primary font-medium"
          />
        </div>

        {/* Volume Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-secondary rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span className="font-bold text-primary">Volume do Dia</span>
            </div>
            <p className="text-3xl font-bold text-primary">{total}</p>
          </div>
          <div className="bg-secondary rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <span className="font-bold text-primary">Média 7 dias</span>
            </div>
            <p className="text-3xl font-bold text-primary">{media7dias}</p>
          </div>
          <div className="bg-secondary rounded-lg p-4">
            <span className="font-bold text-primary text-sm">Tendência 7 dias</span>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={trendData}>
                <Bar dataKey="total" fill="hsl(216, 100%, 16%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-secondary rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Total Chamados</p>
            <p className="text-2xl font-bold text-primary">{total}</p>
          </div>
          <div className="bg-success/10 rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Taxa Conclusão</p>
            <p className="text-2xl font-bold text-success">{taxaConclusao}%</p>
          </div>
          <div className="bg-secondary rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Tempo Médio</p>
            <p className="text-2xl font-bold text-primary">{tempoMedio}s</p>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Taxa de Risco</p>
            <p className="text-2xl font-bold text-destructive">{taxaRisco}%</p>
          </div>
        </div>

        {/* Exceeded Time Indicator */}
        {excedidos.length > 0 && (
          <div className="bg-destructive/10 border-2 border-destructive rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span className="font-bold text-destructive">Tempo Excedido ({">"}600s)</span>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Quantidade</p>
                <p className="text-xl font-bold text-destructive">{excedidos.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Total</p>
                <p className="text-xl font-bold text-destructive">
                  {excedidos.reduce((a, b) => a + (b.tempo_entrega || 0), 0)}s
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-xl font-bold text-destructive">
                  {Math.round(excedidos.reduce((a, b) => a + (b.tempo_entrega || 0), 0) / excedidos.length)}s
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                <th className="p-3 text-left">Tacto</th>
                <th className="p-3 text-left">Peça</th>
                <th className="p-3 text-left">Código</th>
                <th className="p-3 text-left">Horário</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Tempo (s)</th>
              </tr>
            </thead>
            <tbody>
              {chamados.map((c) => {
                const isExceeded = c.tempo_entrega && c.tempo_entrega > 600;
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-border ${isExceeded ? "bg-destructive/10" : "hover:bg-secondary/50"}`}
                  >
                    <td className="p-3">{c.tacto}</td>
                    <td className="p-3">{c.nome_peca}</td>
                    <td className="p-3 font-mono font-bold">{c.codigo_peca}</td>
                    <td className="p-3">{format(new Date(c.created_at), "HH:mm:ss")}</td>
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
                    <td className={`p-3 font-bold ${isExceeded ? "text-destructive" : ""}`}>
                      {c.tempo_entrega ?? "-"}
                    </td>
                  </tr>
                );
              })}
              {chamados.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhum chamado nesta data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default Relatorios;
