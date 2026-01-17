// lib/trustSignals.js
/**
 * Helper para obtener trust signals (badges de verificación) del vendedor.
 * 
 * Trust signals disponibles:
 * - Email verificado: auth.email_confirmed_at
 * - Teléfono verificado: profile.phone existe
 * - Wallet verificada: tiene payout_accounts configurado
 * - Ventas completadas: count de orders del seller con status=paid
 * 
 * TODO: Agregar phone_verified column para tracking más preciso
 * TODO: Agregar disputes count cuando exista tabla de disputes
 */

import { supabaseAdmin } from './supabaseAdmin';

/**
 * Obtiene trust signals del vendedor desde la base de datos.
 * 
 * @param {string} sellerId - UUID del vendedor
 * @returns {Promise<Object>} Trust signals del vendedor
 */
export async function getSellerTrustSignals(sellerId) {
  if (!sellerId) {
    return {
      emailVerified: false,
      phoneVerified: false,
      walletVerified: false,
      salesCount: 0,
      disputesCount: 0, // TODO: implementar cuando exista tabla
      error: 'No seller ID provided'
    };
  }

  const supabase = supabaseAdmin();

  try {
    // 1. Obtener datos del usuario de auth
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(sellerId);
    
    const emailVerified = !authError && authUser?.user?.email_confirmed_at != null;

    // 2. Obtener perfil del vendedor
    const { data: profile } = await supabase
      .from('profiles')
      .select('phone, full_name, email')
      .eq('id', sellerId)
      .maybeSingle();

    // Phone verificado: si tiene phone no null
    // TODO: Mejorar con columna phone_verified cuando se implemente
    const phoneVerified = profile?.phone != null && profile.phone.trim() !== '';

    // 3. Verificar si tiene wallet configurada (payout_accounts)
    const { data: payoutAccount } = await supabase
      .from('payout_accounts')
      .select('id, bank_name, account_number')
      .eq('user_id', sellerId)
      .maybeSingle();

    const walletVerified = payoutAccount?.bank_name != null && payoutAccount?.account_number != null;

    // 4. Contar ventas completadas (orders con status paid o delivered)
    // TODO: Ajustar según los estados reales de tu DB
    const { count: salesCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
      .in('status', ['paid', 'delivered', 'completed']);

    // 5. Disputas count (TODO: implementar cuando exista tabla)
    const disputesCount = 0; // Placeholder

    return {
      emailVerified,
      phoneVerified,
      walletVerified,
      salesCount: salesCount || 0,
      disputesCount,
      sellerName: profile?.full_name || profile?.email || 'Vendedor',
      error: null
    };

  } catch (error) {
    console.error('[trustSignals] Error obteniendo trust signals:', error);
    return {
      emailVerified: false,
      phoneVerified: false,
      walletVerified: false,
      salesCount: 0,
      disputesCount: 0,
      error: error.message
    };
  }
}

/**
 * Obtiene trust signals de múltiples vendedores de forma eficiente.
 * 
 * @param {string[]} sellerIds - Array de UUIDs de vendedores
 * @returns {Promise<Object>} Map de sellerId -> trust signals
 */
export async function getBulkSellerTrustSignals(sellerIds) {
  if (!sellerIds || sellerIds.length === 0) {
    return {};
  }

  const uniqueIds = [...new Set(sellerIds.filter(Boolean))];
  const results = {};

  // Obtener todos en paralelo para mejor performance
  const promises = uniqueIds.map(id => 
    getSellerTrustSignals(id).then(signals => {
      results[id] = signals;
    })
  );

  await Promise.all(promises);

  return results;
}
