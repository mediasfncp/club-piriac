// src/supabase.js
// Client Supabase pour l'app FNCP

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://rnaosrftcntomehaepjh.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuYW9zcmZ0Y250b21laGFlcGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjgzOTQsImV4cCI6MjA4OTc0NDM5NH0.9y9XK2FG5-o03ICrLTzgan3cBIWrg2wPTuMfFLf_3dY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── MEMBRES ───────────────────────────────────────────────

export async function creerMembre(form) {
  const { data, error } = await supabase
    .from('membres')
    .insert([{
      prenom:           form.prenom,
      nom:              form.nom,
      email:            form.email,
      tel:              form.tel,
      adresse:          form.adresse,
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

export async function creerReservationNatation({ membreId, jour, heure, dateSeance, enfants, rappelDate, montant }) {
  const { data, error } = await supabase
    .from('reservations_natation')
    .insert([{
      membre_id:   membreId,
      jour:        jour,
      heure:       heure,
      date_seance: dateSeance,
      enfants:     enfants || [],
      statut:      'confirmed',
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

export async function creerReservationClub({ membreId, dateReservation, session, labelJour, rappelDate }) {
  const { data, error } = await supabase
    .from('reservations_club')
    .insert([{
      membre_id:             membreId,
      date_reservation:      dateReservation,
      session:               session,
      label_jour:            labelJour,
      statut:                'confirmed',
      rappel_date:           rappelDate || null,
      demi_journees_utilisees: 1,
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

// ── RÉSAS CLUB ────────────────────────────────────────────
export async function getAllReservationsClub() {
  const { data, error } = await supabase
    .from('reservations_club')
    .select('*, membres(prenom, nom, email, tel)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── STATS DASHBOARD ───────────────────────────────────────
export async function getStatsGlobales() {
  const [membres, resaNat, resaClub, paiements] = await Promise.all([
    supabase.from('membres').select('id', { count: 'exact' }),
    supabase.from('reservations_natation').select('id', { count: 'exact' }),
    supabase.from('reservations_club').select('id', { count: 'exact' }),
    supabase.from('paiements').select('montant').eq('statut', 'completed'),
  ])
  return {
    nbMembres: membres.count || 0,
    nbResaNat: resaNat.count || 0,
    nbResaClub: resaClub.count || 0,
    totalEncaisse: (paiements.data || []).reduce((s, p) => s + Number(p.montant), 0),
  }
}
