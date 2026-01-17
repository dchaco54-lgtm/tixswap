'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// ============================================
// Server Actions para Profile Management
// ============================================

// Cliente del servidor (requiere Service Role Key para ciertos ops)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase credentials missing');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

// Cliente del usuario autenticado
function getSupabaseAuth() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const cookieStore = cookies();
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase credentials missing');
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false
    }
  });
  
  return supabase;
}

/**
 * Obtener perfil actual del usuario autenticado
 */
export async function getCurrentProfile() {
  try {
    const supabase = getSupabaseAuth();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) throw error;
    
    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Actualizar perfil del usuario (nombre, status, avatar_url)
 */
export async function updateProfile(updates) {
  try {
    const supabase = getSupabaseAuth();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }
    
    // Validar campos
    if (updates.full_name) {
      const trimmed = updates.full_name.trim();
      if (trimmed.length < 3 || trimmed.length > 40) {
        throw new Error('El nombre debe tener entre 3 y 40 caracteres');
      }
      updates.full_name = trimmed;
    }
    
    if (updates.status) {
      const validStatuses = ['online', 'busy', 'away', 'invisible'];
      if (!validStatuses.includes(updates.status)) {
        throw new Error('Estado inválido');
      }
    }
    
    // Actualizar en BD
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, profile: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Subir avatar a Storage y retornar URL pública
 */
export async function uploadAvatar(file, userId) {
  try {
    const supabase = getSupabaseAuth();
    
    // Validar tamaño (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('El archivo debe pesar menos de 2MB');
    }
    
    // Validar tipo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      throw new Error('Solo se permiten JPG, PNG o WebP');
    }
    
    // Generar nombre del archivo
    const ext = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${ext}`;
    const filePath = `${userId}/${fileName}`;
    
    // Subir a storage
    const { error: uploadError, data } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });
    
    if (uploadError) throw uploadError;
    
    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
    
    return { success: true, avatarUrl: publicUrl };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Eliminar avatar de Storage
 */
export async function deleteAvatar(userId) {
  try {
    const supabase = getSupabaseAuth();
    
    // Listar y eliminar todos los avatares del usuario
    const { data: files, error: listError } = await supabase.storage
      .from('avatars')
      .list(`${userId}`);
    
    if (listError) throw listError;
    
    if (files && files.length > 0) {
      const paths = files.map(f => `${userId}/${f.name}`);
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove(paths);
      
      if (deleteError) throw deleteError;
    }
    
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Buscar tickets abiertos para cambio de email o RUT
 */
export async function findOpenChangeTicket(field) {
  try {
    const supabase = getSupabaseAuth();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }
    
    const subjectPrefix = field === 'email' ? 'Solicitud cambio de EMAIL' : 'Solicitud cambio de RUT';
    
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('requester_email', user.email)
      .ilike('subject', `${subjectPrefix}%`)
      .eq('status', 'abierto')
      .single();
    
    // No es error si no encuentra - retorna null
    if (error?.code === 'PGRST116') {
      return { success: true, ticket: null };
    }
    
    if (error) throw error;
    
    return { success: true, ticket: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Crear ticket de soporte para cambio de email o RUT
 */
export async function createProfileChangeTicket(field, requestedValue, reason = '') {
  try {
    const supabase = getSupabaseAuth();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }
    
    // Obtener perfil actual
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (profileError) throw profileError;
    
    // Verificar si ya existe ticket abierto
    const subjectPrefix = field === 'email' ? 'Solicitud cambio de EMAIL' : 'Solicitud cambio de RUT';
    const { data: existingTicket, error: checkError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('requester_email', user.email)
      .ilike('subject', `${subjectPrefix}%`)
      .eq('status', 'abierto')
      .single();
    
    if (checkError?.code !== 'PGRST116' && !checkError) {
      // Existe ticket abierto
      return { 
        success: false, 
        error: `Ya tienes un ticket abierto para cambio de ${field === 'email' ? 'email' : 'RUT'}`
      };
    }
    
    // Crear el ticket
    const ticketData = {
      category: 'cambio_datos',
      subject: `${subjectPrefix} - ${requestedValue}`,
      message: `Solicito cambiar mi ${field === 'email' ? 'email' : 'RUT'} a: ${requestedValue}\n\n${reason ? `Motivo: ${reason}` : ''}`,
      requester_email: user.email,
      requester_name: profile.full_name || 'Sin nombre',
      requester_rut: profile.rut || 'Sin RUT',
      status: 'abierto'
    };
    
    const { data, error } = await supabase
      .from('support_tickets')
      .insert([ticketData])
      .select()
      .single();
    
    if (error) throw error;
    
    return { success: true, ticket: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Validar RUT (importa del lib/rutUtils)
 * Esta función debe importarse desde lib/rutUtils en el cliente
 */
export function formatRutForDisplay(rut) {
  if (!rut) return null;
  // Formato: XX.XXX.XXX-K
  const cleaned = rut.replace(/[^\dKk]/g, '').toUpperCase();
  if (cleaned.length < 8) return rut;
  const body = cleaned.slice(0, -1);
  const dv = cleaned[cleaned.length - 1];
  return `${body.slice(0, 2)}.${body.slice(2, 5)}.${body.slice(5)}-${dv}`;
}

export function formatEmailForDisplay(email) {
  if (!email) return null;
  // Enmascarar email: user***@domain
  const [user, domain] = email.split('@');
  if (user.length <= 2) return email;
  return `${user.slice(0, 2)}***@${domain}`;
}
