
-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela de catálogo de peças
CREATE TABLE public.catalogo_pecas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cor TEXT NOT NULL DEFAULT '#F3F4F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalogo_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ler catálogo" ON public.catalogo_pecas
  FOR SELECT USING (true);

-- Tabela de chamados
CREATE TABLE public.chamados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tacto TEXT NOT NULL,
  codigo_peca TEXT NOT NULL REFERENCES public.catalogo_pecas(codigo),
  nome_peca TEXT NOT NULL,
  cor_peca TEXT NOT NULL DEFAULT '#F3F4F6',
  celula TEXT NOT NULL DEFAULT 'CÉLULA DE VIDROS',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'entregue', 'confirmado')),
  tempo_entrega INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entregue_at TIMESTAMPTZ,
  confirmado_at TIMESTAMPTZ
);

ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ler chamados" ON public.chamados
  FOR SELECT USING (true);

CREATE POLICY "Todos podem criar chamados" ON public.chamados
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Todos podem atualizar chamados" ON public.chamados
  FOR UPDATE USING (true);

-- Enable realtime for chamados
ALTER PUBLICATION supabase_realtime ADD TABLE public.chamados;

-- Tabela de user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function para checar roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
