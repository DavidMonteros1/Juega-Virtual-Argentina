// js/supabase.js

// Conexión central a Supabase para todo el proyecto
// Proyecto: Juega Virtual Argentina Multiplayer

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://xyzqygmvazbkutcynqej.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5enF5Z212YXpia3V0Y3lucWVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MzI3NjEsImV4cCI6MjA2MjMwODc2MX0.bpPU7tClq_4znsMXM6_bj8MkGL3ByYFT2eTK4px_E1Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
