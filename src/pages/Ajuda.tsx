import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    HardHat,
    Truck,
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    AlertCircle,
    Eye,
    LogIn,
    LayoutDashboard,
    Package,
} from "lucide-react";

type Tab = "operador" | "logistica";

interface GuideStep {
    icon: React.ReactNode;
    title: string;
    description: string;
    detail?: string;
}

const operadorSteps: GuideStep[] = [
    {
        icon: <HardHat className="h-6 w-6" />,
        title: "Acesso Direto",
        description: "Não é necessário login para visualizar as peças, apenas para solicitar.",
        detail:
            "Qualquer pessoa pode abrir a tela do Operador e consultar o catálogo. O sistema requer somente o Tacto e Lado para filtrar as peças.",
    },
    {
        icon: <Eye className="h-6 w-6" />,
        title: "Filtro de Posto",
        description: "Digite seu Tacto (3 dígitos) e escolha o Lado (LE / LD).",
        detail:
            "O sistema realiza a validação em tempo real. Se o Tacto digitado não existir no banco de dados, o avanço é imediatamente bloqueado com uma mensagem de erro em vermelho.",
    },
    {
        icon: <CheckCircle2 className="h-6 w-6" />,
        title: "Verificação Visual",
        description: "O catálogo mostrará cards coloridos. Confira se o código da peça no card bate com a etiqueta física antes de solicitar.",
        detail:
            "Cada cor representa uma família ou local de armazenamento de peça. A borda lateral espessa no card facilita a identificação rápida à distância.",
    },
    {
        icon: <AlertCircle className="h-6 w-6" />,
        title: "Alerta de Erro",
        description: "Se o Tacto estiver errado, o sistema impedirá o avanço.",
        detail:
            "Solicite correção ao administrador do sistema se o código do Tacto não estiver cadastrado. O Admin pode gerenciar o catálogo em /admin/pecas.",
    },
];

const logisticaSteps: GuideStep[] = [
    {
        icon: <LogIn className="h-6 w-6" />,
        title: "Cadastro",
        description: "Acesse a tela de registro e crie sua conta utilizando o e-mail corporativo ou ID.",
        detail:
            "O cadastro gera suas credenciais de acesso ao painel. Apenas contas autorizadas pelo Administrador conseguem acessar o painel de logística.",
    },
    {
        icon: <CheckCircle2 className="h-6 w-6" />,
        title: "Login",
        description: "Realize o login para validar suas permissões de acesso ao painel de abastecimento.",
        detail:
            "Após o login, o sistema valida sua função. Se você não tiver a permissão de logística, será redirecionado de volta para a tela inicial.",
    },
    {
        icon: <LayoutDashboard className="h-6 w-6" />,
        title: "Painel de Monitoramento",
        description: "Você verá a tela de chamados em tempo real. Cada linha representa um posto da Glass Cell solicitando material.",
        detail:
            "O painel exibe os chamados ordenados por urgência. Um semáforo cromático (verde → amarelo → vermelho) indica o tempo restante para entrega dentro do SLA de 10 minutos.",
    },
    {
        icon: <Package className="h-6 w-6" />,
        title: "Atendimento",
        description: "Verifique o Tacto, Lado e a Cor da peça solicitada.",
        detail:
            "Dirija-se ao local, realize o abastecimento e clique em 'Confirmar' no sistema para sinalizar a entrega. O Operador deverá confirmar o recebimento na célula para encerrar o chamado.",
    },
];

const colorLegend = [
    { color: "bg-blue-100 border-l-blue-400", label: "Azul", desc: "Peça identificada como Azul no catálogo" },
    { color: "bg-pink-100 border-l-pink-400", label: "Rosa", desc: "Peça identificada como Rosa no catálogo" },
    { color: "bg-yellow-100 border-l-yellow-400", label: "Amarelo", desc: "Peça identificada como Amarelo no catálogo" },
    { color: "bg-white border-l-gray-300", label: "Branco", desc: "Peça padrão ou sem cor específica" },
];

