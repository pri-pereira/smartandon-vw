import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, ArrowLeft, RefreshCw, X, Save } from "lucide-react";

interface Part {
    id: number;
    Tacto: string;
    Lado: string;
    Codigo_Peca: string;
    Nome_Peca: string;
    CC_Number: string;
    Cor: string;
}

const EMPTY_FORM: Omit<Part, "id"> = {
    Tacto: "",
    Lado: "LE",
    Codigo_Peca: "",
    Nome_Peca: "",
    CC_Number: "",
    Cor: "branco",
};

const COR_OPTIONS = ["branco", "azul", "rosa", "amarelo"];
const LADO_OPTIONS = ["LE", "LD"];

const PartsCatalog = () => {
    const [parts, setParts] = useState<Part[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<Omit<Part, "id">>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Delete confirm
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const navigate = useNavigate();
    const { toast } = useToast();

    // Auth guard
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { navigate("/"); return; }

            const { data: roles } = await supabase
                .from("user_roles").select("role")
                .eq("user_id", user.id).eq("role", "admin");

            const isAdmin = (roles && roles.length > 0) || user.user_metadata?.role === "admin";
            if (!isAdmin) {
                toast({ title: "Acesso Negado", description: "Apenas administradores podem gerenciar o catálogo.", variant: "destructive" });
                navigate("/");
                return;
            }
            fetchParts();
        };
        checkAuth();
    }, [navigate]);

    const fetchParts = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("base_pecas_andon")
            .select("*")
            .order("Tacto", { ascending: true });

        if (error) {
            toast({ title: "Erro de Conexão", description: error.message, variant: "destructive" });
        } else {
            setParts((data as Part[]) || []);
        }
        setLoading(false);
    };

    // Open modal for NEW part
    const openNew = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setModalOpen(true);
    };

    // Open modal for EDIT
    const openEdit = (part: Part) => {
        setEditingId(part.id);
        setForm({ Tacto: part.Tacto, Lado: part.Lado, Codigo_Peca: part.Codigo_Peca, Nome_Peca: part.Nome_Peca, CC_Number: part.CC_Number, Cor: part.Cor || "branco" });
        setModalOpen(true);
    };

    // Save (insert or update)
    const handleSave = async () => {
        if (!form.Tacto || !form.Codigo_Peca || !form.Nome_Peca) {
            toast({ title: "Campos obrigatórios", description: "Tacto, Código e Nome são obrigatórios.", variant: "destructive" });
            return;
        }
        setSaving(true);
        if (editingId === null) {
            const { error } = await supabase.from("base_pecas_andon").insert(form);
            if (error) toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
            else { toast({ title: "✅ Peça adicionada!" }); setModalOpen(false); fetchParts(); }
        } else {
            const { error } = await supabase.from("base_pecas_andon").update(form).eq("id", editingId);
            if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
            else { toast({ title: "✅ Peça atualizada!" }); setModalOpen(false); fetchParts(); }
        }
        setSaving(false);
    };

    // Delete confirmed
    const handleDelete = async () => {
        if (deleteId === null) return;
        setDeleting(true);
        const { error } = await supabase.from("base_pecas_andon").delete().eq("id", deleteId);
        if (error) toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        else { toast({ title: "🗑️ Peça removida." }); fetchParts(); }
        setDeleteId(null);
        setDeleting(false);
    };

    // Filtered list
    const filtered = parts.filter(p =>
        (p.Nome_Peca || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.Codigo_Peca || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.Tacto || "").includes(search)
    );

    const COR_BADGE: Record<string, string> = {
        azul: "bg-blue-100 text-blue-700 border-blue-300",
        rosa: "bg-pink-100 text-pink-700 border-pink-300",
        amarelo: "bg-yellow-100 text-yellow-700 border-yellow-300",
        branco: "bg-gray-100 text-gray-600 border-gray-300",
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white font-sans flex flex-col items-center justify-center">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center w-full pb-32">
                    <div className="w-16 h-16 border-4 border-[#001E50] border-t-transparent rounded-full animate-spin" />
                    <p className="mt-6 text-xl font-bold text-[#001E50]">Carregando Catálogo SmartAndon...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-[#001E50] selection:text-white pb-16">
            <Header />

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-8">

                {/* Page Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/relatorios")}
                            className="flex items-center justify-center h-10 w-10 rounded-xl bg-[#001E50]/10 hover:bg-[#001E50]/20 text-[#001E50] transition-colors active:scale-95"
                            title="Voltar ao Dashboard"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black text-[#001E50] tracking-tight">Admin · Peças</h1>
                            <p className="text-sm text-gray-400 font-medium">{parts.length} peça{parts.length !== 1 ? "s" : ""} cadastrada{parts.length !== 1 ? "s" : ""}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Buscar por nome, código ou tacto..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="flex-1 md:w-64 h-10 rounded-xl border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#001E50] bg-white"
                        />
                        <button onClick={fetchParts} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors" title="Atualizar">
                            <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                            onClick={openNew}
                            className="flex items-center gap-2 h-10 bg-[#001E50] hover:bg-[#00287a] text-white font-bold px-4 rounded-xl transition-colors active:scale-95 shadow-sm text-sm"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Nova Peça</span>
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-[#001E50] text-white">
                                    {["Tacto", "Lado", "Código", "Nome da Peça", "CC Number", "Cor", "Ações"].map(h => (
                                        <th key={h} className="px-4 py-3.5 text-left font-black tracking-wide text-xs uppercase whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-16 text-gray-400 font-medium">
                                                {search ? "Nenhuma peça encontrada para esta busca." : "Nenhuma peça cadastrada."}
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((part, i) => (
                                            <motion.tr
                                                key={part.id}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ delay: i * 0.02 }}
                                                className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors"
                                            >
                                                <td className="px-4 py-3 font-black text-[#001E50]">{part.Tacto}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-black border ${part.Lado === "LE" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
                                                        {part.Lado}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 font-mono font-bold text-gray-700">{part.Codigo_Peca}</td>
                                                <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate" title={part.Nome_Peca}>{part.Nome_Peca}</td>
                                                <td className="px-4 py-3 text-gray-500">{part.CC_Number}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border capitalize ${COR_BADGE[part.Cor] || COR_BADGE["branco"]}`}>
                                                        {part.Cor || "branco"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => openEdit(part)}
                                                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteId(part.id)}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                                            title="Remover"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))
                                    )}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* ── ADD / EDIT MODAL ── */}
            <AnimatePresence>
                {modalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center px-4"
                        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 24 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 24 }}
                            transition={{ type: "spring", stiffness: 280, damping: 24 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className="bg-[#001E50] px-6 py-5 flex items-center justify-between">
                                <h2 className="text-lg font-black text-white">
                                    {editingId === null ? "Nova Peça" : "Editar Peça"}
                                </h2>
                                <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
                                    <X className="h-5 w-5 text-white" />
                                </button>
                            </div>

                            {/* Form */}
                            <div className="px-6 py-5 grid grid-cols-2 gap-4">
                                {([
                                    { field: "Tacto", label: "Tacto *", type: "text", placeholder: "ex: 001", col: 1 },
                                    { field: "Codigo_Peca", label: "Código da Peça *", type: "text", placeholder: "ex: A1B2C", col: 1 },
                                    { field: "CC_Number", label: "CC Number", type: "text", placeholder: "ex: 1234", col: 1 },
                                ] as const).map(({ field, label, type, placeholder, col }) => (
                                    <div key={field} className={col === 1 ? "" : "col-span-2"}>
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">{label}</label>
                                        <input
                                            type={type}
                                            value={form[field]}
                                            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                                            placeholder={placeholder}
                                            className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#001E50]"
                                        />
                                    </div>
                                ))}

                                {/* Lado */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Lado *</label>
                                    <div className="flex gap-2">
                                        {LADO_OPTIONS.map(l => (
                                            <button
                                                key={l}
                                                type="button"
                                                onClick={() => setForm(f => ({ ...f, Lado: l }))}
                                                className={`flex-1 h-10 rounded-xl text-sm font-bold transition-all border ${form.Lado === l ? "bg-[#001E50] text-white border-[#001E50]" : "bg-white text-gray-500 border-gray-200 hover:border-[#001E50]"}`}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Nome da Peça - full width */}
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Nome da Peça *</label>
                                    <input
                                        type="text"
                                        value={form.Nome_Peca}
                                        onChange={e => setForm(f => ({ ...f, Nome_Peca: e.target.value }))}
                                        placeholder="ex: Vidro Lateral Dianteiro LE"
                                        className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#001E50]"
                                    />
                                </div>

                                {/* Cor */}
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 block">Cor do Card</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {COR_OPTIONS.map(cor => (
                                            <button
                                                key={cor}
                                                type="button"
                                                onClick={() => setForm(f => ({ ...f, Cor: cor }))}
                                                className={`px-3 h-9 rounded-xl text-sm font-bold capitalize transition-all border ${form.Cor === cor ? "ring-2 ring-[#001E50] ring-offset-1" : ""} ${COR_BADGE[cor] || "bg-gray-100 text-gray-600 border-gray-300"}`}
                                            >
                                                {cor}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="px-6 pb-6 flex gap-3">
                                <button onClick={() => setModalOpen(false)} className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-colors text-sm">
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex-1 h-11 rounded-2xl bg-[#001E50] hover:bg-[#00287a] text-white font-black transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                                >
                                    <Save className="h-4 w-4" />
                                    {saving ? "Salvando..." : editingId === null ? "Adicionar" : "Salvar"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── DELETE CONFIRM MODAL ── */}
            <AnimatePresence>
                {deleteId !== null && (
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
                                <Trash2 className="h-8 w-8 text-red-500" />
                            </div>
                            <h2 className="text-xl font-black text-gray-900 mb-2">Tem certeza?</h2>
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                Esta ação é irreversível. A peça será removida permanentemente do catálogo.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setDeleteId(null)}
                                    className="flex-1 h-11 rounded-2xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 h-11 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-black transition-colors disabled:opacity-60"
                                >
                                    {deleting ? "Removendo..." : "Remover"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PartsCatalog;
