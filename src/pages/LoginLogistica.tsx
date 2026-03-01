import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Header from "@/components/Header";
import { useToast } from "@/hooks/use-toast";

type AuthMode = "login" | "register" | "forgot_password";

const LoginLogistica = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [mode, setMode] = useState<AuthMode>("login");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (mode === "login") {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                if (error.message.includes("Email not confirmed")) {
                    toast({ title: "Email não confirmado", description: "Por favor, verifique sua caixa de entrada e confirme seu email antes de fazer login.", variant: "default" });
                } else {
                    toast({ title: "Erro de autenticação", description: "Email ou senha incorretos.", variant: "destructive" });
                }
            } else if (data.user) {
                // Check if user is admin
                const { data: roles } = await supabase
                    .from("user_roles")
                    .select("role")
                    .eq("user_id", data.user.id)
                    .eq("role", "admin");

                const hasAdminRole = roles && roles.length > 0;
                const hasMetadataAdmin = data.user.user_metadata?.role === "admin";

                if (hasAdminRole || hasMetadataAdmin) {
                    navigate("/relatorios");
                } else {
                    navigate("/logistica");
                }
            }
        } else if (mode === "register") {
            const { error } = await supabase.auth.signUp({ email, password });
            if (error) {
                toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
            } else {
                toast({ title: "Conta criada", description: "Verifique seu email ou faça login se a confirmação estiver desativada." });
                setMode("login");
            }
        } else if (mode === "forgot_password") {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + "/login-logistica",
            });
            if (error) {
                toast({ title: "Erro", description: error.message, variant: "destructive" });
            } else {
                toast({ title: "Email enviado", description: "Um link de recuperação foi enviado para o seu email." });
                setMode("login");
            }
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col bg-background">
            <Header />
            <main className="flex-1 flex items-center justify-center p-6">
                <form onSubmit={handleAuth} className="w-full max-w-sm space-y-6">
                    <h1 className="text-2xl font-bold text-primary text-center">
                        {mode === "login" && "Acesso Logística"}
                        {mode === "register" && "Criar Conta"}
                        {mode === "forgot_password" && "Recuperar Senha"}
                    </h1>
                    <p className="text-center text-muted-foreground">
                        {mode === "login" && "Insira suas credenciais para acessar o painel"}
                        {mode === "register" && "Preencha os dados para se cadastrar"}
                        {mode === "forgot_password" && "Insira seu email para recuperar a senha"}
                    </p>
                    <div className="space-y-4">
                        <Input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-14 text-lg border-2 border-primary"
                            required
                        />
                        {mode !== "forgot_password" && (
                            <Input
                                type="password"
                                placeholder="Senha"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-14 text-lg border-2 border-primary"
                                required
                            />
                        )}
                    </div>
                    <Button type="submit" className="w-full h-14 text-lg" disabled={loading}>
                        {loading ? "Aguarde..." :
                            mode === "login" ? "ENTRAR" :
                                mode === "register" ? "CADASTRAR" : "ENVIAR EMAIL"}
                    </Button>

                    <div className="flex flex-col space-y-2 text-center text-sm mt-4">
                        {mode === "login" ? (
                            <>
                                <button type="button" onClick={() => setMode("forgot_password")} className="text-primary hover:underline">
                                    Esqueceu a senha?
                                </button>
                                <button type="button" onClick={() => setMode("register")} className="text-primary hover:underline">
                                    Não tem uma conta? Cadastre-se
                                </button>
                            </>
                        ) : (
                            <button type="button" onClick={() => setMode("login")} className="text-primary hover:underline">
                                Voltar para o Login
                            </button>
                        )}
                    </div>
                </form>
            </main>
        </div>
    );
};

export default LoginLogistica;
