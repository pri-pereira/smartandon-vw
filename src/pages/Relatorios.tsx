import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO, differenceInSeconds } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { LogOut, Calendar, Activity, Clock, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Chamado {
  id: string;
  created_at: string;
  entregue_at: string | null;
  confirmado_at: string | null;
  status: string;
}

const Relatorios = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();

  // 1. Route Protection & Security
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      // Check for role: admin in user metadata or user_roles table
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");

      const hasAdminRole = roles && roles.length > 0;
      const hasMetadataAdmin = user.user_metadata?.role === "admin";

      if (!hasAdminRole && !hasMetadataAdmin) {
        toast({
          title: "Acesso Restrito",
          description: "Apenas administradores podem acessar a área de Inteligência de Dados.",
          variant: "destructive"
        });
        navigate("/");
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate]);

  // Fetch Data for Selected Date
  useEffect(() => {
    if (loading) return;

    const fetchDay = async () => {
      // Fetching entire day enforcing string matching for America/Sao_Paulo (assuming stored as ISO with offset)
      const { data } = await supabase
        .from("chamados")
        .select("*")
        .gte("created_at", `${selectedDate}T00:00:00`)
        .lte("created_at", `${selectedDate}T23:59:59`)
        .order("created_at", { ascending: true });

      if (data) setChamados(data as Chamado[]);
    };

    fetchDay();
  }, [selectedDate, loading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Metric Calculation Logic
  const getDiff = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    return differenceInSeconds(parseISO(end), parseISO(start));
  };

  const calculateAverage = (arr: (number | null)[]) => {
    const valid = arr.filter((x): x is number => x !== null && x > 0);
    if (valid.length === 0) return 0;
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
  };

  // KPIs
  const reactionTimes = chamados.map(c => getDiff(c.created_at, c.entregue_at));
  const closeTimes = chamados.map(c => getDiff(c.entregue_at, c.confirmado_at));
  const leadTimes = chamados.map(c => getDiff(c.created_at, c.confirmado_at));

  const formatSeconds = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
  };

  const avgReaction = calculateAverage(reactionTimes);
  const avgClose = calculateAverage(closeTimes);
  const avgLeadTime = calculateAverage(leadTimes);

  // Chart Data Processing (Group by hour)
  const hourlyDataMap = new Map<string, { hour: string, requests: number, totalLeadSeconds: number, validLeadCount: number }>();

  // Initialize shift hours (e.g., 06:00 to 23:00)
  for (let i = 6; i <= 23; i++) {
    const h = i.toString().padStart(2, "0") + "h";
    hourlyDataMap.set(h, { hour: h, requests: 0, totalLeadSeconds: 0, validLeadCount: 0 });
  }

  chamados.forEach(c => {
    try {
      // Extract hour from ISO string created_at e.g. "2026-02-28T08:30:00-03:00" -> "08"
      const dateObj = parseISO(c.created_at);
      const h = format(dateObj, "HH") + "h";

      if (hourlyDataMap.has(h)) {
        const entry = hourlyDataMap.get(h)!;
        entry.requests++;

        const lead = getDiff(c.created_at, c.confirmado_at);
        if (lead !== null && lead > 0) {
          entry.totalLeadSeconds += lead;
          entry.validLeadCount++;
        }
      }
    } catch (e) {
      // Skip bad dates
    }
  });

  const chartData = Array.from(hourlyDataMap.values()).map(d => ({
    hour: d.hour,
    "Volume de Pedidos": d.requests,
    "Tempo Médio (s)": d.validLeadCount > 0 ? Math.round(d.totalLeadSeconds / d.validLeadCount) : 0
  }));

  if (loading) return null;

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden selection:bg-[#001E50] selection:text-white">
      <Header />

      {/* 3. Floating Glassmorphism Calendar Widget */}
      <div className="fixed top-24 right-4 z-50">
        <div className="relative">
          <Button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="rounded-full h-14 w-14 shadow-2xl bg-white/40 backdrop-blur-xl border border-white/60 text-[#001E50] hover:bg-white/60 hover:scale-105 transition-all"
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
                className="absolute top-16 right-0 w-72 bg-white/40 backdrop-blur-3xl border border-white/60 rounded-3xl shadow-[0_30px_60px_rgba(0,30,80,0.15)] p-6"
              >
                <div className="flex flex-col gap-4">
                  <h3 className="text-[#001E50] font-black text-xl tracking-tight">Período de Análise</h3>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-white/60 border border-white/80 rounded-2xl px-4 py-3 text-[#001E50] font-bold focus:outline-none focus:ring-2 focus:ring-[#001E50] shadow-inner"
                  />
                  <Button
                    className="w-full bg-[#001E50] text-white rounded-xl font-bold mt-2"
                    onClick={() => setIsCalendarOpen(false)}
                  >
                    Aplicar Visualização
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-10 w-full flex flex-col gap-12">

        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-4">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black text-[#001E50] tracking-tight">Inteligência de Dados</h1>
            <p className="text-lg text-gray-400 font-medium">Performance Operacional • {format(parseISO(selectedDate), "dd/MM/yyyy")}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="rounded-2xl border-gray-200 text-gray-500 hover:text-[#001E50] hover:border-[#001E50] font-bold px-6">
            <LogOut className="h-5 w-5 mr-2" /> Encerrar Sessão
          </Button>
        </div>

        {/* 4. Total Traceability Metrics (KPIs) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Zap className="h-6 w-6" /></div>
              <h2 className="text-gray-500 font-bold tracking-widest text-sm uppercase">Tempo de Reação</h2>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-[#001E50] tracking-tighter">{formatSeconds(avgReaction)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 font-medium">Solicitação → Sinalização Logística</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Clock className="h-6 w-6" /></div>
              <h2 className="text-gray-500 font-bold tracking-widest text-sm uppercase">Tempo de Fechamento</h2>
            </div>
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black text-[#001E50] tracking-tighter">{formatSeconds(avgClose)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-2 font-medium">Sinalização → Confirmação Operador</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-[#001E50] rounded-3xl p-8 shadow-[0_8px_30px_rgba(0,30,80,0.2)] text-white relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10"><Activity className="h-32 w-32" /></div>
            <div className="flex items-center gap-4 mb-4 relative z-10">
              <div className="p-3 bg-white/10 rounded-2xl"><Activity className="h-6 w-6 text-white" /></div>
              <h2 className="text-blue-200 font-bold tracking-widest text-sm uppercase">Total Lead Time</h2>
            </div>
            <div className="flex items-end gap-3 relative z-10">
              <span className="text-5xl font-black tracking-tighter">{formatSeconds(avgLeadTime)}</span>
            </div>
            <p className="text-xs text-blue-200 mt-2 font-medium relative z-10">Ciclo Completo do Chamado</p>
          </motion.div>
        </div>

        {/* 2. Performance Dashboard Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">

          {/* Chart 1: Volume */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
            className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col"
          >
            <h3 className="text-xl font-black text-[#001E50] mb-6">Volume de Pedidos por Hora</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold', fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: '#F3F4F6' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold', color: '#001E50' }}
                  />
                  <Bar
                    dataKey="Volume de Pedidos"
                    fill="#001E50"
                    radius={[6, 6, 0, 0]}
                    animationDuration={1500}
                    animationEasing="ease-out"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Chart 2: Lead Time Evolution */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
            className="bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col"
          >
            <h3 className="text-xl font-black text-[#001E50] mb-6">Evolução do Lead Time (Segundos)</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontWeight: 'bold', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 'bold', color: '#001E50' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="Tempo Médio (s)"
                    stroke="#2563EB"
                    strokeWidth={4}
                    dot={{ fill: '#2563EB', strokeWidth: 2, r: 6, stroke: '#FFFFFF' }}
                    activeDot={{ r: 8, strokeWidth: 0 }}
                    animationDuration={2000}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
};

export default Relatorios;
