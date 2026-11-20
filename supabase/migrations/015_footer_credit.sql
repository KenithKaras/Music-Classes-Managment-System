-- ==============================================================================
-- Migration: 015_footer_credit.sql
-- Description: Adds footer_credit column to public.academy_settings with default
--              'Made by Kenith Karas' for customizable tenant footer branding.
-- ==============================================================================

alter table public.academy_settings
  add column if not exists footer_credit text default 'Made by Kenith Karas';
