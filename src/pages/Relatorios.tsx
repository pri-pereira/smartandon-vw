import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInSeconds, startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { LogOut, Calendar, Activity, Clock, Zap, ChevronRight, Trash2, FileDown, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Chamado {
  id: string;
  tacto: string;
  created_at: string;
  entregue_at: string | null;
  confirmado_at: string | null;
  status: string;
}

const Relatorios = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Auth guard
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const { data: roles } = await supabase
        .from("user_roles").select("role")
        .eq("user_id", user.id).eq("role", "admin");

      const isAdmin = (roles && roles.length > 0) || user.user_metadata?.role === "admin";
      if (!isAdmin) {
        toast({ title: "Acesso Restrito", description: "Área exclusiva para administradores.", variant: "destructive" });
        navigate("/");
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  // Fetch data for selected date range
  useEffect(() => {
    if (loading) return;
    const fetchRange = async () => {
      const { data } = await supabase
        .from("chamados")
        .select("*")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: true });
      if (data) setChamados(data as Chamado[]);
    };
    fetchRange();
  }, [dateFrom, dateTo, loading]);

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };

  // ── Clear Logistica screen (archive active chamados preserving data for reports) ──
  const handleClearLogistica = async () => {
    setClearing(true);
    const { error } = await supabase
      .from("chamados")
      .update({ status: "arquivado" })
      .in("status", ["pendente", "entregue", "aguardando_confirmacao"]);
    if (error) {
      toast({ title: "Erro ao limpar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "✅ Tela da Logística limpa!", description: "Os dados continuam salvos nos relatórios." });
    }
    setClearConfirmOpen(false);
    setClearing(false);
  };

  // ── Export PDF (opens print-optimised window) ──
  const handleExportPDF = () => {
    const rows = chamados.map(c => {
      const react = getDiff(c.created_at, c.entregue_at);
      const close = getDiff(c.entregue_at, c.confirmado_at);
      const lead = getDiff(c.created_at, c.confirmado_at);
      return `<tr>
        <td>${c.tacto ?? "—"}</td>
        <td>${format(parseISO(c.created_at), "dd/MM/yyyy HH:mm")}</td>
        <td>${c.status}</td>
        <td>${react !== null ? fmt(react) : "—"}</td>
        <td>${close !== null ? fmt(close) : "—"}</td>
        <td>${lead !== null ? fmt(lead) : "—"}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8">
      <title>System Analytics – ${rangeLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
        h1 { color: #001E50; margin-bottom: 4px; }
        p.sub { color: #666; margin: 0 0 20px; font-size: 13px; }
        .kpi-grid { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .kpi { background: #f5f7fa; border-radius: 8px; padding: 14px 20px; min-width: 140px; }
        .kpi-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .05em; }
        .kpi-value { font-size: 22px; font-weight: 900; color: #001E50; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { background: #001E50; color: #fff; padding: 8px 10px; text-align: left; }
        td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        @media print { body { margin: 0; } button { display: none; } }
      </style>
    </head><body>
      <h1>System Analytics · SmartAndon VW</h1>
      <p class="sub">Período: ${rangeLabel} &nbsp;·&nbsp; ${chamados.length} chamados</p>
      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">Tempo de Reação</div><div class="kpi-value">${fmt(avgReaction)}</div></div>
        <div class="kpi"><div class="kpi-label">Tempo de Fechamento</div><div class="kpi-value">${fmt(avgClose)}</div></div>
        <div class="kpi"><div class="kpi-label">Lead Time Total</div><div class="kpi-value">${fmt(avgLeadTime)}</div></div>
        <div class="kpi"><div class="kpi-label">Total Chamados</div><div class="kpi-value">${chamados.length}</div></div>
      </div>
      <table>
        <thead><tr><th>Tacto</th><th>Data/Hora</th><th>Status</th><th>T. Reação</th><th>T. Fechamento</th><th>Lead Time</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:20px;font-size:11px;color:#aaa;">Exportado em ${format(new Date(), "dd/MM/yyyy HH:mm")} · Equipe de MP VW Taubaté</p>
    </body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.print();
    }
  };

  // Metric helpers
  const getDiff = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    return differenceInSeconds(parseISO(end), parseISO(start));
  };
  const avg = (arr: (number | null)[]) => {
    const v = arr.filter((x): x is number => x !== null && x > 0);
    return v.length === 0 ? 0 : Math.round(v.reduce((a, b) => a + b, 0) / v.length);
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  // KPIs
  const reactionTimes = chamados.map(c => getDiff(c.created_at, c.entregue_at));
  const closeTimes = chamados.map(c => getDiff(c.entregue_at, c.confirmado_at));
  const leadTimes = chamados.map(c => getDiff(c.created_at, c.confirmado_at));

  const avgReaction = avg(reactionTimes);
  const avgClose = avg(closeTimes);
  const avgLeadTime = avg(leadTimes);

  // Chart 1: Volume + Lead Time by hour
  const hourMap = new Map<string, { hour: string; requests: number; totalLead: number; validLead: number }>();
  for (let i = 6; i <= 23; i++) {
    const h = i.toString().padStart(2, "0") + "h";
    hourMap.set(h, { hour: h, requests: 0, totalLead: 0, validLead: 0 });
  }
  chamados.forEach(c => {
    try {
      const h = format(parseISO(c.created_at), "HH") + "h";
      if (hourMap.has(h)) {
        const e = hourMap.get(h)!;
        e.requests++;
        const lead = getDiff(c.created_at, c.confirmado_at);
        if (lead !== null && lead > 0) { e.totalLead += lead; e.validLead++; }
      }
    } catch { /* skip bad dates */ }
  });
  const chartData = Array.from(hourMap.values()).map(d => ({
    hour: d.hour,
    "Volume de Pedidos": d.requests,
    "Lead Time Médio (s)": d.validLead > 0 ? Math.round(d.totalLead / d.validLead) : 0,
  }));

  // Chart 2: Top 5 Tactos
  const tactoMap = new Map<string, number>();
  chamados.forEach(c => { if (c.tacto) tactoMap.set(c.tacto, (tactoMap.get(c.tacto) || 0) + 1); });
  const top5Tactos = Array.from(tactoMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tacto, chamados]) => ({ tacto: `T${tacto}`, chamados }));

  const TOP5_COLORS = ["#001E50", "#1D4ED8", "#2563EB", "#3B82F6", "#60A5FA"];

  const rangeLabel = dateFrom === dateTo
    ? format(parseISO(dateFrom), "dd/MM/yyyy")
    : `${format(parseISO(dateFrom), "dd/MM")} → ${format(parseISO(dateTo), "dd/MM/yyyy")}`;

  if (loading) return null;

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden selection:bg-[#001E50] selection:text-white">
      <Header />

      {/* Floating Date Range Picker */}
      <div className="fixed top-20 right-4 md:top-24 md:right-4 z-50">
        <div className="relative">
          <Button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="rounded-full h-12 w-12 md:h-14 md:w-14 shadow-2xl bg-white/40 backdrop-blur-xl border border-white/60 text-[#001E50] hover:bg-white/60 hover:scale-105 transition-all"
            variant="ghost"
          >
            <Calendar className="h-6 w-6" />
          </Button>

          <AnimatePresence>
            {isCalendarOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                className="absolute top-16 right-0 w-80 bg-white/70 backdrop-blur-3xl border border-white/60 rounded-3xl shadow-[0_30px_60px_rgba(0,30,80,0.15)] p-6"
              >
                <h3 className="text-[#001E50] font-black text-lg tracking-tight mb-4">Intervalo de Análise</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Data Início</label>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full bg-white/80 border border-gray-200 rounded-2xl px-4 py-2.5 text-[#001E50] font-bold focus:outline-none focus:ring-2 focus:ring-[#001E50] text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-center">
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 block">Data Fim</label>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      max={today}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full bg-white/80 border border-gray-200 rounded-2xl px-4 py-2.5 text-[#001E50] font-bold focus:outline-none focus:ring-2 focus:ring-[#001E50] text-sm"
                    />
                  </div>
                  <Button
                    className="w-full bg-[#001E50] text-white rounded-xl font-bold mt-1"
                    onClick={() => setIsCalendarOpen(false)}
                  >
                    Aplicar Filtro
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-10 w-full flex flex-col gap-12">

        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
          <div className="space-y-1 mt-4 md:mt-0">
            <h1 className="text-3xl md:text-5xl font-black text-[#001E50] tracking-tight">System Analytics</h1>
            <p className="text-base md:text-lg text-gray-400 font-medium">Performance Operacional · {rangeLabel}</p>
            <p className="text-sm text-gray-300 font-medium">{chamados.length} chamado{chamados.length !== 1 ? "s" : ""} no período</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            {/* Limpar tela da logística */}
            <button
              onClick={() => setClearConfirmOpen(true)}
              className="flex items-center gap-2 h-11 px-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-bold border border-red-100 transition-colors text-sm"
            >
              <Trash2 className="h-4 w-4" />
              Limpar Rastreamento
            </button>
            {/* Export PDF */}
            <button
              onClick={handleExportPDF}
              disabled={chamados.length === 0}
              className="flex items-center gap-2 h-11 px-4 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-100 transition-colors text-sm disabled:opacity-40"
            >
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </button>
            <Button variant="outline" onClick={handleLogout} className="rounded-2xl border-gray-200 text-gray-500 hover:text-[#001E50] hover:border-[#001E50] font-bold px-4 h-11">
              <LogOut className="h-4 w-4 mr-2" /> Encerrar Sessão
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Tempo de Reação", value: fmt(avgReaction), sub: "Solicitação → Logística", icon: <Zap className="h-6 w-6" />, bg: "bg-blue-50", color: "text-blue-600", delay: 0.1 },
            { label: "Tempo de Fechamento", value: fmt(avgClose), sub: "Logística → Confirmação", icon: <Clock className="h-6 w-6" />, bg: "bg-indigo-50", color: "text-indigo-600", delay: 0.2 },
          ].map((kpi) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: kpi.delay }}
              className="bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 ${kpi.bg} ${kpi.color} rounded-2xl`}>{kpi.icon}</div>
                <h2 className="text-gray-500 font-bold tracking-widest text-sm uppercase">{kpi.label}</h2>
              </div>
              <span className="text-4xl md:text-5xl font-black text-[#001E50] tracking-tighter">{kpi.value}</span>
              <p className="text-xs text-gray-400 mt-2 font-medium">{kpi.sub}</p>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-[#001E50] rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,30,80,0.2)] text-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10"><Activity className="h-32 w-32" /></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-3 bg-white/10 rounded-2xl"><Activity className="h-6 w-6 text-white" /></div>
              <h2 className="text-blue-200 font-bold tracking-widest text-sm uppercase">Lead Time Total</h2>
            </div>
            <span className="text-4xl md:text-5xl font-black tracking-tighter relative z-10">{fmt(avgLeadTime)}</span>
            <p className="text-xs text-blue-200 mt-2 font-medium relative z-10">Ciclo Completo do Chamado</p>
          </motion.div>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Volume por Hora */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
            className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
          >
            <h3 className="text-xl font-black text-[#001E50] mb-6">Volume de Pedidos por Hora</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold', fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold', fontSize: 11 }} />
                  <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold', color: '#001E50' }} />
                  <Bar dataKey="Volume de Pedidos" fill="#001E50" radius={[6, 6, 0, 0]} animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Lead Time Médio por Hora */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
            className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
          >
            <h3 className="text-xl font-black text-[#001E50] mb-6">Lead Time Médio por Hora (seg)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold', fontSize: 11 }} dy={8} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold', fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold', color: '#001E50' }} />
                  <Line type="monotone" dataKey="Lead Time Médio (s)" stroke="#2563EB" strokeWidth={4}
                    dot={{ fill: '#2563EB', strokeWidth: 2, r: 5, stroke: '#fff' }}
                    activeDot={{ r: 7, strokeWidth: 0 }} animationDuration={2000} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* Chart row 2: Top 5 Tactos */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }}
          className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
        >
          <div className="flex items-start justify-between mb-6 flex-wrap gap-2">
            <div>
              <h3 className="text-xl font-black text-[#001E50]">Top 5 Tactos com Mais Chamados</h3>
              <p className="text-sm text-gray-400 font-medium mt-0.5">Identificação de gargalos na linha de montagem</p>
            </div>
            {top5Tactos.length === 0 && <span className="text-xs text-gray-300 font-medium">Sem dados no período</span>}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top5Tactos} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold', fontSize: 12 }} />
                <YAxis dataKey="tacto" type="category" axisLine={false} tickLine={false} tick={{ fill: '#001E50', fontWeight: 'black', fontSize: 13 }} width={50} />
                <Tooltip cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold', color: '#001E50' }} />
                <Bar dataKey="chamados" radius={[0, 6, 6, 0]} animationDuration={1500}>
                  {top5Tactos.map((_, i) => <Cell key={i} fill={TOP5_COLORS[i] || "#001E50"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

      </main>

      {/* ── Clear Confirm Modal ── */}
      <AnimatePresence>
        {clearConfirmOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 flex flex-col items-center text-center"
            >
              <div className="p-4 bg-red-50 rounded-2xl mb-4">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-xl font-black text-gray-900 mb-2">Limpar Rastreamento?</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Todos os chamados <strong>pendentes e em entrega</strong> serão arquivados.
                Os dados <strong>permanecem salvos</strong> para os relatórios e o System Analytics.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setClearConfirmOpen(false)}
                  className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleClearLogistica}
                  disabled={clearing}
                  className="flex-1 h-11 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black transition-colors disabled:opacity-60"
                >
                  {clearing ? "Limpando..." : "Sim, Limpar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Relatorios;
