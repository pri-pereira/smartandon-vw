import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RealtimeOrder {
    id: string;
    nome_peca: string;
    codigo_peca: string;
    tacto: string;
    lado: string;
    cor_peca?: string;
}

/**
 * useRealtimeOrders
 * Monitors the 'chamados' table for records with status='entregue_no_posto'
 * scoped to the current operator's tacto and lado.
 * Returns a list of pending deliveries and a realtime-synced flag.
 */
export const useRealtimeOrders = (tacto: string, lado: string | null) => {
    const [pendingOrders, setPendingOrders] = useState<RealtimeOrder[]>([]);

    useEffect(() => {
        // Don't start monitoring if we don't have a tacto yet
        if (!tacto || tacto.length < 3) {
            setPendingOrders([]);
            return;
        }

        let active = true;

        // 1. Fetch current pending deliveries for this terminal on mount
        const fetchExisting = async () => {
            const query = supabase
                .from("chamados")
                .select("id, nome_peca, codigo_peca, tacto, lado, cor_peca")
                .eq("status", "entregue_no_posto")
                .eq("tacto", tacto);

            if (lado) query.eq("lado", lado);

            const { data } = await query;
            if (active && data && data.length > 0) {
                setPendingOrders(data as RealtimeOrder[]);
            }
        };
        fetchExisting();

        // 2. Realtime channel: listen to ALL updates on chamados
        const channel = supabase
            .channel(`realtime-orders-${tacto}-${lado ?? "all"}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "chamados" },
                (payload) => {
                    const record = payload.new as any;
                    const isMine =
                        record.tacto === tacto && (lado ? record.lado === lado : true);

                    // New delivery arrived for this terminal
                    if (record.status === "entregue_no_posto" && isMine) {
                        setPendingOrders((prev) => {
                            if (prev.find((o) => o.id === record.id)) return prev;
                            return [
                                ...prev,
                                {
                                    id: record.id,
                                    nome_peca: record.nome_peca,
                                    codigo_peca: record.codigo_peca,
                                    tacto: record.tacto,
                                    lado: record.lado,
                                    cor_peca: record.cor_peca,
                                },
                            ];
                        });
                    }

                    // Order resolved (concluido or divergencia) — remove from list
                    if (record.status === "concluido" || record.status === "divergencia") {
                        setPendingOrders((prev) => prev.filter((o) => o.id !== record.id));
                    }
                }
            )
            .subscribe();

        return () => {
            active = false;
            supabase.removeChannel(channel);
        };
    }, [tacto, lado]);

    return { pendingOrders };
};
