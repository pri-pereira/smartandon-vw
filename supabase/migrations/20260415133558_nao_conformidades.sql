-- Tabela de registros de material não conforme
CREATE TABLE public.nao_conformidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tacto TEXT NOT NULL,
  lado TEXT NOT NULL CHECK (lado IN ('LE', 'LD')),
  motivo TEXT NOT NULL CHECK (motivo IN ('Posicionamento Rack', 'Material lado invertido')),
  status TEXT NOT NULL DEFAULT 'aguardando_inspecao',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nao_conformidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ler nao_conformidades" ON public.nao_conformidades
  FOR SELECT USING (true);

CREATE POLICY "Todos podem registrar nao_conformidades" ON public.nao_conformidades
  FOR INSERT WITH CHECK (true);

-- Habilitar realtime para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.nao_conformidades;
