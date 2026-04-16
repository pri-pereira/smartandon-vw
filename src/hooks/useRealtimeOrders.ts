import { useEffect, useState } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { getTerminalId, getActiveChamadoId, saveActiveChamadoId, clearActiveChamadoId } from "@/utils/terminalId";

export interface RealtimeOrder {
    id: string;
    nome_peca: string;
    codigo_peca: string;
    tacto: string;
    lado: string;
    cor_peca?: string;
    terminal_id?: string;
}

/**
 * useRealtimeOrders
 * Monitora a tabela 'chamados' por registros com status='entregue_no_posto'
 * vinculados a ESTE dispositivo.
 *
 * Estratégia de 3 camadas para garantir persistência em reloads:
 *
 *  1. ID salvo no localStorage (mais rápido, cobre chamados novos)
 *  2. terminal_id do dispositivo (cobre registros corretamente associados)
 *  3. FALLBACK AMPLO: todos os chamados 'entregue_no_posto' de hoje
 *     → necessário para chamados legados (terminal_id=null) e primeiros testes
 *     → quando encontra via fallback, salva o ID no localStorage para o próximo reload
 *
 *  Realtime: captura novas sinalizações em tempo real usando os mesmos critérios.
 */
export const useRealtimeOrders = () => {
    const [pendingOrders, setPendingOrders] = useState<RealtimeOrder[]>([]);

    useEffect(() => {
        let active = true;
        const myTerminalId = getTerminalId();

        const fetchExisting = async () => {
            const savedChamadoId = getActiveChamadoId();
            let results: RealtimeOrder[] = [];

            // ── Estratégia 1: ID salvo no localStorage ──────────────────────
            if (savedChamadoId) {
                console.log("[DoubleCheck] Estratégia 1 — buscando por ID salvo:", savedChamadoId);
                const { data } = await supabase
                    .from("chamados")
                    .select("id, nome_peca, codigo_peca, tacto, lado, cor_peca, terminal_id")
                    .eq("id", savedChamadoId)
                    .in("status", ["entregue_no_posto", "aguardando_confirmacao", "aguardando_validacao_operador"])
                    .maybeSingle();

                if (data) {
                    console.log("[DoubleCheck] ✅ Encontrado por ID:", data.nome_peca);
                    results = [data as RealtimeOrder];
                } else {
                    // Chamado não está mais pendente — limpar
                    clearActiveChamadoId();
                }
            }

            // ── Estratégia 2: terminal_id do dispositivo ─────────────────────
            if (results.length === 0) {
                console.log("[DoubleCheck] Estratégia 2 — buscando por terminal_id:", myTerminalId);
                const { data } = await supabase
                    .from("chamados")
                    .select("id, nome_peca, codigo_peca, tacto, lado, cor_peca, terminal_id")
                    .in("status", ["entregue_no_posto", "aguardando_confirmacao", "aguardando_validacao_operador"])
                    .eq("terminal_id", myTerminalId);

                if (data && data.length > 0) {
                    console.log("[DoubleCheck] ✅ Encontrados por terminal_id:", data.length);
                    results = data as RealtimeOrder[];
                    // Salva para o próximo reload
                    saveActiveChamadoId(data[0].id);
                }
            }

            // ── Estratégia 3: fallback amplo (hoje, qualquer terminal_id) ────
            // Cobre chamados legados (terminal_id=null) e primeiros testes.
            if (results.length === 0) {
                const today = format(new Date(), "yyyy-MM-dd");
                console.log("[DoubleCheck] Estratégia 3 — buscando todos de hoje em entregue_no_posto");
                const { data } = await supabase
                    .from("chamados")
                    .select("id, nome_peca, codigo_peca, tacto, lado, cor_peca, terminal_id")
                    .in("status", ["entregue_no_posto", "aguardando_confirmacao", "aguardando_validacao_operador"])
                    .gte("created_at", `${today}T00:00:00`);

                if (data && data.length > 0) {
                    console.log("[DoubleCheck] ✅ Encontrados por fallback de hoje:", data.length);
                    results = data as RealtimeOrder[];
                    // Persiste o primeiro chamado para reloads futuros serem mais rápidos
                    saveActiveChamadoId(data[0].id);
                    console.log("[DoubleCheck] ID salvo no localStorage:", data[0].id);
                } else {
                    console.log("[DoubleCheck] Nenhum chamado pendente encontrado hoje.");
                }
            }

            if (active && results.length > 0) {
                setPendingOrders(results);
            }
        };

        fetchExisting();

        // ── Realtime: captura sinalizações feitas APÓS a página carregar ──────
        const channel = supabase
            .channel(`realtime-orders-${myTerminalId}`)
            .on(
                "postgres_changes",
                { event: "UPDATE", schema: "public", table: "chamados" },
                (payload) => {
                    const record = payload.new as any;
                    const savedId = getActiveChamadoId();

                    console.log("[DoubleCheck] Realtime — status:", record.status);
                    console.log("[DoubleCheck] ID Terminal Local:", myTerminalId);
                    console.log("[DoubleCheck] ID Terminal no Pedido:", record.terminal_id);

                    const isMyOrder =
                        (record.terminal_id && record.terminal_id === myTerminalId) ||
                        (savedId && record.id === savedId);

                    // Nova entrega sinalizada
                    if (record.status === "entregue_no_posto" || record.status === "aguardando_confirmacao" || record.status === "aguardando_validacao_operador") {
                        // Se for meu pedido OU se não tiver terminal_id (legado), mostrar
                        const shouldShow = isMyOrder || !record.terminal_id;
                        if (shouldShow) {
                            if (!savedId) saveActiveChamadoId(record.id);
                            setPendingOrders((prev) => {
                                if (prev.find((o) => o.id === record.id)) return prev;
                                return [...prev, {
                                    id: record.id,
                                    nome_peca: record.nome_peca,
                                    codigo_peca: record.codigo_peca,
                                    tacto: record.tacto,
                                    lado: record.lado,
                                    cor_peca: record.cor_peca,
                                }];
                            });
                        }
                    }

                    // Pedido resolvido → remover da lista
                    if (record.status === "concluido" || record.status === "divergencia") {
                        clearActiveChamadoId();
                        setPendingOrders((prev) => prev.filter((o) => o.id !== record.id));
                    }
                }
            )
            .subscribe();

        return () => {
            active = false;
            supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { pendingOrders };
};
