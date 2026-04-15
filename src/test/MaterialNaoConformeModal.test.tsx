import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MaterialNaoConformeModal from '../components/MaterialNaoConformeModal';
import { supabase } from '@/integrations/supabase/client';
import { Toaster } from '@/components/ui/toaster';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock ResizeObserver for framer-motion issue in test env
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

describe('MaterialNaoConformeModal', () => {
  const mockInsert = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (supabase.from as any).mockReturnValue({
      insert: mockInsert,
    });
  });

  it('deve pular a etapa 1 de validação se tacto e lado já estiverem preenchidos', async () => {
    render(
      <MaterialNaoConformeModal
        isOpen={true}
        onClose={mockOnClose}
        tactoInicial="123"
        ladoInicial="LE"
      />
    );

    // Deve mostrar "Selecione o tipo de ocorrência" indicando que pulou para o step "motivo"
    expect(screen.getByText(/Selecione o tipo de ocorrência/i)).toBeInTheDocument();
  });

  it('deve abrir no passo 1 de identificação se tacto e lado não forem passados', () => {
    render(
      <MaterialNaoConformeModal
        isOpen={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Passo 1 — Identificação do Tacto/i)).toBeInTheDocument();
  });

  it('deve inserir 2 registros se motivo for Divergência de Lado', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    render(
      <MaterialNaoConformeModal
        isOpen={true}
        onClose={mockOnClose}
        tactoInicial="70"
        ladoInicial="LD"
      />
    );

    // Selecionar motivo
    const btnsDivergencia = screen.getAllByText(/Divergência de Lado/i);
    fireEvent.click(btnsDivergencia[0]);

    // Irá para a etapa de confirmação
    expect(screen.getAllByText(/Confirmação/i)[0]).toBeInTheDocument();

    const btnsConfirmar = screen.getAllByText(/Confirmar Envio/i);
    fireEvent.click(btnsConfirmar[0]);

    await waitFor(() => {
      // Supabase.from("nao_conformidades").insert([...])
      expect(mockInsert).toHaveBeenCalledTimes(1);

      // Deve inserir um array com 2 objetos
      const args = mockInsert.mock.calls[0][0];
      expect(args.length).toBe(2);

      // Logística Reversa (mesmo lado selecionado: LD)
      expect(args[0]).objectContaining({
        tacto: "70",
        lado: "LD",
        tipo_acao: "reversa",
      });

      // Abastecimento Urgente (lado inverso gerado: LE)
      expect(args[1]).objectContaining({
        tacto: "70",
        lado: "LE",
        tipo_acao: "urgente",
      });
    });
  });

  it('deve inserir apenas 1 registro se motivo for Erro de Posicionamento', async () => {
    mockInsert.mockResolvedValueOnce({ error: null });

    render(
      <MaterialNaoConformeModal
        isOpen={true}
        onClose={mockOnClose}
        tactoInicial="99"
        ladoInicial="LE"
      />
    );

    const btnsPosicionamento = screen.getAllByText(/Erro de Posicionamento/i);
    fireEvent.click(btnsPosicionamento[0]);

    const btnsConfirmar = screen.getAllByText(/Confirmar Envio/i);
    fireEvent.click(btnsConfirmar[0]);

    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(1);
      const args = mockInsert.mock.calls[0][0];
      
      expect(args.length).toBe(1);
      expect(args[0]).objectContaining({
        tacto: "99",
        lado: "LE",
        tipo_acao: null, // Sem logística reversa
      });
    });
  });
});