const StepCard = ({ step, index }: { step: GuideStep; index: number }) => {
    const [open, setOpen] = useState(false);
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
        >
            <button
                onClick={() => setOpen((o) => !o)}
                className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 transition-colors"
            >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#001E50]/10 flex items-center justify-center text-[#001E50]">
                    {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#001E50]/50 uppercase tracking-widest">Passo {index + 1}</span>
                    </div>
                    <p className="text-base md:text-lg font-bold text-gray-900 leading-snug mt-0.5">{step.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5 leading-snug">{step.description}</p>
                </div>
                <span className={`flex-shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>▶</span>
            </button>
            <AnimatePresence>
                {open && step.detail && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pb-5 pt-1 border-t border-gray-100 bg-[#001E50]/[0.02]">
                            <p className="text-sm md:text-base text-gray-700 leading-relaxed">{step.detail}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

const Ajuda = () => {
    const [activeTab, setActiveTab] = useState<Tab>("operador");
    const navigate = useNavigate();

    const steps = activeTab === "operador" ? operadorSteps : logisticaSteps;

    return (
        <div className="min-h-screen bg-gray-50 font-sans selection:bg-[#001E50] selection:text-white">
            {/* Top Bar */}
            <header className="w-full bg-[#001E50] px-4 py-4 flex items-center gap-4 shadow-lg sticky top-0 z-30">
                <button
                    onClick={() => navigate("/")}
                    className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors active:scale-95"
                >
                    <ArrowLeft className="h-6 w-6 text-white" />
                </button>
                <div className="flex items-center gap-3">
                    <BookOpen className="h-7 w-7 text-white/80" />
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-white leading-none">Central de Ajuda</h1>
                        <p className="text-xs text-white/60 mt-0.5 hidden sm:block">SmartAndon · Volkswagen Taubaté</p>
                    </div>
                </div>
            </header>

            <main className="w-full max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
                {/* Tab Switcher */}
                <div className="flex bg-white rounded-3xl p-1.5 shadow-sm border border-gray-200 w-full">
                    <button
                        onClick={() => setActiveTab("operador")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm md:text-base transition-all duration-200 ${activeTab === "operador"
                                ? "bg-[#001E50] text-white shadow-md"
                                : "text-gray-500 hover:text-[#001E50]"
                            }`}
                    >
                        <HardHat className="h-5 w-5 flex-shrink-0" />
                        <span>Guia do Operador</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("logistica")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl font-bold text-sm md:text-base transition-all duration-200 ${activeTab === "logistica"
                                ? "bg-[#001E50] text-white shadow-md"
                                : "text-gray-500 hover:text-[#001E50]"
                            }`}
                    >
                        <Truck className="h-5 w-5 flex-shrink-0" />
                        <span>Guia da Logística</span>
                    </button>
                </div>

                {/* Guide Content */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: activeTab === "operador" ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-4"
                    >
                        {/* Section Header */}
                        <div className={`rounded-2xl p-5 flex items-start gap-4 ${activeTab === "operador"
                                ? "bg-[#001E50] text-white"
                                : "bg-emerald-700 text-white"
                            }`}>
                            <div className="p-2 bg-white/15 rounded-xl flex-shrink-0">
                                {activeTab === "operador"
                                    ? <HardHat className="h-8 w-8" />
                                    : <Truck className="h-8 w-8" />
                                }
                            </div>
                            <div>
                                <h2 className="text-xl md:text-2xl font-black leading-tight">
                                    {activeTab === "operador" ? "Guia do Operador" : "Guia da Logística"}
                                </h2>
                                <p className="text-sm md:text-base text-white/75 mt-1 leading-snug">
                                    {activeTab === "operador"
                                        ? "Como solicitar peças de forma rápida e segura direto da linha de montagem."
                                        : "Como monitorar e atender os chamados de abastecimento em tempo real."
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Steps */}
                        <div className="flex flex-col gap-3">
                            {steps.map((step, i) => (
                                <StepCard key={i} step={step} index={i} />
                            ))}
                        </div>

                        {/* Color Legend (only for Operador) */}
                        {activeTab === "operador" && (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                                <h3 className="text-base font-black text-[#001E50] mb-4 flex items-center gap-2">
                                    <span className="w-1 h-5 bg-[#001E50] rounded-full inline-block" />
                                    Legenda de Cores dos Cards
                                </h3>
                                <div className="flex flex-col gap-3">
                                    {colorLegend.map((item) => (
                                        <div key={item.label} className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg border-l-[6px] flex-shrink-0 ${item.color}`} />
                                            <div>
                                                <span className="text-sm font-bold text-gray-900">{item.label}</span>
                                                <span className="text-xs text-gray-400 block">{item.desc}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Footer note */}
                <p className="text-center text-xs text-gray-400 pb-6">
                    SmartAndon · Volkswagen Taubaté · Versão 2026
                </p>
            </main>
        </div>
    );
};

export default Ajuda;
