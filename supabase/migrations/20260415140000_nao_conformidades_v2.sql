-- Atualizar constraint de motivos para os novos valores
ALTER TABLE public.nao_conformidades
  DROP CONSTRAINT IF EXISTS nao_conformidades_motivo_check;

ALTER TABLE public.nao_conformidades
  ADD CONSTRAINT nao_conformidades_motivo_check
    CHECK (motivo IN (
      'Erro de Posicionamento (Rack)',
      'Divergência de Lado (Ficha vs Físico)',
      -- manter compatibilidade com registros antigos
      'Posicionamento Rack',
      'Material lado invertido'
    ));

-- Adicionar coluna para tipo de ação gerado automaticamente
ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS tipo_acao TEXT DEFAULT NULL
    CHECK (tipo_acao IN ('reversa', 'urgente', NULL));

-- Adicionar coluna para calcular downtime
ALTER TABLE public.nao_conformidades
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ DEFAULT NULL;
