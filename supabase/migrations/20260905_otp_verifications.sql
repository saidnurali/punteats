-- ============================================================
-- Migration: Server-side OTP verification table
-- Fixes: client-side OTP generation, "0000" backdoor, predictable
--        phone-derived passwords in the customer app auth flow.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- ============================================================

create table if not exists public.otp_verifications (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists otp_verifications_phone_idx on public.otp_verifications (phone);

-- RLS enabled, zero policies added on purpose: only the service_role
-- (used exclusively by the send-otp / verify-otp Edge Functions) can
-- read or write this table. anon and authenticated get zero access.
alter table public.otp_verifications enable row level security;
