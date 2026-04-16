-- Script de Limpeza: Arquiva chamados antigos (mais de 24 horas)
-- Pode ser rodado manualmente ou agendado no pg_cron

UPDATE public.chamados
SET status = 'arquivado'
WHERE created_at < NOW() - INTERVAL '24 hours'
AND status NOT IN ('concluido', 'arquivado');
