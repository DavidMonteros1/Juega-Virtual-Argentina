import { supabase } from './supabase.js';

const PHONE_E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,24}$/;

function normalizeUsername(username) {
  const normalized = username.trim();
  if (!USERNAME_PATTERN.test(normalized)) {
    throw new Error('El nombre debe tener entre 3 y 24 caracteres: letras, números o guion bajo.');
  }
  return normalized;
}

function authEmailForUsername(username) {
  return `${normalizeUsername(username).toLowerCase()}@accounts.jva.invalid`;
}

function normalizePhone(phone) {
  const normalized = phone.trim().replace(/[()\s-]/g, '');
  if (!PHONE_E164_PATTERN.test(normalized)) {
    throw new Error('Ingresa tu WhatsApp en formato internacional, por ejemplo +5491157054802.');
  }
  return normalized;
}

export async function login(username, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authEmailForUsername(username),
      password,
    });
    return { data, error };
  } catch (error) {
    return { data: null, error: error.message?.startsWith('El nombre')
      ? error
      : new Error('No se pudo iniciar sesión. Revisa tu usuario y contraseña.') };
  }
}

export async function register(username, password, phone) {
  try {
    const normalizedUsername = normalizeUsername(username);
    const normalizedPhone = normalizePhone(phone);
    const { data, error } = await supabase.auth.signUp({
      email: authEmailForUsername(normalizedUsername),
      password,
      options: {
        data: {
          username: normalizedUsername,
          whatsapp: normalizedPhone,
        },
      },
    });
    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

export async function getUsuarioActual() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }
  if (!sessionData.session) {
    return null;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    throw authError;
  }
  if (!authData.user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase.rpc('jva_get_my_profile');

  if (profileError) {
    throw profileError;
  }

  return {
    id: profile.user_id,
    user_id: profile.user_id,
    username: profile.username,
    nombre_usuario: profile.username,
    balance_tokens: profile.balance_tokens,
    fichas: profile.balance_tokens,
    phone: authData.user.user_metadata.whatsapp,
  };
}

export async function getOrganizerWhatsAppLink(message) {
  const { data, error } = await supabase.rpc('jva_get_public_config');
  if (error) {
    throw error;
  }

  const phone = data?.settings?.organizer_whatsapp?.replace(/\D/g, '');
  if (!phone || !/^[1-9]\d{7,14}$/.test(phone)) {
    throw new Error('El WhatsApp del organizador no está configurado correctamente.');
  }

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
  window.location.href = 'login.html';
}
