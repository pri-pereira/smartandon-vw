import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Part {
    id: number;
    Tacto: string;
    Lado: string;
    Codigo_Peca: string;
    Nome_Peca: string;
    CC_Number: string;
}

export const PartsCatalog = () => {
    const [parts, setParts] = useState<Part[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigate("/");
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
                    title: "Acesso Negado",
                    description: "Você precisa ter privilégios de administrador para gerenciar o catálogo.",
                    variant: "destructive"
                });
                navigate("/");
                return;
            }

            // Admin confirmed, load parts
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
            toast({
                title: "Erro de Conexão",
                description: `Não foi possível carregar as peças: ${error.message}`,
                variant: "destructive"
            });
        } else {
            setParts((data as Part[]) || []);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white font-sans flex flex-col items-center justify-center">
                <Header />
                <div className="flex-1 flex flex-col items-center justify-center w-full pb-32">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-6 text-xl font-bold text-[#001E50]">Carregando Catálogo da Glass Cell...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-[#001E50] selection:text-white pb-12">
            <Header />

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 w-full border-b pb-6">
                    <h2 className="text-3xl md:text-4xl font-black text-[#001E50] tracking-tight border-l-4 border-blue-600 pl-4">
                        Catálogo de Peças (Gestão)
                    </h2>
                    <Button
                        onClick={fetchParts}
                        className="w-full md:w-auto bg-[#001E50] hover:bg-blue-900 text-white rounded-xl shadow-lg font-bold px-8 h-12 md:h-14 transition-all hover:scale-105 active:scale-95"
                    >
                        Atualizar Dados
                    </Button>
                </div>

                <div className="bg-white overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/5 rounded-2xl md:rounded-3xl border border-gray-100 flex flex-col w-full">
                    {/* Scrollable container for mobile */}
                    <div className="w-full overflow-x-auto">
                        <table className="w-full min-w-[800px] divide-y divide-gray-100">
                            <thead className="bg-[#001E50]/5">
                                <tr>
                                    <th className="px-6 py-5 text-left text-sm font-black text-[#001E50] uppercase tracking-wider">Tacto</th>
                                    <th className="px-6 py-5 text-left text-sm font-black text-[#001E50] uppercase tracking-wider">Lado</th>
                                    <th className="px-6 py-5 text-left text-sm font-black text-[#001E50] uppercase tracking-wider">Código da Peça</th>
                                    <th className="px-6 py-5 text-left text-sm font-black text-[#001E50] uppercase tracking-wider">Nome da Peça</th>
                                    <th className="px-6 py-5 text-left text-sm font-black text-[#001E50] uppercase tracking-wider">CC Number</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {parts.map((part) => (
                                    <tr key={part.id} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-mono text-blue-600 font-bold group-hover:text-blue-800">{part.Tacto}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm font-black text-gray-700 bg-gray-50/50">{part.Lado}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 font-medium">{part.Codigo_Peca}</td>
                                        <td className="px-6 py-4 text-sm font-bold text-[#001E50]">{part.Nome_Peca}</td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-400 font-medium">{part.CC_Number}</td>
                                    </tr>
                                ))}
                                {parts.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">Nenhuma peça cadastrada.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default PartsCatalog;
