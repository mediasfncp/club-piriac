// src/supabase.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wztcwxaqcdzcuiistopk.supabase.co'
const SUPABASE_KEY = 'sb_publishable_nsyVs4eGQTMbKUgpmNv2aA_uJhpfnJH'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: localStorage,
  }
})

// ── MEMBRES ───────────────────────────────────────────────
export async function creerMembre(form) {
  const { data, error } = await supabase
    .from('membres')
    .insert([{
      prenom:           form.prenom,
      nom:              form.nom,
      email:            form.email,
      tel:              form.tel,
      tel2:             form.tel2 || null,
      adresse:          form.adresse,
      ville:            form.ville,
      cp:               form.cp,
      adresse_vac:      form.adresse_vac || null,
      ville_vac:        form.ville_vac || null,
      cp_vac:           form.cp_vac || null,
      droit_image:      form.droitImage,
      droit_diffusion:  form.droitDiffusion,
      cgv_accepted:     form.cgvAccepted,
      liberte_balance:  0,
      liberte_total:    0,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function creerEnfants(membreId, enfants) {
  if (!enfants?.length) return []
  const rows = enfants.map(e => ({
    membre_id:  membreId,
    prenom:     e.prenom,
    nom:        e.nom,
    naissance:  e.naissance,
    activite:   e.activite,
    niveau:     e.niveau,
    allergies:  e.allergies || '',
    sexe:       e.sexe || null,
    personnes_autorisees: e.personnesAutorisees || null,
  }))
  const { data, error } = await supabase.from('enfants').insert(rows).select()
  if (error) throw error
  return data
}

export async function getMembre(email) {
  const { data, error } = await supabase
    .from('membres')
    .select('*, enfants(*)')
    .eq('email', email)
    .single()
  if (error) return null
  return data
}

export async function updateLiberte(membreId, balance, total) {
  const { error } = await supabase
    .from('membres')
    .update({ liberte_balance: balance, liberte_total: total })
    .eq('id', membreId)
  if (error) throw error
}

// ── RÉSERVATIONS NATATION ─────────────────────────────────
export async function creerReservationNatation({ membreId, jour, heure, dateSeance, enfants, rappelDate, montant, statut }) {
  const { data, error } = await supabase
    .from('reservations_natation')
    .insert([{
      membre_id:   membreId,
      jour:        jour,
      heure:       heure,
      date_seance: dateSeance,
      enfants:     enfants || [],
      statut:      statut || 'pending',
      rappel_date: rappelDate || null,
      montant:     montant || 20,
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getReservationsNatation(membreId) {
  const { data, error } = await supabase
    .from('reservations_natation')
    .select('*')
    .eq('membre_id', membreId)
    .order('date_seance', { ascending: true })
  if (error) throw error
  return data || []
}

// ── RÉSERVATIONS CLUB ─────────────────────────────────────
export async function creerReservationClub({ membreId, dateReservation, session, labelJour, rappelDate, enfants, statut }) {
  const { data, error } = await supabase
    .from('reservations_club')
    .insert([{
      membre_id:               membreId,
      date_reservation:        dateReservation,
      session:                 session,
      label_jour:              labelJour,
      statut:                  statut || 'pending',
      rappel_date:             rappelDate || null,
      demi_journees_utilisees: 1,
      enfants:                 enfants || [],
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getReservationsClub(membreId) {
  const { data, error } = await supabase
    .from('reservations_club')
    .select('*')
    .eq('membre_id', membreId)
    .order('date_reservation', { ascending: true })
  if (error) throw error
  return data || []
}

// ── PAIEMENTS ─────────────────────────────────────────────
export async function enregistrerPaiement({ membreId, montant, type, label, transactionWero }) {
  const { data, error } = await supabase
    .from('paiements')
    .insert([{
      membre_id:        membreId || null,
      montant:          montant,
      type:             type,
      label:            label,
      transaction_wero: transactionWero || null,
      statut:           'completed',
    }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getPaiements() {
  const { data, error } = await supabase
    .from('paiements')
    .select('*, membres(prenom, nom)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getTotalPaiements() {
  const { data, error } = await supabase
    .from('paiements')
    .select('montant, type')
    .eq('statut', 'completed')
  if (error) throw error
  return data || []
}

// ── ADMIN ─────────────────────────────────────────────────
export async function getAllMembres() {
  const { data, error } = await supabase
    .from('membres')
    .select('*, enfants(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getAllReservations() {
  const { data, error } = await supabase
    .from('reservations_natation')
    .select('*, membres(prenom, nom, email, tel)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}
