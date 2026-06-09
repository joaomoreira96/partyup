-- =============================================================================
-- Phase 1a — Adicionar role 'developer' ao enum user_role
--
-- OBRIGATÓRIO correr numa transacção/commit separado antes da phase1_v2.
-- PostgreSQL (55P04): novos valores de enum não podem ser usados na mesma
-- transacção em que são criados — daí este ficheiro isolado.
--
-- No SQL Editor do Supabase: executa APENAS este ficheiro, confirma sucesso,
-- e só depois corre 20250605910000_phase1_v2_foundations.sql
-- =============================================================================

alter type public.user_role add value if not exists 'developer';
