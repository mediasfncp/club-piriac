import { useState, useEffect } from "react";
import React from "react";
import {
  creerMembre, creerEnfants, getMembre,
  creerReservationNatation, getReservationsNatation,
  creerReservationClub, updateLiberte,
  enregistrerPaiement, getPaiements, getTotalPaiements,
  getAllMembres, getAllReservations,
  supabase as sb,
} from "./supabase";

/* ═══════════════════════════════════════════════════════
   🌊 FNCP – Club de Plage  |  Univers Joyeux Plage & Enfants
   ═══════════════════════════════════════════════════════ */

// Helper — nom toujours en majuscules
const NOM = (n) => (n || "").toUpperCase();

const C = {
  sun:    "#FFD93D",
  sunset: "#FF6B6B",
  coral:  "#FF8E53",
  sea:    "#4ECDC4",
  ocean:  "#1A8FE3",
  deep:   "#0066CC",
  sky:    "#87CEEB",
  sand:   "#FFEAA7",
  shell:  "#FFF9F0",
  green:  "#6BCB77",
  white:  "#FFFFFF",
  dark:   "#2C3E50",
};

// ── SYSTÈME DE RAPPELS ────────────────────────────────────
async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const perm = await Notification.requestPermission();
  return perm === "granted";
}

function scheduleRappel({ titre, corps, dateStr, heure = "20:00" }) {
  // dateStr = "2026-07-07", heure = "20:00"
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = heure.split(":").map(Number);
  const targetTime = new Date(y, m - 1, d, h, min, 0).getTime();
  const delay = targetTime - Date.now();
  if (delay <= 0) return null; // déjà passé
  const timerId = setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(titre, {
        body: corps,
        icon: "https://em-content.zobj.net/source/apple/354/beach-with-umbrella_1f3d6-fe0f.png",
        badge: "https://em-content.zobj.net/source/apple/354/beach-with-umbrella_1f3d6-fe0f.png",
        tag: `fncp-${dateStr}-${titre}`,
      });
    }
  }, delay);
  return { timerId, targetTime, titre, corps };
}

function getRappelDate(dateISO) {
  // Retourne la date de la veille
  const d = new Date(dateISO);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// ── TARIFS CLUB ────────────────────────────────────────
const TARIFS_MATIN = {
  label: "Matin", emoji: "🌅", color: C.coral, horaires: "9h30 – 12h30",
  rows: [
    { label: "1 demi-journée", e1: 15,  e2: 28,  e3: 39,  sup: 11 },
    { label: "1 semaine",      e1: 78,  e2: 144, e3: 198, sup: 54 },
    { label: "2 semaines",     e1: 144, e2: 264, e3: 360, sup: 96 },
    { label: "3 semaines",     e1: 189, e2: 342, e3: 459, sup: 126 },
    { label: "4 semaines",     e1: 216, e2: 384, e3: 504, sup: 144 },
  ],
};
const TARIFS_APMIDI = {
  label: "Après-midi", emoji: "🌊", color: C.ocean, horaires: "14h30 – 18h00",
  rows: [
    { label: "1 demi-journée", e1: 17,  e2: 32,  e3: 45,  sup: 13 },
    { label: "1 semaine",      e1: 90,  e2: 168, e3: 234, sup: 66 },
    { label: "2 semaines",     e1: 168, e2: 312, e3: 432, sup: 120 },
    { label: "3 semaines",     e1: 225, e2: 414, e3: 567, sup: 162 },
    { label: "4 semaines",     e1: 264, e2: 480, e3: 648, sup: 192 },
  ],
};
const TARIFS_JOURNEE = {
  label: "Journée", emoji: "☀️", color: C.green, horaires: "9h30 – 12h30 · 14h30 – 18h00",
  rows: [
    { label: "1 journée",  e1: 25,  e2: 48,  e3: 69,   sup: 21 },
    { label: "1 semaine",  e1: 138, e2: 264, e3: 378,  sup: 114 },
    { label: "2 semaines", e1: 264, e2: 504, e3: 720,  sup: 216 },
    { label: "3 semaines", e1: 369, e2: 702, e3: 999,  sup: 306 },
    { label: "4 semaines", e1: 456, e2: 864, e3: 1224, sup: 384 },
  ],
};
const TARIFS_LIBERTE = [
  { label: "6 demi-journées",  price: 96  },
  { label: "12 demi-journées", price: 180 },
  { label: "18 demi-journées", price: 252 },
  { label: "24 demi-journées", price: 288 },
  { label: "30 demi-journées", price: 330 },
];

const FORMULES_NAT = [
  { id: "f1", label: "1 leçon",   qty: 1,  price: 20,  emoji: "🐠", color: C.sea,   badge: "Découverte" },
  { id: "f2", label: "5 leçons",  qty: 5,  price: 95,  emoji: "🐬", color: C.ocean, badge: "Populaire ⭐", saving: "5€ offerts" },
  { id: "f3", label: "6 leçons",  qty: 6,  price: 113, emoji: "🦈", color: C.coral, badge: "Été complet 🌞", saving: "7€ offerts" },
  { id: "f4", label: "10 leçons", qty: 10, price: 170, emoji: "🌊", color: C.green, badge: "Best value 🏆", saving: "20€ offerts" },
];

const DAYS = [
  { id: "lun7",  label: "Lun", num: "7"  },
  { id: "mar8",  label: "Mar", num: "8"  },
  { id: "mer9",  label: "Mer", num: "9"  },
  { id: "jeu10", label: "Jeu", num: "10" },
  { id: "ven11", label: "Ven", num: "11" },
  { id: "sam12", label: "Sam", num: "12" },
];

function generateSlots() {
  const slots = [];
  let id = 1;
  const addSlots = (startH, startM, endH, endM) => {
    let h = startH, m = startM;
    while (h < endH || (h === endH && m <= endM)) {
      const time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      DAYS.forEach(d => { slots.push({ id: `s${id++}`, day: d.id, time, spots: 2 }); });
      m += 30; if (m >= 60) { h++; m -= 60; }
    }
  };
  addSlots(9, 0, 12, 30);
  addSlots(13, 30, 19, 0);
  return slots;
}
const INIT_SESSIONS = generateSlots();

// ── SAISON COMPLÈTE : tous les jours du 6 juillet au 22 août ──
function buildSeasonDays() {
  const days = [];
  const start = new Date(2026, 6, 6);
  const end   = new Date(2026, 7, 22);
  const cur   = new Date(start);
  const dowLabels = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  const months    = ["jan","fév","mar","avr","mai","jun","juil","août"];
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0) {
      const d = cur.getDate(), m = cur.getMonth();
      const id = `d${d}-${m}`;
      days.push({ id, label: dowLabels[dow], num: String(d), month: months[m], date: new Date(cur) });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
const ALL_SEASON_DAYS = buildSeasonDays();

function generateAllSeasonSlots() {
  const slots = [];
  let id = 10000;
  const addSlots = (dayId, startH, startM, endH, endM) => {
    let h = startH, m = startM;
    while (h < endH || (h === endH && m <= endM)) {
      const time = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      slots.push({ id: `ss${id++}`, day: dayId, time, spots: 2 });
      m += 30; if (m >= 60) { h++; m -= 60; }
    }
  };
  ALL_SEASON_DAYS.forEach(d => {
    addSlots(d.id, 9, 0, 12, 30);
    addSlots(d.id, 13, 30, 19, 0);
  });
  return slots;
}
const ALL_SEASON_SLOTS_INIT = generateAllSeasonSlots();


const ACTIVITY_BY_DOW = {
  1: { label: "Koh Lanta",       emoji: "🏝️", color: C.coral  },
  2: { label: "Béret 🎓",            emoji: "🎓", color: C.ocean  },
  3: { label: "Chasse au trésor 🗺️", emoji: "🗺️", color: C.green  },
  4: { label: "Gamelle 🥣",          emoji: "🥣", color: C.sun    },
  5: { label: "Olympiades 🏅",       emoji: "🏅", color: C.sea    },
  6: { label: "Thèque 🥊",           emoji: "🥊", color: "#9B59B6" },
};


// ── PLANNING SAISON 2026 (6 juillet – 22 août) ────────────
// Structure : [date_iso, m1030, m1130, am1500, am1700]
// m1030 = activité 10h00-10h30, m1130 = 11h30-12h00
// am1500 = activité 15h00-16h00, am1700 = 17h00-17h30
const DAILY_ACTIVITIES = {
  // Semaine 1 : 06-11 juillet
  "2026-07-06": { m1030:"Cerceaux musicaux",      m1130:"Queue du diable",         am1500:"Koh Lanta",                          am1700:"Koh Lanta" },
  "2026-07-07": { m1030:"Initiation Beach Tennis", m1130:"Tomate",                  am1500:"Dodgeball",                          am1700:"Concours de figures au trampoline" },
  "2026-07-08": { m1030:"Horloge",                 m1130:"1, 2, 3 soleil",          am1500:"Chasse au trésor",                   am1700:"Relais Morpion" },
  "2026-07-09": { m1030:"Le facteur",              m1130:"Initiation Beach Tennis", am1500:"Tournoi Ballon capitaine",           am1700:"Mastermind" },
  "2026-07-10": { m1030:"Olympiades Pitch",        m1130:"Olympiades Pitch",        am1500:"Olympiades Pitch",                   am1700:"Olympiades Pitch" },
  "2026-07-11": { m1030:"Chef d'orchestre",        m1130:"Tomate Ketchup",          am1500:"Béret",                              am1700:"Balle assise" },
  // Semaine 2 : 13-18 juillet
  "2026-07-13": { m1030:"Land art",                m1130:"Chasse aux couleurs",     am1500:"Fort Boyard",                        am1700:"Fort Boyard" },
  "2026-07-14": { m1030:"Initiation Beach Tennis", m1130:"Minuit dans la bergerie", am1500:"Balles brulantes",                   am1700:"Poules, renards, vipères" },
  "2026-07-15": { m1030:"Chat perché",             m1130:"Qui suis-je ? Jeux de mimes", am1500:"Chasse au trésor",              am1700:"Le drapeau" },
  "2026-07-16": { m1030:"Déménageurs",             m1130:"Initiation Beach Tennis", am1500:"Boule qui roule",                    am1700:"Concours de figures au trampoline" },
  "2026-07-17": { m1030:"Olympiades Pitch",        m1130:"Olympiades Pitch",        am1500:"Olympiades Pitch",                   am1700:"Olympiades Pitch" },
  "2026-07-18": { m1030:"Chameau Chamois",         m1130:"Poissons Pêcheurs",       am1500:"Balle aux prisonniers",              am1700:"Thèque" },
  // Semaine 3 : 20-25 juillet
  "2026-07-20": { m1030:"Les sorciers",            m1130:"Remplir la maison",       am1500:"Cluedo Géant : Qui a volé la bouée du club ?", am1700:"Cluedo Géant : Qui a volé la bouée du club ?" },
  "2026-07-21": { m1030:"Initiation Beach Tennis", m1130:"Chamboule-tout",          am1500:"Dodgeball",                          am1700:"Ballon couloir" },
  "2026-07-22": { m1030:"Journée Anniversaire 90 ans", m1130:"Journée Anniversaire 90 ans", am1500:"Journée Anniversaire 90 ans", am1700:"Journée Anniversaire 90 ans" },
  "2026-07-23": { m1030:"Dessinez, c'est gagné !",  m1130:"Initiation Beach Tennis", am1500:"Douaniers et contrebandiers",      am1700:"Concours de figures au trampoline" },
  "2026-07-24": { m1030:"Olympiades Pitch",        m1130:"Olympiades Pitch",        am1500:"Olympiades Pitch",                   am1700:"Olympiades Pitch" },
  "2026-07-25": { m1030:"Le slalomeur",            m1130:"Le passage de la rivière",am1500:"Boule qui roule",                    am1700:"Déménageurs" },
  // Semaine 4 : 27 juillet – 01 août
  "2026-07-27": { m1030:"Les jongleurs",           m1130:"Les lapins dans leur terrier", am1500:"Fort Boyard",                   am1700:"Fort Boyard" },
  "2026-07-28": { m1030:"Initiation Beach Tennis", m1130:"Mon ombre me suit",       am1500:"Thèque",                             am1700:"Le drapeau" },
  "2026-07-29": { m1030:"Passer sous le pont",     m1130:"La chaine des pompiers",  am1500:"Chasse au trésor",                   am1700:"Mastermind" },
  "2026-07-30": { m1030:"Les quatre roues de la voiture", m1130:"Initiation Beach Tennis", am1500:"Biathlon",                   am1700:"Tic Tac Toe" },
  "2026-07-31": { m1030:"Olympiades Pitch",        m1130:"Olympiades Pitch",        am1500:"Olympiades Pitch",                   am1700:"Olympiades Pitch" },
  "2026-08-01": { m1030:"Le ballon aux prénoms",   m1130:"Nettoyer la maison",      am1500:"Boule qui roule",                    am1700:"Balle aux prisonniers" },
  // Semaine 5 : 03-08 août
  "2026-08-03": { m1030:"Cerceaux musicaux",       m1130:"Queue du diable",         am1500:"Koh Lanta",                          am1700:"Koh Lanta" },
  "2026-08-04": { m1030:"Initiation Beach Tennis", m1130:"Tomate",                  am1500:"Ballon couloir",                     am1700:"Thèque" },
  "2026-08-05": { m1030:"Horloge",                 m1130:"1, 2, 3 soleil",          am1500:"Chasse au trésor",                   am1700:"Relais Morpion" },
  "2026-08-06": { m1030:"Relais SNCF",             m1130:"Initiation Beach Tennis", am1500:"Tournoi Ballon capitaine",           am1700:"Accroche décroche" },
  "2026-08-07": { m1030:"Olympiades Pitch",        m1130:"Olympiades Pitch",        am1500:"Olympiades Pitch",                   am1700:"Olympiades Pitch" },
  "2026-08-08": { m1030:"Chef d'orchestre",        m1130:"Tomate Ketchup",          am1500:"Béret",                              am1700:"Balle assise" },
  // Semaine 6 : 10-15 août
  "2026-08-10": { m1030:"Passe à cinq",            m1130:"Loup couleur",            am1500:"Fort Boyard",                        am1700:"Fort Boyard" },
  "2026-08-11": { m1030:"Initiation Beach Tennis", m1130:"Minuit dans la bergerie", am1500:"Thèque",                             am1700:"Les trois tapes" },
  "2026-08-12": { m1030:"Journée Anniversaire 90 ans", m1130:"Journée Anniversaire 90 ans", am1500:"Chasse au trésor",          am1700:"Chasse au trésor" },
  "2026-08-13": { m1030:"Déménageurs",             m1130:"Initiation Beach Tennis", am1500:"Mastermind",                         am1700:"Concours de figures au trampoline" },
  "2026-08-14": { m1030:"Olympiades Pitch",        m1130:"Olympiades Pitch",        am1500:"Olympiades Pitch",                   am1700:"Olympiades Pitch" },
  "2026-08-15": { m1030:"Chameau Chamois",         m1130:"Poissons Pêcheurs",       am1500:"Dodgeball",                          am1700:"Roule qui boule" },
  // Semaine 7 : 17-22 août
  "2026-08-17": { m1030:"Parcours de motricité",   m1130:"Relais en pagaille",      am1500:"Koh Lanta",                          am1700:"Koh Lanta" },
  "2026-08-18": { m1030:"Initiation Beach Tennis", m1130:"Queue du diable",         am1500:"Ballon capitaine",                   am1700:"Course en étoile" },
  "2026-08-19": { m1030:"Initiation Yoga",         m1130:"Tomate",                  am1500:"Chasse au trésor",                   am1700:"Béret" },
  "2026-08-20": { m1030:"Epervier",                m1130:"Initiation Beach Tennis", am1500:"Balle au prisonnier",                am1700:"Thèque" },
  "2026-08-21": { m1030:"Olympiades Pitch",        m1130:"Olympiades Pitch",        am1500:"Olympiades Pitch",                   am1700:"Olympiades Pitch" },
  "2026-08-22": { m1030:"Kermesse",                m1130:"Kermesse",                am1500:"Kermesse",                           am1700:"Kermesse" },
};

function buildProgramme() {
  const days = [];
  const start = new Date(2026, 6, 6);
  const end   = new Date(2026, 7, 22);
  const cur = new Date(start);
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const dowNames = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const colors = [C.coral, C.sea, "#9B59B6", C.sun, C.ocean, C.green];

  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0) {
      const iso = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
      const act = DAILY_ACTIVITIES[iso] || { m1030:"—", m1130:"—", am1500:"—", am1700:"—" };
      const color = colors[(cur.getDate() + cur.getMonth()) % colors.length];
      days.push({
        date: new Date(cur),
        dateStr: `${dowNames[dow]} ${cur.getDate()} ${months[cur.getMonth()]}`,
        emoji: "🏖️", color,
        activities: [
          { time: "9h30 – 10h00",  label: "Accueil & Jeux divers" },
          { time: "10h00 – 10h30", label: act.m1030 },
          { time: "10h30 – 11h30", label: "Jeux au bord de l'eau" },
          { time: "11h30 – 12h00", label: act.m1130 },
          { time: "12h00 – 12h30", label: "Jeux libres & Remise des cadeaux" },
          { time: "14h30 – 15h00", label: "Accueil & Jeux divers" },
          { time: "15h00 – 16h00", label: act.am1500 },
          { time: "16h00 – 16h30", label: "Baignade du club" },
          { time: "16h30 – 17h00", label: "Gouter & Jeux libres" },
          { time: "17h00 – 17h30", label: act.am1700 },
          { time: "17h30 – 18h00", label: "Jeux libres & Remise des cadeaux" },
        ],
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
const PROGRAMME = buildProgramme();

// ── RAPPEL BANNER ─────────────────────────────────────────
function RappelBanner({ rappels }) {
  const [perm, setPerm] = useState(typeof Notification !== "undefined" ? Notification.permission : "default");
  const [visible, setVisible] = useState(true);

  if (!visible || rappels.length === 0) return null;

  const handleEnable = async () => {
    const ok = await requestNotifPermission();
    setPerm(ok ? "granted" : "denied");
  };

  if (perm === "denied") return null;

  return (
    <div style={{ background: perm === "granted" ? `${C.green}18` : `${C.sun}30`, border: `1.5px solid ${perm === "granted" ? C.green : C.sun}`, borderRadius: 16, padding: "12px 14px", margin: "12px 0 0", display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>{perm === "granted" ? "🔔" : "🔕"}</div>
      <div style={{ flex: 1 }}>
        {perm === "granted" ? (
          <>
            <div style={{ fontWeight: 900, color: C.green, fontSize: 13 }}>Rappel programmé ✓</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              Tu recevras une notification le {rappels[0]?.rappelDate?.split("-").reverse().join("/")} à 20h00
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 900, color: "#2C3E50", fontSize: 13 }}>Activer les rappels ?</div>
            <div style={{ fontSize: 12, color: "#777", marginTop: 2, marginBottom: 8 }}>
              Reçois une notification la veille de ta séance à 20h00
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleEnable} style={{ background: C.ocean, color: "#fff", border: "none", borderRadius: 50, padding: "6px 14px", fontWeight: 900, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🔔 Activer</button>
              <button onClick={() => setVisible(false)} style={{ background: "none", color: "#aaa", border: "none", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Plus tard</button>
            </div>
          </>
        )}
      </div>
      {perm === "granted" && <button onClick={() => setVisible(false)} style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", fontSize: 16, fontFamily: "inherit" }}>✕</button>}
    </div>
  );
}

// ── Micro components ─────────────────────────────────────
const Pill = ({ children, color }) => (
  <span style={{ background: color + "25", color, border: `2px solid ${color}55`, borderRadius: 30, padding: "2px 12px", fontSize: 11, fontWeight: 900, display: "inline-block" }}>{children}</span>
);
const SunBtn = ({ children, onClick, color = C.ocean, disabled, small, full, style: s }) => (
  <button onClick={disabled ? undefined : onClick} style={{
    background: disabled ? "#e0e0e0" : `linear-gradient(135deg, ${color}, ${color}cc)`,
    color: disabled ? "#aaa" : "#fff", border: "none", borderRadius: 50,
    cursor: disabled ? "not-allowed" : "pointer",
    padding: small ? "9px 22px" : "14px 32px",
    fontSize: small ? 13 : 15, fontWeight: 900,
    boxShadow: disabled ? "none" : `0 6px 18px ${color}55`,
    fontFamily: "inherit", transition: "all .18s", width: full ? "100%" : "auto", letterSpacing: 0.2, ...s,
  }}>{children}</button>
);
const Card = ({ children, style: s, onClick }) => (
  <div onClick={onClick} style={{ background: "#fff", borderRadius: 24, boxShadow: "0 6px 28px rgba(0,102,204,0.10)", padding: 20, cursor: onClick ? "pointer" : "default", ...s }}>{children}</div>
);
const FInput = ({ label, type = "text", value, onChange, placeholder, required }) => (
  <div style={{ marginBottom: 13 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 900, color: C.deep, display: "block", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>
      {label}{required && <span style={{ color: C.sunset }}> ✦</span>}
    </label>}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", border: `2.5px solid ${C.sky}`, borderRadius: 14, padding: "11px 15px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: C.dark, background: "#fafcff" }}
      onFocus={e => e.target.style.borderColor = C.ocean} onBlur={e => e.target.style.borderColor = C.sky} />
  </div>
);
const Wave = ({ fill = C.shell }) => (
  <div style={{ lineHeight: 0, overflow: "hidden" }}>
    <svg viewBox="0 0 1440 56" style={{ width: "100%", display: "block" }}>
      <path d="M0,28 C360,60 720,0 1080,30 C1260,45 1380,15 1440,28 L1440,56 L0,56 Z" fill={fill} />
    </svg>
  </div>
);
const BackBtn = ({ onNav, to }) => (
  <button onClick={() => typeof onNav === "function" && (to ? onNav(to) : onNav("home"))}
    style={{ background: "rgba(255,255,255,0.28)", border: "none", color: "#fff", borderRadius: 50, width: 38, height: 38, fontSize: 18, cursor: "pointer", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>
);

// ── PAYPAL MODAL ──────────────────────────────────────────
// ── WERO MODAL ────────────────────────────────────────────
// Couleurs officielles Wero
const WERO = { main: "#6B2D8B", light: "#8B3DB0", accent: "#E8D5F5", dark: "#4A1D62" };

function WeroModal({ amount, label, onSuccess, onCancel }) {
  const [step, setStep] = useState("form"); // form | processing | success
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handlePay = () => {
    const clean = phone.replace(/\s/g, "");
    if (!clean) { setError("Merci de saisir votre numéro de téléphone."); return; }
    if (!/^(\+33|0)[67]\d{8}$/.test(clean)) { setError("Numéro invalide. Ex : 06 12 34 56 78"); return; }
    setError("");
    setStep("processing");
    setTimeout(() => setStep("success"), 2400);
  };

  const WERO_LOGO = (
    <svg width="72" height="28" viewBox="0 0 120 40" fill="none">
      <rect width="120" height="40" rx="8" fill={WERO.main}/>
      <text x="12" y="28" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="900" fill="#fff" letterSpacing="1">wero</text>
      <circle cx="100" cy="20" r="12" fill={WERO.accent} opacity="0.3"/>
      <circle cx="100" cy="20" r="7" fill="#fff" opacity="0.9"/>
    </svg>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
      <div onClick={step === "processing" ? undefined : onCancel} style={{ position: "absolute", inset: 0, background: "rgba(30,10,50,0.65)", backdropFilter: "blur(6px)" }} />

      <div style={{ position: "relative", width: "100%", maxWidth: 430, background: "#fff", borderRadius: "28px 28px 0 0", boxShadow: "0 -12px 48px rgba(0,0,0,0.3)", overflow: "hidden" }}>

        {/* Processing */}
        {step === "processing" && (
          <div style={{ padding: "44px 24px", textAlign: "center" }}>
            <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${WERO.main}, ${WERO.light})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 36 }}>💸</div>
            <div style={{ fontWeight: 900, color: WERO.main, fontSize: 18, marginBottom: 8 }}>Envoi en cours…</div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Connexion sécurisée Wero</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: WERO.main, animation: `pulse 1s ${i*0.3}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {/* Success */}
        {step === "success" && (
          <div style={{ padding: "44px 24px", textAlign: "center" }}>
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: `linear-gradient(135deg, ${WERO.main}, ${WERO.light})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, margin: "0 auto 18px" }}>✓</div>
            <div style={{ fontWeight: 900, color: WERO.main, fontSize: 22, marginBottom: 6 }}>Paiement reçu !</div>
            <div style={{ fontSize: 15, color: "#555", marginBottom: 4 }}><strong>{amount} €</strong> via Wero</div>
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 28 }}>{label}</div>
            <button onClick={onSuccess} style={{ background: `linear-gradient(135deg, ${WERO.main}, ${WERO.light})`, color: "#fff", border: "none", borderRadius: 50, padding: "14px 40px", fontWeight: 900, fontSize: 16, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 6px 20px ${WERO.main}55` }}>
              Accéder à ma réservation →
            </button>
          </div>
        )}

        {/* Form */}
        {step === "form" && (
          <>
            {/* Header Wero */}
            <div style={{ background: `linear-gradient(135deg, ${WERO.dark}, ${WERO.main}, ${WERO.light})`, padding: "20px 24px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ color: "#fff", fontWeight: 900, fontSize: 26, letterSpacing: 1 }}>wero</div>
                <button onClick={onCancel} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontWeight: 900, fontSize: 16, fontFamily: "inherit" }}>✕</button>
              </div>
              {/* Montant */}
              <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 16, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 2 }}>Montant</div>
                  <div style={{ color: "#fff", fontWeight: 900, fontSize: 28, lineHeight: 1 }}>{amount} €</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>FNCP · Club de Plage</div>
                  <div style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 700, marginTop: 2 }}>{label}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: "22px 24px 28px" }}>
              {/* Info Wero */}
              <div style={{ background: WERO.accent, borderRadius: 14, padding: "12px 14px", marginBottom: 18, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontSize: 20, flexShrink: 0 }}>💜</div>
                <div style={{ fontSize: 12, color: WERO.dark, lineHeight: 1.6 }}>
                  <strong>Paiement via Wero</strong> — disponible dans votre application bancaire (BNP, Société Générale, Crédit Agricole, LCL, La Banque Postale…)
                </div>
              </div>

              {/* Téléphone */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 900, color: WERO.main, display: "block", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  📱 Votre numéro de téléphone
                </label>
                <input
                  type="tel" value={phone}
                  onChange={e => { setPhone(e.target.value); setError(""); }}
                  placeholder="06 12 34 56 78"
                  style={{ width: "100%", border: `2px solid ${error ? "#e74c3c" : "#e0d5f0"}`, borderRadius: 14, padding: "13px 16px", fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: "#2C3E50", background: "#FDFBFF", letterSpacing: 1 }}
                  onFocus={e => e.target.style.borderColor = WERO.main}
                  onBlur={e => e.target.style.borderColor = error ? "#e74c3c" : "#e0d5f0"}
                />
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 5 }}>Le numéro associé à votre compte Wero</div>
              </div>

              {error && (
                <div style={{ background: "#fff0f0", border: "1.5px solid #fca5a5", borderRadius: 10, padding: "9px 14px", fontSize: 13, color: "#e74c3c", fontWeight: 700, marginBottom: 14 }}>⚠️ {error}</div>
              )}

              {/* Pay button */}
              <button onClick={handlePay} style={{
                width: "100%", background: `linear-gradient(135deg, ${WERO.dark}, ${WERO.main})`,
                color: "#fff", border: "none", borderRadius: 50, padding: "16px",
                fontWeight: 900, fontSize: 16, cursor: "pointer", fontFamily: "inherit",
                boxShadow: `0 6px 20px ${WERO.main}55`, marginBottom: 14,
              }}>
                💜 Payer {amount} € avec Wero
              </button>

              <div style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginBottom: 6 }}>
                🔒 Paiement sécurisé · Données chiffrées
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#bbb" }}>
                En payant, vous acceptez nos <span style={{ color: WERO.main }}>CGV</span>.<br/>
                <span style={{ color: C.sunset, fontWeight: 700 }}>Aucun remboursement sauf attestation médicale.</span>
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
      `}</style>
    </div>
  );
}

// ── PROGRAMME MODAL ───────────────────────────────────────
function ProgrammeModal({ onClose }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const futureDays = PROGRAMME.filter(p => { const d = new Date(p.date); d.setHours(0,0,0,0); return d >= today; });
  function getWeekKey(date) {
    const d = new Date(date), day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1), mon = new Date(d);
    mon.setDate(diff); return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
  }
  const weeksMap = {};
  futureDays.forEach(p => { const k = getWeekKey(p.date); if (!weeksMap[k]) weeksMap[k] = []; weeksMap[k].push(p); });
  const weeks = Object.keys(weeksMap).sort().map(k => weeksMap[k]);
  const [weekIdx, setWeekIdx] = useState(0);
  const [dayIdx, setDayIdx] = useState(0);
  if (futureDays.length === 0) return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", flexDirection: "column" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,40,80,0.55)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", marginTop: "auto", background: C.shell, borderRadius: "28px 28px 0 0", padding: 32, textAlign: "center" }}>
        <p style={{ color: "#888" }}>La saison est terminée. À l'été prochain !</p>
        <button onClick={onClose} style={{ background: C.coral, color: "#fff", border: "none", borderRadius: 50, padding: "12px 28px", fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>Fermer</button>
      </div>
    </div>
  );
  const currentWeek = weeks[Math.min(weekIdx, weeks.length-1)] || [];
  const safeDay = Math.min(dayIdx, currentWeek.length-1);
  const prog = currentWeek[safeDay];
  const months = ["jan","fév","mar","avr","mai","jun","juil","août"];
  const weekLabel = currentWeek.length > 0
    ? `${currentWeek[0].date.getDate()} ${months[currentWeek[0].date.getMonth()]} – ${currentWeek[currentWeek.length-1].date.getDate()} ${months[currentWeek[currentWeek.length-1].date.getMonth()]} 2026`
    : "";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", flexDirection: "column" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,40,80,0.55)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", marginTop: "auto", background: C.shell, borderRadius: "28px 28px 0 0", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 -12px 48px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}><div style={{ width: 40, height: 5, borderRadius: 10, background: "#ddd" }} /></div>
        <div style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.sun})`, margin: "0 16px", borderRadius: 20, padding: "14px 16px", marginBottom: 12, position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 10, right: 10, background: "rgba(255,255,255,0.3)", border: "none", color: "#fff", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontWeight: 900, fontSize: 16 }}>✕</button>
          <div style={{ fontSize: 28, marginBottom: 2 }}>🏖️</div>
          <div style={{ fontWeight: 900, color: "#fff", fontSize: 17 }}>Programme Club de Plage</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button onClick={() => { setWeekIdx(Math.max(0,weekIdx-1)); setDayIdx(0); }} disabled={weekIdx===0}
              style={{ background:"rgba(255,255,255,0.25)",border:"none",color:"#fff",borderRadius:"50%",width:28,height:28,fontWeight:900,cursor:weekIdx===0?"not-allowed":"pointer",opacity:weekIdx===0?0.4:1,fontFamily:"inherit" }}>‹</button>
            <div style={{ flex:1, textAlign:"center", color:"rgba(255,255,255,0.9)", fontSize:12, fontWeight:700 }}>Semaine du {weekLabel}</div>
            <button onClick={() => { setWeekIdx(Math.min(weeks.length-1,weekIdx+1)); setDayIdx(0); }} disabled={weekIdx>=weeks.length-1}
              style={{ background:"rgba(255,255,255,0.25)",border:"none",color:"#fff",borderRadius:"50%",width:28,height:28,fontWeight:900,cursor:weekIdx>=weeks.length-1?"not-allowed":"pointer",opacity:weekIdx>=weeks.length-1?0.4:1,fontFamily:"inherit" }}>›</button>
          </div>
        </div>
        <div style={{ display:"flex",gap:6,overflowX:"auto",padding:"0 16px 10px" }}>
          {currentWeek.map((p,i) => (
            <button key={i} onClick={() => setDayIdx(i)} style={{ background:safeDay===i?p.color:"#f0f0f0", color:safeDay===i?"#fff":"#888", border:`2px solid ${p.date.toDateString()===new Date().toDateString()?p.color:"transparent"}`, borderRadius:14, padding:"7px 12px", cursor:"pointer", fontWeight:900, fontFamily:"inherit", fontSize:11, whiteSpace:"nowrap", transition:"all .15s" }}>
              {p.emoji} {p.dateStr.split(" ").slice(0,2).join(" ")}
            </button>
          ))}
        </div>
        {prog && (
          <div style={{ overflowY:"auto",padding:"0 16px 24px" }}>
            <div style={{ background:prog.color+"15",border:`2px solid ${prog.color}40`,borderRadius:20,padding:16 }}>
              <div style={{ fontWeight:900,color:prog.color,fontSize:15,marginBottom:14 }}>{prog.emoji} {prog.dateStr}</div>
              {(() => {
                const morning = prog.activities.filter(a => {
                  const h = parseInt(a.time.split("h")[0]);
                  return h < 13;
                });
                const afternoon = prog.activities.filter(a => {
                  const h = parseInt(a.time.split("h")[0]);
                  return h >= 13;
                });
                return (
                  <>
                    {morning.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ height: 1.5, flex: 1, background: `${prog.color}40` }} />
                          <span style={{ fontSize: 11, fontWeight: 900, color: prog.color, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>☀️ Matin</span>
                          <div style={{ height: 1.5, flex: 1, background: `${prog.color}40` }} />
                        </div>
                        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                          {morning.map((a,i) => (
                            <div key={i} style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                              <div style={{ background:prog.color,color:"#fff",borderRadius:10,padding:"4px 10px",fontSize:11,fontWeight:900,whiteSpace:"nowrap",flexShrink:0,marginTop:2 }}>{a.time}</div>
                              <div style={{ fontWeight:800,color:C.dark,fontSize:14 }}>{a.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {afternoon.length > 0 && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ height: 1.5, flex: 1, background: `${prog.color}40` }} />
                          <span style={{ fontSize: 11, fontWeight: 900, color: prog.color, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap" }}>🌊 Après-midi</span>
                          <div style={{ height: 1.5, flex: 1, background: `${prog.color}40` }} />
                        </div>
                        <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                          {afternoon.map((a,i) => (
                            <div key={i} style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
                              <div style={{ background:prog.color,color:"#fff",borderRadius:10,padding:"4px 10px",fontSize:11,fontWeight:900,whiteSpace:"nowrap",flexShrink:0,marginTop:2 }}>{a.time}</div>
                              <div style={{ fontWeight:800,color:C.dark,fontSize:14 }}>{a.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
            <div style={{ marginTop:12,background:`${C.sky}25`,borderRadius:16,padding:"10px 14px",fontSize:12,color:"#666" }}>
              ⚠️ Programme indicatif, susceptible d'être modifié selon météo · Encadrement par moniteurs diplômés
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── HOME ─────────────────────────────────────────────────
function HomeScreen({ onNav, user }) {
  const [showProg, setShowProg] = useState(false);
  return (
    <div style={{ background: C.shell, minHeight: "100%" }}>
      {showProg && <ProgrammeModal onClose={() => setShowProg(false)} />}
      <div style={{ background: "linear-gradient(160deg, #0099FF 0%, #00C9FF 55%, #4ECDC4 100%)", padding: "36px 22px 0", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{ display: "inline-block", background: "rgba(255,255,255,0.22)", backdropFilter: "blur(8px)", borderRadius: 50, padding: "4px 20px", marginBottom: 10, border: "2px solid rgba(255,255,255,0.4)" }}>
            <span style={{ color: "#fff", fontSize: 14, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>PIRIAC SUR MER</span>
          </div>
          <h1 style={{ color: "#fff", fontSize: 29, margin: "6px 0 2px", fontWeight: 900, textShadow: "0 3px 14px rgba(0,0,0,0.22)", letterSpacing: -0.5 }}>Eole Beach Club</h1>
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, margin: "0 0 2px", fontWeight: 700 }}>
            {user ? `Bonjour ${user.prenom} 👋` : "Club de plage · Ecole de natation · Soleil pour tous !"}
          </p>
          {user && <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, margin: "0 0 6px", fontWeight: 600 }}>Prêt pour passer un été incroyable ? ☀️</p>}
        </div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding: "6px 18px 24px" }}>
        {!user && (
          <Card style={{ marginBottom: 16, marginTop: 16, padding: "16px 16px", background: "linear-gradient(135deg, #FFF3CD, #FFE8B0)", border: `3px dashed ${C.sun}`, textAlign: "center" }}>
            <h3 style={{ color: C.dark, margin: "0 0 6px", fontSize: 18 }}>Nouveau au club ?</h3>
            <p style={{ color: "#777", fontSize: 13, margin: "0 0 14px" }}>Inscris-toi et plonge dans l'aventure !</p>
            <SunBtn color={C.coral} onClick={() => onNav("inscription")}>📋 S'inscrire maintenant</SunBtn>
          </Card>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 13 }}>
          {[
            { screen: "formules",         emoji: "🎫", label: "Formules",              sub: "Club · Natation",           bg: `linear-gradient(135deg, #00C9FF, ${C.ocean})`,    sh: C.ocean },
            { screen: "reservation",      emoji: "🏊", label: "École Natation",         sub: "Dès 4 ans · Créneaux 30 min", bg: `linear-gradient(135deg, ${C.sea}, #00B09B)`,     sh: C.sea   },
            { screen: "prestations",      emoji: "🏖️", label: "Club de Plage",        sub: "3 à 12 ans · Matin / AM", bg: `linear-gradient(135deg, ${C.coral}, ${C.sunset})`, sh: C.coral },
            { screen: "mes-reservations", emoji: "🎫", label: "Mes accès",             sub: "Saison 2026",                 bg: `linear-gradient(135deg, ${C.green}, #27AE60)`,    sh: C.green },
          ].map(item => (
            <div key={item.screen} onClick={() => onNav(item.screen)}
              style={{ background: item.bg, borderRadius: 22, padding: "20px 14px", cursor: "pointer", boxShadow: `0 8px 22px ${item.sh}44`, transition: "transform .18s", textAlign: "center" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
              onMouseLeave={e => e.currentTarget.style.transform = ""}
            >
              <div style={{ fontSize: 38, marginBottom: 8 }}>{item.emoji}</div>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: 13 }}>{item.label}</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 3 }}>{item.sub}</div>
            </div>
          ))}
        </div>
        <Card onClick={() => onNav("infos")} style={{ textAlign: "center", padding: 16, marginBottom: 13 }}>
          <div style={{ fontSize: 32 }}>ℹ️</div>
          <div style={{ fontWeight: 900, color: C.deep, fontSize: 13, marginTop: 6 }}>Infos Club</div>
          <div style={{ fontSize: 11, color: "#aaa" }}>Horaires · Règlement · Contact</div>
        </Card>
        <div onClick={() => setShowProg(true)} style={{ background: `linear-gradient(135deg, ${C.sun}, ${C.coral})`, borderRadius: 20, padding: "13px 20px", textAlign: "center", boxShadow: `0 6px 20px ${C.sun}66`, cursor: "pointer" }}>
          <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>☀️ Été 2026 · Voir le programme d'activités</span>
        </div>
      </div>
    </div>
  );
}

// ── FORMULES CHOIX ────────────────────────────────────────
function FormulesChoixScreen({ onNav }) {
  return (
    <div style={{ background: C.shell, minHeight: "100%" }}>
      <div style={{ background: `linear-gradient(135deg, #00C9FF, ${C.sea})`, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <BackBtn onNav={onNav} />
          <div>
            <h2 style={{ color: "#fff", margin: 0, fontWeight: 900, fontSize: 22 }}>🎫 Formules</h2>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>Choisir une activité</p>
          </div>
        </div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding: "16px 18px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div onClick={() => onNav("formules-natation")} style={{
          background: `linear-gradient(135deg, ${C.ocean}, ${C.sea})`,
          borderRadius: 20, padding: "16px 20px", cursor: "pointer",
          boxShadow: `0 6px 20px ${C.ocean}44`,
          transition: "transform .18s", display: "flex", alignItems: "center", gap: 16,
        }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = ""}
        >
          <div style={{ fontSize: 36, flexShrink: 0 }}>🏊</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 16, marginBottom: 2 }}>Formules Natation</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>1, 5, 6 ou 10 leçons</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {["20 €", "95 €", "113 €", "170 €"].map(p => (
                <div key={p} style={{ background: "rgba(255,255,255,0.2)", borderRadius: 50, padding: "3px 10px", color: "#fff", fontSize: 11, fontWeight: 800 }}>{p}</div>
              ))}
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 20 }}>›</div>
        </div>

        <div onClick={() => onNav("prestations")} style={{
          background: `linear-gradient(135deg, ${C.coral}, ${C.sun})`,
          borderRadius: 20, padding: "16px 20px", cursor: "pointer",
          boxShadow: `0 6px 20px ${C.coral}44`,
          transition: "transform .18s", display: "flex", alignItems: "center", gap: 16,
        }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = ""}
        >
          <div style={{ fontSize: 36, flexShrink: 0 }}>🏖️</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 16, marginBottom: 2 }}>Formules Club de Plage</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Matin · Après-midi · Journée</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {["🏖️ Formule Club", "🎟️ Formule Liberté"].map(p => (
                <div key={p} style={{ background: "rgba(255,255,255,0.2)", borderRadius: 50, padding: "3px 10px", color: "#fff", fontSize: 11, fontWeight: 800 }}>{p}</div>
              ))}
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 20 }}>›</div>
        </div>

        <div onClick={() => onNav("formules-eveil")} style={{
          background: `linear-gradient(135deg, #9B59B6, #8E44AD)`,
          borderRadius: 20, padding: "16px 20px", cursor: "pointer",
          boxShadow: `0 6px 20px #9B59B644`,
          transition: "transform .18s", display: "flex", alignItems: "center", gap: 16,
        }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={e => e.currentTarget.style.transform = ""}
        >
          <div style={{ fontSize: 36, flexShrink: 0 }}>🌊</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 16, marginBottom: 2 }}>Éveil Aquatique</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>2 à 5 ans · Séances 30 min · Chaque dimanche</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 50, padding: "3px 12px", color: "#fff", fontSize: 11, fontWeight: 900 }}>20 € / séance</div>
            </div>
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 20 }}>›</div>
        </div>
      </div>
    </div>
  );
}

// ── FORMULES ÉVEIL AQUATIQUE ──────────────────────────────
// Generate all Sundays between 6 July and 22 August 2026
function buildEveilSundays() {
  const sundays = [];
  const start = new Date(2026, 6, 6);  // 6 juillet (dimanche)
  const end   = new Date(2026, 7, 22); // 22 août
  const months = ["jan","fév","mar","avr","mai","jun","juil","août"];
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() === 0) {
      const label = `Dimanche ${cur.getDate()} ${months[cur.getMonth()]}`;
      sundays.push({
        id: `dim-${cur.getDate()}-${cur.getMonth()}`,
        label,
        date: new Date(cur),
        slots: [
          { id: `dim-${cur.getDate()}-${cur.getMonth()}-1`, time: "10h00 – 10h30", spots: 4 },
          { id: `dim-${cur.getDate()}-${cur.getMonth()}-2`, time: "10h45 – 11h15", spots: 4 },
          { id: `dim-${cur.getDate()}-${cur.getMonth()}-3`, time: "11h30 – 12h00", spots: 4 },
        ],
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return sundays;
}

function FormulesEveilScreen({ onNav, user, panier, setPanier }) {
  const [eveilSundays, setEveilSundays] = useState(() => buildEveilSundays());
  const [selectedSunday, setSelectedSunday] = useState(0);
  const [booking, setBooking]         = useState(null);
  const [done, setDone]               = useState(null);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [enfantsDB, setEnfantsDB]     = useState([]);

  useEffect(() => {
    if (user?.supabaseId) {
      sb.from("enfants").select("*").eq("membre_id", user.supabaseId)
        .then(({ data }) => setEnfantsDB(data || [])).catch(() => {});
    }
  }, [user?.supabaseId]);

  const enfantsEveil = (enfantsDB.length > 0 ? enfantsDB : (user?.enfants || []))
    .filter(e => {
      const age = calcAge(e.naissance);
      return age >= 2 && age <= 5;
    });

  // 🔒 Gate inscription
  if (!user) return (
    <div style={{ background: C.shell, minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ background: `linear-gradient(135deg, #9B59B6, #8E44AD)`, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <BackBtn onNav={onNav} to="formules" />
          <h2 style={{ color: "#fff", margin: 0, fontWeight: 900, fontSize: 20 }}>🌊 Éveil Aquatique</h2>
        </div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🔒</div>
        <h2 style={{ color: C.dark, fontSize: 22, margin: "0 0 10px" }}>Inscription requise</h2>
        <p style={{ color: "#777", fontSize: 15, margin: "0 0 28px", lineHeight: 1.6 }}>
          Pour réserver une séance d'éveil aquatique, tu dois d'abord t'inscrire au Eole Beach Club.
        </p>
        <SunBtn color={C.coral} onClick={() => onNav("inscription")} style={{ marginBottom: 14 }}>📋 S'inscrire maintenant</SunBtn>
        <button onClick={() => onNav("home")} style={{ background: "none", border: "none", color: "#aaa", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>← Retour à l'accueil</button>
      </div>
    </div>
  );

  const handleBook = (sundayIdx, slotId) => {
    setBooking({ sundayIdx, slotId });
  };

  const confirmBook = async () => {
    setEveilSundays(prev => prev.map((sun, si) =>
      si === booking.sundayIdx
        ? { ...sun, slots: sun.slots.map(sl => sl.id === booking.slotId ? { ...sl, spots: Math.max(0, sl.spots - 1) } : sl) }
        : sun
    ));
    const sun = eveilSundays[booking.sundayIdx];
    const sl = sun.slots.find(s => s.id === booking.slotId);
    const resaDate = new Date(sun.date);
    const resaDateISO = `${resaDate.getFullYear()}-${String(resaDate.getMonth()+1).padStart(2,"0")}-${String(resaDate.getDate()).padStart(2,"0")}`;
    const rappelDate = getRappelDate(resaDateISO);
    scheduleRappel({ titre:"🌊 Rappel Éveil Aquatique demain !", corps:`Séance d'éveil aquatique demain à ${sl.time}. N'oublie pas !`, dateStr: rappelDate });
    try {
      if (user?.supabaseId) {
        await sb.from("reservations_natation").insert([{ membre_id: user.supabaseId, heure: sl.time, date_seance: resaDateISO, enfants: selectedEnfant ? [selectedEnfant] : [], statut: "pending", montant: 20 }]);
      }
    } catch(e) { console.warn(e); }
    setDone({ sunday: sun.label, slot: sl.time, rappelDate, enfant: selectedEnfant });
    setBooking(null);
  };

  if (done) return (
    <div style={{ padding:32, textAlign:"center", background:C.shell, minHeight:"100%" }}>
      <div style={{ fontSize:80 }}>📨</div>
      <h2 style={{ color:"#9B59B6" }}>Demande envoyée ! 🎉</h2>
      <div style={{ background:"#fff", borderRadius:20, padding:20, margin:"16px 0", boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
        <p style={{ color:"#666", fontSize:14, lineHeight:1.8 }}>
          🌊 Éveil Aquatique · <strong>{done.sunday}</strong> à {done.slot}{done.enfant ? ` · pour ${done.enfant}` : ""}<br/>
          L'équipe Eole Beach Club vous contactera pour le paiement.<br/>
          🏦 Virement · ✉️ Chèque · 💶 Espèces · 🎫 Chèques vacances
        </p>
        <div style={{ background:"#F3E8FF", borderRadius:12, padding:"10px 14px", fontSize:13, color:"#9B59B6", fontWeight:700 }}>
          ⏳ Votre accès sera activé à réception du paiement
        </div>
      </div>
      <SunBtn color="#9B59B6" onClick={() => { setDone(null); onNav("home"); }}>Retour à l'accueil</SunBtn>
    </div>
  );

  if (booking !== null) {
    const sun = eveilSundays[booking.sundayIdx];
    const sl = sun.slots.find(s => s.id === booking.slotId);
    return (
      <div style={{ background: C.shell, minHeight: "100%" }}>
        <div style={{ background: `linear-gradient(135deg, #9B59B6, #8E44AD)`, padding: "20px 20px 0", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <BackBtn onNav={() => setBooking(null)} />
            <div style={{ flex: 1, color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: 700 }}>🌊 Confirmer la réservation</div>
          </div>
          <div style={{ fontSize: 44, fontWeight: 900, color: "#fff", margin: "8px 0 4px" }}>{sl.time}</div>
          <div style={{ color: "#e8d0ff", fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{sun.label} ☀️</div>
          <Wave fill={C.shell} />
        </div>
        <div style={{ padding: "16px 18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            <h3 style={{ color: C.dark, margin: "0 0 10px", fontSize: 15 }}>👤 Parent / Responsable</h3>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 14 }}>
              <span style={{ color: "#aaa" }}>Nom</span><strong>{user?.prenom} {NOM(user?.nom)}</strong>
              <span style={{ color: "#aaa" }}>Email</span><span>{user?.email || "—"}</span>
              <span style={{ color: "#aaa" }}>Tél.</span><span>{user?.tel || "—"}</span>
            </div>
          </div>

          {/* Sélection enfant nominatif */}
          {enfantsEveil.length > 0 ? (
            <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ fontWeight:800, color:C.dark, fontSize:14, marginBottom:10 }}>🌊 Pour quel enfant ?</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {enfantsEveil.map(e => {
                  const sel = selectedEnfant === e.prenom;
                  return (
                    <div key={e.prenom} onClick={() => setSelectedEnfant(sel ? null : e.prenom)} style={{
                      background: sel ? "linear-gradient(135deg,#9B59B6,#8E44AD)" : "#F0F4F8",
                      color: sel ? "#fff" : "#888",
                      borderRadius:50, padding:"9px 20px", cursor:"pointer",
                      fontWeight:800, fontSize:14, transition:"all .15s",
                      boxShadow: sel ? "0 4px 12px #9B59B644" : "none",
                    }}>
                      {sel ? "✓ " : ""}{e.prenom}
                    </div>
                  );
                })}
              </div>
              {selectedEnfant && (
                <div style={{ fontSize:12, color:"#9B59B6", marginTop:8, fontWeight:700 }}>✓ Séance nominative pour {selectedEnfant}</div>
              )}
            </div>
          ) : (
            <div style={{ background:`${C.sunset}10`, border:`2px solid ${C.sunset}30`, borderRadius:16, padding:"14px 18px" }}>
              <div style={{ fontWeight:900, color:C.sunset, fontSize:13, marginBottom:4 }}>⚠️ Aucun enfant éligible</div>
              <div style={{ fontSize:12, color:"#777" }}>L'éveil aquatique est réservé aux enfants de 2 à 5 ans. Vérifiez les dates de naissance dans votre profil.</div>
            </div>
          )}
          <div style={{ background: "#F3E8FF", border: "2px solid #9B59B640", borderRadius: 16, padding: "14px 18px" }}>
            <div style={{ fontWeight: 900, color: "#9B59B6", marginBottom: 4 }}>💰 Tarif : 20 €</div>
            <div style={{ fontSize: 13, color: "#777" }}>1 séance d'éveil aquatique · 30 min</div>
          </div>
          <div style={{ background:"#F8FBFF", borderRadius:14, padding:"12px 14px", marginBottom:8 }}>
            <div style={{ fontWeight:900, color:C.dark, fontSize:12, marginBottom:8 }}>💳 Modes de paiement acceptés</div>
            {[["🏦","Virement bancaire"],["✉️","Chèque"],["💶","Espèces"],["🎫","Chèques vacances"]].map(([icon,label]) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, fontSize:12, color:"#555" }}>
                <span>{icon}</span>{label}
              </div>
            ))}
            <div style={{ fontSize:11, color:"#aaa", marginTop:6, fontStyle:"italic" }}>Votre accès sera activé à réception du paiement.</div>
          </div>
          {/* Bouton ajouter au panier - enfant obligatoire */}
          {enfantsEveil.length === 0 ? (
            <div style={{ background:`${C.sunset}10`, border:`2px solid ${C.sunset}30`, borderRadius:12, padding:"10px 14px", fontSize:13, color:"#c0392b", fontWeight:700, textAlign:"center" }}>
              ⚠️ Aucun enfant éligible (2-5 ans). Vérifiez les dates de naissance dans votre profil.
            </div>
          ) : !selectedEnfant ? (
            <div style={{ background:"#FFF9F0", border:"1.5px solid #FFD93D", borderRadius:12, padding:"10px 14px", fontSize:13, color:"#b45309", fontWeight:700, textAlign:"center" }}>
              👆 Sélectionnez un enfant pour continuer
            </div>
          ) : (
            <button onClick={async () => {
              // Basculer l'enfant sur "les deux" si nécessaire
              const enf = enfantsEveil.find(e => e.prenom === selectedEnfant);
              if (enf && enf.activite === "club" && enf.id) {
                try { await sb.from("enfants").update({ activite: "les deux" }).eq("id", enf.id); }
                catch(e) { console.warn(e); }
              }
              const sun = eveilSundays[booking.sundayIdx];
              const sl = sun.slots.find(s => s.id === booking.slotId);
              setPanier(prev => [...prev, {
                id: `eveil-${Date.now()}`,
                type: "eveil",
                label: `Éveil Aquatique · ${sun.label} ${sl.time}`,
                emoji: "🌊",
                color: "#9B59B6",
                prix: 20,
                enfant: selectedEnfant,
                heure: sl.time,
                date: (() => { const d = new Date(sun.date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })(),
                jour: sun.label,
                details: `${sun.label} à ${sl.time}`,
              }]);
              onNav("panier");
              setBooking(null);
            }} style={{ width:"100%", background:`linear-gradient(135deg,${C.sun},${C.coral})`, border:"none", color:"#fff", borderRadius:14, padding:"12px", cursor:"pointer", fontWeight:900, fontSize:14, fontFamily:"inherit", marginBottom:8 }}>
              🛒 Ajouter au panier · {selectedEnfant}
            </button>
          )}
          <SunBtn color={!selectedEnfant ? "#bbb" : "#9B59B6"} full
            onClick={() => { if (!selectedEnfant) return; confirmBook(); }}>
            {!selectedEnfant ? (enfantsEveil.length === 0 ? "⚠️ Aucun enfant 2-5 ans" : "👆 Sélectionnez un enfant") : "📨 Envoyer la demande · 20 €"}
          </SunBtn>
        </div>
      </div>
    );
  }

  const sun = eveilSundays[selectedSunday];
  const spotColor = n => n === 0 ? C.sunset : n <= 1 ? C.coral : n <= 2 ? "#FF9500" : C.green;
  const spotLabel = n => n === 0 ? "🔴 Complet" : n === 1 ? "🟡 1 place" : n === 2 ? "🟠 2 places" : n === 3 ? "🟢 3 places" : "🟢 4 places";

  return (
    <div style={{ background: C.shell, minHeight: "100%" }}>
      <div style={{ background: `linear-gradient(135deg, #9B59B6, #8E44AD)`, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <BackBtn onNav={onNav} to="formules" />
          <div>
            <h2 style={{ color: "#fff", margin: 0, fontWeight: 900, fontSize: 20 }}>🌊 Éveil Aquatique</h2>
            <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>Dimanche matin · 30 min · 20 € · 4 places max</p>
          </div>
        </div>
        {/* Sunday selector */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {eveilSundays.map((s, i) => {
            const totalSpots = s.slots.reduce((acc, sl) => acc + sl.spots, 0);
            return (
              <button key={s.id} onClick={() => setSelectedSunday(i)} style={{
                background: selectedSunday === i ? "#fff" : "rgba(255,255,255,0.25)",
                color: selectedSunday === i ? "#9B59B6" : "#fff",
                border: "none", borderRadius: 16, padding: "8px 12px",
                cursor: "pointer", fontWeight: 800, fontFamily: "inherit",
                minWidth: 68, textAlign: "center", transition: "all .15s",
                boxShadow: selectedSunday === i ? "0 4px 14px rgba(0,0,0,0.15)" : "none",
                flexShrink: 0,
              }}>
                <div style={{ fontSize: 10 }}>Dim.</div>
                <div style={{ fontSize: 16, fontWeight: 900 }}>{s.date.getDate()}</div>
                <div style={{ fontSize: 9, marginTop: 1, color: selectedSunday === i ? (totalSpots > 0 ? "#6BCB77" : C.sunset) : "rgba(255,255,255,0.7)" }}>
                  {totalSpots > 0 ? `${totalSpots} pl.` : "Complet"}
                </div>
              </button>
            );
          })}
        </div>
        <Wave fill={C.shell} />
      </div>

      <div style={{ padding: "12px 18px 24px" }}>
        {/* Info banner */}
        <div style={{ background: "#F3E8FF", border: "2px solid #9B59B640", borderRadius: 18, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 28 }}>🌊</div>
          <div>
            <div style={{ fontWeight: 900, color: "#9B59B6", fontSize: 14 }}>{sun.label}</div>
            <div style={{ fontSize: 12, color: "#888" }}>Sous réserve d'avoir plusieurs enfants · 20 € / séance</div>
          </div>
        </div>

        {/* Slots */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sun.slots.filter(sl => sl.spots > 0).map(sl => (
            <div key={sl.id} style={{
              background: "#fff",
              borderRadius: 18, padding: "14px 18px",
              boxShadow: "0 3px 12px rgba(155,89,182,0.10)",
              border: `2px solid ${sl.spots <= 1 ? C.coral+"50" : "#9B59B630"}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: "linear-gradient(135deg, #9B59B6, #8E44AD)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🌊</div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 17, color: C.dark }}>{sl.time}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: spotColor(sl.spots) }}>{spotLabel(sl.spots)}</div>
                </div>
              </div>
              <button onClick={() => handleBook(selectedSunday, sl.id)} style={{ background: "linear-gradient(135deg, #9B59B6, #8E44AD)", color: "#fff", border: "none", borderRadius: 50, padding: "9px 20px", fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 14px #9B59B644" }}>Réserver</button>
            </div>
          ))}
          {sun.slots.every(sl => sl.spots === 0) && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>🔴</div>
              <div style={{ fontWeight: 900, color: C.sunset, fontSize: 16 }}>Tous les créneaux sont complets</div>
              <div style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>Essayez un autre dimanche</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FORMULES NATATION ─────────────────────────────────────
function FormulesNatationScreen({ onNav, user, allSeasonSessions, setAllSeasonSessions, panier, setPanier }) {
  const [selected, setSelected]             = useState(null);
  const [selectedEnfants, setSelectedEnfants] = useState([]);
  const [done, setDone]                     = useState(false);
  const [enfantsDB, setEnfantsDB]           = useState([]);
  const [step, setStep]                     = useState("formule");
  const [selectedCreneaux, setSelectedCreneaux] = useState([]);
  const [dbResasNat, setDbResasNat]         = useState([]);
  const [weekIdx, setWeekIdx]               = useState(0);

  useEffect(() => {
    if (user?.supabaseId) {
      sb.from("enfants").select("*").eq("membre_id", user.supabaseId)
        .then(({ data }) => setEnfantsDB(data || [])).catch(() => {});
    }
    sb.from("reservations_natation").select("date_seance, heure, statut")
      .eq("statut", "confirmed")
      .then(({ data }) => setDbResasNat(data || [])).catch(() => {});

    // Recharger les créneaux supprimés/ajoutés par l'admin
    sb.from("seances_natation").select("date, heure, spots").then(({ data }) => {
      if (!data || data.length === 0) return;
      if (!setAllSeasonSessions) return;
      setAllSeasonSessions(prev => {
        let updated = [...prev];
        data.forEach(({ date, heure, spots }) => {
          if (spots === -1) {
            // Supprimé par l'admin
            updated = updated.filter(slot => {
              const dayObj = ALL_SEASON_DAYS.find(d => d.id === slot.day);
              if (!dayObj?.date) return true;
              const dd = dayObj.date;
              const dateISO = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}-${String(dd.getDate()).padStart(2,"0")}`;
              return !(dateISO === date && slot.time === heure);
            });
          } else if (spots >= 0) {
            // Ajouté par l'admin
            const dayObj = ALL_SEASON_DAYS.find(d => {
              const dd = d.date;
              if (!dd) return false;
              const dateISO = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}-${String(dd.getDate()).padStart(2,"0")}`;
              return dateISO === date;
            });
            if (dayObj && !updated.some(s => s.day === dayObj.id && s.time === heure)) {
              updated.push({ id: `sb-${date}-${heure}`, day: dayObj.id, time: heure, spots });
            }
          }
        });
        return updated;
      });
    }).catch(() => {});
  }, [user?.supabaseId]);

  const enfantsNat = enfantsDB.length > 0
    ? enfantsDB.filter(e => e.activite === "natation" || e.activite === "les deux")
    : (user?.enfants || []).filter(e => e.activite === "natation" || e.activite === "les deux");

  const nbLecons = selected?.qty || 1;

  // Places réelles par créneau
  const getTodayISO = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`; };
  const getSpots = (dayISO, time) => {
    if (dayISO === getTodayISO()) return 0;
    const taken = dbResasNat.filter(r => r.date_seance?.slice(0,10) === dayISO && r.heure === time).length;
    return Math.max(0, 2 - taken);
  };

  const toggleEnfant = (prenom) => {
    setSelectedEnfants(prev => prev.includes(prenom) ? prev.filter(e => e !== prenom) : [...prev, prenom]);
    // Ne pas reset les créneaux quand on change la sélection d'enfants
  };

  const toggleCreneau = (dayISO, time, dayId) => {
    const key = `${dayISO}-${time}`;
    const spots = getSpots(dayISO, time);
    // Ne pas sélectionner si plus de places que d'enfants
    if (selectedEnfants.length > spots && !selectedCreneaux.find(c => c.key === key)) return;
    setSelectedCreneaux(prev => {
      const exists = prev.find(c => c.key === key);
      if (exists) return prev.filter(c => c.key !== key);
      if (prev.length >= nbLecons) return prev;
      return [...prev, { key, dayISO, time, dayId }];
    });
  };

  // Prix total = prix forfait × nb enfants
  const prixTotal = selected ? selected.price * Math.max(1, selectedEnfants.length) : 0;
  const prixParLecon = selected ? (selected.price / selected.qty) : 20;

  // Semaines
  const weeks = [];
  let wk = [];
  ALL_SEASON_DAYS.forEach((d, i) => {
    wk.push(d);
    if (d.label === "Sam" || i === ALL_SEASON_DAYS.length - 1) { weeks.push([...wk]); wk = []; }
  });
  const currentWeek = weeks[Math.min(weekIdx, weeks.length - 1)] || [];

  if (done) return (
    <div style={{ padding:32, textAlign:"center", background:C.shell, minHeight:"100%" }}>
      <div style={{ fontSize:80 }}>📨</div>
      <h2 style={{ color:C.ocean }}>Demande envoyée ! 🎉</h2>
      <div style={{ background:"#fff", borderRadius:20, padding:20, margin:"16px 0", boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
        <p style={{ color:"#666", fontSize:14, lineHeight:1.8 }}>
          Formule <strong>{selected?.label}</strong> ({prixTotal} €){selectedEnfants.length > 0 ? ` pour ${selectedEnfants.join(", ")}` : ""}.<br/>
          {selectedCreneaux.length > 0 && <>{selectedCreneaux.length} créneau{selectedCreneaux.length>1?"x":""} sélectionné{selectedCreneaux.length>1?"s":""}.<br/></>}
          L'équipe Eole Beach Club vous contactera pour le paiement.<br/>
          🏦 Virement · ✉️ Chèque · 💶 Espèces · 🎫 Chèques vacances
        </p>
        <div style={{ background:`${C.ocean}10`, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.ocean, fontWeight:700 }}>
          ⏳ Votre accès sera activé à réception du paiement
        </div>
      </div>
      <SunBtn color={C.ocean} onClick={() => { setDone(false); setSelected(null); setSelectedEnfant(null); onNav("home"); }}>Retour à l'accueil</SunBtn>
    </div>
  );

  return (
    <div style={{ background: C.shell, minHeight: "100%" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.ocean}, ${C.sea})`, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <BackBtn onNav={onNav} to="formules" />
          <div><h2 style={{ color: "#fff", margin: 0, fontWeight: 900, fontSize: 22 }}>🎫 Formules Natation</h2><p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>Chaque forfait est nominatif 🏊‍♀️</p></div>
        </div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding: "10px 18px 24px" }}>

        {/* Sélection des enfants */}
        {enfantsNat.length > 0 && (
          <div style={{ background:"#fff", borderRadius:18, padding:16, marginBottom:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight:800, color:C.dark, fontSize:14, marginBottom:6 }}>🏊 Pour quels enfants ?</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>
              Chaque enfant = 1 place par créneau. Max 2 places disponibles par créneau.
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
              {enfantsNat.map(e => {
                const sel = selectedEnfants.includes(e.prenom);
                return (
                  <div key={e.prenom} onClick={() => toggleEnfant(e.prenom)} style={{
                    background: sel ? `linear-gradient(135deg,${C.ocean},${C.sea})` : "#F0F4F8",
                    color: sel ? "#fff" : "#888",
                    borderRadius:50, padding:"9px 20px", cursor:"pointer",
                    fontWeight:800, fontSize:14, transition:"all .15s",
                    boxShadow: sel ? `0 4px 12px ${C.ocean}44` : "none",
                  }}>
                    {sel ? "✓ " : ""}{e.prenom}
                  </div>
                );
              })}
            </div>
            {selectedEnfants.length > 0 && (
              <div style={{ fontSize:12, color:C.ocean, marginTop:8, fontWeight:700 }}>
                ✓ {selectedEnfants.length} enfant{selectedEnfants.length>1?"s":""} · {selectedEnfants.join(", ")}
                {selected && <span style={{ color:C.coral }}> · {prixTotal} €</span>}
              </div>
            )}
          </div>
        )}

        {/* Formules — affiche prix × nb enfants */}
        <div style={{ display:"flex", flexDirection:"column", gap:13, marginBottom:18 }}>
          {FORMULES_NAT.map(f => {
            const sel = selected?.id === f.id;
            const nbEnf = Math.max(1, selectedEnfants.length);
            const prixAffiche = f.price * nbEnf;
            return (
              <div key={f.id} onClick={() => { setSelected(sel ? null : f); setSelectedCreneaux([]); }} style={{
                background: sel ? `linear-gradient(135deg,${f.color}18,${f.color}08)` : "#fff",
                border:`3px solid ${sel ? f.color : "#f0f0f0"}`,
                borderRadius:22, padding:"16px 18px", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"space-between",
                boxShadow: sel ? `0 8px 28px ${f.color}33` : "0 4px 14px rgba(0,0,0,0.06)",
                transform: sel ? "scale(1.02)" : "scale(1)", transition:"all .2s",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:58, height:58, borderRadius:18, background:`linear-gradient(135deg,${f.color},${f.color}aa)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, flexShrink:0 }}>{f.emoji}</div>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                      <span style={{ fontWeight:900, fontSize:17, color:C.dark }}>{f.label}</span>
                      <Pill color={f.color}>{f.badge}</Pill>
                    </div>
                    <div style={{ fontSize:22, fontWeight:900, color:f.color }}>
                      {prixAffiche} €
                      {nbEnf > 1 && <span style={{ fontSize:13, color:"#aaa", marginLeft:6 }}>({f.price} € × {nbEnf} enfants)</span>}
                    </div>
                    {f.saving && <div style={{ fontSize:12, color:C.green, fontWeight:800 }}>🎁 {f.saving}</div>}
                    <div style={{ fontSize:11, color:"#bbb", marginTop:1 }}>soit {(f.price/f.qty).toFixed(1)} €/leçon/enfant</div>
                  </div>
                </div>
                <div style={{ width:26, height:26, borderRadius:"50%", border:`3px solid ${sel ? f.color : "#ddd"}`, background:sel ? f.color : "transparent", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:13, flexShrink:0 }}>{sel?"✓":""}</div>
              </div>
            );
          })}
        </div>

        {/* Bouton vers créneaux */}
        {selected && step === "formule" && (
          <SunBtn color={selected.color} full onClick={() => { setStep("creneaux"); setSelectedCreneaux([]); }}>
            Choisir mes {nbLecons} créneau{nbLecons>1?"x":""} →
          </SunBtn>
        )}

        {/* Étape 2 — Sélection des créneaux */}
        {selected && step === "creneaux" && (
          <div style={{ background:"#fff", borderRadius:20, padding:16, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight:900, color:C.dark, fontSize:14, marginBottom:4 }}>
              🕐 Choisissez {nbLecons} créneau{nbLecons>1?"x":""}
            </div>
            <div style={{ fontSize:12, color:"#888", marginBottom:4 }}>
              {selectedCreneaux.length}/{nbLecons} sélectionné{selectedCreneaux.length>1?"s":""}
              {selectedEnfants.length > 1 && <span style={{ color:C.ocean, fontWeight:700 }}> · {selectedEnfants.length} enfants → max {selectedEnfants.length} place(s)/créneau</span>}
            </div>
            {selectedEnfants.length > 1 && (
              <div style={{ background:`${C.sun}15`, borderRadius:10, padding:"6px 10px", marginBottom:10, fontSize:11, color:"#b45309", fontWeight:700 }}>
                ⚠️ Si un créneau n'a qu'1 place dispo, il ne pourra accueillir qu'un seul enfant
              </div>
            )}

            {/* Navigation semaine */}
            <div style={{ display:"flex", alignItems:"center", gap:10, background:"#F8FBFF", borderRadius:12, padding:"8px 12px", marginBottom:10 }}>
              <button onClick={() => setWeekIdx(Math.max(0,weekIdx-1))} disabled={weekIdx===0}
                style={{ background:weekIdx===0?"#eee":C.ocean, border:"none", color:weekIdx===0?"#bbb":"#fff", borderRadius:"50%", width:26, height:26, cursor:weekIdx===0?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:14 }}>‹</button>
              <div style={{ flex:1, textAlign:"center", fontWeight:800, color:C.dark, fontSize:12 }}>
                {currentWeek[0]?.num} {currentWeek[0]?.month} – {currentWeek[currentWeek.length-1]?.num} {currentWeek[currentWeek.length-1]?.month} 2026
              </div>
              <button onClick={() => setWeekIdx(Math.min(weeks.length-1,weekIdx+1))} disabled={weekIdx>=weeks.length-1}
                style={{ background:weekIdx>=weeks.length-1?"#eee":C.ocean, border:"none", color:weekIdx>=weeks.length-1?"#bbb":"#fff", borderRadius:"50%", width:26, height:26, cursor:weekIdx>=weeks.length-1?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:14 }}>›</button>
            </div>

            {/* Créneaux par jour */}
            {currentWeek.map(d => {
              const dayISO = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
              const daySlots = ALL_SEASON_SLOTS_INIT.filter(s => s.day === d.id);
              if (!daySlots.length) return null;
              return (
                <div key={d.id} style={{ marginBottom:12 }}>
                  <div style={{ fontSize:11, fontWeight:900, color:C.ocean, textTransform:"uppercase", marginBottom:6 }}>
                    {d.label} {d.num} {d.month}
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {daySlots.map(slot => {
                      const spots = getSpots(dayISO, slot.time);
                      const nbEnf = Math.max(1, selectedEnfants.length);
                      // Si pas assez de places pour tous les enfants, on peut quand même réserver mais avec avertissement
                      const key = `${dayISO}-${slot.time}`;
                      const sel = selectedCreneaux.find(c => c.key === key);
                      const blocked = !sel && selectedCreneaux.length >= nbLecons;
                      const full = spots === 0;
                      const partiel = spots > 0 && spots < nbEnf; // 1 place pour 2 enfants
                      return (
                        <div key={slot.id} onClick={() => !full && !blocked && toggleCreneau(dayISO, slot.time, d.id)} style={{
                          background: sel ? `linear-gradient(135deg,${C.ocean},${C.sea})` : full ? "#f5f5f5" : blocked ? "#f8f8f8" : partiel ? `${C.sun}20` : "#F0F4F8",
                          color: sel ? "#fff" : full ? "#ccc" : blocked ? "#ccc" : partiel ? "#b45309" : C.dark,
                          borderRadius:10, padding:"6px 12px", cursor:full||blocked?"not-allowed":"pointer",
                          fontWeight:800, fontSize:12, opacity:full?0.5:1,
                          boxShadow:sel?`0 3px 10px ${C.ocean}44`:"none",
                          border:`1.5px solid ${sel?C.ocean:partiel?C.sun:full?"#e0e0e0":"#e0e8f0"}`,
                        }}>
                          {slot.time}
                          <span style={{ fontSize:9, marginLeft:4, opacity:.8 }}>
                            {full ? "Complet" : `${spots}/2`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Récap + prix total */}
            {selectedCreneaux.length > 0 && (
              <div style={{ background:`${C.ocean}10`, borderRadius:12, padding:"10px 12px", marginBottom:12 }}>
                <div style={{ fontSize:12, color:C.ocean, fontWeight:700, marginBottom:4 }}>
                  ✓ {selectedCreneaux.map(c => `${c.time} · ${parseLocalDate(c.dayISO).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}`).join("  ·  ")}
                </div>
                <div style={{ fontSize:14, fontWeight:900, color:C.coral }}>
                  Total : {prixTotal} €
                  {selectedEnfants.length > 1 && ` (${selected.price} € × ${selectedEnfants.length} enfants)`}
                </div>
              </div>
            )}

            <div style={{ display:"flex", gap:8 }}>
              <button onClick={() => setStep("formule")} style={{ flex:1, background:"#f0f0f0", border:"none", color:"#888", borderRadius:14, padding:"11px", cursor:"pointer", fontWeight:800, fontFamily:"inherit" }}>← Retour</button>
              {setPanier ? (
                <button onClick={async () => {
                  if (selectedCreneaux.length < nbLecons) return;
                  if (!selectedEnfants.length) { alert("Veuillez sélectionner au moins un enfant."); return; }
                  // Basculer les enfants "club" sur "les deux"
                  for (const prenom of selectedEnfants) {
                    const enf = (enfantsDB.length > 0 ? enfantsDB : user?.enfants||[]).find(e => e.prenom === prenom);
                    if (enf && enf.activite === "club" && enf.id) {
                      try { await sb.from("enfants").update({ activite: "les deux" }).eq("id", enf.id); }
                      catch(e) { console.warn("update activite nat:", e); }
                    }
                  }
                  const nbEnf = Math.max(1, selectedEnfants.length);
                  const prix = selected.price * nbEnf;
                  setPanier(prev => [...prev, {
                    id: `nat-${Date.now()}`,
                    type: "natation",
                    label: `${selected.label}${selectedEnfants.length > 0 ? " · " + selectedEnfants.join(", ") : ""}`,
                    emoji: selected.emoji,
                    color: C.ocean,
                    prix,
                    enfants: selectedEnfants,
                    creneaux: selectedCreneaux,
                    details: `${nbLecons} leçon${nbLecons>1?"s":""} · ${nbEnf} enfant${nbEnf>1?"s":""}`,
                  }]);
                  onNav("panier");
                }} disabled={selectedCreneaux.length < nbLecons}
                style={{ flex:2, background:selectedCreneaux.length<nbLecons?"#bbb":`linear-gradient(135deg,${C.coral},${C.sun})`, border:"none", color:"#fff", borderRadius:14, padding:"11px", cursor:selectedCreneaux.length<nbLecons?"not-allowed":"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>
                  🛒 Ajouter au panier · {selected.price * Math.max(1, selectedEnfants.length)} €
                </button>
              ) : (
                <SunBtn color={selectedCreneaux.length === nbLecons ? C.ocean : "#bbb"}
                  disabled={selectedCreneaux.length < nbLecons}
                  onClick={async () => {
                    if (selectedCreneaux.length < nbLecons) return;
                    if (!selectedEnfants.length) { alert("Veuillez sélectionner au moins un enfant."); return; }
                    const nbEnf = Math.max(1, selectedEnfants.length);
                    const prix = selected.price * nbEnf;
                    try {
                      if (user?.supabaseId) {
                        for (const c of selectedCreneaux) {
                          const spotsDispos = getSpots(c.dayISO, c.time);
                          const enfantsCreneau = selectedEnfants.slice(0, spotsDispos);
                          await sb.from("reservations_natation").insert([{
                            membre_id:   user.supabaseId,
                            heure:       c.time,
                            date_seance: c.dayISO,
                            enfants:     enfantsCreneau,
                            statut:      "pending",
                            montant:     Math.round(prix / nbLecons),
                            jour:        parseLocalDate(c.dayISO).toLocaleDateString("fr-FR",{weekday:"short"}),
                          }]);
                        }
                      }
                    } catch(e) { console.warn(e); }
                    setDone(true);
                  }}>
                  📨 Envoyer · {selected.price * Math.max(1, selectedEnfants.length)} €
                </SunBtn>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CLUB DE PLAGE – TARIFS ────────────────────────────────
function TarifTable({ tarif, enfants }) {
  const row = tarif.rows[0]; // just show selected enfants count
  return null;
}

// ── RÉSERVATION CLUB (Carte Liberté) ─────────────────────
const CLUB_SEASON_DAYS = (() => {
  const days = [];
  const start = new Date(2026, 6, 6);
  const end   = new Date(2026, 7, 22);
  const cur   = new Date(start);
  const dowL  = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  const moisL = ["jan","fév","mar","avr","mai","jun","juil","août"];
  while (cur <= end) {
    const dow = cur.getDay();
    if (dow !== 0) {
      days.push({ id:`club-${cur.getDate()}-${cur.getMonth()}`, label:dowL[dow], num:String(cur.getDate()), month:moisL[cur.getMonth()], date:new Date(cur) });
    }
    cur.setDate(cur.getDate() + 1);
  }
  return days;
})();

// Semaines saison 2026 — 6 jours consécutifs sans dimanche
// Toutes les combinaisons possibles (Lun→Sam, Mar→Lun, Mer→Mar, Jeu→Mer, Ven→Jeu, Sam→Ven)
const SEASON_WEEKS = (() => {
  const dowOrder = ["Lun","Mar","Mer","Jeu","Ven","Sam"]; // sans dim
  const allDays = CLUB_SEASON_DAYS; // déjà sans dim
  const weeks = [];

  dowOrder.forEach((startLabel, si) => {
    // Pour chaque jour qui correspond au jour de départ
    allDays.forEach((startDay, startIdx) => {
      if (startDay.label !== startLabel) return;
      // Prendre les 6 prochains jours consécutifs sans dimanche
      let collected = [];
      let idx = startIdx;
      while (collected.length < 6 && idx < allDays.length) {
        collected.push(allDays[idx]);
        idx++;
      }
      if (collected.length === 6) {
        const first = collected[0];
        const last  = collected[5];
        // Vérifier que c'est bien 6 jours consécutifs (pas de saut de semaine)
        const daysDiff = Math.round((last.date - first.date) / (1000*60*60*24));
        if (daysDiff <= 7) { // max 7 jours civils pour 6 jours ouvrés
          weeks.push({
            label: `${first.num} ${first.month} (${first.label}) → ${last.num} ${last.month} (${last.label})`,
            days: [...collected],
          });
        }
      }
    });
  });

  // Dédoublonner et trier par date de début
  const seen = new Set();
  return weeks
    .filter(w => {
      const key = w.days[0].id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.days[0].date - b.days[0].date);
})();

function ReservationClubScreen({ onNav, user, setUser, clubPlaces, setClubPlaces }) {
  const [selectedDate, setSelectedDate]       = useState(null); // ISO
  const [selectedSession, setSelectedSession] = useState(null);
  const [done, setDone]                       = useState(null);
  const [resasClubDB, setResasClubDB]         = useState([]);
  const [selectedEnfants, setSelectedEnfants] = useState([]);
  const [enfantsDB, setEnfantsDB]             = useState([]);
  const [balance, setBalance]                 = useState(0);
  const [liberteTotal, setLiberteTotal]       = useState(0);
  const [moisFilter, setMoisFilter]           = useState("juil");
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    sb.from("reservations_club").select("date_reservation, session")
      .then(({ data }) => setResasClubDB(data || [])).catch(() => {});
    if (user?.supabaseId) {
      sb.from("enfants").select("*").eq("membre_id", user.supabaseId)
        .then(({ data }) => setEnfantsDB(data || [])).catch(() => {});
      sb.from("membres").select("liberte_balance, liberte_total").eq("id", user.supabaseId).single()
        .then(({ data }) => {
          setBalance(data?.liberte_balance || 0);
          setLiberteTotal(data?.liberte_total || 0);
          setLoading(false);
        }).catch(() => setLoading(false));
    } else setLoading(false);
  }, [user?.supabaseId]);

  const enfantsClub = enfantsDB.length > 0
    ? enfantsDB.filter(e => e.activite === "club" || e.activite === "les deux")
    : (user?.enfants || []).filter(e => e.activite === "club" || e.activite === "les deux");

  const toggleEnfant = (prenom) => setSelectedEnfants(prev => prev.includes(prenom) ? prev.filter(x => x !== prenom) : [...prev, prenom]);

  const getPlacesForDate = (dateISO, session) => {
    const t = new Date(); const todayISO = `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
    if (dateISO === todayISO) return 0;
    const taken = resasClubDB.filter(r => r.date_reservation?.slice(0,10) === dateISO && r.session === session).length;
    return Math.max(0, 45 - taken);
  };

  if (!user) return (
    <div style={{ background:C.shell,minHeight:"100%",display:"flex",flexDirection:"column" }}>
      <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`,padding:"20px 20px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}><BackBtn onNav={onNav} to="profil" /><h2 style={{ color:"#fff",margin:0,fontWeight:900 }}>🏖️ Réserver Club</h2></div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",textAlign:"center" }}>
        <div style={{ fontSize:72 }}>🔒</div><h2 style={{ color:C.dark }}>Inscription requise</h2>
        <SunBtn color={C.coral} onClick={() => onNav("inscription")}>📋 S'inscrire</SunBtn>
      </div>
    </div>
  );

  if (!loading && balance === 0) return (
    <div style={{ background:C.shell,minHeight:"100%",display:"flex",flexDirection:"column" }}>
      <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`,padding:"20px 20px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}><BackBtn onNav={onNav} to="profil" /><h2 style={{ color:"#fff",margin:0,fontWeight:900 }}>🏖️ Réserver Club</h2></div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",textAlign:"center" }}>
        <div style={{ fontSize:72 }}>🎟️</div>
        <h2 style={{ color:C.dark }}>Plus de demi-journées disponibles</h2>
        <p style={{ color:"#888",fontSize:14 }}>Recharge ta Carte Liberté pour continuer.</p>
        <SunBtn color={C.coral} onClick={() => onNav("prestations")}>Recharger ma carte</SunBtn>
      </div>
    </div>
  );

  if (done) return (
    <div style={{ minHeight:"100%",background:`linear-gradient(135deg,${C.coral},${C.sun})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 28px",textAlign:"center" }}>
      <div style={{ width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,0.25)",border:"3px solid rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:42 }}>✓</div>
      <h1 style={{ color:"#fff",fontSize:26,fontWeight:900,margin:"0 0 8px" }}>Demande envoyée !</h1>
      <p style={{ color:"rgba(255,255,255,0.9)",fontSize:15,margin:"0 0 4px" }}>{done.day} · {done.session}</p>
      <div style={{ background:"rgba(255,255,255,0.2)",borderRadius:14,padding:"10px 20px",margin:"12px 0 24px" }}>
        <span style={{ color:"#fff",fontWeight:900 }}>⏳ En attente de validation</span>
      </div>
      <button onClick={() => { setDone(null); setSelectedSession(null); setSelectedDate(null); onNav("profil"); }}
        style={{ background:"#fff",color:C.coral,border:"none",borderRadius:50,padding:"14px 36px",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"inherit" }}>
        Voir mon compte
      </button>
    </div>
  );

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSession) return;
    const sessionLabel = selectedSession === "matin" ? "☀️ Matin" : "🌊 Après-midi";
    const dateLabel = new Date(selectedDate).toLocaleDateString("fr-FR", {weekday:"long",day:"numeric",month:"long"});
    try {
      await creerReservationClub({
        membreId:        user?.supabaseId || null,
        dateReservation: selectedDate,
        session:         selectedSession,
        labelJour:       `[LIBERTE] ${dateLabel}`,
        rappelDate:      getRappelDate(selectedDate),
        enfants:         selectedEnfants.length > 0 ? selectedEnfants : enfantsClub.map(e => e.prenom),
        statut:          "pending",
      });
    } catch(e) { console.warn("Supabase:", e.message); }
    onNav("panier");
    setSelectedSession(null);
  };

  // Calendrier mensuel
  const year = 2026;
  const month = moisFilter === "juil" ? 6 : 7;
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const offset = firstDow === 0 ? 6 : firstDow - 1;
  const dowLabels = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

  const SESSIONS = [
    { id:"matin",  label:"☀️ Matin",      horaires:"9h30 – 12h30",  color:C.coral },
    { id:"apmidi", label:"🌊 Après-midi", horaires:"14h30 – 18h00", color:C.ocean },
  ];

  return (
    <div style={{ background:C.shell, minHeight:"100%" }}>
      <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, padding:"20px 20px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
          <BackBtn onNav={onNav} to="profil" />
          <div>
            <h2 style={{ color:"#fff",margin:0,fontWeight:900,fontSize:20 }}>🏖️ Réserver · Carte Liberté</h2>
            <p style={{ color:"rgba(255,255,255,0.85)",margin:0,fontSize:12 }}>{balance} demi-j. restante{balance>1?"s":""}</p>
          </div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.2)",borderRadius:16,padding:"10px 16px",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span style={{ color:"#fff",fontWeight:800,fontSize:13 }}>🎟️ Solde</span>
          <span style={{ color:"#fff",fontWeight:900,fontSize:20 }}>{balance} / {liberteTotal}</span>
        </div>
        <Wave fill={C.shell} />
      </div>

      <div style={{ padding:"12px 18px 24px", display:"flex", flexDirection:"column", gap:14 }}>

        {/* Toggle mois */}
        <div style={{ display:"flex", gap:8 }}>
          {[["juil","🌊 Juillet"],["aout","☀️ Août"]].map(([k,l]) => (
            <button key={k} onClick={() => { setMoisFilter(k); setSelectedDate(null); setSelectedSession(null); }} style={{
              flex:1, background: moisFilter===k ? `linear-gradient(135deg,${C.coral},${C.sun})` : "#fff",
              color: moisFilter===k ? "#fff" : "#888", border:"none", borderRadius:14, padding:"10px",
              cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit",
              boxShadow: moisFilter===k ? `0 4px 14px ${C.coral}44` : "0 2px 8px rgba(0,0,0,0.05)",
            }}>{l}</button>
          ))}
        </div>

        {/* Calendrier */}
        <div style={{ background:"#fff", borderRadius:20, padding:16, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:6 }}>
            {dowLabels.map(d => <div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:900, color:"#aaa", paddingBottom:4 }}>{d}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
            {Array.from({length:offset}).map((_,i) => <div key={`e${i}`} />)}
            {Array.from({length:daysInMonth}).map((_,i) => {
              const day = i+1;
              const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dow = new Date(year, month, day).getDay();
              const isDim = dow === 0;
              const inSeason = CLUB_SEASON_DAYS.some(d => {
                const diso = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
                return diso === iso;
              });
              const sel = selectedDate === iso;
              return (
                <div key={day} onClick={() => { if (!inSeason || isDim) return; setSelectedDate(sel ? null : iso); setSelectedSession(null); }} style={{
                  height:38, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:13, fontWeight: inSeason ? 800 : 400,
                  background: sel ? `linear-gradient(135deg,${C.coral},${C.sun})` : !inSeason||isDim ? "transparent" : "#F8FBFF",
                  color: sel ? "#fff" : !inSeason||isDim ? "#ddd" : C.dark,
                  cursor: !inSeason||isDim ? "default" : "pointer",
                  boxShadow: sel ? `0 3px 10px ${C.coral}44` : "none",
                }}>{day}</div>
              );
            })}
          </div>
        </div>

        {/* Choix session */}
        {selectedDate && (
          <div style={{ background:"#fff", borderRadius:20, padding:16, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight:800, color:C.dark, fontSize:14, marginBottom:12 }}>
              📅 {new Date(selectedDate).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {SESSIONS.map(s => {
                const places = getPlacesForDate(selectedDate, s.id);
                const sel = selectedSession === s.id;
                const full = places === 0;
                return (
                  <div key={s.id} onClick={() => !full && setSelectedSession(sel ? null : s.id)} style={{
                    background: sel ? `linear-gradient(135deg,${s.color},${s.color}cc)` : full ? "#f5f5f5" : "#F8FBFF",
                    border: `2px solid ${sel ? s.color : "#e0e8f0"}`,
                    borderRadius:16, padding:"14px 16px", cursor: full ? "not-allowed" : "pointer",
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    opacity: full ? 0.5 : 1,
                  }}>
                    <div>
                      <div style={{ fontWeight:900, fontSize:15, color: sel?"#fff":C.dark }}>{s.label}</div>
                      <div style={{ fontSize:12, color: sel?"rgba(255,255,255,0.8)":"#aaa" }}>{s.horaires}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:900, color: sel?"#fff":full?"#e74c3c":C.green, fontSize:16 }}>{places}</div>
                      <div style={{ fontSize:10, color: sel?"rgba(255,255,255,0.7)":"#aaa" }}>places</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Enfants */}
        {selectedDate && selectedSession && enfantsClub.length > 0 && (
          <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight:800, color:C.dark, fontSize:13, marginBottom:10 }}>👧 Enfants qui viennent</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {enfantsClub.map(e => {
                const sel = selectedEnfants.includes(e.prenom);
                return (
                  <div key={e.prenom} onClick={() => toggleEnfant(e.prenom)} style={{
                    background: sel ? `linear-gradient(135deg,${C.coral},${C.sun})` : "#f0f0f0",
                    color: sel ? "#fff" : "#888", borderRadius:50, padding:"8px 18px",
                    cursor:"pointer", fontWeight:800, fontSize:13,
                    boxShadow: sel ? `0 3px 10px ${C.coral}44` : "none",
                  }}>{sel?"✓ ":""}{e.prenom}</div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bouton confirmer */}
        {selectedDate && selectedSession && (
          <SunBtn color={C.coral} full onClick={handleConfirm}>
            📨 Envoyer la demande · {SESSIONS.find(s=>s.id===selectedSession)?.label}
          </SunBtn>
        )}
      </div>
    </div>
  );
}

function PrestationsScreen({ onNav, clubPlaces, setClubPlaces, user, setUser, panier, setPanier }) {
  const [tab, setTab]               = useState("club");
  const [formulType, setFormulType] = useState("matin");
  const [nbEnfants, setNbEnfants]   = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);
  const [done, setDone]             = useState(null);
  const [showWero, setShowWero]     = useState(false);
  const [selectedLiberte, setSelectedLiberte] = useState(null);
  const [step, setStep]             = useState("choix");
  const [selectedDates, setSelectedDates] = useState([]);
  const [moisFilter, setMoisFilter] = useState("juil");
  const [selectedEnfantsClub, setSelectedEnfantsClub] = useState([]);
  const [enfantsDB, setEnfantsDB]   = useState([]);

  useEffect(() => {
    if (user?.supabaseId) {
      sb.from("enfants").select("*").eq("membre_id", user.supabaseId)
        .then(({ data }) => setEnfantsDB(data || [])).catch(() => {});
    }
  }, [user?.supabaseId]);

  // Tous les enfants sont éligibles au club — si natation seulement, on bascule sur "les deux"
  const enfantsClub = enfantsDB.length > 0 ? enfantsDB : (user?.enfants || []);

  const toggleEnfantClub = (prenom) => setSelectedEnfantsClub(prev => {
    if (prev.includes(prenom)) return prev.filter(x => x !== prenom);
    if (prev.length >= nbEnfants) return prev;
    return [...prev, prenom];
  });

  const tarifData = formulType === "matin" ? TARIFS_MATIN : formulType === "apmidi" ? TARIFS_APMIDI : TARIFS_JOURNEE;

  const priceForRow = (row) => {
    if (nbEnfants === 1) return row.e1;
    if (nbEnfants === 2) return row.e2;
    if (nbEnfants === 3) return row.e3;
    return row.e3 + (nbEnfants - 3) * row.sup;
  };

  // Nombre de jours requis selon la formule
  const getNbJours = (label) => {
    if (!label) return 1;
    if (label.toLowerCase().includes("semaine")) {
      const n = parseInt(label);
      return isNaN(n) ? 1 : n;
    }
    if (label.includes("5")) return 5;
    if (label.includes("10")) return 10;
    if (label.includes("15")) return 15;
    if (label.includes("20")) return 20;
    return 1;
  };

  const isFormulaSemai = (label) => label?.toLowerCase().includes("semaine");
  const nbSemaines     = selectedRow ? getNbJours(selectedRow.label) : 1;
  const nbJoursRequis  = selectedRow ? (isFormulaSemai(selectedRow.label) ? nbSemaines * 6 : getNbJours(selectedRow.label)) : 1;

  // Pour les formules semaines : clic sur le 1er jour = N semaines × 6 jours consécutifs
  const toggleDate = (iso) => {
    if (isFormulaSemai(selectedRow?.label)) {
      // Trouver l'index du jour cliqué dans CLUB_SEASON_DAYS
      const startIdx = CLUB_SEASON_DAYS.findIndex(d => {
        const dISO = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
        return dISO === iso;
      });
      if (startIdx === -1) return;

      // Prendre N semaines × 6 jours consécutifs
      const totalJours = nbSemaines * 6;
      const jours = CLUB_SEASON_DAYS.slice(startIdx, startIdx + totalJours);
      if (jours.length < totalJours) return; // pas assez de jours après

      const allISOs = jours.map(d =>
        `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`
      );

      // Si déjà sélectionnées → désélectionner
      const alreadySel = allISOs.every(d => selectedDates.includes(d));
      setSelectedDates(alreadySel ? [] : allISOs);
    } else {
      setSelectedDates(prev => {
        if (prev.includes(iso)) return prev.filter(d => d !== iso);
        if (prev.length >= nbJoursRequis) return [...prev.slice(1), iso];
        return [...prev, iso];
      });
    }
  };

  const getDjCount = (label) => parseInt(label);

  if (done === "liberte" && selectedLiberte) return (
    <div style={{ padding:32, textAlign:"center", background:C.shell, minHeight:"100%" }}>
      <div style={{ fontSize:80 }}>📨</div>
      <h2 style={{ color:C.coral }}>Demande envoyée ! 🎉</h2>
      <div style={{ background:"#fff", borderRadius:20, padding:20, margin:"16px 0", boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:14, color:"#555", lineHeight:1.8 }}>
          Votre demande de <strong>Carte Liberté · {selectedLiberte.label}</strong> est enregistrée.<br/>
          <strong>L'équipe Eole Beach Club va vous contacter</strong> pour le paiement :<br/>
          🏦 Virement · ✉️ Chèque · 💶 Espèces · 🎫 Chèques vacances
        </div>
        <div style={{ marginTop:12, background:`${C.coral}10`, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.coral, fontWeight:700 }}>
          ⏳ Vos demi-journées seront créditées à réception du paiement
        </div>
      </div>
      <button onClick={() => { setDone(null); setSelectedLiberte(null); onNav("home"); }}
        style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, color:"#fff", border:"none", borderRadius:50, padding:"16px 40px", fontSize:16, fontWeight:900, cursor:"pointer", boxShadow:"0 8px 28px rgba(0,0,0,0.18)", fontFamily:"inherit" }}>
        Retour à l'accueil
      </button>
    </div>
  );

  if (done === "club") return (
    <div style={{ padding:32, textAlign:"center", background:C.shell, minHeight:"100%" }}>
      <div style={{ fontSize:80 }}>📨</div>
      <h2 style={{ color:C.coral }}>Demande envoyée ! 🎉</h2>
      <div style={{ background:"#fff", borderRadius:20, padding:20, margin:"16px 0", boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:14, color:"#555", lineHeight:1.8 }}>
          Votre demande de réservation a bien été pré-enregistrée.<br/>
          <strong>L'équipe Eole Beach Club va vous contacter</strong> pour finaliser le paiement par :<br/>
          🏦 Virement · ✉️ Chèque · 💶 Espèces · 🎫 Chèques vacances
        </div>
        <div style={{ marginTop:12, background:`${C.coral}10`, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.coral, fontWeight:700 }}>
          ⏳ Votre accès sera activé à réception du paiement
        </div>
      </div>
      <SunBtn color={C.ocean} onClick={() => { setDone(null); setSelectedRow(null); setStep("choix"); onNav("home"); }}>Retour à l'accueil</SunBtn>
    </div>
  );

  return (
    <div style={{ background: C.shell, minHeight: "100%" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.sun})`, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <BackBtn onNav={onNav} />
          <div><h2 style={{ color: "#fff", margin: 0, fontWeight: 900 }}>🏖️ Club de Plage</h2><p style={{ color: "rgba(255,255,255,0.85)", margin: 0, fontSize: 12 }}>Réserve ta demi-journée de plage !</p></div>
        </div>
        {/* Tab selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["club", "🏖️ Formule Club"], ["liberte", "🎟️ Formule Liberté"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, background: tab === k ? "#fff" : "rgba(255,255,255,0.25)", color: tab === k ? C.coral : "#fff", border: "none", borderRadius: 14, padding: "9px 8px", cursor: "pointer", fontWeight: 900, fontSize: 12, fontFamily: "inherit", transition: "all .15s" }}>{l}</button>
          ))}
        </div>
        <Wave fill={C.shell} />
      </div>

      <div style={{ padding: "10px 18px 24px" }}>

        {tab === "club" && (
          <>
            {/* Session type */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: C.dark, fontSize: 13, marginBottom: 8 }}>Type de session</div>
              <div style={{ display: "flex", gap: 8 }}>
                {[["matin", "Matin", C.coral], ["apmidi", "Après-midi", C.ocean], ["journee", "Journée", C.green]].map(([k, l, col]) => {
                  const placesLeft = clubPlaces ? (clubPlaces[k] || 45) : 45;
                  const full = placesLeft === 0;
                  return (
                    <button key={k} onClick={() => { if (!full) { setFormulType(k); setSelectedRow(null); setNbEnfants(1); } }} style={{
                      flex: 1, background: formulType === k ? col : full ? "#f5f5f5" : "#f0f0f0",
                      color: formulType === k ? "#fff" : full ? "#bbb" : "#888",
                      border: `2px solid ${full ? C.sunset+"40" : "transparent"}`,
                      borderRadius: 14, padding: "10px 6px",
                      cursor: full ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 11, fontFamily: "inherit", transition: "all .15s",
                      boxShadow: formulType === k ? `0 4px 14px ${col}44` : "none",
                    }}>
                      <div>{l}</div>
                      {full ? <div style={{ fontSize: 9, marginTop: 2, color: C.sunset }}>COMPLET</div>
                             : <div style={{ fontSize: 9, marginTop: 2, opacity: 0.8 }}>{placesLeft}/45 pl.</div>}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 6, textAlign: "center" }}>🕐 {tarifData.horaires}</div>
            </div>

            {/* Nb enfants */}
            <Card style={{ marginBottom: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 800, color: C.dark, fontSize: 14 }}>👧 Nombre d'enfants</div>
                  {clubPlaces && (
                    <div style={{ fontSize: 11, marginTop: 3, fontWeight: 700, color: (clubPlaces[formulType] || 45) <= 5 ? C.sunset : C.green }}>
                      {(clubPlaces[formulType] || 45)} place{(clubPlaces[formulType] || 45) > 1 ? "s" : ""} restante{(clubPlaces[formulType] || 45) > 1 ? "s" : ""} (max 45)
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => { setNbEnfants(Math.max(1, nbEnfants-1)); setSelectedRow(null); setSelectedEnfantsClub([]); }} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: C.coral, color: "#fff", fontWeight: 900, fontSize: 18, cursor: "pointer" }}>−</button>
                  <span style={{ fontWeight: 900, fontSize: 20, color: C.dark, minWidth: 24, textAlign: "center" }}>{nbEnfants}</span>
                  <button onClick={() => {
                    const max = clubPlaces ? (clubPlaces[formulType] || 45) : 45;
                    if (nbEnfants < max) { setNbEnfants(nbEnfants+1); setSelectedRow(null); setSelectedEnfantsClub([]); }
                  }} disabled={clubPlaces && nbEnfants >= (clubPlaces[formulType] || 45)}
                    style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: (clubPlaces && nbEnfants >= (clubPlaces[formulType] || 45)) ? "#ddd" : C.coral, color: "#fff", fontWeight: 900, fontSize: 18, cursor: (clubPlaces && nbEnfants >= (clubPlaces[formulType] || 45)) ? "not-allowed" : "pointer" }}>+</button>
                </div>
              </div>
              {nbEnfants > 3 && <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>3 enfants + {nbEnfants-3} enfant(s) supplémentaire(s)</div>}
            </Card>

            {/* Sélection des enfants concernés */}
            <div style={{ background:"#fff", borderRadius:18, padding:16, marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
              <div style={{ fontWeight:800, color:C.dark, fontSize:14, marginBottom:10 }}>
                👧 Enfant(s) concernés
                {selectedEnfantsClub.length > 0 && <span style={{ fontSize:12, color:tarifData.color, fontWeight:700 }}> · {selectedEnfantsClub.join(", ")}</span>}
              </div>
              {enfantsClub.length === 0 ? (
                <div style={{ fontSize:13, color:"#aaa", fontStyle:"italic" }}>
                  Aucun enfant inscrit pour le Club.<br/>
                  <span style={{ color:C.ocean, fontWeight:700, cursor:"pointer" }} onClick={() => {}}>Ajoutez un enfant dans votre profil.</span>
                </div>
              ) : (
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {enfantsClub.map(e => {
                    const sel = selectedEnfantsClub.includes(e.prenom);
                    return (
                      <div key={e.prenom} onClick={() => toggleEnfantClub(e.prenom)} style={{
                        background: sel ? `linear-gradient(135deg,${tarifData.color},${tarifData.color}cc)` : "#F0F4F8",
                        color: sel ? "#fff" : "#888",
                        borderRadius:50, padding:"9px 18px", cursor:"pointer",
                        fontWeight:800, fontSize:13, transition:"all .15s",
                        boxShadow: sel ? `0 4px 12px ${tarifData.color}44` : "none",
                      }}>
                        {sel ? "✓ " : ""}{e.prenom}
                      </div>
                    );
                  })}
                </div>
              )}
              {enfantsClub.length > 0 && selectedEnfantsClub.length < nbEnfants && (
                <div style={{ fontSize:11, color:"#aaa", marginTop:8, fontStyle:"italic" }}>
                  Sélectionnez encore {nbEnfants - selectedEnfantsClub.length} enfant{nbEnfants - selectedEnfantsClub.length > 1 ? "s" : ""}
                </div>
              )}
              {enfantsClub.length > 0 && selectedEnfantsClub.length === nbEnfants && (
                <div style={{ fontSize:11, color:C.green, marginTop:8, fontWeight:700 }}>
                  ✓ Sélection complète
                </div>
              )}
            </div>

            {/* Tarif rows */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, color: C.dark, fontSize: 13, marginBottom: 8 }}>Choisir une durée</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tarifData.rows.map((row, i) => {
                  const price = priceForRow(row);
                  const sel = selectedRow?.label === row.label;
                  // savings vs daily rate
                  const dailyRate = priceForRow(tarifData.rows[0]);
                  const savings = i > 0 ? Math.round((dailyRate * (i === 1 ? 5 : i === 2 ? 10 : i === 3 ? 15 : 20)) - price) : 0;
                  return (
                    <div key={row.label} onClick={() => { setSelectedRow({ ...row, price }); setStep("choix"); setSelectedDates([]); }} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: sel ? `linear-gradient(135deg, ${tarifData.color}18, ${tarifData.color}06)` : "#fff",
                      border: `2.5px solid ${sel ? tarifData.color : "#f0f0f0"}`,
                      borderRadius: 18, padding: "13px 16px", cursor: "pointer",
                      boxShadow: sel ? `0 6px 20px ${tarifData.color}33` : "0 2px 10px rgba(0,0,0,0.05)",
                      transform: sel ? "scale(1.01)" : "scale(1)", transition: "all .18s",
                    }}>
                      <div>
                        <div style={{ fontWeight: 800, color: C.dark, fontSize: 14 }}>{row.label}</div>
                        {savings > 0 && <div style={{ fontSize: 11, color: C.green, fontWeight: 800 }}>🎁 -{savings}€ d'économie</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontWeight: 900, fontSize: 20, color: tarifData.color }}>{price} €</div>
                        <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2.5px solid ${sel ? tarifData.color : "#ddd"}`, background: sel ? tarifData.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 900 }}>{sel ? "✓" : ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedRow && step === "choix" && (
              <>
                {enfantsClub.length === 0 && (
                  <div style={{ background:"#FFF0EC", border:"1.5px solid #FF8E53", borderRadius:12, padding:"10px 14px", fontSize:13, color:"#c0392b", fontWeight:700, textAlign:"center" }}>
                    ⚠️ Aucun enfant inscrit pour le Club. Ajoutez d'abord un enfant dans votre profil.
                  </div>
                )}
                {enfantsClub.length > 0 && selectedEnfantsClub.length === 0 && (
                  <div style={{ background:"#FFF9F0", border:"1.5px solid #FFD93D", borderRadius:12, padding:"10px 14px", fontSize:13, color:"#b45309", fontWeight:700, textAlign:"center" }}>
                    👆 Sélectionnez au moins un enfant pour continuer
                  </div>
                )}
                <SunBtn color={enfantsClub.length === 0 || selectedEnfantsClub.length === 0 ? "#ccc" : tarifData.color} full onClick={() => {
                  if (enfantsClub.length === 0) { alert("Aucun enfant inscrit pour le Club. Ajoutez d'abord un enfant dans votre profil."); return; }
                  if (selectedEnfantsClub.length === 0) { alert("Veuillez sélectionner au moins un enfant."); return; }
                  setStep("dates"); setSelectedDates([]);
                }}>
                  Choisir mes dates →
                </SunBtn>
              </>
            )}

            {/* Étape 2 — Sélection des dates */}
            {selectedRow && step === "dates" && (
              <div style={{ background:"#fff", borderRadius:20, padding:16, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight:900, color:C.dark, fontSize:14, marginBottom:4 }}>
                  📅 {isFormulaSemai(selectedRow.label)
                    ? `Choisissez votre 1er jour (${nbSemaines} sem. · ${nbSemaines*6} jours)`
                    : `Choisissez ${nbJoursRequis} jour${nbJoursRequis>1?"s":""}`}
                </div>
                <div style={{ fontSize:12, color:"#888", marginBottom:12 }}>
                  {selectedDates.length > 0
                    ? `Du ${new Date(selectedDates[0]).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})} au ${new Date(selectedDates[selectedDates.length-1]).toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}`
                    : "Cliquez sur un jour pour démarrer"}
                </div>

                {/* Toggle Juillet / Août */}
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  {[["juil","Juillet 2026"],["aout","Août 2026"]].map(([k,l]) => (
                    <button key={k} onClick={() => setMoisFilter(k)}
                      style={{ flex:1, background: moisFilter===k ? `linear-gradient(135deg,${tarifData.color},${tarifData.color}cc)` : "#f0f0f0", color: moisFilter===k?"#fff":"#888", border:"none", borderRadius:12, padding:"9px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* Calendrier */}
                {(() => {
                  const year = 2026;
                  const month = moisFilter === "juil" ? 6 : 7; // 0-indexed
                  const firstDay = new Date(year, month, 1).getDay(); // 0=dim
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const dowLabels = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
                  // Décalage : semaine commence lundi
                  const offset = firstDay === 0 ? 6 : firstDay - 1;

                  return (
                    <div>
                      {/* En-têtes jours */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:4 }}>
                        {dowLabels.map(d => (
                          <div key={d} style={{ textAlign:"center", fontSize:10, fontWeight:900, color:"#aaa", padding:"4px 0" }}>{d}</div>
                        ))}
                      </div>
                      {/* Grille */}
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
                        {/* Cases vides avant le 1er */}
                        {Array.from({length: offset}).map((_,i) => <div key={`e${i}`} />)}
                        {/* Jours du mois */}
                        {Array.from({length: daysInMonth}).map((_,i) => {
                          const day = i + 1;
                          const date = new Date(year, month, day);
                          const dow = date.getDay(); // 0=dim
                          const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                          const isDimanche = dow === 0;
                          const inSeason = CLUB_SEASON_DAYS.some(d => {
                            const dISO = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
                            return dISO === iso;
                          });

                          // Vérifier si disabled (pas assez de jours après pour les semaines)
                          let disabled = !inSeason || isDimanche;
                          if (!disabled && isFormulaSemai(selectedRow.label)) {
                            const startIdx = CLUB_SEASON_DAYS.findIndex(d => {
                              const dISO = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
                              return dISO === iso;
                            });
                            disabled = startIdx === -1 || CLUB_SEASON_DAYS.slice(startIdx, startIdx + nbSemaines * 6).length < nbSemaines * 6;
                          }

                          const sel = selectedDates.includes(iso);
                          const inRange = selectedDates.includes(iso);

                          return (
                            <div key={day} onClick={() => !disabled && toggleDate(iso)} style={{
                              height:36, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center",
                              fontSize:13, fontWeight: inSeason ? 800 : 400,
                              background: sel ? `linear-gradient(135deg,${tarifData.color},${tarifData.color}cc)`
                                : !inSeason || isDimanche ? "transparent"
                                : "#F8FBFF",
                              color: sel ? "#fff"
                                : !inSeason || isDimanche ? "#ddd"
                                : disabled ? "#ccc"
                                : C.dark,
                              border: sel ? `2px solid ${tarifData.color}` : "2px solid transparent",
                              cursor: disabled || !inSeason || isDimanche ? "default" : "pointer",
                              boxShadow: sel ? `0 3px 10px ${tarifData.color}44` : "none",
                              transition:"all .12s",
                            }}>
                              {day}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Récap dates sélectionnées */}
                {selectedDates.length > 0 && (
                  <div style={{ marginTop:12, background:`${tarifData.color}10`, borderRadius:12, padding:"8px 12px", fontSize:12, color:tarifData.color, fontWeight:700 }}>
                    ✓ {isFormulaSemai(selectedRow.label)
                      ? `${nbSemaines} sem. · ${selectedDates[0] ? new Date(selectedDates[0]).toLocaleDateString("fr-FR",{day:"numeric",month:"long"}) : ""} → ${selectedDates[selectedDates.length-1] ? new Date(selectedDates[selectedDates.length-1]).toLocaleDateString("fr-FR",{day:"numeric",month:"long"}) : ""}`
                      : `${selectedDates.length}/${nbJoursRequis} jour${nbJoursRequis>1?"s":""}`}
                    {selectedDates.length > 0 && (
                      <button onClick={() => setSelectedDates([])} style={{ marginLeft:8, background:"none", border:"none", color:tarifData.color, cursor:"pointer", fontFamily:"inherit", fontWeight:900, fontSize:12 }}>✕ Effacer</button>
                    )}
                  </div>
                )}

                <div style={{ display:"flex", gap:8, marginTop:14 }}>
                  <button onClick={() => setStep("choix")} style={{ flex:1, background:"#f0f0f0", border:"none", color:"#888", borderRadius:14, padding:"11px", cursor:"pointer", fontWeight:800, fontFamily:"inherit" }}>← Retour</button>
                  <SunBtn color={selectedDates.length >= nbJoursRequis ? tarifData.color : "#bbb"}
                    disabled={selectedDates.length < nbJoursRequis}
                    onClick={() => { if (selectedDates.length >= nbJoursRequis) setStep("confirm"); }}>
                    Confirmer →
                  </SunBtn>
                </div>
              </div>
            )}

            {selectedRow && step === "confirm" && (
              <Card style={{ background: `linear-gradient(135deg, ${tarifData.color}15, ${tarifData.color}05)`, border: `2px solid ${tarifData.color}40`, textAlign: "center" }}>
                <div style={{ fontWeight: 900, color: C.dark, marginBottom: 2 }}>{tarifData.label} · {selectedRow.label}</div>
                <div style={{ fontWeight: 900, color: C.dark, fontSize: 13, marginBottom: 4 }}>👧 {nbEnfants} enfant{nbEnfants > 1 ? "s" : ""}</div>
                {/* Dates sélectionnées */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, justifyContent:"center", marginBottom:12 }}>
                  {selectedDates.map(iso => {
                    const d = new Date(iso);
                    return (
                      <div key={iso} style={{ background:`${tarifData.color}20`, color:tarifData.color, borderRadius:8, padding:"3px 10px", fontSize:12, fontWeight:800 }}>
                        {d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: tarifData.color, marginBottom: 8 }}>{selectedRow.price} €</div>

                {/* Modes de paiement */}
                <div style={{ background:"#F8FBFF", borderRadius:14, padding:"12px 14px", marginBottom:14, textAlign:"left" }}>
                  <div style={{ fontWeight:900, color:C.dark, fontSize:13, marginBottom:8 }}>💳 Modes de paiement acceptés</div>
                  {[["🏦","Virement bancaire"],["✉️","Chèque"],["💶","Espèces"],["🎫","Chèques vacances"]].map(([icon,label]) => (
                    <div key={label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, fontSize:13, color:"#555" }}>
                      <span style={{ fontSize:16 }}>{icon}</span>{label}
                    </div>
                  ))}
                  <div style={{ fontSize:11, color:"#aaa", marginTop:8, fontStyle:"italic" }}>
                    Votre réservation sera confirmée à réception du paiement par l'équipe Eole Beach Club.
                  </div>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <button onClick={() => setStep("dates")} style={{ background:"#f0f0f0", border:"none", color:"#888", borderRadius:14, padding:"11px", cursor:"pointer", fontWeight:800, fontFamily:"inherit" }}>← Dates</button>
                  {setPanier && selectedDates.length > 0 ? (
                    <>
                      <button onClick={async () => {
                        if (!selectedEnfantsClub.length) { alert("Veuillez sélectionner au moins un enfant."); return; }
                        // Basculer les enfants "natation" sur "les deux"
                        for (const prenom of selectedEnfantsClub) {
                          const enf = enfantsClub.find(e => e.prenom === prenom);
                          if (enf && enf.activite === "natation" && enf.id) {
                            try {
                              await sb.from("enfants").update({ activite: "les deux" }).eq("id", enf.id);
                            } catch(e) { console.warn("update activite:", e); }
                          }
                        }
                        setPanier(prev => [...prev, {
                          id: `club-${Date.now()}`,
                          type: "club",
                          label: `Club · ${formulType==="journee"?"Journée":formulType==="matin"?"☀️ Matin":"🌊 Après-midi"} · ${selectedRow?.label||""}`,
                          emoji: "🏖️",
                          color: C.coral,
                          prix: selectedRow?.price || 0,
                          enfants: selectedEnfantsClub,
                          session: formulType,
                          dates: selectedDates,
                          details: `${selectedDates.length} jour${selectedDates.length>1?"s":""}`,
                        }]);
                        onNav("panier");
                      }} style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, border:"none", color:"#fff", borderRadius:14, padding:"14px", cursor:"pointer", fontWeight:900, fontSize:14, fontFamily:"inherit", boxShadow:`0 4px 14px ${C.coral}44` }}>
                        🛒 Ajouter au panier · {selectedRow?.price} €
                      </button>
                    </>
                  ) : (
                    <SunBtn color={tarifData.color} onClick={async () => {
                      try {
                        for (const iso of selectedDates) {
                          await creerReservationClub({
                            membreId: user?.supabaseId || null,
                            dateReservation: iso,
                            session: formulType === "journee" ? "matin" : formulType,
                            labelJour: `[MONTANT:${Math.round(selectedRow.price / selectedDates.length)}] ${new Date(iso).toLocaleDateString("fr-FR", {weekday:"long",day:"numeric",month:"long"})}`,
                            rappelDate: null,
                            enfants: selectedEnfantsClub.length > 0 ? selectedEnfantsClub : (user?.enfants||[]).filter(e => e.activite==="club"||e.activite==="les deux").map(e=>e.prenom),
                            statut: "pending",
                          });
                        }
                      } catch(e) { console.warn(e); }
                      if (setClubPlaces) setClubPlaces(prev => ({ ...prev, [formulType]: Math.max(0, (prev[formulType]||45) - nbEnfants) }));
                      setDone("club");
                    }}>📨 Envoyer la demande · {selectedRow.price} €</SunBtn>
                  )}
                </div>
              </Card>
            )}
          </>
        )}

        {tab === "liberte" && (
          <>
            <Card style={{ background: `linear-gradient(135deg, ${C.sand}50, #fff8dc)`, border: `2px solid ${C.sun}`, marginBottom: 16 }}>
              <div style={{ fontWeight: 900, color: C.dark, marginBottom: 4 }}>🎟️ Formule Liberté</div>
              <div style={{ fontSize: 13, color: "#666" }}>Utilisable matin ou après-midi selon vos disponibilités. Valable toute la saison 2026.</div>
            </Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
              {TARIFS_LIBERTE.map((t, i) => {
                const sel = selectedLiberte?.label === t.label;
                const pricePerDj = Math.round(t.price / parseInt(t.label));
                return (
                  <div key={t.label} onClick={() => setSelectedLiberte(t)} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: sel ? `${C.sun}20` : "#fff",
                    border: `2.5px solid ${sel ? C.sun : "#f0f0f0"}`,
                    borderRadius: 18, padding: "13px 16px", cursor: "pointer",
                    boxShadow: sel ? `0 6px 20px ${C.sun}44` : "0 2px 10px rgba(0,0,0,0.05)",
                    transform: sel ? "scale(1.01)" : "scale(1)", transition: "all .18s",
                  }}>
                    <div>
                      <div style={{ fontWeight: 800, color: C.dark, fontSize: 14 }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>soit {pricePerDj} €/demi-journée</div>
                      {i > 0 && <div style={{ fontSize: 11, color: C.green, fontWeight: 800 }}>🎁 Économie vs tarif unitaire</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 20, color: C.coral }}>{t.price} €</div>
                      <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2.5px solid ${sel ? C.sun : "#ddd"}`, background: sel ? C.sun : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 900 }}>{sel ? "✓" : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedLiberte && (
              <Card style={{ background: `${C.sun}15`, border: `2px solid ${C.sun}40` }}>
                <div style={{ fontWeight:900, color:C.dark, marginBottom:4 }}>🎟️ {selectedLiberte.label}</div>
                <div style={{ background:`${C.coral}15`, borderRadius:12, padding:"8px 12px", marginBottom:10, fontSize:12, color:C.coral, fontWeight:700 }}>
                  ⚠️ Valable uniquement saison 2026 · 6 juil – 22 août
                </div>
                <div style={{ fontSize:28, fontWeight:900, color:C.coral, marginBottom:10, textAlign:"center" }}>{selectedLiberte.price} €</div>
                {/* Modes de paiement */}
                <div style={{ background:"#F8FBFF", borderRadius:12, padding:"10px 12px", marginBottom:14 }}>
                  <div style={{ fontWeight:900, color:C.dark, fontSize:12, marginBottom:6 }}>💳 Modes de paiement acceptés</div>
                  {[["🏦","Virement bancaire"],["✉️","Chèque"],["💶","Espèces"],["🎫","Chèques vacances"]].map(([icon,label]) => (
                    <div key={label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, fontSize:12, color:"#555" }}>
                      <span>{icon}</span>{label}
                    </div>
                  ))}
                  <div style={{ fontSize:11, color:"#aaa", marginTop:6, fontStyle:"italic" }}>Votre carte sera activée à réception du paiement.</div>
                </div>
                <SunBtn color={C.coral} full onClick={async () => {
                  try {
                    if (user?.supabaseId) {
                      await sb.from("reservations_club").insert([{
                        membre_id: user.supabaseId,
                        date_reservation: new Date().toISOString().slice(0,10),
                        session: "matin",
                        label_jour: `Carte Liberté · ${selectedLiberte.label}`,
                        statut: "pending",
                        enfants: [String(parseInt(selectedLiberte.label))],
                      }]);
                    }
                  } catch(e) { console.warn(e); }
                  setDone("liberte");
                }}>📨 Envoyer la demande · {selectedLiberte.price} €</SunBtn>
                {setPanier && (
                  <button onClick={() => {
                    setPanier(prev => [...prev, {
                      id: `lib-${Date.now()}`,
                      type: "liberte",
                      label: `🎟️ Carte Liberté · ${selectedLiberte.label}`,
                      emoji: "🎟️",
                      color: C.coral,
                      prix: selectedLiberte.price,
                      nbDemiJ: parseInt(selectedLiberte.label),
                      details: selectedLiberte.label,
                    }]);
                    setDone("liberte");
                  }} style={{ width:"100%", marginTop:8, background:`linear-gradient(135deg,${C.sun},${C.coral})`, border:"none", color:"#fff", borderRadius:14, padding:"11px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>
                    🛒 Ajouter au panier
                  </button>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── RESERVATION ───────────────────────────────────────────
function ReservationScreen({ onNav, user, allSeasonSessions, setAllSeasonSessions, reservations, setReservations, panier, setPanier }) {
  const [weekIdx, setWeekIdx]           = useState(0);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [booking, setBooking]           = useState(null);
  const [selectedEnfants, setSelectedEnfants] = useState([]);
  const [done, setDone]                 = useState(null);

  const weeks = (() => {
    const ws = []; let wk = [];
    ALL_SEASON_DAYS.forEach((d, i) => {
      wk.push(d);
      if (d.label === "Sam" || i === ALL_SEASON_DAYS.length - 1) { ws.push([...wk]); wk = []; }
    });
    return ws;
  })();
  const currentWeek = weeks[Math.min(weekIdx, weeks.length-1)] || [];
  const selectedDay = selectedDayId ? ALL_SEASON_DAYS.find(d => d.id === selectedDayId) : currentWeek[0];
  const effectiveDayId = selectedDay?.id || currentWeek[0]?.id;

  useEffect(() => {
    if (currentWeek[0]) setSelectedDayId(currentWeek[0].id);
  }, [weekIdx]);

  useEffect(() => {
    sb.from("reservations_natation").select("date_seance, heure, statut")
      .eq("statut", "confirmed")
      .then(({ data }) => {
        if (setAllSeasonSessions) {
          setAllSeasonSessions(() => {
            const next = ALL_SEASON_SLOTS_INIT.map(s => ({ ...s, spots: 2 }));
            data.forEach(r => {
              if (!r.date_seance || !r.heure) return;
              const dateResa = r.date_seance.slice(0, 10);
              for (let i = 0; i < next.length; i++) {
                if (next[i].time !== r.heure || next[i].spots <= 0) continue;
                const dayObj = ALL_SEASON_DAYS.find(d => d.id === next[i].day);
                if (dayObj?.date) {
                  const iso = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
                  if (iso === dateResa) { next[i] = { ...next[i], spots: next[i].spots - 1 }; break; }
                }
              }
            });
            return next;
          });
        }
      }).catch(() => {});
  }, []);

  const allForDay = (allSeasonSessions || []).filter(s => s.day === effectiveDayId);
  const morning   = allForDay.filter(s => { const [h] = s.time.split(":").map(Number); return h < 13; });
  const afternoon = allForDay.filter(s => { const [h] = s.time.split(":").map(Number); return h >= 13; });

  const getDateISO = (day) => {
    if (!day?.date) return "";
    return `${day.date.getFullYear()}-${String(day.date.getMonth()+1).padStart(2,"0")}-${String(day.date.getDate()).padStart(2,"0")}`;
  };

  // Prix unitaire × nb enfants sélectionnés × forfait
  const nbEnf = Math.max(1, selectedEnfants.length);
  const prixSeance = 20 * nbEnf;

  const handleConfirm = async () => {
    if (!selectedEnfants.length) { alert("Veuillez sélectionner au moins un enfant."); return; }
    if (setAllSeasonSessions) setAllSeasonSessions(prev => prev.map(s => s.id === booking.id ? { ...s, spots: Math.max(0, s.spots-1) } : s));
    const resaDateISO = getDateISO(selectedDay);
    const rappelDate  = getRappelDate(resaDateISO);
    scheduleRappel({ titre:"🏊 Rappel séance natation demain !", corps:`Ta séance à ${booking.time} est demain !`, dateStr:rappelDate });
    try {
      await sb.from("reservations_natation").insert([{
        membre_id:   user?.supabaseId || null,
        jour:        booking.day,
        heure:       booking.time,
        date_seance: resaDateISO,
        enfants:     selectedEnfants,
        statut:      "pending",
        rappel_date: rappelDate || null,
        montant:     prixSeance,
      }]);
    } catch(e) { console.warn("Supabase:", e.message); }
    setDone({ ...booking, enfants: selectedEnfants, rappelDate });
    setBooking(null);
    setSelectedEnfants([]);
  };

  const handlePanier = () => {
    if (!selectedEnfants.length) { alert("Veuillez sélectionner au moins un enfant."); return; }
    const resaDateISO = getDateISO(selectedDay);
    setPanier(prev => [...prev, {
      id: `res-${Date.now()}`,
      type: "natation",
      label: `Séance ${booking.time} · ${selectedDay?.label} ${selectedDay?.num} ${selectedDay?.month}`,
      emoji: "🏊",
      color: C.ocean,
      prix: prixSeance,
      enfants: selectedEnfants,
      creneaux: [{ key: `${resaDateISO}-${booking.time}`, dayISO: resaDateISO, time: booking.time, dayId: effectiveDayId }],
      details: `${nbEnf} enfant${nbEnf>1?"s":""} · forfait appliqué`,
    }]);
    setBooking(null);
    setSelectedEnfants([]);
  };

  if (!user) return (
    <div style={{ background:C.shell, minHeight:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ background:`linear-gradient(135deg, #00C9FF, ${C.sea})`, padding:"20px 20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <BackBtn onNav={onNav} /><h2 style={{ color:"#fff", margin:0, fontWeight:900, fontSize:20 }}>🏊 Réservations Natation</h2>
        </div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 24px", textAlign:"center" }}>
        <div style={{ fontSize:72, marginBottom:16 }}>🔒</div>
        <h2 style={{ color:C.dark, fontSize:22, margin:"0 0 10px" }}>Inscription requise</h2>
        <SunBtn color={C.coral} onClick={() => onNav("inscription")}>📋 S'inscrire maintenant</SunBtn>
        <button onClick={() => onNav("home")} style={{ background:"none", border:"none", color:"#aaa", fontSize:14, cursor:"pointer", fontFamily:"inherit", fontWeight:700, marginTop:12 }}>← Retour</button>
      </div>
    </div>
  );

  if (done) return (
    <div style={{ padding:32, textAlign:"center", background:C.shell, minHeight:"100%" }}>
      <div style={{ fontSize:80 }}>📨</div>
      <h2 style={{ color:C.ocean }}>Demande envoyée ! 🎉</h2>
      <div style={{ background:"#fff", borderRadius:20, padding:20, margin:"16px 0", boxShadow:"0 4px 16px rgba(0,0,0,0.06)", textAlign:"left" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
          <div style={{ fontSize:44 }}>🏊</div>
          <div>
            <div style={{ fontWeight:900, fontSize:22, color:C.ocean }}>{done.time}</div>
            <div style={{ color:"#666" }}>{selectedDay?.label} {selectedDay?.num} {selectedDay?.month} 2026</div>
            {done.enfants?.length > 0 && <div style={{ marginTop:6, display:"flex", gap:4, flexWrap:"wrap" }}>{done.enfants.map(e => <Pill key={e} color={C.sea}>{e}</Pill>)}</div>}
          </div>
        </div>
        <div style={{ fontSize:14, color:"#555", lineHeight:1.8, marginBottom:12 }}>
          Votre demande est enregistrée.<br/>
          <strong>L'équipe Eole Beach Club va vous contacter</strong> pour le paiement :<br/>
          🏦 Virement · ✉️ Chèque · 💶 Espèces · 🎫 Chèques vacances
        </div>
        <div style={{ background:`${C.ocean}10`, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.ocean, fontWeight:700 }}>
          ⏳ Votre accès sera activé à réception du paiement
        </div>
      </div>
      <SunBtn color={C.ocean} onClick={() => { setDone(null); onNav("home"); }}>🏠 Retour à l'accueil</SunBtn>
    </div>
  );

  if (booking) return (
    <div style={{ background:C.shell, minHeight:"100%" }}>
      <div style={{ background:`linear-gradient(135deg, #00C9FF, ${C.sea})`, padding:"20px 20px 0", textAlign:"center" }}>
        <div style={{ display:"flex", alignItems:"center", marginBottom:6 }}><BackBtn onNav={() => { setBooking(null); setSelectedEnfants([]); }} /><div style={{ flex:1, color:"rgba(255,255,255,0.9)", fontSize:13, fontWeight:700 }}>🏊 Réserver la séance</div></div>
        <div style={{ fontSize:56, fontWeight:900, color:"#fff", letterSpacing:-2 }}>{booking.time}</div>
        <div style={{ color:C.sun, fontWeight:800, fontSize:15, marginBottom:4 }}>{selectedDay?.label} {selectedDay?.num} {selectedDay?.month} 2026 ☀️</div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding:"10px 18px 24px", display:"flex", flexDirection:"column", gap:14 }}>
        <Card>
          <h3 style={{ color:C.dark, margin:"0 0 10px", fontSize:15 }}>👤 Parent / Responsable</h3>
          <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"6px 12px", fontSize:14 }}>
            <span style={{ color:"#aaa" }}>Nom</span><strong>{user?.prenom} {NOM(user?.nom)}</strong>
            <span style={{ color:"#aaa" }}>Email</span><span>{user?.email||"—"}</span>
            <span style={{ color:"#aaa" }}>Tél.</span><span><a href={`tel:${user?.tel}`} style={{ color:"inherit", textDecoration:"none" }}>{user?.tel||"—"}</a></span>
          </div>
        </Card>

        {/* Enfants — sélection multi avec filtre places */}
        {user?.enfants?.length > 0 && (
          <Card>
            <h3 style={{ color:C.dark, margin:"0 0 6px", fontSize:15 }}>🧒 Enfants participants</h3>
            <div style={{ fontSize:12, color:"#888", marginBottom:10 }}>
              {booking.spots === 1 ? "⚠️ 1 seule place disponible — 1 enfant maximum" : "2 places disponibles sur ce créneau"}
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {user.enfants.map(e => {
                const sel = selectedEnfants.includes(e.prenom);
                const disabledBySpots = !sel && selectedEnfants.length >= booking.spots;
                return (
                  <div key={e.id||e.prenom} onClick={() => {
                    if (disabledBySpots) return;
                    setSelectedEnfants(s => sel ? s.filter(x=>x!==e.prenom) : [...s, e.prenom]);
                  }} style={{
                    display:"flex", alignItems:"center", gap:8,
                    background: sel ? `${C.sea}30` : disabledBySpots ? "#f0f0f0" : "#f5f5f5",
                    border:`2.5px solid ${sel ? C.sea : "#e0e0e0"}`,
                    borderRadius:50, padding:"8px 16px", cursor:disabledBySpots?"not-allowed":"pointer",
                    fontWeight:700, color:sel?C.deep:disabledBySpots?"#ccc":"#888",
                    opacity:disabledBySpots?0.5:1,
                  }}>
                    <span>{sel?"✓":"○"}</span><span>{e.prenom}</span>
                  </div>
                );
              })}
            </div>
            {/* Prix dynamique */}
            <div style={{ marginTop:12, display:"flex", justifyContent:"space-between", alignItems:"center", background:`${C.ocean}08`, borderRadius:10, padding:"8px 12px" }}>
              <span style={{ fontSize:13, color:"#888", fontWeight:700 }}>
                20 € × {nbEnf} enfant{nbEnf>1?"s":""}
              </span>
              <span style={{ fontSize:18, fontWeight:900, color:C.coral }}>{prixSeance} €</span>
            </div>
          </Card>
        )}

        {/* Prix */}
        <div style={{ background:`${C.ocean}08`, borderRadius:14, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", border:`1.5px solid ${C.ocean}20` }}>
          <span style={{ fontSize:13, color:C.ocean, fontWeight:800 }}>💰 20 € × {nbEnf} enfant{nbEnf>1?"s":""} = <strong>{prixSeance} €</strong></span>
          <span style={{ fontSize:11, color:"#aaa" }}>Forfait appliqué dans le panier</span>
        </div>

        <div style={{ background:"#F8FBFF", borderRadius:14, padding:"12px 14px", textAlign:"left" }}>
          <div style={{ fontWeight:900, color:C.dark, fontSize:13, marginBottom:8 }}>💳 Modes de paiement acceptés</div>
          {[["🏦","Virement bancaire"],["✉️","Chèque"],["💶","Espèces"],["🎫","Chèques vacances"]].map(([icon,label]) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, fontSize:13, color:"#555" }}>
              <span style={{ fontSize:16 }}>{icon}</span>{label}
            </div>
          ))}
          <div style={{ fontSize:11, color:"#aaa", marginTop:8, fontStyle:"italic" }}>Votre accès sera activé à réception du paiement.</div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {setPanier ? (
            <>
              <button onClick={handlePanier} style={{
                background:`linear-gradient(135deg,${C.ocean},${C.sea})`,
                border:"none", color:"#fff", borderRadius:14, padding:"14px",
                cursor:"pointer", fontWeight:900, fontSize:14, fontFamily:"inherit",
                boxShadow:`0 4px 14px ${C.ocean}44`,
              }}>
                🛒 Ajouter au panier · {prixSeance} €
              </button>

            </>
          ) : (
            <SunBtn color={C.green} full onClick={handleConfirm}>📨 Envoyer · {prixSeance} €</SunBtn>
          )}
        </div>
      </div>
    </div>
  );


  if (done) return (
    <div style={{ padding:32, textAlign:"center", background:C.shell, minHeight:"100%" }}>
      <div style={{ fontSize:80 }}>📨</div>
      <h2 style={{ color:C.ocean }}>Demande envoyée ! 🎉</h2>
      <div style={{ background:"#fff", borderRadius:20, padding:20, margin:"16px 0", boxShadow:"0 4px 16px rgba(0,0,0,0.06)", textAlign:"left" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14 }}>
          <div style={{ fontSize:44 }}>🏊</div>
          <div>
            <div style={{ fontWeight:900, fontSize:22, color:C.ocean }}>{done.time}</div>
            <div style={{ color:"#666" }}>{selectedDay?.label} {selectedDay?.num} {selectedDay?.month} 2026</div>
            {done.enfants?.length > 0 && <div style={{ marginTop:6, display:"flex", gap:4, flexWrap:"wrap" }}>{done.enfants.map(e => <Pill key={e} color={C.sea}>{e}</Pill>)}</div>}
          </div>
        </div>
        <div style={{ fontSize:14, color:"#555", lineHeight:1.8, marginBottom:12 }}>
          Votre demande est enregistrée.<br/>
          <strong>L'équipe Eole Beach Club va vous contacter</strong> pour le paiement :<br/>
          🏦 Virement · ✉️ Chèque · 💶 Espèces · 🎫 Chèques vacances
        </div>
        <div style={{ background:`${C.ocean}10`, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.ocean, fontWeight:700 }}>
          ⏳ Votre accès sera activé à réception du paiement
        </div>
      </div>
      <SunBtn color={C.ocean} onClick={() => { setDone(null); onNav("home"); }}>🏠 Retour à l'accueil</SunBtn>
    </div>
  );

  if (booking) return (
    <div style={{ background:C.shell, minHeight:"100%" }}>
      <div style={{ background:`linear-gradient(135deg, #00C9FF, ${C.sea})`, padding:"20px 20px 0", textAlign:"center" }}>
        <div style={{ display:"flex", alignItems:"center", marginBottom:6 }}><BackBtn onNav={() => setBooking(null)} /><div style={{ flex:1, color:"rgba(255,255,255,0.9)", fontSize:13, fontWeight:700 }}>🏊 Réserver la séance</div></div>
        <div style={{ fontSize:56, fontWeight:900, color:"#fff", letterSpacing:-2 }}>{booking.time}</div>
        <div style={{ color:C.sun, fontWeight:800, fontSize:15, marginBottom:4 }}>{selectedDay?.label} {selectedDay?.num} {selectedDay?.month} 2026 ☀️</div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding:"10px 18px 24px", display:"flex", flexDirection:"column", gap:14 }}>
        <Card>
          <h3 style={{ color:C.dark, margin:"0 0 10px", fontSize:15 }}>👤 Parent / Responsable</h3>
          <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"6px 12px", fontSize:14 }}>
            <span style={{ color:"#aaa" }}>Nom</span><strong>{user?.prenom} {NOM(user?.nom)}</strong>
            <span style={{ color:"#aaa" }}>Email</span><span>{user?.email||"—"}</span>
            <span style={{ color:"#aaa" }}>Tél.</span><span><a href={`tel:${user?.tel}`} style={{ color:"inherit", textDecoration:"none" }}>{user?.tel||"—"}</a></span>
          </div>
        </Card>
        {user?.enfants?.length > 0 && (
          <Card>
            <h3 style={{ color:C.dark, margin:"0 0 12px", fontSize:15 }}>🧒 Enfants participants</h3>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {user.enfants.map(e => {
                const sel = selectedEnfants.includes(e.prenom);
                return (
                  <div key={e.id} onClick={() => setSelectedEnfants(s => sel ? s.filter(x=>x!==e.prenom) : [...s,e.prenom])}
                    style={{ display:"flex", alignItems:"center", gap:8, background:sel?`${C.sea}30`:"#f5f5f5", border:`2.5px solid ${sel?C.sea:"#e0e0e0"}`, borderRadius:50, padding:"8px 16px", cursor:"pointer", fontWeight:700, color:sel?C.deep:"#888" }}>
                    <span>{sel?"✓":"○"}</span><span>{e.prenom}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        <div style={{ background:"#F8FBFF", borderRadius:14, padding:"12px 14px", marginBottom:8, textAlign:"left" }}>
          <div style={{ fontWeight:900, color:C.dark, fontSize:13, marginBottom:8 }}>💳 Modes de paiement acceptés</div>
          {[["🏦","Virement bancaire"],["✉️","Chèque"],["💶","Espèces"],["🎫","Chèques vacances"]].map(([icon,label]) => (
            <div key={label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, fontSize:13, color:"#555" }}>
              <span style={{ fontSize:16 }}>{icon}</span>{label}
            </div>
          ))}
          <div style={{ fontSize:11, color:"#aaa", marginTop:8, fontStyle:"italic" }}>Votre accès sera activé à réception du paiement.</div>
        </div>
        <SunBtn color={C.green} full onClick={handleConfirm}>📨 Envoyer la demande · 20 €</SunBtn>
      </div>
    </div>
  );

  const SlotRow = ({ s }) => (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#fff", borderRadius:18, padding:"12px 16px", boxShadow:"0 3px 12px rgba(0,102,204,0.08)", border:`2px solid ${s.spots===1?C.coral+"60":C.sea+"40"}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:44, height:44, borderRadius:14, background:`linear-gradient(135deg,${C.ocean},${C.sea})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🏊</div>
        <div>
          <div style={{ fontWeight:900, fontSize:18, color:C.dark }}>{s.time}</div>
          <div style={{ fontSize:12, fontWeight:700, color:s.spots===1?C.coral:C.green }}>{s.spots===1?"🟡 1 place restante":"🟢 2 places dispo"}</div>
        </div>
      </div>
      <SunBtn small color={s.spots===1?C.coral:C.ocean} onClick={() => setBooking(s)}>Réserver</SunBtn>
    </div>
  );

  const weekLabel = currentWeek.length > 0 ? `${currentWeek[0].num} ${currentWeek[0].month} – ${currentWeek[currentWeek.length-1].num} ${currentWeek[currentWeek.length-1].month}` : "";

  return (
    <div style={{ background:C.shell, minHeight:"100%" }}>
      <div style={{ background:`linear-gradient(135deg, #00C9FF, ${C.sea})`, padding:"20px 20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <BackBtn onNav={onNav} />
          <div><h2 style={{ color:"#fff", margin:0, fontWeight:900, fontSize:20 }}>🏊 Natation</h2><p style={{ color:"rgba(255,255,255,0.8)", margin:0, fontSize:12 }}>Créneaux 30 min · 2 places max</p></div>
        </div>
        {/* Navigation semaine */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(255,255,255,0.2)", borderRadius:16, padding:"8px 12px", marginBottom:10 }}>
          <button onClick={() => setWeekIdx(Math.max(0, weekIdx-1))} disabled={weekIdx===0}
            style={{ background:"rgba(255,255,255,0.3)", border:"none", color:"#fff", borderRadius:10, width:32, height:32, cursor:weekIdx===0?"default":"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit", opacity:weekIdx===0?0.4:1 }}>‹</button>
          <span style={{ color:"#fff", fontWeight:800, fontSize:13 }}>📅 {weekLabel}</span>
          <button onClick={() => setWeekIdx(Math.min(weeks.length-1, weekIdx+1))} disabled={weekIdx===weeks.length-1}
            style={{ background:"rgba(255,255,255,0.3)", border:"none", color:"#fff", borderRadius:10, width:32, height:32, cursor:weekIdx===weeks.length-1?"default":"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit", opacity:weekIdx===weeks.length-1?0.4:1 }}>›</button>
        </div>
        {/* Sélecteur jours */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4 }}>
          {currentWeek.map(d => {
            const sel = effectiveDayId === d.id;
            const avail = (allSeasonSessions||[]).filter(s => s.day===d.id && s.spots>0).length;
            return (
              <button key={d.id} onClick={() => setSelectedDayId(d.id)}
                style={{ background:sel?"#fff":"rgba(255,255,255,0.25)", color:sel?C.ocean:"#fff", border:"none", borderRadius:16, padding:"10px 12px", cursor:"pointer", fontWeight:800, fontFamily:"inherit", minWidth:52, textAlign:"center", transition:"all .15s" }}>
                <div style={{ fontSize:10 }}>{d.label}</div>
                <div style={{ fontSize:18, fontWeight:900 }}>{d.num}</div>
                <div style={{ fontSize:9, color:sel?(avail===0?C.sunset:C.green):"rgba(255,255,255,0.7)" }}>{avail===0?"🔴":avail}</div>
              </button>
            );
          })}
        </div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding:"10px 18px 24px" }}>
        {morning.filter(s=>s.spots>0).length > 0 && (
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ height:2, flex:1, background:`linear-gradient(90deg,${C.sun},transparent)` }} />
              <span style={{ fontWeight:900, color:C.coral, fontSize:13, whiteSpace:"nowrap" }}>☀️ Matin · 9h00 – 12h30</span>
              <div style={{ height:2, flex:1, background:`linear-gradient(270deg,${C.sun},transparent)` }} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>{morning.filter(s=>s.spots>0).map(s=><SlotRow key={s.id} s={s} />)}</div>
          </div>
        )}
        {afternoon.filter(s=>s.spots>0).length > 0 && (
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <div style={{ height:2, flex:1, background:`linear-gradient(90deg,${C.ocean},transparent)` }} />
              <span style={{ fontWeight:900, color:C.ocean, fontSize:13, whiteSpace:"nowrap" }}>🌊 Après-midi · 13h30 – 19h00</span>
              <div style={{ height:2, flex:1, background:`linear-gradient(270deg,${C.ocean},transparent)` }} />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>{afternoon.filter(s=>s.spots>0).map(s=><SlotRow key={s.id} s={s} />)}</div>
          </div>
        )}
        {allForDay.filter(s=>s.spots>0).length === 0 && (
          <Card style={{ textAlign:"center", padding:32 }}>
            <div style={{ fontSize:50, marginBottom:8 }}>🔴</div>
            <p style={{ color:C.sunset, fontWeight:800 }}>Tous les créneaux sont complets</p>
            <p style={{ color:"#aaa", fontSize:13 }}>Essayez un autre jour</p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── MES RÉSERVATIONS ─────────────────────────────────────
function MesReservationsScreen({ onNav, user }) {
  const [resasNat, setResasNat]           = useState([]);
  const [resasClub, setResasClub]         = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [liberteBalance, setLiberteBalance] = useState(0);
  const [liberteTotal, setLiberteTotal]   = useState(0);
  const [hasCarteActive, setHasCarteActive] = useState(false);

  const loadResas = async () => {
    if (!user?.supabaseId) { setLoading(false); return; }
    const [{ data: nat }, { data: club }, { data: membre }] = await Promise.all([
      sb.from("reservations_natation").select("*").eq("membre_id", user.supabaseId).order("date_seance"),
      sb.from("reservations_club").select("*").eq("membre_id", user.supabaseId).order("date_reservation"),
      sb.from("membres").select("liberte_balance, liberte_total").eq("id", user.supabaseId).single(),
    ]);
    setResasNat(nat || []);
    setResasClub(club || []);
    const balance = membre?.liberte_balance || 0;
    const total   = membre?.liberte_total   || 0;
    setLiberteBalance(balance);
    setLiberteTotal(total);
    const carteConfirmee = (club || []).some(r =>
      r.statut === "confirmed" && !isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6
    );
    setHasCarteActive(carteConfirmee && balance > 0);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { loadResas().catch(() => setLoading(false)); }, [user?.supabaseId]);

  if (!user) return (
    <div style={{ background:C.shell, minHeight:"100%" }}>
      <div style={{ background:`linear-gradient(135deg,${C.green},#27AE60)`, padding:"20px 20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}><BackBtn onNav={onNav} /><h2 style={{ color:"#fff", margin:0, fontWeight:900 }}>🎫 Mes accès 2026</h2></div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding:"32px 24px", textAlign:"center" }}>
        <div style={{ fontSize:60, marginBottom:12 }}>🔒</div>
        <h3 style={{ color:C.dark }}>Connectez-vous pour voir vos accès</h3>
        <SunBtn color={C.ocean} onClick={() => onNav("login")}>Se connecter</SunBtn>
      </div>
    </div>
  );

  return (
    <div style={{ background:C.shell, minHeight:"100%" }}>
      <div style={{ background:`linear-gradient(135deg,${C.green},#27AE60)`, padding:"20px 20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <BackBtn onNav={onNav} />
            <div>
              <h2 style={{ color:"#fff", margin:0, fontWeight:900, fontSize:20 }}>🎫 Mes accès saison 2026</h2>
              <p style={{ color:"rgba(255,255,255,0.8)", margin:0, fontSize:12 }}>{user.prenom} {user.nom?.toUpperCase()}</p>
            </div>
          </div>
          <button onClick={() => { setRefreshing(true); loadResas(); }} style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"#fff", borderRadius:50, padding:"6px 14px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>
            {refreshing ? "…" : "↻"}
          </button>
        </div>
        <Wave fill={C.shell} />
      </div>

      <div style={{ padding:"12px 18px 24px", display:"flex", flexDirection:"column", gap:12 }}>

        {/* Carte Liberté */}
        {hasCarteActive ? (
          <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, borderRadius:20, padding:18, boxShadow:`0 6px 20px ${C.coral}44` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div>
                <div style={{ color:"#fff", fontWeight:900, fontSize:16 }}>🎟️ Carte Liberté</div>
                <div style={{ color:"rgba(255,255,255,0.8)", fontSize:11 }}>Valable saison 2026 · 6 juil – 22 août</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#fff", fontWeight:900, fontSize:28, lineHeight:1 }}>{liberteBalance}</div>
                <div style={{ color:"rgba(255,255,255,0.8)", fontSize:11 }}>demi-j. restantes</div>
              </div>
            </div>
            <div style={{ background:"rgba(255,255,255,0.25)", borderRadius:50, height:8, overflow:"hidden", marginBottom:8 }}>
              <div style={{ height:"100%", width:`${liberteTotal > 0 ? (liberteBalance/liberteTotal)*100 : 0}%`, background:"#fff", borderRadius:50 }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"rgba(255,255,255,0.75)", marginBottom:liberteBalance > 0 ? 12 : 0 }}>
              <span>{liberteTotal - liberteBalance} utilisée{(liberteTotal-liberteBalance)>1?"s":""}</span>
              <span>{liberteTotal} au total</span>
            </div>
            {liberteBalance > 0 && (
              <button onClick={() => onNav("reservation-club")} style={{ width:"100%", background:"rgba(255,255,255,0.25)", border:"2px solid rgba(255,255,255,0.5)", color:"#fff", borderRadius:50, padding:"11px", fontWeight:900, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                📅 Réserver avec ma carte
              </button>
            )}
          </div>
        ) : (
          <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.06)", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:32 }}>🎟️</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, color:C.dark }}>Carte Liberté</div>
              <div style={{ fontSize:12, color:"#aaa" }}>Pas encore de carte active</div>
            </div>
            <button onClick={() => onNav("prestations")} style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, border:"none", color:"#fff", borderRadius:50, padding:"8px 14px", fontWeight:900, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Acheter</button>
          </div>
        )}

        {/* Natation */}
        <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontWeight:800, color:C.dark, fontSize:15 }}>🏊 Natation</div>
            <Pill color={C.ocean}>{resasNat.length} séance{resasNat.length>1?"s":""}</Pill>
          </div>
          {loading ? <div style={{ fontSize:12, color:"#bbb", textAlign:"center" }}>Chargement…</div>
          : resasNat.length === 0 ? (
            <div style={{ fontSize:12, color:"#bbb", textAlign:"center", padding:"8px 0" }}>
              Aucune séance réservée
              <div style={{ marginTop:8 }}><button onClick={() => onNav("formules-natation")} style={{ background:`${C.ocean}15`, border:"none", color:C.ocean, borderRadius:50, padding:"6px 14px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>Réserver</button></div>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {resasNat.map((r,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background: r.statut==="pending" ? `${C.sun}15` : `${C.ocean}08`, borderRadius:12, padding:"8px 12px", borderLeft:`3px solid ${r.statut==="pending" ? C.sun : C.ocean}` }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:800, color: r.statut==="pending" ? "#b45309" : C.ocean }}>{r.heure}</div>
                    {r.enfants?.length > 0 && <div style={{ fontSize:11, color:"#888", fontWeight:700 }}>{r.enfants.join(", ")}</div>}
                  </div>
                  <div style={{ fontSize:11, color:"#888" }}>{r.date_seance ? parseLocalDate(r.date_seance).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}) : "—"}</div>
                  {r.statut === "pending"
                    ? <span style={{ background:`${C.sun}20`, color:"#b45309", borderRadius:50, padding:"2px 8px", fontSize:10, fontWeight:800 }}>⏳</span>
                    : <Pill color={C.green}>✓</Pill>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Club */}
        {(() => {
          const resasClubFiltered = resasClub.filter(r => !(Array.isArray(r.enfants) && Number(r.enfants[0]) >= 6));
          return (
            <div style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontWeight:800, color:C.dark, fontSize:15 }}>🏖️ Club de Plage</div>
                <Pill color={C.coral}>{resasClubFiltered.length} demi-j.</Pill>
              </div>
              {loading ? <div style={{ fontSize:12, color:"#bbb", textAlign:"center" }}>Chargement…</div>
              : resasClubFiltered.length === 0 ? (
                <div style={{ fontSize:12, color:"#bbb", textAlign:"center", padding:"8px 0" }}>Aucune réservation club</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {resasClubFiltered.map((r,i) => (
                    <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background: r.statut==="pending" ? `${C.sun}15` : `${C.coral}08`, borderRadius:12, padding:"8px 12px", borderLeft:`3px solid ${r.statut==="pending" ? C.sun : C.coral}` }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:800, color: r.statut==="pending" ? "#b45309" : C.coral }}>
                          {(r.label_jour||"").startsWith("[LIBERTE]") ? "🎟️ Carte Liberté" : r.session==="matin"?"☀️ Matin":"🌊 Après-midi"}
                        </div>
                        {r.enfants?.length > 0 && !isNaN(Number(r.enfants[0])) === false && <div style={{ fontSize:11, color:"#888", fontWeight:700 }}>{r.enfants.join(", ")}</div>}
                      </div>
                      <div style={{ fontSize:11, color:"#888" }}>{r.date_reservation ? new Date(r.date_reservation).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}) : "—"}</div>
                      {r.statut === "pending"
                        ? <span style={{ background:`${C.sun}20`, color:"#b45309", borderRadius:50, padding:"2px 8px", fontSize:10, fontWeight:800 }}>⏳</span>
                        : <Pill color={C.green}>✓</Pill>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ── LOGIN SCREEN ──────────────────────────────────────────
function LoginScreen({ onNav, setUser }) {
  const [email, setEmail]       = useState("");
  const [step, setStep]         = useState("form"); // form | sent | loading | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleSend = async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("Merci de saisir un email valide."); return;
    }
    setStep("loading");
    try {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true }
      });
      if (error) throw error;
      setStep("sent");
    } catch(e) {
      setErrorMsg(e.message || "Erreur lors de l'envoi. Réessayez.");
      setStep("error");
    }
  };

  return (
    <div style={{ background: C.shell, minHeight: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.ocean}, ${C.sea})`, padding: "24px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={() => onNav("home")} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: "50%", width: 36, height: 36, cursor: "pointer", fontSize: 18, fontFamily: "inherit" }}>←</button>
          <h2 style={{ color: "#fff", margin: 0, fontWeight: 900, fontSize: 20 }}>Mon espace Eole Beach Club</h2>
        </div>
        <Wave fill={C.shell} />
      </div>

      <div style={{ flex: 1, padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>

        {step === "sent" ? (
          /* Succès */
          <div style={{ textAlign: "center", maxWidth: 320 }}>
            <div style={{ width: 90, height: 90, borderRadius: "50%", background: `linear-gradient(135deg, ${C.green}, #1E8449)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, margin: "0 auto 20px" }}>📧</div>
            <h2 style={{ color: C.dark, fontWeight: 900, margin: "0 0 10px" }}>Email envoyé !</h2>
            <p style={{ color: "#666", fontSize: 14, lineHeight: 1.6, margin: "0 0 8px" }}>
              Un lien de connexion a été envoyé à <strong>{email}</strong>
            </p>
            <p style={{ color: "#888", fontSize: 13, margin: "0 0 28px" }}>
              Cliquez sur le lien dans l'email pour accéder à votre compte. Valable 24h.
            </p>
            <div style={{ background: `${C.ocean}12`, borderRadius: 16, padding: "12px 16px", marginBottom: 24, fontSize: 13, color: C.ocean, fontWeight: 700 }}>
              💡 Vérifiez aussi vos spams
            </div>
            <button onClick={() => { setStep("form"); setEmail(""); }} style={{ background: "none", border: "none", color: C.ocean, fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
              ← Utiliser un autre email
            </button>
          </div>
        ) : (
          /* Formulaire */
          <div style={{ width: "100%", maxWidth: 340 }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🏖️</div>
              <h2 style={{ color: C.dark, fontWeight: 900, margin: "0 0 8px" }}>Connexion</h2>
              <p style={{ color: "#888", fontSize: 14, margin: 0 }}>
                Entrez votre email — nous vous envoyons un lien de connexion instantané
              </p>
            </div>

            <Card>
              <label style={{ fontSize: 12, fontWeight: 900, color: C.ocean, display: "block", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>
                📧 Votre email
              </label>
              <input
                type="email" value={email}
                onChange={e => { setEmail(e.target.value); setErrorMsg(""); setStep("form"); }}
                placeholder="prenom@exemple.fr"
                style={{ width: "100%", border: `2px solid ${errorMsg ? C.sunset : "#e0e8f0"}`, borderRadius: 14, padding: "13px 16px", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", color: C.dark }}
                onFocus={e => e.target.style.borderColor = C.ocean}
                onBlur={e => e.target.style.borderColor = errorMsg ? C.sunset : "#e0e8f0"}
                onKeyDown={e => e.key === "Enter" && handleSend()}
              />

              {errorMsg && (
                <div style={{ background: "#fff0f0", border: `1.5px solid ${C.sunset}44`, borderRadius: 10, padding: "8px 12px", marginTop: 10, fontSize: 13, color: C.sunset, fontWeight: 700 }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <SunBtn color={C.ocean} full onClick={handleSend} style={{ marginTop: 16 }}>
                {step === "loading" ? "⏳ Envoi en cours..." : "✉️ Recevoir mon lien de connexion"}
              </SunBtn>
            </Card>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <p style={{ color: "#aaa", fontSize: 13, margin: "0 0 10px" }}>Pas encore de compte ?</p>
              <SunBtn color={C.coral} onClick={() => onNav("inscription")}>
                📋 S'inscrire au Club
              </SunBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── INSCRIPTION ───────────────────────────────────────────
function InscriptionScreen({ onNav, setUser }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", tel: "", tel2: "", adresse: "", ville: "", cp: "", adresse_vac: "", ville_vac: "", cp_vac: "", enfants: [], droitImage: false, droitDiffusion: false });
  const [newEnfant, setNewEnfant] = useState({ prenom: "", nom: "", naissance: "", sexe: "", activite: "club", niveau: "debutant", allergies: "" });
  const [done, setDone] = useState(false);
  const [step1Error, setStep1Error] = useState(false);
  const [showCgvModal, setShowCgvModal] = useState(false);
  const [showEnfantForm, setShowEnfantForm] = useState(true); // formulaire ajout enfant visible
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const cpValid    = /^\d{5}$/.test(form.cp);
  const cpVacValid = /^\d{5}$/.test(form.cp_vac);
  const step1Valid = form.prenom && form.nom && form.email && emailValid && form.tel && form.adresse && form.ville && form.cp && cpValid && form.adresse_vac && form.ville_vac && form.cp_vac && cpVacValid;

  const goToStep2 = () => {
    if (!step1Valid) { setStep1Error(true); return; }
    setStep1Error(false); setStep(2);
  };

  if (done) return (
    <div style={{ minHeight: "100%", background: `linear-gradient(160deg, #0099FF 0%, #00C9FF 45%, ${C.sea} 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.07)", top: -80, right: -80 }} />
      <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,0.07)", bottom: -40, left: -60 }} />
      <div style={{ position: "relative", zIndex: 2 }}>
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "3px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 46 }}>✓</div>
        <div style={{ display: "inline-block", background: "rgba(255,255,255,0.2)", borderRadius: 50, padding: "4px 18px", marginBottom: 16, border: "1.5px solid rgba(255,255,255,0.4)" }}>
          <span style={{ color: "#fff", fontSize: 12, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>Inscription confirmée</span>
        </div>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 900, margin: "0 0 8px" }}>Bienvenue {form.prenom} !</h1>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, margin: "0 0 32px", fontWeight: 600 }}>Tu fais maintenant partie de la famille Eole Beach Club 🌊</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
          <div style={{ background: "rgba(255,255,255,0.22)", borderRadius: 50, padding: "8px 18px", color: "#fff", fontWeight: 800, fontSize: 13 }}>👧 {form.enfants.length} enfant{form.enfants.length > 1 ? "s" : ""}</div>
          {form.droitImage && <div style={{ background: "rgba(255,255,255,0.22)", borderRadius: 50, padding: "8px 18px", color: "#fff", fontWeight: 800, fontSize: 13 }}>📸 Droit image ✓</div>}
          <div style={{ background: "rgba(255,255,255,0.22)", borderRadius: 50, padding: "8px 18px", color: "#fff", fontWeight: 800, fontSize: 13 }}>☀️ Été 2026</div>
        </div>
        <button onClick={() => onNav("home")} style={{ background: "#fff", color: C.ocean, border: "none", borderRadius: 50, padding: "16px 40px", fontSize: 16, fontWeight: 900, cursor: "pointer", boxShadow: "0 8px 28px rgba(0,0,0,0.18)", fontFamily: "inherit" }}>C'est parti ! 🏊</button>
      </div>
    </div>
  );

  return (
    <div style={{ background: C.shell, minHeight: "100%" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.coral}, ${C.sun})`, padding: "20px 20px 0" }}>
        <button onClick={() => onNav("home")} style={{ background: "rgba(255,255,255,0.28)", border: "none", color: "#fff", borderRadius: 50, width: 38, height: 38, fontSize: 18, cursor: "pointer", fontWeight: 900 }}>←</button>
        <div style={{ textAlign: "center", padding: "6px 0 0" }}>
          <div style={{ fontSize: 38 }}>📋</div>
          <h2 style={{ color: "#fff", margin: "4px 0", fontWeight: 900 }}>Inscription</h2>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 14 }}>
            {[1,2,3,4].map(i => <div key={i} style={{ height: 6, flex: 1, maxWidth: 65, borderRadius: 10, background: i <= step ? "#fff" : "rgba(255,255,255,0.33)", transition: "all .3s" }} />)}
          </div>
        </div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding: "10px 18px 24px" }}>
        {step === 1 && (
          <Card>
            <h3 style={{ color: C.dark, marginTop: 0 }}>👤 Parent / Responsable</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
              <FInput label="Prénom" value={form.prenom} onChange={f("prenom")} required />
              <FInput label="Nom" value={form.nom} onChange={f("nom")} required />
            </div>
            <FInput label="Email" type="email" value={form.email} onChange={f("email")} required />
            {form.email && !emailValid && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ Format invalide — ex : prenom@exemple.fr</div>}
            <FInput label="Téléphone" type="tel" value={form.tel} onChange={f("tel")} required />
            <FInput label="Téléphone 2" type="tel" value={form.tel2} onChange={f("tel2")} placeholder="Autre numéro (optionnel)" />

            {/* Adresse principale */}
            <div style={{ fontSize:12, fontWeight:900, color:C.ocean, textTransform:"uppercase", letterSpacing:0.5, marginBottom:-4 }}>🏠 Adresse principale</div>
            <FInput label="Adresse *" value={form.adresse} onChange={f("adresse")} required />
            {step1Error && !form.adresse && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ L'adresse est obligatoire</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0 12px" }}>
              <div>
                <FInput label="Code postal *" value={form.cp} onChange={f("cp")} required />
                {form.cp && !cpValid && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ 5 chiffres</div>}
              </div>
              <div>
                <FInput label="Ville *" value={form.ville} onChange={f("ville")} required />
                {step1Error && !form.ville && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ Obligatoire</div>}
              </div>
            </div>

            {/* Adresse vacances */}
            <div style={{ fontSize:12, fontWeight:900, color:C.coral, textTransform:"uppercase", letterSpacing:0.5, marginBottom:-4 }}>🏖️ Adresse de vacances</div>
            <FInput label="Adresse *" value={form.adresse_vac} onChange={f("adresse_vac")} required />
            {step1Error && !form.adresse_vac && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ L'adresse de vacances est obligatoire</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0 12px" }}>
              <div>
                <FInput label="Code postal *" value={form.cp_vac} onChange={f("cp_vac")} required />
                {form.cp_vac && !cpVacValid && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ 5 chiffres</div>}
              </div>
              <div>
                <FInput label="Ville *" value={form.ville_vac} onChange={f("ville_vac")} required />
                {step1Error && !form.ville_vac && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ Obligatoire</div>}
              </div>
            </div>

            {step1Error && (
              <div style={{ background: `${C.sunset}18`, border: `2px solid ${C.sunset}`, borderRadius: 14, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.sunset }}>
                  {form.email && !emailValid ? "L'adresse email n'est pas valide (ex : prenom@exemple.fr)"
                    : (form.cp && !cpValid) || (form.cp_vac && !cpVacValid) ? "Le code postal doit contenir 5 chiffres (ex : 44500)"
                    : "Merci de remplir tous les champs obligatoires (✦) avant de continuer."}
                </span>
              </div>
            )}
            <SunBtn color={C.coral} full onClick={goToStep2}>Suivant → Les enfants 👧</SunBtn>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <h3 style={{ color: C.dark, marginTop: 0 }}>🧒 Enfants inscrits</h3>

            {/* Enfants validés - cliquables pour modifier */}
            {form.enfants.map((e, idx) => (
              <div key={e.id}>
                {/* Si cet enfant est en cours de modification */}
                {newEnfant._editId === e.id ? (
                  <div style={{ border:`2.5px solid ${C.coral}`, borderRadius:18, padding:16, marginBottom:14, background:`${C.coral}06` }}>
                    <h4 style={{ color:C.coral, marginTop:0 }}>✏️ Modifier {e.prenom}</h4>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 12px" }}>
                      <FInput label="Prénom" value={newEnfant.prenom} onChange={v => setNewEnfant(e => ({ ...e, prenom:v }))} required />
                      <FInput label="Nom" value={newEnfant.nom} onChange={v => setNewEnfant(e => ({ ...e, nom:v }))} required />
                    </div>
                    <FInput label="Date de naissance" type="date" value={newEnfant.naissance} onChange={v => setNewEnfant(e => ({ ...e, naissance:v }))} required />
                    <div style={{ marginBottom:12 }}>
                      <label style={{ fontSize:12, fontWeight:900, color:C.deep, display:"block", marginBottom:6, textTransform:"uppercase" }}>Sexe</label>
                      <div style={{ display:"flex", gap:8 }}>
                        {[["M","👦 Garçon"],["F","👧 Fille"]].map(([val, label]) => (
                          <div key={val} onClick={() => setNewEnfant(e => ({ ...e, sexe:val }))} style={{ flex:1, textAlign:"center", padding:"10px 6px", borderRadius:14, cursor:"pointer", fontWeight:800, fontSize:13,
                            background: newEnfant.sexe===val ? (val==="M" ? C.green : "#9B59B6") : "#f0f0f0",
                            color: newEnfant.sexe===val ? "#fff" : "#888",
                            border:`2px solid ${newEnfant.sexe===val ? (val==="M" ? C.green : "#9B59B6") : "transparent"}` }}>{label}</div>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom:12 }}>
                      <label style={{ fontSize:12, fontWeight:900, color:C.deep, display:"block", marginBottom:6, textTransform:"uppercase" }}>Activité</label>
                      <div style={{ display:"flex", gap:8 }}>
                        {[["club","🏖️ Club"],["natation","🏊 Natation"],["les deux","🏖️🏊 Les deux"]].map(([val, label]) => (
                          <div key={val} onClick={() => setNewEnfant(e => ({ ...e, activite:val }))} style={{ flex:1, textAlign:"center", padding:"9px 6px", borderRadius:14, cursor:"pointer", fontWeight:800, fontSize:12,
                            background: newEnfant.activite===val ? C.sea : "#f0f0f0",
                            color: newEnfant.activite===val ? "#fff" : "#888",
                            border:`2px solid ${newEnfant.activite===val ? C.sea : "transparent"}` }}>{label}</div>
                        ))}
                      </div>
                    </div>
                    {(newEnfant.activite==="natation" || newEnfant.activite==="les deux") && (
                      <div style={{ marginBottom:12 }}>
                        <label style={{ fontSize:12, fontWeight:900, color:C.deep, display:"block", marginBottom:5, textTransform:"uppercase" }}>Niveau 🏊</label>
                        <div style={{ display:"flex", gap:6 }}>
                          {[["debutant","🌱 Débutant"],["intermediaire","🌊 Intermédiaire"],["avance","🏊 Avancé"]].map(([val, label]) => (
                            <div key={val} onClick={() => setNewEnfant(e => ({ ...e, niveau:val }))} style={{ flex:1, textAlign:"center", padding:"8px 4px", borderRadius:12, cursor:"pointer", fontWeight:800, fontSize:11,
                              background: newEnfant.niveau===val ? C.ocean : "#f0f0f0",
                              color: newEnfant.niveau===val ? "#fff" : "#888" }}>{label}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    <FInput label="Allergies" value={newEnfant.allergies} onChange={v => setNewEnfant(e => ({ ...e, allergies:v }))} placeholder="Aucune si vide" />
                    <div style={{ marginBottom:12 }}>
                      <label style={{ fontSize:12, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>👤 Personnes autorisées à récupérer l'enfant</label>
                      <FInput placeholder="Ex : Marie Dupont (grand-mère)…" value={newEnfant.personnesAutorisees||""} onChange={v => setNewEnfant(e => ({ ...e, personnesAutorisees:v }))} />
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={() => setNewEnfant({ prenom:"", nom:"", naissance:"", sexe:"", activite:"club", niveau:"debutant", allergies:"", personnesAutorisees:"" })}
                        style={{ flex:1, background:"#f0f0f0", border:"none", color:"#888", borderRadius:12, padding:"10px", cursor:"pointer", fontWeight:800, fontFamily:"inherit" }}>Annuler</button>
                      <button onClick={() => {
                        if (!newEnfant.prenom || !newEnfant.nom || !newEnfant.naissance) { alert("Prénom, nom et date requis."); return; }
                        setForm(p => ({ ...p, enfants: p.enfants.map(x => x.id === newEnfant._editId ? { ...newEnfant, id: x.id } : x) }));
                        setNewEnfant({ prenom:"", nom:"", naissance:"", sexe:"", activite:"club", niveau:"debutant", allergies:"", personnesAutorisees:"" });
                      }} style={{ flex:2, background:`linear-gradient(135deg,${C.coral},${C.sun})`, border:"none", color:"#fff", borderRadius:12, padding:"10px", cursor:"pointer", fontWeight:900, fontFamily:"inherit" }}>✅ Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:`${C.sea}18`, border:`2px solid ${C.sea}40`, borderRadius:14, padding:"10px 14px", marginBottom:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, color:C.dark }}>{e.sexe==="M"?"👦":"👧"} {e.prenom} {NOM(e.nom)}</div>
                      <div style={{ fontSize:12, color:"#888" }}>
                        {e.naissance ? e.naissance.split("-").reverse().join("/") : ""} · {e.activite==="club"?"🏖️ Club":e.activite==="natation"?"🏊 Natation":"🏖️🏊 Club & Natation"}
                        {e.activite!=="club" && ` · ${e.niveau}`}
                      </div>
                      {e.allergies && <div style={{ fontSize:12, color:C.sunset }}>⚠️ {e.allergies}</div>}
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      <button onClick={() => setNewEnfant({ ...e, _editId: e.id })}
                        style={{ background:`${C.ocean}15`, border:"none", color:C.ocean, borderRadius:8, width:28, height:28, cursor:"pointer", fontSize:13 }}>✏️</button>
                      <button onClick={() => setForm(p => ({ ...p, enfants: p.enfants.filter(x => x.id !== e.id) }))}
                        style={{ background:`${C.sunset}20`, border:"none", color:C.sunset, borderRadius:"50%", width:28, height:28, cursor:"pointer", fontWeight:900 }}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Formulaire nouvel enfant — visible si pas en mode édition */}
            {!newEnfant._editId && (
              <div style={{ border:`2.5px dashed ${C.sea}`, borderRadius:18, padding:16, marginBottom:14, background:`${C.sea}06` }}>
                <h4 style={{ color:C.ocean, marginTop:0 }}>
                  {form.enfants.length === 0 ? "👧 Enfant à inscrire" : `➕ Enfant ${form.enfants.length + 1}`}
                </h4>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 12px" }}>
                  <FInput label="Prénom" value={newEnfant.prenom} onChange={v => setNewEnfant(e => ({ ...e, prenom:v }))} required />
                  <FInput label="Nom" value={newEnfant.nom} onChange={v => setNewEnfant(e => ({ ...e, nom:v }))} required />
                </div>
                <FInput label="Date de naissance" type="date" value={newEnfant.naissance} onChange={v => setNewEnfant(e => ({ ...e, naissance:v }))} required />
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, fontWeight:900, color:C.deep, display:"block", marginBottom:6, textTransform:"uppercase" }}>Sexe</label>
                  <div style={{ display:"flex", gap:8 }}>
                    {[["M","👦 Garçon"],["F","👧 Fille"]].map(([val, label]) => (
                      <div key={val} onClick={() => setNewEnfant(e => ({ ...e, sexe:val }))} style={{ flex:1, textAlign:"center", padding:"10px 6px", borderRadius:14, cursor:"pointer", fontWeight:800, fontSize:13,
                        background: newEnfant.sexe===val ? (val==="M" ? C.green : "#9B59B6") : "#f0f0f0",
                        color: newEnfant.sexe===val ? "#fff" : "#888",
                        border:`2px solid ${newEnfant.sexe===val ? (val==="M" ? C.green : "#9B59B6") : "transparent"}` }}>{label}</div>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:12, fontWeight:900, color:C.deep, display:"block", marginBottom:6, textTransform:"uppercase" }}>Activité</label>
                  <div style={{ display:"flex", gap:8 }}>
                    {[["club","🏖️ Club"],["natation","🏊 Natation"],["les deux","🏖️🏊 Les deux"]].map(([val, label]) => (
                      <div key={val} onClick={() => setNewEnfant(e => ({ ...e, activite:val }))} style={{ flex:1, textAlign:"center", padding:"9px 6px", borderRadius:14, cursor:"pointer", fontWeight:800, fontSize:12,
                        background: newEnfant.activite===val ? C.sea : "#f0f0f0",
                        color: newEnfant.activite===val ? "#fff" : "#888",
                        border:`2px solid ${newEnfant.activite===val ? C.sea : "transparent"}` }}>{label}</div>
                    ))}
                  </div>
                </div>
                {(newEnfant.activite==="natation" || newEnfant.activite==="les deux") && (
                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:12, fontWeight:900, color:C.deep, display:"block", marginBottom:5, textTransform:"uppercase" }}>Niveau 🏊</label>
                    <div style={{ display:"flex", gap:6 }}>
                      {[["debutant","🌱 Débutant"],["intermediaire","🌊 Intermédiaire"],["avance","🏊 Avancé"]].map(([val, label]) => (
                        <div key={val} onClick={() => setNewEnfant(e => ({ ...e, niveau:val }))} style={{ flex:1, textAlign:"center", padding:"8px 4px", borderRadius:12, cursor:"pointer", fontWeight:800, fontSize:11,
                          background: newEnfant.niveau===val ? C.ocean : "#f0f0f0",
                          color: newEnfant.niveau===val ? "#fff" : "#888" }}>{label}</div>
                      ))}
                    </div>
                  </div>
                )}
                <FInput label="Allergies / informations médicales" value={newEnfant.allergies} onChange={v => setNewEnfant(e => ({ ...e, allergies:v }))} placeholder="Aucune si vide" />
                <div>
                  <label style={{ fontSize:12, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>👤 Personnes autorisées à récupérer l'enfant</label>
                  <div style={{ fontSize:11, color:"#aaa", marginBottom:6 }}>Autres que le responsable légal (prénom + nom + lien de parenté)</div>
                  <FInput placeholder="Ex : Marie Dupont (grand-mère), Paul Martin (oncle)…" value={newEnfant.personnesAutorisees||""} onChange={v => setNewEnfant(e => ({ ...e, personnesAutorisees:v }))} />
                </div>
              </div>
            )}

            {/* Bouton ➕ Ajouter un autre enfant — valide le courant */}
            {!newEnfant._editId && (
              <button onClick={() => {
                if (!newEnfant.prenom || !newEnfant.nom || !newEnfant.naissance) { alert("Merci de remplir le prénom, nom et date de naissance."); return; }
                const age = calcAge(newEnfant.naissance);
                if (age < 3) { alert("L'enfant doit avoir au moins 3 ans pour s'inscrire."); return; }
                  if (age > 13) { alert("L'inscription est réservée aux enfants de 13 ans maximum."); return; }
                setForm(p => ({ ...p, enfants: [...p.enfants, { ...newEnfant, id: Date.now() }] }));
                setNewEnfant({ prenom:"", nom:"", naissance:"", sexe:"", activite:"club", niveau:"debutant", allergies:"", personnesAutorisees:"" });
              }} style={{ width:"100%", background:`${C.ocean}10`, border:`2px dashed ${C.ocean}40`, color:C.ocean, borderRadius:14, padding:"11px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit", marginBottom:14 }}>
                ➕ Ajouter un autre enfant
              </button>
            )}

            <div style={{ display:"flex", gap:10 }}>
              <SunBtn color="#bbb" onClick={() => setStep(1)} style={{ flex:1 }}>← Retour</SunBtn>
              <SunBtn color={C.coral} onClick={() => {
                if (newEnfant._editId) { alert("Merci d'enregistrer les modifications en cours."); return; }
                if (newEnfant.prenom && newEnfant.nom && newEnfant.naissance) {
                  const age = calcAge(newEnfant.naissance);
                  if (age < 3) { alert("L'enfant doit avoir au moins 3 ans pour s'inscrire."); return; }
                  if (age > 13) { alert("L'inscription est réservée aux enfants de 13 ans maximum."); return; }
                  setForm(p => ({ ...p, enfants: [...p.enfants, { ...newEnfant, id: Date.now() }] }));
                  setNewEnfant({ prenom:"", nom:"", naissance:"", sexe:"", activite:"club", niveau:"debutant", allergies:"", personnesAutorisees:"" });
                } else if (form.enfants.length === 0) {
                  alert("Veuillez remplir les informations de votre enfant.");
                  return;
                }
                setStep(3);
              }} style={{ flex:2 }}>Suivant → Droits 📸</SunBtn>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <h3 style={{ color: C.dark, marginTop: 0 }}>📸 Droit à l'image</h3>
            <div style={{ background: `${C.sky}20`, border: `2px solid ${C.sky}`, borderRadius: 16, padding: 16, marginBottom: 20, fontSize: 14, color: "#555", lineHeight: 1.7 }}>
              Dans le cadre des activités du Eole Beach Club, des photos et/ou vidéos pourront être réalisées lors des séances. Ces images peuvent être utilisées à des fins de communication non commerciale.
            </div>
            {[
              { key: "droitImage",    label: "J'autorise l'Eole Beach Club à photographier et/ou filmer mon/mes enfant(s) lors des activités.", icon: "📷" },
              { key: "droitDiffusion",label: "J'autorise la diffusion de ces images sur les supports de communication du club (site, réseaux sociaux, affiches).", icon: "📢" },
            ].map(({ key, label, icon }) => (
              <div key={key} onClick={() => setForm(p => ({ ...p, [key]: !p[key] }))} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", marginBottom: 12, background: form[key] ? `${C.green}15` : "#f9f9f9", border: `2.5px solid ${form[key] ? C.green : "#e0e0e0"}`, borderRadius: 18, cursor: "pointer", transition: "all .18s" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: form[key] ? C.green : "#ddd", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 15, flexShrink: 0, marginTop: 2, transition: "all .18s" }}>{form[key] ? "✓" : ""}</div>
                <div style={{ fontSize: 14, color: C.dark, fontWeight: 600, lineHeight: 1.5 }}><span style={{ marginRight: 6 }}>{icon}</span>{label}</div>
              </div>
            ))}
            <div style={{ background: "#FFF8EF", border: `1.5px solid ${C.sun}`, borderRadius: 12, padding: 12, marginBottom: 16, fontSize: 12, color: "#888" }}>
              ⚠️ Ces autorisations sont valables pour la saison estivale 2026 et peuvent être révoquées à tout moment par écrit.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <SunBtn color="#bbb" onClick={() => setStep(2)} style={{ flex: 1 }}>← Retour</SunBtn>
              <SunBtn color={C.coral} onClick={() => setStep(4)} style={{ flex: 2 }}>Suivant → Récap 📋</SunBtn>
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <h3 style={{ color: C.dark, marginTop: 0 }}>✅ Récapitulatif</h3>
            <div style={{ background: `${C.sea}15`, border: `2px solid ${C.sea}40`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 17, color: C.dark }}>{form.prenom} {NOM(form.nom)}</div>
              <div style={{ color: "#666", fontSize: 14 }}>{form.email} · {form.tel}{form.tel2 ? ` · ${form.tel2}` : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontWeight: 800, color: C.dark }}>Enfants inscrits :</div>
              <div style={{ background: form.enfants.length === 0 ? "#eee" : `linear-gradient(135deg, ${C.sea}, ${C.ocean})`, color: form.enfants.length === 0 ? "#aaa" : "#fff", borderRadius: 50, padding: "4px 16px", fontWeight: 900, fontSize: 15 }}>
                {form.enfants.length} enfant{form.enfants.length > 1 ? "s" : ""}
              </div>
            </div>
            {form.enfants.length === 0 ? <p style={{ color: "#bbb", fontSize: 14 }}>Aucun enfant ajouté</p> : form.enfants.map(e => (
              <div key={e.id} style={{ background: `${C.sun}30`, borderRadius: 12, padding: "8px 14px", marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{e.prenom} {NOM(e.nom)} <span style={{ fontWeight: 500, fontSize: 13, color: "#666" }}>— {e.activite === "club" ? "🏖️ Club" : e.activite === "natation" ? "🏊 Natation" : "🏖️🏊 Club & Natation"}{e.activite !== "club" ? ` · ${e.niveau}` : ""}</span></div>
                {e.allergies && <div style={{ fontSize: 12, color: C.sunset, marginTop: 2 }}>⚠️ {e.allergies}</div>}
              </div>
            ))}
            <div style={{ background: `${C.sky}15`, border: `1.5px solid ${C.sky}`, borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
              <div style={{ fontWeight: 800, color: C.dark, marginBottom: 6 }}>📸 Droit à l'image</div>
              <div style={{ color: "#666" }}>Photos : {form.droitImage ? "✅ Autorisé" : "❌ Refusé"}</div>
              <div style={{ color: "#666" }}>Diffusion : {form.droitDiffusion ? "✅ Autorisée" : "❌ Refusée"}</div>
            </div>

            {/* Modale CGV inline */}
            {showCgvModal && (
              <div style={{ position:"fixed", inset:0, zIndex:1200, display:"flex", flexDirection:"column" }}>
                <div onClick={() => setShowCgvModal(false)} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
                <div style={{ position:"relative", marginTop:"auto", background:"#fff", borderRadius:"28px 28px 0 0", maxHeight:"85vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
                  <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
                    <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
                  </div>
                  <div style={{ background:`linear-gradient(135deg,${C.ocean},${C.sea})`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
                    <button onClick={() => setShowCgvModal(false)} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
                    <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>📄 Conditions Générales</div>
                    <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13 }}>EOLE BEACH CLUB · Saison 2026</div>
                  </div>
                  <div style={{ overflowY:"auto", padding:"16px 20px 32px", display:"flex", flexDirection:"column", gap:14, fontSize:14, color:"#555", lineHeight:1.7 }}>
                    <div><strong style={{ color:C.dark }}>💶 Remboursement</strong><br/>Aucune prestation ne pourra être remboursée, excepté sur présentation d'une attestation médicale justifiant l'impossibilité de participer aux activités.</div>
                    <div><strong style={{ color:C.dark }}>⛅ Annulation par le club</strong><br/>En cas d'annulation par le club (météo défavorable, force majeure ou tout autre motif indépendant de notre volonté), les séances seront reportées à une date ultérieure.</div>
                    <div><strong style={{ color:C.dark }}>📋 Règlement Club de Plage</strong><br/>Respecter les consignes des animateurs · Prévoir un équipement adapté (casquette, gourde, serviette, maillot) · Pas de nourriture dans l'espace de jeux.</div>
                    <div><strong style={{ color:C.dark }}>🏊 Règlement Natation</strong><br/>Arriver 5 min avant la séance · Enfants accompagnés jusqu'au bassin · Inscription préalable obligatoire.</div>
                    <div><strong style={{ color:C.dark }}>📸 Droit à l'image</strong><br/>Des photos et/ou vidéos pourront être réalisées lors des séances à des fins de communication non commerciale, sous réserve de votre autorisation.</div>
                    <SunBtn color={C.green} full onClick={() => { setForm(p => ({ ...p, cgvAccepted: true })); setShowCgvModal(false); }}>✅ J'accepte les conditions</SunBtn>
                  </div>
                </div>
              </div>
            )}

            {/* CGV acceptance */}
            <div style={{ background: `${C.deep}08`, border: `1.5px solid ${C.deep}25`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, color: C.deep, fontSize: 13, marginBottom: 8 }}>📄 Conditions Générales de Vente</div>
              <div style={{ background: `${C.sunset}10`, border: `1px solid ${C.sunset}30`, borderRadius: 10, padding: "9px 12px", marginBottom: 10, fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                💶 <strong>Remboursement :</strong> Aucune prestation ne pourra être remboursée, excepté sur présentation d'une attestation médicale justifiant l'impossibilité de participer.<br/><br/>⛅ <strong>Annulation par le club :</strong> En cas d'annulation par le club (météo défavorable, force majeure ou tout autre motif indépendant de notre volonté), les séances seront reportées à une date ultérieure.
              </div>
              <div onClick={() => setForm(p => ({ ...p, cgvAccepted: !p.cgvAccepted }))} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 22, height: 22, borderRadius: 8, border: `2.5px solid ${form.cgvAccepted ? C.green : "#ccc"}`, background: form.cgvAccepted ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13, flexShrink: 0, marginTop: 1, transition: "all .15s" }}>
                  {form.cgvAccepted ? "✓" : ""}
                </div>
                <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
                  J'ai lu et j'accepte les <span style={{ color: C.ocean, fontWeight: 700, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); setShowCgvModal(true); }}>Conditions Générales de Vente</span> ainsi que le règlement intérieur de l'Eole Beach Club, et j'autorise la prise en charge de mon/mes enfant(s) dans le cadre des activités.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <SunBtn color="#bbb" onClick={() => setStep(3)} style={{ flex: 1 }}>← Retour</SunBtn>
              <SunBtn color={form.cgvAccepted ? C.green : "#ccc"} disabled={!form.cgvAccepted} onClick={async () => {
                if (!form.cgvAccepted) return;
                try {
                  const membre = await creerMembre(form);
                  await creerEnfants(membre.id, form.enfants || []);
                  setUser({ ...form, supabaseId: membre.id });
                } catch (e) {
                  // Si email déjà existant, on récupère le membre
                  const existing = await getMembre(form.email);
                  if (existing) setUser({ ...form, supabaseId: existing.id });
                  else setUser({ ...form });
                }
                setDone(true);
              }} style={{ flex: 2 }}>🎉 Confirmer !</SunBtn>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── INFOS ─────────────────────────────────────────────────
function InfosScreen({ onNav }) {
  const [showCGV, setShowCGV] = useState(false);
  return (
    <div style={{ background: C.shell, minHeight: "100%" }}>
      <div style={{ background: `linear-gradient(135deg, #9B59B6, #8E44AD)`, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}><BackBtn onNav={onNav} /><h2 style={{ color: "#fff", margin: 0, fontWeight: 900 }}>ℹ️ Infos du Club</h2></div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding: "10px 18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Card>
          <h3 style={{ color: C.dark, marginTop: 0 }}>🕐 Horaires</h3>
          {[["Lun – Sam", "9h30 – 12h30 · 14h30 – 18h00"], ["Dimanche", "Fermé 😴"]].map(([j, h]) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1.5px solid #f0f5ff" }}>
              <span style={{ color: "#888" }}>{j}</span><strong style={{ color: C.dark, fontSize: 13 }}>{h}</strong>
            </div>
          ))}
        </Card>
        <Card>
          <h3 style={{ color: C.dark, marginTop: 0 }}>🏊 Créneaux natation</h3>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ background: `${C.sun}30`, borderRadius: 14, padding: "10px 14px", flex: 1 }}>
              <div style={{ fontWeight: 900, color: C.coral, fontSize: 12 }}>☀️ Matin</div>
              <div style={{ fontWeight: 700, color: C.dark, fontSize: 13 }}>9h00 – 12h30</div>
              <div style={{ fontSize: 11, color: "#888" }}>Créneaux 30 min</div>
            </div>
            <div style={{ background: `${C.sea}25`, borderRadius: 14, padding: "10px 14px", flex: 1 }}>
              <div style={{ fontWeight: 900, color: C.ocean, fontSize: 12 }}>🌊 Après-midi</div>
              <div style={{ fontWeight: 700, color: C.dark, fontSize: 13 }}>13h30 – 19h00</div>
              <div style={{ fontSize: 11, color: "#888" }}>Créneaux 30 min</div>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#888", background: "#f9f9f9", borderRadius: 10, padding: "8px 12px" }}>⚠️ Max 2 enfants par créneau</div>
        </Card>
        <Card>
          <h3 style={{ color: C.dark, marginTop: 0 }}>🌊 Éveil aquatique</h3>
          <div style={{ background: "#F3E8FF", borderRadius: 14, padding: "10px 14px", marginBottom: 12, border: "1.5px solid #9B59B640" }}>
            <div style={{ fontWeight: 900, color: "#9B59B6", fontSize: 13, marginBottom: 2 }}>📅 Chaque dimanche matin</div>
            <div style={{ fontSize: 12, color: "#666" }}>Sous réserve d'avoir plusieurs enfants</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[["10h00","10h30"],["10h45","11h15"],["11h30","12h00"]].map(([start, end]) => (
              <div key={start} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "#9B59B6", color: "#fff", borderRadius: 10, padding: "5px 12px", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>{start} – {end}</div>
                <div style={{ fontSize: 13, color: "#555", fontWeight: 600 }}>Créneau éveil aquatique</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h3 style={{ color: C.coral, marginTop: 0 }}>📋 Règlement · Club de Plage</h3>
          {["Respecter les consignes des animateurs 👨‍🏫", "Prévoir un équipement adapté (casquette, gourde, serviette de bain, maillot de bain…) 🩱", "Pas de nourriture dans l'espace de jeux 🚫"].map(r => (
            <div key={r} style={{ display: "flex", gap: 10, marginBottom: 9, fontSize: 14, color: "#555" }}><span style={{ color: C.coral }}>•</span>{r}</div>
          ))}
        </Card>
        <Card>
          <h3 style={{ color: C.ocean, marginTop: 0 }}>🏊 Règlement · Natation</h3>
          {["Arriver 5 min avant la séance 🏃", "Enfants accompagnés jusqu'au bassin 👨‍👧", "Inscription préalable obligatoire 📋"].map(r => (
            <div key={r} style={{ display: "flex", gap: 10, marginBottom: 9, fontSize: 14, color: "#555" }}><span style={{ color: C.ocean }}>•</span>{r}</div>
          ))}
        </Card>
        <Card style={{ background: `linear-gradient(135deg, ${C.sky}18, ${C.sea}10)` }}>
          <h3 style={{ color: C.dark, marginTop: 0 }}>📍 Nous trouver</h3>
          <div style={{ fontSize: 14, color: "#555", lineHeight: 2.4 }}>
            <div>🏖️ <strong>Eole Beach Club</strong></div>
            <div>📍 Plage Saint-Michel - Rue des Caps Horniers, 44420 Piriac-sur-Mer</div>
            <div>📞 <a href="tel:0767786922" style={{ color: C.ocean, fontWeight: 700 }}>07 67 78 69 22</a></div>
            <div>✉️ <a href="mailto:clubdeplage.piriacsurmer@hotmail.com" style={{ color: C.ocean, fontWeight: 700 }}>clubdeplage.piriacsurmer@hotmail.com</a></div>
            <div>🌐 <a href="https://www.clubdeplage-piriacsurmer.fr" target="_blank" rel="noreferrer" style={{ color: C.ocean, fontWeight: 700 }}>www.clubdeplage-piriacsurmer.fr</a></div>
          </div>
        </Card>

        {/* CGV — bouton cliquable */}
        <div onClick={() => setShowCGV(true)} style={{ background:"#fff", borderRadius:20, padding:"16px 18px", boxShadow:"0 4px 16px rgba(0,0,0,0.06)", display:"flex", alignItems:"center", gap:14, cursor:"pointer" }}>
          <div style={{ width:48, height:48, borderRadius:16, background:`linear-gradient(135deg,${C.deep},${C.ocean})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>📄</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:900, color:C.deep, fontSize:15 }}>Conditions Générales de Vente</div>
            <div style={{ fontSize:12, color:"#aaa" }}>Saison 2026 · Appuyez pour consulter</div>
          </div>
          <div style={{ fontSize:20, color:"#ddd" }}>›</div>
        </div>

        {/* Modal CGV */}
        {showCGV && (
          <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", flexDirection:"column" }}>
            <div onClick={() => setShowCGV(false)} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
            <div style={{ position:"relative", marginTop:"auto", background:"#F0F4F8", borderRadius:"28px 28px 0 0", maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
              <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
                <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
              </div>
              <div style={{ background:`linear-gradient(135deg,${C.deep},${C.ocean})`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
                <button onClick={() => setShowCGV(false)} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
                <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>📄 Conditions Générales de Vente</div>
                <div style={{ color:"rgba(255,255,255,0.8)", fontSize:12, marginTop:2 }}>Saison 2026</div>
              </div>
              <div style={{ overflowY:"auto", padding:"16px 16px 28px", display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ background:`${C.sunset}12`, border:`1.5px solid ${C.sunset}40`, borderRadius:14, padding:"12px 14px" }}>
                  <div style={{ fontWeight:900, color:C.sunset, fontSize:13, marginBottom:6 }}>💶 Remboursement</div>
                  <div style={{ fontSize:13, color:"#555", lineHeight:1.7 }}>Aucune prestation ne pourra être remboursée, <strong>excepté sur présentation d'une attestation médicale</strong> justifiant l'impossibilité de participer aux activités.</div>
                </div>
                {[
                  { icon:"📅", title:"Validité", text:"Les forfaits et cartes Liberté sont valables uniquement sur la saison 2026, du 6 juillet au 22 août. Aucun report sur une saison ultérieure n'est possible." },
                  { icon:"🔄", title:"Report de séance", text:"En cas d'annulation par le club (météo, force majeure), les séances seront reportées." },
                  { icon:"👶", title:"Responsabilité", text:"Les enfants sont placés sous la responsabilité des moniteurs diplômés pendant la durée de la prestation. Les parents sont responsables avant et après." },
                  { icon:"⚠️", title:"Informations médicales", text:"Tout problème de santé, allergie ou contre-indication doit être signalé lors de l'inscription. Le club se réserve le droit de refuser un enfant pour des raisons de sécurité." },
                ].map(item => (
                  <div key={item.title} style={{ background:"#fff", borderRadius:14, padding:"12px 14px" }}>
                    <div style={{ fontWeight:900, color:C.deep, fontSize:13, marginBottom:4 }}>{item.icon} {item.title}</div>
                    <div style={{ fontSize:13, color:"#666", lineHeight:1.6 }}>{item.text}</div>
                  </div>
                ))}
                <div style={{ background:"#F0F4F8", borderRadius:12, padding:"10px 12px", fontSize:11, color:"#888", textAlign:"center" }}>
                  En effectuant une réservation, vous acceptez l'intégralité des présentes CGV.<br />
                  <span style={{ color:C.ocean, fontWeight:700 }}>EOLE BEACH CLUB · Club de Plage · Piriac-sur-Mer · Saison 2026</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ADMIN ─────────────────────────────────────────────────
// ── ADMIN SÉANCES TAB ─────────────────────────────────────
function SeancesTab({ sessions, setSessions }) {
  const weeks = [];
  let week = [];
  ALL_SEASON_DAYS.forEach((d, i) => {
    week.push(d);
    if (d.label === "Sam" || i === ALL_SEASON_DAYS.length - 1) { weeks.push(week); week = []; }
  });
  const [weekIdx, setWeekIdx]             = useState(0);
  const currentWeek                        = weeks[Math.min(weekIdx, weeks.length - 1)] || [];
  const [selectedDayId, setSelectedDayId] = useState(ALL_SEASON_DAYS[0]?.id);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [newHeure, setNewHeure]           = useState("09:00");
  const [addError, setAddError]           = useState("");
  const [dbResasNat, setDbResasNat]       = useState([]);

  // Charger résas natation depuis Supabase
  useEffect(() => {
    sb.from("reservations_natation").select("date_seance, heure, statut")
      .eq("statut", "confirmed")
      .then(({ data }) => setDbResasNat(data || []))
      .catch(() => {});
  }, []);

  // Calculer places réelles par créneau selon Supabase
  const getSpots = (dayId, time) => {
    const dayObj = ALL_SEASON_DAYS.find(d => d.id === dayId);
    if (!dayObj?.date) return 2;
    const dateISO = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
    const taken = dbResasNat.filter(r => r.date_seance?.slice(0,10) === dateISO && r.heure === time && r.statut === "confirmed").length;
    return Math.max(0, 2 - taken);
  };

  const handleWeekChange = (idx) => {
    setWeekIdx(idx);
    const w = weeks[Math.min(idx, weeks.length - 1)];
    if (w?.length) setSelectedDayId(w[0].id);
  };

  const daySessions  = sessions.filter(s => s.day === selectedDayId)
    .map(s => ({ ...s, spots: getSpots(s.day, s.time) }));
  const morning      = daySessions.filter(s => parseInt(s.time) < 13);
  const afternoon    = daySessions.filter(s => parseInt(s.time) >= 13);
  const weekSessions = sessions.filter(s => currentWeek.some(d => d.id === s.day))
    .map(s => ({ ...s, spots: getSpots(s.day, s.time) }));

  // Places réelles semaine
  const weekLibres  = weekSessions.reduce((acc, s) => acc + s.spots, 0);
  const weekPrises  = weekSessions.reduce((acc, s) => acc + (2 - s.spots), 0);
  const weekTotal   = weekLibres + weekPrises; // total = nb créneaux × 2
  const dayAvail    = daySessions.reduce((acc, s) => acc + s.spots, 0);
  const dayPrises   = daySessions.reduce((acc, s) => acc + (2 - s.spots), 0);
  const spotColor   = n => n === 0 ? C.sunset : n === 1 ? C.coral : C.green;
  const spotDot     = n => n === 0 ? "#FF6B6B" : n === 1 ? "#FF8E53" : "#6BCB77";

  const doCancel = (id) => {
    const slot = sessions.find(s => s.id === id);
    if (!slot) return;
    const dayObj = ALL_SEASON_DAYS.find(d => d.id === slot.day);
    if (dayObj?.date) {
      const d = dayObj.date;
      const dateISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      // Supprimer si existe, puis insérer avec spots=-1
      sb.from("seances_natation").delete().eq("date", dateISO).eq("heure", slot.time)
        .then(() => sb.from("seances_natation").insert({ date: dateISO, heure: slot.time, spots: -1 }))
        .catch(err => console.warn("Supabase seances:", err));
    }
    setSessions(prev => prev.filter(x => x.id !== id));
    setConfirmCancel(null);
  };

  const weekLabel = currentWeek.length > 0
    ? `${currentWeek[0].num} ${currentWeek[0].month} – ${currentWeek[currentWeek.length-1].num} ${currentWeek[currentWeek.length-1].month}`
    : "";

  const heuresDisponibles = [
    "09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30",
    "13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"
  ];

  const handleAddCreneau = () => {
    setAddError("");
    const exists = daySessions.some(s => s.time === newHeure);
    if (exists) { setAddError(`Un créneau à ${newHeure} existe déjà ce jour.`); return; }
    const newSlot = {
      id: `custom-${selectedDayId}-${newHeure}-${Date.now()}`,
      day: selectedDayId,
      time: newHeure,
      spots: 2,
    };
    // Sauvegarder en Supabase (spots = 2 = actif)
    const dayObj = ALL_SEASON_DAYS.find(d => d.id === selectedDayId);
    if (dayObj?.date) {
      const d = dayObj.date;
      const dateISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      sb.from("seances_natation").delete().eq("date", dateISO).eq("heure", newHeure)
        .then(() => sb.from("seances_natation").insert({ date: dateISO, heure: newHeure, spots: 2 }))
        .catch(err => console.warn("Supabase seances add:", err));
    }
    setSessions(prev => [...prev, newSlot].sort((a, b) => {
      if (a.day !== b.day) return 0;
      return a.time.localeCompare(b.time);
    }));
    setShowAddModal(false);
    setAddError("");
  };

  return (
    <div>
      {/* Modal ajout créneau */}
      {showAddModal && (
        <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", flexDirection:"column" }}>
          <div onClick={() => setShowAddModal(false)} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
          <div style={{ position:"relative", marginTop:"auto", background:"#F0F4F8", borderRadius:"28px 28px 0 0", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
            <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
              <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
            </div>
            <div style={{ background:`linear-gradient(135deg,${C.ocean},${C.sea})`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
              <button onClick={() => setShowAddModal(false)} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
              <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>➕ Ajouter un créneau</div>
              <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>
                {(() => { const d = ALL_SEASON_DAYS.find(d => d.id === selectedDayId); return d ? `${d.label} ${d.num} ${d.month} 2026` : ""; })()}
              </div>
            </div>
            <div style={{ padding:"16px 16px 28px", display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Heure du créneau</label>
                <select value={newHeure} onChange={e => setNewHeure(e.target.value)}
                  style={{ width:"100%", border:"2px solid #e0e8f0", borderRadius:14, padding:"12px", fontSize:15, fontFamily:"inherit", outline:"none", background:"#fff" }}>
                  {heuresDisponibles.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div style={{ background:`${C.ocean}10`, border:`1.5px solid ${C.ocean}20`, borderRadius:12, padding:"10px 14px", fontSize:13, color:C.ocean, fontWeight:700 }}>
                🏊 2 places · 30 min · Ouvert aux réservations immédiatement
              </div>
              {addError && <div style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:10, padding:"9px 14px", fontSize:13, color:"#e74c3c", fontWeight:700 }}>⚠️ {addError}</div>}
              <SunBtn color={C.ocean} full onClick={handleAddCreneau}>✅ Ajouter ce créneau</SunBtn>
            </div>
          </div>
        </div>
      )}
      {/* Week navigator */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "10px 14px", marginBottom: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => handleWeekChange(Math.max(0, weekIdx-1))} disabled={weekIdx === 0}
          style={{ background: weekIdx === 0 ? "#f0f0f0" : C.ocean, border: "none", color: weekIdx === 0 ? "#bbb" : "#fff", borderRadius: "50%", width: 30, height: 30, cursor: weekIdx === 0 ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 16, fontFamily: "inherit" }}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 900, color: C.dark, fontSize: 13 }}>Semaine {weekIdx + 1} / {weeks.length}</div>
          <div style={{ fontSize: 11, color: "#aaa" }}>🗓️ {weekLabel} 2026</div>
        </div>
        <button onClick={() => handleWeekChange(Math.min(weeks.length-1, weekIdx+1))} disabled={weekIdx >= weeks.length-1}
          style={{ background: weekIdx >= weeks.length-1 ? "#f0f0f0" : C.ocean, border: "none", color: weekIdx >= weeks.length-1 ? "#bbb" : "#fff", borderRadius: "50%", width: 30, height: 30, cursor: weekIdx >= weeks.length-1 ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 16, fontFamily: "inherit" }}>›</button>
      </div>

      {/* Bouton ajouter créneau */}
      <button onClick={() => { setShowAddModal(true); setAddError(""); }}
        style={{ width:"100%", background:`linear-gradient(135deg,${C.ocean},${C.sea})`, color:"#fff", border:"none", borderRadius:14, padding:"11px", cursor:"pointer", fontWeight:900, fontSize:14, fontFamily:"inherit", marginBottom:12, boxShadow:`0 4px 14px ${C.ocean}44` }}>
        ➕ Ajouter un créneau natation
      </button>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Places semaine", value: weekTotal,   color: C.ocean   },
          { label: "Libres",          value: weekLibres,  color: C.green   },
          { label: "Réservées",       value: weekPrises,  color: C.sunset  },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: "#fff", borderRadius: 14, padding: "10px 8px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: "#aaa", fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Day selector — centré */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2, justifyContent: "center", flexWrap: "wrap" }}>
        {currentWeek.map(d => {
          const ds = sessions.filter(s => s.day === d.id);
          const dAvail = ds.reduce((acc, s) => acc + s.spots, 0) > 0;
          const dFull  = ds.some(s => s.spots === 0);
          const sel = selectedDayId === d.id;
          return (
            <button key={d.id} onClick={() => setSelectedDayId(d.id)} style={{
              flexShrink: 0, background: sel ? `linear-gradient(135deg, ${C.ocean}, ${C.sea})` : "#fff",
              border: "none", borderRadius: 16, padding: "10px 14px", cursor: "pointer",
              fontFamily: "inherit", boxShadow: sel ? `0 4px 14px ${C.ocean}44` : "0 2px 8px rgba(0,0,0,0.06)",
              transition: "all .15s", minWidth: 68, textAlign: "center",
            }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: sel ? "rgba(255,255,255,0.8)" : "#aaa" }}>{d.label}</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: sel ? "#fff" : C.dark }}>{d.num}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 4 }}>
                {dAvail  && <div style={{ width: 6, height: 6, borderRadius: "50%", background: sel ? "#fff" : C.green }} />}
                {dFull   && <div style={{ width: 6, height: 6, borderRadius: "50%", background: sel ? "rgba(255,255,255,0.5)" : C.sunset }} />}
              </div>
              <div style={{ fontSize: 9, color: sel ? "rgba(255,255,255,0.7)" : "#bbb", marginTop: 2 }}>
                {ds.length} créneaux
              </div>
            </button>
          );
        })}
      </div>

      {/* Slot grid — 2 colonnes sur desktop */}
      {daySessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa", fontSize: 14 }}>Aucun créneau ce jour</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {morning.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.coral, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>☀️ Matin</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {morning.map(s => (
                  <div key={s.id} onClick={() => setConfirmCancel(confirmCancel === s.id ? null : s.id)} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: confirmCancel === s.id ? "#FFF0F0" : "#F8FBFF",
                    border: `1.5px solid ${confirmCancel === s.id ? C.sunset : spotColor(s.spots)}30`,
                    borderRadius: 12, padding: "7px 11px", cursor: "pointer", transition: "all .15s",
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: spotDot(s.spots), flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: 13, color: C.dark }}>{s.time}</span>
                    <span style={{ fontSize: 10, color: spotColor(s.spots), fontWeight: 700 }}>
                      {s.spots === 0 ? "●" : `${s.spots}/2`}
                    </span>
                    {confirmCancel === s.id && (
                      <button onClick={e => { e.stopPropagation(); doCancel(s.id); }} style={{ background: C.sunset, border: "none", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 900, cursor: "pointer", marginLeft: 2 }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#bbb", fontStyle: "italic" }}>💡 Cliquer pour annuler</div>
            </div>
          )}
          {afternoon.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.ocean, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>🌊 Après-midi</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {afternoon.map(s => (
                  <div key={s.id} onClick={() => setConfirmCancel(confirmCancel === s.id ? null : s.id)} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: confirmCancel === s.id ? "#FFF0F0" : "#F8FBFF",
                    border: `1.5px solid ${confirmCancel === s.id ? C.sunset : spotColor(s.spots)}30`,
                    borderRadius: 12, padding: "7px 11px", cursor: "pointer", transition: "all .15s",
                  }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: spotDot(s.spots), flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: 13, color: C.dark }}>{s.time}</span>
                    <span style={{ fontSize: 10, color: spotColor(s.spots), fontWeight: 700 }}>
                      {s.spots === 0 ? "●" : `${s.spots}/2`}
                    </span>
                    {confirmCancel === s.id && (
                      <button onClick={e => { e.stopPropagation(); doCancel(s.id); }} style={{ background: C.sunset, border: "none", color: "#fff", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 900, cursor: "pointer", marginLeft: 2 }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#bbb", fontStyle: "italic" }}>💡 Cliquer pour annuler</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ADMIN DATA ────────────────────────────────────────────
const MEMBRES = [
  { id: 1, name: "Martin Dupont",  email: "martin@gmail.com",  phone: "06 00 00 00 00", adresse: "12 rue de la Mer, 44500 La Baule", av: "👨", color: C.ocean,
    enfants: [
      { prenom: "Emma",  nom: "Dupont", naissance: "2018-03-14", activite: "les deux",  niveau: "intermediaire", allergies: "" },
      { prenom: "Lucas", nom: "Dupont", naissance: "2020-07-02", activite: "club",       niveau: "debutant",      allergies: "Arachides" },
    ], resa: 3, droitImage: true, droitDiffusion: false },
  { id: 2, name: "Sophie Bernard", email: "sophie@gmail.com",  phone: "06 12 34 56 78", adresse: "4 allée des Pins, 44500 La Baule", av: "👩", color: C.coral,
    enfants: [
      { prenom: "Léo",   nom: "Bernard", naissance: "2017-11-20", activite: "natation", niveau: "avance",        allergies: "" },
      { prenom: "Chloé", nom: "Bernard", naissance: "2019-05-08", activite: "club",     niveau: "debutant",      allergies: "" },
    ], resa: 5, droitImage: true, droitDiffusion: true },
  { id: 3, name: "Pierre Martin",  email: "pierre@gmail.com",  phone: "06 55 44 33 22", adresse: "8 bd de l'Océan, 44500 La Baule", av: "👨", color: C.green,
    enfants: [
      { prenom: "Noah",  nom: "Martin",  naissance: "2021-01-15", activite: "club",     niveau: "debutant",      allergies: "Gluten" },
    ], resa: 1, droitImage: false, droitDiffusion: false },
  { id: 4, name: "Julie Leroy",    email: "julie@gmail.com",   phone: "06 77 88 99 11", adresse: "2 impasse des Goélands, 44500 La Baule", av: "👩", color: "#9B59B6",
    enfants: [
      { prenom: "Manon", nom: "Leroy",   naissance: "2016-09-30", activite: "les deux", niveau: "avance",        allergies: "" },
      { prenom: "Tom",   nom: "Leroy",   naissance: "2018-12-05", activite: "natation", niveau: "intermediaire", allergies: "" },
      { prenom: "Clara", nom: "Leroy",   naissance: "2022-04-22", activite: "club",     niveau: "debutant",      allergies: "Lactose" },
    ], resa: 7, droitImage: true, droitDiffusion: true },
];

// ── FICHE ENFANT ──────────────────────────────────────────
function FicheEnfantModal({ enfant, onClose }) {
  const age = calcAge(enfant.naissance);
  const actColor = enfant.sexe === "F" ? "#9B59B6" : enfant.sexe === "M" ? C.green : enfant.activite === "natation" ? C.ocean : enfant.activite === "club" ? C.coral : "#9B59B6";
  const actLabel = enfant.activite === "natation" ? "🏊 Natation" : enfant.activite === "club" ? "🏖️ Club de Plage" : "🏊🏖️ Natation & Club";
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", flexDirection:"column" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
      <div style={{ position:"relative", marginTop:"auto", background:"#F0F4F8", borderRadius:"28px 28px 0 0", maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
        </div>
        {/* Header */}
        <div style={{ background:`linear-gradient(135deg,${actColor},${actColor}cc)`, margin:"0 16px", borderRadius:20, padding:"20px 18px", position:"relative", marginBottom:12 }}>
          <button onClick={onClose} style={{ position:"absolute", top:12, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:60, height:60, borderRadius:20, background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>{enfant.sexe === "M" ? "👦" : "👧"}</div>
            <div>
              <div style={{ color:"#fff", fontWeight:900, fontSize:20 }}>{enfant.prenom} {NOM(enfant.nom)}</div>
              <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13 }}>{age} ans · {actLabel}</div>
              {enfant.parent && <div style={{ color:"rgba(255,255,255,0.75)", fontSize:12, marginTop:2 }}>👤 {enfant.parent}</div>}
            </div>
          </div>
        </div>

        <div style={{ overflowY:"auto", padding:"0 16px 28px", display:"flex", flexDirection:"column", gap:10 }}>
          {/* Infos */}
          <div style={{ background:"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight:800, color:"#2C3E50", fontSize:12, marginBottom:10, textTransform:"uppercase", letterSpacing:0.5 }}>📋 Informations</div>
            <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"8px 16px", fontSize:14 }}>
              <span style={{ color:"#aaa" }}>Naissance</span>
              <span style={{ fontWeight:700, color:"#2C3E50" }}>{enfant.naissance ? new Date(enfant.naissance).toLocaleDateString("fr-FR") : "—"} ({age} ans)</span>
              {enfant.sexe && <><span style={{ color:"#aaa" }}>Sexe</span><span style={{ fontWeight:700, color: enfant.sexe==="F"?"#9B59B6":C.green }}>{enfant.sexe==="F"?"👧 Fille":"👦 Garçon"}</span></>}
              <span style={{ color:"#aaa" }}>Activité</span>
              <span style={{ fontWeight:700, color:actColor }}>{actLabel}</span>
              {enfant.activite !== "club" && <><span style={{ color:"#aaa" }}>Niveau</span><span style={{ fontWeight:700, color:C.sea }}>{enfant.niveau || "—"}</span></>}
              <span style={{ color:"#aaa" }}>Parent</span>
              <span style={{ fontWeight:700, color:"#2C3E50" }}>{enfant.parent || "—"}</span>
              {enfant.parentPhone && <><span style={{ color:"#aaa" }}>Téléphone</span><span style={{ fontWeight:700, color:"#2C3E50" }}><a href={`tel:${enfant.parentPhone}`} style={{ color:"inherit", textDecoration:"none" }}>📞 {enfant.parentPhone}</a></span></>}
            </div>
          </div>

          {/* Adresses */}
          {(enfant.adresse || enfant.adresse_vac) && (
            <div style={{ background:"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ fontWeight:800, color:"#2C3E50", fontSize:12, marginBottom:10, textTransform:"uppercase", letterSpacing:0.5 }}>📍 Adresses</div>
              {enfant.adresse && (
                <div style={{ marginBottom:8 }}>
                  <div style={{ fontSize:10, fontWeight:900, color:C.ocean, textTransform:"uppercase", marginBottom:3 }}>🏠 Domicile</div>
                  <div style={{ fontSize:13, color:"#555" }}>{enfant.adresse}</div>
                  {(enfant.ville || enfant.cp) && <div style={{ fontSize:12, color:"#888" }}>{enfant.ville} {enfant.cp}</div>}
                </div>
              )}
              {enfant.adresse_vac && (
                <div style={{ borderTop: enfant.adresse ? "1px solid #f0f0f0" : "none", paddingTop: enfant.adresse ? 8 : 0 }}>
                  <div style={{ fontSize:10, fontWeight:900, color:C.coral, textTransform:"uppercase", marginBottom:3 }}>🏖️ Vacances</div>
                  <div style={{ fontSize:13, color:"#555" }}>{enfant.adresse_vac}</div>
                  {(enfant.ville_vac || enfant.cp_vac) && <div style={{ fontSize:12, color:"#888" }}>{enfant.ville_vac} {enfant.cp_vac}</div>}
                </div>
              )}
            </div>
          )}

          {/* Personnes autorisées à récupérer */}
          {enfant.personnes_autorisees && (
            <div style={{ background:"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ fontWeight:800, color:"#2C3E50", fontSize:12, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5 }}>👤 Personnes autorisées à récupérer l'enfant</div>
              <div style={{ fontSize:14, color:"#555", lineHeight:1.6 }}>{enfant.personnes_autorisees}</div>
            </div>
          )}

          {/* Allergies */}
          {enfant.allergies ? (
            <div style={{ background:"#FFF0F0", border:`1.5px solid ${C.sunset}30`, borderRadius:16, padding:"14px 16px" }}>
              <div style={{ fontWeight:800, color:C.sunset, fontSize:12, marginBottom:6, textTransform:"uppercase" }}>⚠️ Allergies / Infos médicales</div>
              <div style={{ fontSize:14, color:"#555", fontWeight:700 }}>{enfant.allergies}</div>
            </div>
          ) : (
            <div style={{ background:`${C.green}10`, border:`1.5px solid ${C.green}30`, borderRadius:16, padding:"12px 16px" }}>
              <div style={{ fontWeight:800, color:C.green, fontSize:13 }}>✅ Aucune allergie connue</div>
            </div>
          )}

          {/* Groupe d'âge */}
          <div style={{ background:"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight:800, color:"#2C3E50", fontSize:12, marginBottom:8, textTransform:"uppercase" }}>🏷️ Groupe d'âge</div>
            {(() => {
              const grp = age <= 5 ? { label:"🐥 3–5 ans", color:"#FFD93D" } : age <= 9 ? { label:"🐬 6–9 ans", color:C.sea } : { label:"🏅 10–12 ans", color:C.ocean };
              return <Pill color={grp.color}>{grp.label}</Pill>;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

function FicheModal({ membre, onClose }) {
  const [resasNat, setResasNat] = useState([]);
  const [resasClub, setResasClub] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!membre?.id) { setLoading(false); return; }
    Promise.all([
      sb.from("reservations_natation").select("*").eq("membre_id", membre.id).order("date_seance"),
      sb.from("reservations_club").select("*").eq("membre_id", membre.id).order("date_reservation"),
    ]).then(([{data: nat}, {data: club}]) => {
      setResasNat(nat || []);
      setResasClub(club || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [membre?.id]);

  const actLabel = a => {
    if (!a) return "—";
    const v = a.toLowerCase();
    if (v === "club") return "🏖️ Club";
    if (v === "natation") return "🏊 Natation";
    return "🏖️🏊 Club & Natation";
  };
  const actColor = a => {
    if (!a) return C.ocean;
    const v = a.toLowerCase();
    if (v === "club") return C.coral;
    if (v === "natation") return C.ocean;
    return "#9B59B6";
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,20,50,0.6)", backdropFilter: "blur(5px)" }} />
      <div style={{ position: "relative", marginTop: "auto", background: "#F0F4F8", borderRadius: "28px 28px 0 0", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 -12px 48px rgba(0,0,0,0.25)" }}>
        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 5, borderRadius: 10, background: "#ddd" }} />
        </div>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${membre.color}, ${membre.color}cc)`, margin: "0 16px", borderRadius: 20, padding: "16px 18px", position: "relative", marginBottom: 12 }}>
          <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "rgba(255,255,255,0.25)", border: "none", color: "#fff", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontWeight: 900, fontSize: 16, fontFamily: "inherit" }}>✕</button>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{membre.av}</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>{membre.name}</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>{membre.email}</div>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>📞 <a href={`tel:${membre.phone}`} style={{ color:"inherit", textDecoration:"none" }}>{membre.phone}</a></div>
            </div>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Adresse */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 12, marginBottom: 8 }}>📍 ADRESSES</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize:10, fontWeight:900, color:C.ocean, textTransform:"uppercase", marginBottom:3 }}>🏠 Domicile</div>
              <div style={{ fontSize: 13, color: "#555" }}>{membre.adresse || "—"}</div>
              {(membre.ville || membre.cp) && <div style={{ fontSize: 12, color: "#888" }}>{membre.ville} {membre.cp}</div>}
            </div>
            {(membre.adresse_vac || membre.ville_vac) && (
              <div style={{ borderTop:"1px solid #f0f0f0", paddingTop:8 }}>
                <div style={{ fontSize:10, fontWeight:900, color:C.coral, textTransform:"uppercase", marginBottom:3 }}>🏖️ Vacances</div>
                <div style={{ fontSize: 13, color: "#555" }}>{membre.adresse_vac || "—"}</div>
                {(membre.ville_vac || membre.cp_vac) && <div style={{ fontSize: 12, color: "#888" }}>{membre.ville_vac} {membre.cp_vac}</div>}
              </div>
            )}
          </div>
          {/* Enfants */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 12, marginBottom: 10 }}>👧 ENFANTS ({membre.enfants.length})</div>
            {membre.enfants.map((e, i) => (
              <div key={i} style={{ background: "#F8FBFF", borderRadius: 14, padding: "10px 14px", marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ fontWeight: 900, color: "#2C3E50", fontSize: 14 }}>{e.prenom} {NOM(e.nom)}</div>
                  <div style={{ fontSize: 11, color: "#888" }}>Né(e) le {e.naissance ? e.naissance.split("-").reverse().join("/") : "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <div style={{ background: `${actColor(e.activite)}18`, color: actColor(e.activite), borderRadius: 50, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>{actLabel(e.activite)}</div>
                  {e.activite !== "club" && e.niveau && <div style={{ background: `${C.sea}20`, color: C.sea, borderRadius: 50, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>Niveau : {e.niveau}</div>}
                  {e.allergies && <div style={{ background: "#FFF0F0", color: C.sunset, borderRadius: 50, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>⚠️ {e.allergies}</div>}
                </div>
              </div>
            ))}
          </div>
          {/* Droit image */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 12, marginBottom: 8 }}>📸 DROIT À L'IMAGE</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1, background: membre.droitImage ? `${C.green}15` : "#f5f5f5", borderRadius: 12, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 16 }}>{membre.droitImage ? "✅" : "❌"}</div>
                <div style={{ fontSize: 11, color: membre.droitImage ? C.green : "#aaa", fontWeight: 700 }}>Photos</div>
              </div>
              <div style={{ flex: 1, background: membre.droitDiffusion ? `${C.green}15` : "#f5f5f5", borderRadius: 12, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 16 }}>{membre.droitDiffusion ? "✅" : "❌"}</div>
                <div style={{ fontSize: 11, color: membre.droitDiffusion ? C.green : "#aaa", fontWeight: 700 }}>Diffusion</div>
              </div>
            </div>
          </div>
          {/* Réservations */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 12, marginBottom: 10 }}>📅 RÉSERVATIONS</div>
            {loading ? (
              <div style={{ textAlign:"center", color:"#bbb", fontSize:13, padding:"8px 0" }}>Chargement…</div>
            ) : (
              <>
                {/* Natation */}
                {resasNat.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize:11, fontWeight:900, color:C.ocean, marginBottom:6, textTransform:"uppercase" }}>🏊 Natation · {resasNat.length} séance{resasNat.length>1?"s":""}</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {resasNat.slice(0,5).map((r,i) => (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:`${C.ocean}08`, borderRadius:10, padding:"7px 10px" }}>
                          <div style={{ fontWeight:800, color:C.ocean, fontSize:13 }}>{r.heure}</div>
                          <div style={{ fontSize:11, color:"#888" }}>{r.date_seance ? parseLocalDate(r.date_seance).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}) : "—"}</div>
                          {r.enfants?.length > 0 && <div style={{ fontSize:11, color:C.ocean, fontWeight:700 }}>{r.enfants.join(", ")}</div>}
                          <Pill color={C.green}>✓</Pill>
                        </div>
                      ))}
                      {resasNat.length > 5 && <div style={{ fontSize:11, color:"#aaa", textAlign:"center" }}>+{resasNat.length-5} séances</div>}
                    </div>
                  </div>
                )}
                {/* Club */}
                {resasClub.length > 0 && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:900, color:C.coral, marginBottom:6, textTransform:"uppercase" }}>🏖️ Club · {resasClub.length} demi-journée{resasClub.length>1?"s":""}</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                      {resasClub.slice(0,5).map((r,i) => {
                        const enfantsClub = (membre.enfants || [])
                          .filter(e => e.activite === "club" || e.activite === "les deux")
                          .map(e => e.prenom);
                        return (
                        <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:`${C.coral}08`, borderRadius:10, padding:"7px 10px" }}>
                          <div style={{ fontWeight:800, color:C.coral, fontSize:12 }}>{r.session==="matin"?"Matin":"Après-midi"}</div>
                          <div style={{ fontSize:11, color:"#888" }}>{r.date_reservation ? new Date(r.date_reservation).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}) : "—"}</div>
                          {enfantsClub.length > 0 && <div style={{ fontSize:11, color:C.coral, fontWeight:700 }}>{enfantsClub.join(", ")}</div>}
                          <Pill color={C.green}>✓</Pill>
                        </div>
                        );
                      })}
                      {resasClub.length > 5 && <div style={{ fontSize:11, color:"#aaa", textAlign:"center" }}>+{resasClub.length-5} demi-journées</div>}
                    </div>
                  </div>
                )}
                {resasNat.length === 0 && resasClub.length === 0 && (
                  <div style={{ textAlign:"center", color:"#bbb", fontSize:13, padding:"8px 0" }}>Aucune réservation</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CRÉER MEMBRE MANUELLEMENT ─────────────────────────────
function CreerMembreModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ prenom:"", nom:"", email:"", tel:"", tel2:"", adresse:"", ville:"", cp:"", adresse_vac:"", ville_vac:"", cp_vac:"", droitImage:false, droitDiffusion:false });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const f = k => v => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.prenom || !form.nom || !form.email || !form.tel) { setError("Prénom, nom, email et téléphone sont obligatoires."); return; }
    if (!form.adresse || !form.ville || !form.cp) { setError("L'adresse principale (rue, ville, CP) est obligatoire."); return; }
    if (!form.adresse_vac || !form.ville_vac || !form.cp_vac) { setError("L'adresse de vacances (rue, ville, CP) est obligatoire."); return; }
    setSaving(true);
    try {
      await creerMembre({ ...form, enfants: [], cgvAccepted: true });
      onSaved();
      onClose();
    } catch(e) { setError("Erreur : " + e.message); setSaving(false); }
  };

  const SectionTitle = ({ icon, label }) => (
    <div style={{ fontSize:11, fontWeight:900, color:C.ocean, textTransform:"uppercase", letterSpacing:0.5, marginTop:4 }}>{icon} {label}</div>
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", flexDirection:"column" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
      <div style={{ position:"relative", marginTop:"auto", background:"#F0F4F8", borderRadius:"28px 28px 0 0", maxHeight:"94vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
        </div>
        <div style={{ background:`linear-gradient(135deg,${C.ocean},${C.sea})`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
          <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>👤 Nouveau membre</div>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>Création manuelle depuis l'admin</div>
        </div>
        <div style={{ overflowY:"auto", padding:"16px 16px 28px", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Prénom *</label><FInput value={form.prenom} onChange={f("prenom")} required /></div>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Nom *</label><FInput value={form.nom} onChange={f("nom")} required /></div>
          </div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Email *</label><FInput type="email" value={form.email} onChange={f("email")} required /></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Téléphone *</label><FInput type="tel" value={form.tel} onChange={f("tel")} required /></div>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Téléphone 2</label><FInput type="tel" value={form.tel2} onChange={f("tel2")} /></div>
          </div>

          <SectionTitle icon="🏠" label="Adresse principale *" />
          <div><FInput placeholder="Rue, numéro..." value={form.adresse} onChange={f("adresse")} required /></div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
            <div><FInput placeholder="Ville" value={form.ville} onChange={f("ville")} required /></div>
            <div><FInput placeholder="CP" value={form.cp} onChange={f("cp")} required /></div>
          </div>

          <SectionTitle icon="🏖️" label="Adresse de vacances *" />
          <div><FInput placeholder="Rue, numéro..." value={form.adresse_vac} onChange={f("adresse_vac")} required /></div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
            <div><FInput placeholder="Ville" value={form.ville_vac} onChange={f("ville_vac")} required /></div>
            <div><FInput placeholder="CP" value={form.cp_vac} onChange={f("cp_vac")} required /></div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            {[["droitImage","📸 Droit photo"],["droitDiffusion","📡 Droit diffusion"]].map(([k,l]) => (
              <div key={k} onClick={() => setForm(prev => ({...prev, [k]:!prev[k]}))}
                style={{ flex:1, background: form[k]?`${C.green}15`:"#f5f5f5", border:`2px solid ${form[k]?C.green:"#e0e8f0"}`, borderRadius:14, padding:"10px", textAlign:"center", cursor:"pointer" }}>
                <div style={{ fontSize:18 }}>{form[k]?"✅":"⬜"}</div>
                <div style={{ fontSize:11, fontWeight:800, color: form[k]?C.green:"#aaa", marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>
          {error && <div style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:10, padding:"9px 14px", fontSize:13, color:"#e74c3c", fontWeight:700 }}>⚠️ {error}</div>}
          <SunBtn color={saving?"#aaa":C.green} full onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Enregistrement..." : "✅ Créer le membre"}
          </SunBtn>
        </div>
      </div>
    </div>
  );
}

// ── MODIFIER MEMBRE ───────────────────────────────────────
function ModifierMembreModal({ membre, onClose, onSaved }) {
  const [form, setForm] = useState({
    prenom: membre.prenom || membre.name?.split(" ")[0] || "",
    nom:    membre.nom    || membre.name?.split(" ").slice(1).join(" ") || "",
    email:  membre.email  || "",
    tel:    membre.phone  || membre.tel || "",
    tel2:   membre.tel2   || "",
    adresse:     membre.adresse     || "",
    ville:       membre.ville       || "",
    cp:          membre.cp          || "",
    adresse_vac: membre.adresse_vac || "",
    ville_vac:   membre.ville_vac   || "",
    cp_vac:      membre.cp_vac      || "",
    droitImage:        membre.droitImage        || false,
    droitDiffusion:    membre.droitDiffusion    || false,
    comptefinSaison:   membre.compte_fin_saison || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const f = k => v => setForm(prev => ({...prev, [k]: v}));

  const handleSave = async () => {
    if (!form.prenom || !form.nom || !form.email || !form.tel) { setError("Prénom, nom, email et téléphone sont obligatoires."); return; }
    if (!form.adresse || !form.ville || !form.cp) { setError("L'adresse principale (rue, ville, CP) est obligatoire."); return; }
    if (!form.adresse_vac || !form.ville_vac || !form.cp_vac) { setError("L'adresse de vacances (rue, ville, CP) est obligatoire."); return; }
    setSaving(true);
    try {
      await sb.from("membres").update({
        prenom: form.prenom, nom: form.nom, email: form.email,
        tel: form.tel, tel2: form.tel2,
        adresse: form.adresse, ville: form.ville, cp: form.cp,
        adresse_vac: form.adresse_vac, ville_vac: form.ville_vac, cp_vac: form.cp_vac,
        droit_image: form.droitImage, droit_diffusion: form.droitDiffusion,
        compte_fin_saison: form.comptefinSaison,
      }).eq("id", membre.id);
      onSaved();
      onClose();
    } catch(e) { setError("Erreur : " + e.message); setSaving(false); }
  };

  const SectionTitle = ({ icon, label }) => (
    <div style={{ fontSize:11, fontWeight:900, color:C.coral, textTransform:"uppercase", letterSpacing:0.5, marginTop:4 }}>{icon} {label}</div>
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", flexDirection:"column" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
      <div style={{ position:"relative", marginTop:"auto", background:"#F0F4F8", borderRadius:"28px 28px 0 0", maxHeight:"94vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
        </div>
        <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
          <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>✏️ Modifier le membre</div>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>{form.prenom} {NOM(form.nom)}</div>
        </div>
        <div style={{ overflowY:"auto", padding:"16px 16px 28px", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.coral, display:"block", marginBottom:4 }}>Prénom *</label><FInput value={form.prenom} onChange={f("prenom")} required /></div>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.coral, display:"block", marginBottom:4 }}>Nom *</label><FInput value={form.nom} onChange={f("nom")} required /></div>
          </div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.coral, display:"block", marginBottom:4 }}>Email *</label><FInput type="email" value={form.email} onChange={f("email")} required /></div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.coral, display:"block", marginBottom:4 }}>Téléphone *</label><FInput type="tel" value={form.tel} onChange={f("tel")} required /></div>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.coral, display:"block", marginBottom:4 }}>Téléphone 2</label><FInput type="tel" value={form.tel2} onChange={f("tel2")} /></div>
          </div>

          <SectionTitle icon="🏠" label="Adresse principale *" />
          <div><FInput placeholder="Rue, numéro..." value={form.adresse} onChange={f("adresse")} required /></div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
            <div><FInput placeholder="Ville" value={form.ville} onChange={f("ville")} required /></div>
            <div><FInput placeholder="CP" value={form.cp} onChange={f("cp")} required /></div>
          </div>

          <SectionTitle icon="🏖️" label="Adresse de vacances *" />
          <div><FInput placeholder="Rue, numéro..." value={form.adresse_vac} onChange={f("adresse_vac")} required /></div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
            <div><FInput placeholder="Ville" value={form.ville_vac} onChange={f("ville_vac")} required /></div>
            <div><FInput placeholder="CP" value={form.cp_vac} onChange={f("cp_vac")} required /></div>
          </div>

          <div style={{ display:"flex", gap:10 }}>
            {[["droitImage","📸 Droit photo"],["droitDiffusion","📡 Droit diffusion"]].map(([k,l]) => (
              <div key={k} onClick={() => setForm(prev => ({...prev, [k]:!prev[k]}))}
                style={{ flex:1, background: form[k]?`${C.green}15`:"#f5f5f5", border:`2px solid ${form[k]?C.green:"#e0e8f0"}`, borderRadius:14, padding:"10px", textAlign:"center", cursor:"pointer" }}>
                <div style={{ fontSize:18 }}>{form[k]?"✅":"⬜"}</div>
                <div style={{ fontSize:11, fontWeight:800, color: form[k]?C.green:"#aaa", marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>

          <div onClick={() => setForm(prev => ({...prev, comptefinSaison:!prev.comptefinSaison}))}
            style={{ display:"flex", alignItems:"center", gap:12, background: form.comptefinSaison?`${C.ocean}12`:"#f5f5f5", border:`2px solid ${form.comptefinSaison?C.ocean:"#e0e8f0"}`, borderRadius:14, padding:"12px 14px", cursor:"pointer" }}>
            <div style={{ fontSize:22 }}>{form.comptefinSaison?"📒":"📒"}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, color: form.comptefinSaison?C.ocean:"#555", fontSize:13 }}>📒 Règlement fin de saison</div>
              <div style={{ fontSize:11, color:"#aaa" }}>Prestations réglées en fin de saison</div>
            </div>
            <div style={{ fontSize:18 }}>{form.comptefinSaison?"✅":"⬜"}</div>
          </div>

          {error && <div style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:10, padding:"9px 14px", fontSize:13, color:"#e74c3c", fontWeight:700 }}>⚠️ {error}</div>}
          <SunBtn color={saving?"#aaa":C.coral} full onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Enregistrement..." : "✅ Enregistrer les modifications"}
          </SunBtn>
        </div>
      </div>
    </div>
  );
}

function AjouterEnfantModal({ membre, onClose, onSaved }) {
  const [prenom, setPrenom]     = useState("");
  const [nom, setNom]           = useState("");
  const [naissance, setNaissance] = useState("");
  const [sexe, setSexe]         = useState("");
  const [activite, setActivite] = useState("club");
  const [niveau, setNiveau]     = useState("debutant");
  const [allergies, setAllergies] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const handleSave = async () => {
    if (!prenom || !nom || !naissance) { setError("Prénom, nom et date de naissance sont requis."); return; }
    setSaving(true);
    try {
      await creerEnfants(membre.id, [{ prenom, nom, naissance, sexe, activite, niveau, allergies }]);
      onSaved();
      onClose();
    } catch(e) {
      setError("Erreur lors de l'enregistrement. Réessayez.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", flexDirection:"column" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
      <div style={{ position:"relative", marginTop:"auto", background:"#F0F4F8", borderRadius:"28px 28px 0 0", maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
        </div>
        <div style={{ background:`linear-gradient(135deg,${C.ocean},${C.sea})`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
          <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>👧 Ajouter un enfant</div>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>{membre.name || `${membre.prenom} ${membre.nom}`}</div>
        </div>
        <div style={{ overflowY:"auto", padding:"16px 16px 28px", display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4, textTransform:"uppercase" }}>Prénom *</label>
              <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Emma"
                style={{ width:"100%", border:`2px solid #e0e8f0`, borderRadius:12, padding:"10px 12px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            </div>
            <div>
              <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4, textTransform:"uppercase" }}>Nom *</label>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Dupont"
                style={{ width:"100%", border:`2px solid #e0e8f0`, borderRadius:12, padding:"10px 12px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4, textTransform:"uppercase" }}>Date de naissance *</label>
            <input type="date" value={naissance} onChange={e => setNaissance(e.target.value)}
              style={{ width:"100%", border:`2px solid #e0e8f0`, borderRadius:12, padding:"10px 12px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Sexe</label>
            <div style={{ display:"flex", gap:8 }}>
              {[["M","👦 Garçon"],["F","👧 Fille"]].map(([val, label]) => (
                <button key={val} onClick={() => setSexe(val)} style={{ flex:1, background: sexe===val?(val==="M"?C.green:"#9B59B6"):"#f0f0f0", color: sexe===val?"#fff":"#888", border:"none", borderRadius:12, padding:"9px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Activité</label>
            <div style={{ display:"flex", gap:6 }}>
              {[["natation","🏊 Natation"],["club","🏖️ Club"],["les deux","🏊🏖️ Les deux"]].map(([k,l]) => (
                <button key={k} onClick={() => setActivite(k)} style={{ flex:1, background: activite===k ? C.ocean : "#f0f0f0", color: activite===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Niveau natation</label>
            <div style={{ display:"flex", gap:6 }}>
              {[["debutant","Débutant"],["intermediaire","Intermédiaire"],["avance","Avancé"]].map(([k,l]) => (
                <button key={k} onClick={() => setNiveau(k)} style={{ flex:1, background: niveau===k ? C.ocean : "#f0f0f0", color: niveau===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4, textTransform:"uppercase" }}>Allergies</label>
            <input value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="Ex : Arachides, Gluten... (laisser vide si aucune)"
              style={{ width:"100%", border:`2px solid #e0e8f0`, borderRadius:12, padding:"10px 12px", fontSize:14, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
          </div>
          {error && <div style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:10, padding:"9px 14px", fontSize:13, color:"#e74c3c", fontWeight:700 }}>⚠️ {error}</div>}
          <SunBtn color={saving ? "#aaa" : C.green} full onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Enregistrement..." : "✅ Enregistrer l'enfant"}
          </SunBtn>
        </div>
      </div>
    </div>
  );
}

function MembresTab({ allResas, dbMembres, onRefresh }) {
  const [selectedMembre, setSelectedMembre]       = useState(null);
  const [ajouterEnfantPour, setAjouterEnfantPour] = useState(null);
  const [modifierMembre, setModifierMembre]       = useState(null);
  const [showCreer, setShowCreer]                 = useState(false);

  const supprimerMembre = async (membre) => {
    if (!window.confirm(`Supprimer définitivement ${membre.name} ?\n\nAttention : ses enfants et réservations seront aussi supprimés.`)) return;
    try {
      // Supprimer enfants, résas, paiements, puis membre
      await sb.from("enfants").delete().eq("membre_id", membre.id);
      await sb.from("reservations_natation").delete().eq("membre_id", membre.id);
      await sb.from("reservations_club").delete().eq("membre_id", membre.id);
      await sb.from("paiements").delete().eq("membre_id", membre.id);
      await sb.from("membres").delete().eq("id", membre.id);
      onRefresh?.();
    } catch(e) { alert("Erreur suppression : " + e.message); }
  };

  const membresSupabase = (dbMembres || []).map(m => ({
    id: m.id, name: `${m.prenom} ${m.nom}`, prenom: m.prenom, nom: m.nom,
    email: m.email, phone: m.tel, tel: m.tel, tel2: m.tel2,
    adresse: m.adresse, ville: m.ville, cp: m.cp,
    adresse_vac: m.adresse_vac, ville_vac: m.ville_vac, cp_vac: m.cp_vac,
    color: C.ocean, av: "👤", enfants: m.enfants || [], resa: 0,
    droitImage: m.droit_image, droitDiffusion: m.droit_diffusion, supabase: true,
    compte_fin_saison: m.compte_fin_saison || false,
    compte_solde: m.compte_solde || false,
  }));

  const tousLesMembres = membresSupabase.length > 0 ? membresSupabase : MEMBRES;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {selectedMembre && <FicheModal membre={selectedMembre} onClose={() => setSelectedMembre(null)} />}
      {ajouterEnfantPour && <AjouterEnfantModal membre={ajouterEnfantPour} onClose={() => setAjouterEnfantPour(null)} onSaved={() => { setAjouterEnfantPour(null); onRefresh?.(); }} />}
      {modifierMembre && <ModifierMembreModal membre={modifierMembre} onClose={() => setModifierMembre(null)} onSaved={() => { setModifierMembre(null); onRefresh?.(); }} />}
      {showCreer && <CreerMembreModal onClose={() => setShowCreer(false)} onSaved={() => { setShowCreer(false); onRefresh?.(); }} />}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <div style={{ fontWeight:900, color:"#2C3E50", fontSize:14 }}>{tousLesMembres.length} membre{tousLesMembres.length>1?"s":""} inscrit{tousLesMembres.length>1?"s":""}</div>
        <button onClick={() => setShowCreer(true)} style={{ background:`linear-gradient(135deg,${C.green},#1E8449)`, color:"#fff", border:"none", borderRadius:50, padding:"6px 14px", cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit" }}>
          ➕ Nouveau membre
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:10 }}>
      {tousLesMembres.map((u, i) => (
        <div key={u.id || i} style={{ background:"#fff", borderRadius:20, padding:"14px 16px", boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, cursor:"pointer" }} onClick={() => setSelectedMembre(u)}>
            <div style={{ width:50, height:50, borderRadius:18, background:`linear-gradient(135deg,${u.color},${u.color}bb)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>{u.av}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:900, color:"#2C3E50", fontSize:14 }}>{u.name}</div>
              <div style={{ fontSize:11, color:"#aaa", marginBottom:6 }}>{u.email}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <div style={{ background:`${u.color}18`, color:u.color, borderRadius:50, padding:"3px 10px", fontSize:11, fontWeight:800 }}>👧 {u.enfants?.length||0} enfant{(u.enfants?.length||0)>1?"s":""}</div>
                {u.enfants?.some(e => e.allergies) && <div style={{ background:"#FFF0F0", color:C.sunset, borderRadius:50, padding:"3px 10px", fontSize:11, fontWeight:800 }}>⚠️ Allergie</div>}
                {u.droitImage && <div style={{ background:`${C.green}18`, color:C.green, borderRadius:50, padding:"3px 10px", fontSize:11, fontWeight:800 }}>📸 OK</div>}
                {u.compte_fin_saison && <div style={{ background:`${C.ocean}18`, color:C.ocean, borderRadius:50, padding:"3px 10px", fontSize:11, fontWeight:800 }}>📒 Fin de saison</div>}
              </div>
            </div>
            <div style={{ fontSize:20, color:"#ddd" }}>›</div>
          </div>
          {u.supabase && u.enfants?.length > 0 && (
            <div style={{ marginTop:8, borderTop:"1px solid #f0f0f0", paddingTop:8, display:"flex", flexDirection:"column", gap:4 }}>
              {u.enfants.map((e, ei) => (
                <div key={ei} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#f8fbff", borderRadius:10, padding:"6px 10px" }}>
                  <span style={{ fontSize:12, fontWeight:700, color:"#2C3E50" }}>{e.sexe==="M"?"👦":"👧"} {e.prenom} {NOM(e.nom)}</span>
                  <button onClick={async () => {
                    if (!window.confirm(`Supprimer ${e.prenom} ?`)) return;
                    await sb.from("enfants").delete().eq("id", e.id);
                    onRefresh?.();
                  }} style={{ background:"#fff0f0", border:"none", color:"#e74c3c", borderRadius:8, width:26, height:26, cursor:"pointer", fontSize:13, fontFamily:"inherit", flexShrink:0 }}>🗑</button>
                </div>
              ))}
            </div>
          )}
          {u.supabase && (
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <button onClick={() => setModifierMembre(u)} style={{ flex:1, background:`${C.coral}12`, border:`1.5px solid ${C.coral}30`, color:C.coral, borderRadius:12, padding:"7px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>
                ✏️ Modifier
              </button>
              <button onClick={() => setAjouterEnfantPour(u)} style={{ flex:1, background:`${C.ocean}12`, border:`1.5px dashed ${C.ocean}40`, color:C.ocean, borderRadius:12, padding:"7px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>
                ➕ Enfant
              </button>
              <button onClick={() => supprimerMembre(u)} style={{ background:"#FFF0F0", border:`1.5px solid ${C.sunset}30`, color:C.sunset, borderRadius:12, padding:"7px 10px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>
                🗑
              </button>
            </div>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}

function RechercheTab({ allResas, sessions, dbMembres }) {
  const [query, setQuery]           = useState("");
  const [filterType, setFilterType] = useState("tous");
  const [selectedMembre, setSelectedMembre] = useState(null);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [sansPhoto, setSansPhoto] = useState(false);
  const q = query.toLowerCase().trim();

  // Construire les données depuis Supabase
  const membresData = (dbMembres || []).map(m => ({
    id: m.id, name: `${m.prenom} ${m.nom}`, prenom: m.prenom, nom: m.nom,
    email: m.email, phone: m.tel, color: C.ocean, av: "👤",
    adresse: m.adresse, ville: m.ville, cp: m.cp,
    adresse_vac: m.adresse_vac, ville_vac: m.ville_vac, cp_vac: m.cp_vac,
    enfants: m.enfants || [], droitImage: m.droit_image, droitDiffusion: m.droit_diffusion,
    supabase: true,
  }));
  const tousLesMembres = membresData.length > 0 ? membresData : MEMBRES;

  // Tous les enfants avec leur parent + adresses
  const tousLesEnfants = tousLesMembres.flatMap(m =>
    (m.enfants || []).map(e => ({ ...e,
      parent: m.name || `${m.prenom} ${m.nom}`, parentId: m.id,
      parentColor: m.color || C.ocean, parentPhone: m.phone || m.tel,
      adresse: m.adresse, ville: m.ville, cp: m.cp,
      adresse_vac: m.adresse_vac, ville_vac: m.ville_vac, cp_vac: m.cp_vac,
      droitImage: m.droitImage, droitDiffusion: m.droitDiffusion,
    }))
  );

  // Appliquer filtre sans-photo
  const membresFiltres = sansPhoto ? tousLesMembres.filter(m => !m.droitImage) : tousLesMembres;
  const enfantsFiltres  = sansPhoto ? tousLesEnfants.filter(e => !e.droitImage)  : tousLesEnfants;

  // Résultats filtrés par recherche
  const resMembres = (filterType === "tous" || filterType === "membre") && (q || sansPhoto)
    ? membresFiltres.filter(m => !q ||
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        (m.enfants||[]).some(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(q))
      )
    : [];

  const resEnfants = (filterType === "tous" || filterType === "enfant") && (q || sansPhoto)
    ? enfantsFiltres.filter(e => !q ||
        `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
        e.activite?.toLowerCase().includes(q) ||
        e.niveau?.toLowerCase().includes(q) ||
        e.allergies?.toLowerCase().includes(q)
      )
    : [];

  const resActivites = (filterType === "tous" || filterType === "activite") && q
    ? tousLesEnfants.filter(e => e.activite?.toLowerCase().includes(q) || e.niveau?.toLowerCase().includes(q))
    : [];

  const totalResultats = resMembres.length + resEnfants.length;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {selectedMembre && <FicheModal membre={selectedMembre} onClose={() => setSelectedMembre(null)} />}
      {selectedEnfant && <FicheEnfantModal enfant={selectedEnfant} onClose={() => setSelectedEnfant(null)} />}

      {/* Barre de recherche */}
      <div style={{ position:"relative" }}>
        <div style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16, color:"#aaa" }}>🔍</div>
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Nom, email, prénom enfant, activité…"
          style={{ width:"100%", boxSizing:"border-box", border:"2px solid #E8EFF8", borderRadius:16, padding:"13px 42px 13px 42px", fontSize:15, fontFamily:"inherit", outline:"none", background:"#fff", boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}
          onFocus={e => e.target.style.borderColor = C.ocean}
          onBlur={e => e.target.style.borderColor = "#E8EFF8"}
          autoFocus
        />
        {query && <button onClick={() => setQuery("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"#eee", border:"none", borderRadius:"50%", width:24, height:24, cursor:"pointer", fontSize:12, fontWeight:900 }}>✕</button>}
      </div>

      {/* Filtres type */}
      <div style={{ display:"flex", gap:8 }}>
        {[["tous","🔍 Tout"],["membre","👤 Membres"],["enfant","👧 Enfants"],["activite","🏊 Activités"]].map(([k,l]) => (
          <button key={k} onClick={() => setFilterType(k)}
            style={{ flex:1, background: filterType===k ? C.ocean : "#f0f0f0", color: filterType===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:10, fontFamily:"inherit" }}>
            {l}
          </button>
        ))}
      </div>

      {/* Filtre sans autorisation photo */}
      <div onClick={() => setSansPhoto(v => !v)} style={{
        display:"flex", alignItems:"center", gap:10, cursor:"pointer",
        background: sansPhoto ? `${C.sunset}15` : "#f8f8f8",
        border: `2px solid ${sansPhoto ? C.sunset : "#e0e0e0"}`,
        borderRadius:12, padding:"10px 14px",
      }}>
        <div style={{ width:20, height:20, borderRadius:6, background: sansPhoto ? C.sunset : "#ddd", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"#fff", fontWeight:900, flexShrink:0 }}>
          {sansPhoto ? "✓" : ""}
        </div>
        <div>
          <div style={{ fontWeight:800, fontSize:13, color: sansPhoto ? C.sunset : "#555" }}>📵 Sans autorisation photo</div>
          {sansPhoto && <div style={{ fontSize:11, color:"#aaa" }}>{resMembres.length + resEnfants.length} résultat{resMembres.length + resEnfants.length > 1 ? "s" : ""}</div>}
        </div>
      </div>

      {/* Stats rapides */}
      {!query && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          {[
            { label:"Membres", value: tousLesMembres.length, color: C.ocean, emoji:"👤" },
            { label:"Enfants", value: tousLesEnfants.length, color: C.coral, emoji:"👧" },
            { label:"Avec allergie", value: tousLesEnfants.filter(e=>e.allergies).length, color: C.sunset, emoji:"⚠️" },
          ].map(k => (
            <div key={k.label} style={{ background:"#fff", borderRadius:16, padding:"12px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize:22 }}>{k.emoji}</div>
              <div style={{ fontWeight:900, color:k.color, fontSize:20 }}>{k.value}</div>
              <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Aucun résultat */}
      {query && totalResultats === 0 && (
        <div style={{ textAlign:"center", padding:"32px 0", color:"#bbb" }}>
          <div style={{ fontSize:48, marginBottom:10 }}>😶</div>
          <div style={{ fontSize:14 }}>Aucun résultat pour « {query} »</div>
        </div>
      )}

      {/* Résultats membres */}
      {resMembres.length > 0 && (
        <div>
          <div style={{ fontWeight:900, color:"#2C3E50", fontSize:12, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>👤 Membres ({resMembres.length})</div>
          {resMembres.map(u => (
            <div key={u.id} onClick={() => setSelectedMembre(u)} style={{ background:"#fff", borderRadius:16, padding:"12px 14px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", display:"flex", alignItems:"center", gap:12, marginBottom:8, cursor:"pointer" }}>
              <div style={{ width:42, height:42, borderRadius:14, background:`linear-gradient(135deg,${u.color},${u.color}bb)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>{u.av}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:900, color:"#2C3E50", fontSize:13 }}>{u.name}</div>
                <div style={{ fontSize:11, color:"#aaa" }}>{u.email}</div>
                {(u.enfants||[]).some(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(q)) && (
                  <div style={{ fontSize:11, color:u.color, fontWeight:700, marginTop:2 }}>
                    👧 {(u.enfants||[]).filter(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(q)).map(e=>e.prenom).join(", ")}
                  </div>
                )}
              </div>
              <div style={{ fontSize:18, color:"#ddd" }}>›</div>
            </div>
          ))}
        </div>
      )}

      {/* Résultats enfants */}
      {resEnfants.length > 0 && (
        <div>
          <div style={{ fontWeight:900, color:"#2C3E50", fontSize:12, letterSpacing:1, textTransform:"uppercase", marginBottom:8 }}>👧 Enfants ({resEnfants.length})</div>
          {resEnfants.map((e, i) => {
            const age = calcAge(e.naissance);
            const actColor = e.activite === "natation" ? C.ocean : e.activite === "club" ? C.coral : "#9B59B6";
            return (
              <div key={i} onClick={() => setSelectedEnfant(e)} style={{ background:"#fff", borderRadius:16, padding:"12px 14px", boxShadow:"0 2px 8px rgba(0,0,0,0.06)", display:"flex", alignItems:"center", gap:12, marginBottom:8, cursor:"pointer" }}>
                <div style={{ width:42, height:42, borderRadius:14, background:`linear-gradient(135deg,${e.parentColor},${e.parentColor}bb)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>👧</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:900, color:"#2C3E50", fontSize:13 }}>{e.prenom} {NOM(e.nom)}</div>
                  <div style={{ fontSize:11, color:"#aaa" }}>{age} ans · Parent : {e.parent}</div>
                  <div style={{ display:"flex", gap:5, marginTop:4, flexWrap:"wrap" }}>
                    <Pill color={actColor}>{e.activite === "natation" ? "🏊 Natation" : e.activite === "club" ? "🏖️ Club" : "🏊🏖️ Les deux"}</Pill>
                    {e.allergies && <Pill color={C.sunset}>⚠️ {e.allergies}</Pill>}
                    {e.niveau && e.activite !== "club" && <Pill color={C.sea}>{e.niveau}</Pill>}
                  </div>
                </div>
                <div style={{ fontSize:18, color:"#ddd" }}>›</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PAIEMENTS TAB ─────────────────────────────────────────
const ALL_PAYMENTS = [
  // Semaine 1 — 6 juillet
  { id:1,  parent:"Martin Dupont",   montant:20,  type:"Natation · 1 leçon",            date:"2026-07-06", categorie:"natation"  },
  { id:2,  parent:"Sophie Bernard",  montant:95,  type:"Natation · 5 leçons",           date:"2026-07-06", categorie:"natation"  },
  { id:3,  parent:"Pierre Martin",   montant:39,  type:"Club Matin · 3 enfants",        date:"2026-07-07", categorie:"club"      },
  { id:4,  parent:"Julie Leroy",     montant:264, type:"Club Journée · 2 semaines",     date:"2026-07-07", categorie:"club"      },
  { id:5,  parent:"Emma Renard",     montant:40,  type:"Éveil Aquatique · 2 séances",   date:"2026-07-08", categorie:"eveil"     },
  { id:6,  parent:"Lucie Morin",     montant:113, type:"Natation · 6 leçons",           date:"2026-07-08", categorie:"natation"  },
  { id:7,  parent:"Thomas Girard",   montant:180, type:"Club Liberté · 12 demi-j.",     date:"2026-07-09", categorie:"club"      },
  { id:8,  parent:"Clara Petit",     montant:170, type:"Natation · 10 leçons",          date:"2026-07-09", categorie:"natation"  },
  { id:9,  parent:"Marc Blanc",      montant:15,  type:"Club Matin · 1 enfant",         date:"2026-07-10", categorie:"club"      },
  { id:10, parent:"Isabelle Roy",    montant:20,  type:"Éveil Aquatique · 1 séance",    date:"2026-07-10", categorie:"eveil"     },
  { id:11, parent:"Nicolas André",   montant:78,  type:"Club Matin · 1 sem. · 1 enf.", date:"2026-07-11", categorie:"club"      },
  { id:12, parent:"Camille Simon",   montant:95,  type:"Natation · 5 leçons",           date:"2026-07-11", categorie:"natation"  },
  // Semaine 2 — 13 juillet
  { id:13, parent:"Marie Dupuis",    montant:144, type:"Club Matin · 2 semaines",       date:"2026-07-13", categorie:"club"      },
  { id:14, parent:"Antoine Moreau",  montant:20,  type:"Natation · 1 leçon",            date:"2026-07-14", categorie:"natation"  },
  { id:15, parent:"Laura Bonnet",    montant:45,  type:"Club AM · 3 enfants",           date:"2026-07-14", categorie:"club"      },
  { id:16, parent:"Julien Faure",    montant:60,  type:"Éveil Aquatique · 3 séances",   date:"2026-07-15", categorie:"eveil"     },
  { id:17, parent:"Aurélie Roux",    montant:264, type:"Club Journée · 2 semaines",     date:"2026-07-15", categorie:"club"      },
  { id:18, parent:"Maxime Laurent",  montant:113, type:"Natation · 6 leçons",           date:"2026-07-16", categorie:"natation"  },
  { id:19, parent:"Chloé Mercier",   montant:189, type:"Club Matin · 3 semaines",       date:"2026-07-17", categorie:"club"      },
  { id:20, parent:"Paul Legrand",    montant:20,  type:"Éveil Aquatique · 1 séance",    date:"2026-07-18", categorie:"eveil"     },
  // Semaine 3 — 20 juillet
  { id:21, parent:"Nathalie Hubert", montant:95,  type:"Natation · 5 leçons",           date:"2026-07-20", categorie:"natation"  },
  { id:22, parent:"François Colin",  montant:144, type:"Club AM · 2 semaines",          date:"2026-07-21", categorie:"club"      },
  { id:23, parent:"Stéphanie Adam",  montant:40,  type:"Éveil Aquatique · 2 séances",   date:"2026-07-22", categorie:"eveil"     },
  { id:24, parent:"David Garnier",   montant:170, type:"Natation · 10 leçons",          date:"2026-07-23", categorie:"natation"  },
  { id:25, parent:"Caroline Muller", montant:252, type:"Club Liberté · 18 demi-j.",     date:"2026-07-24", categorie:"club"      },
  { id:26, parent:"Vincent Chevalier",montant:20, type:"Natation · 1 leçon",            date:"2026-07-25", categorie:"natation"  },
  // Semaine 4 — 27 juillet
  { id:27, parent:"Sylvie Fontaine", montant:216, type:"Club Matin · 4 semaines",       date:"2026-07-27", categorie:"club"      },
  { id:28, parent:"Éric Rousseau",   montant:113, type:"Natation · 6 leçons",           date:"2026-07-28", categorie:"natation"  },
  { id:29, parent:"Sandrine Michel", montant:80,  type:"Éveil Aquatique · 4 séances",   date:"2026-07-29", categorie:"eveil"     },
  { id:30, parent:"Pascal Henry",    montant:95,  type:"Natation · 5 leçons",           date:"2026-07-30", categorie:"natation"  },
  { id:31, parent:"Brigitte Morel",  montant:264, type:"Club Journée · 2 semaines",     date:"2026-07-31", categorie:"club"      },
  { id:32, parent:"Rémi Leclerc",    montant:20,  type:"Éveil Aquatique · 1 séance",    date:"2026-08-01", categorie:"eveil"     },
  // Semaine 5 — 3 août
  { id:33, parent:"Céline Gauthier", montant:170, type:"Natation · 10 leçons",          date:"2026-08-03", categorie:"natation"  },
  { id:34, parent:"Olivier Perrin",  montant:144, type:"Club Matin · 2 semaines",       date:"2026-08-04", categorie:"club"      },
  { id:35, parent:"Angélique Renaud",montant:40,  type:"Éveil Aquatique · 2 séances",   date:"2026-08-05", categorie:"eveil"     },
  { id:36, parent:"Sébastien Dupont",montant:95,  type:"Natation · 5 leçons",           date:"2026-08-06", categorie:"natation"  },
  { id:37, parent:"Laetitia Lemaire",montant:288, type:"Club Liberté · 24 demi-j.",     date:"2026-08-07", categorie:"club"      },
  { id:38, parent:"Thierry Vincent", montant:113, type:"Natation · 6 leçons",           date:"2026-08-08", categorie:"natation"  },
  // Semaine 6 — 10 août
  { id:39, parent:"Isabelle Perez",  montant:20,  type:"Natation · 1 leçon",            date:"2026-08-10", categorie:"natation"  },
  { id:40, parent:"Arnaud Robert",   montant:216, type:"Club Matin · 4 semaines",       date:"2026-08-11", categorie:"club"      },
  { id:41, parent:"Véronique Simon", montant:60,  type:"Éveil Aquatique · 3 séances",   date:"2026-08-12", categorie:"eveil"     },
  { id:42, parent:"Xavier Martin",   montant:170, type:"Natation · 10 leçons",          date:"2026-08-13", categorie:"natation"  },
  { id:43, parent:"Monique Durand",  montant:264, type:"Club Journée · 2 semaines",     date:"2026-08-14", categorie:"club"      },
  { id:44, parent:"Patrick Bernard", montant:20,  type:"Éveil Aquatique · 1 séance",    date:"2026-08-15", categorie:"eveil"     },
  // Semaine 7 — 17 août
  { id:45, parent:"Christine Lebrun",montant:95,  type:"Natation · 5 leçons",           date:"2026-08-17", categorie:"natation"  },
  { id:46, parent:"Daniel Girard",   montant:144, type:"Club AM · 2 semaines",          date:"2026-08-18", categorie:"club"      },
  { id:47, parent:"Nathalie Dupuy",  montant:40,  type:"Éveil Aquatique · 2 séances",   date:"2026-08-19", categorie:"eveil"     },
  { id:48, parent:"Michel Leconte",  montant:113, type:"Natation · 6 leçons",           date:"2026-08-20", categorie:"natation"  },
  { id:49, parent:"Sylvie Renard",   montant:330, type:"Club Liberté · 30 demi-j.",     date:"2026-08-21", categorie:"club"      },
  { id:50, parent:"Jean-Pierre Roy", montant:20,  type:"Natation · 1 leçon",            date:"2026-08-22", categorie:"natation"  },
];

function PaiementsTab({ onValidate }) {
  const [resas, setResas]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("tous");
  const [dateFilter, setDateFilter] = useState("");
  const [subTab, setSubTab]   = useState("liste"); // "liste" | "suivi"

  const loadAll = async () => {
    const [{ data: nat }, { data: club }] = await Promise.all([
      sb.from("reservations_natation").select("*, membres(prenom, nom, email)").order("created_at"),
      sb.from("reservations_club").select("*, membres(prenom, nom, email)").order("created_at"),
    ]);
    const natFmt  = (nat  || []).map(r => ({ ...r, _type:"natation", _date:r.date_seance,      _label:`🏊 ${r.heure}` }));
    const clubFmt = (club || []).map(r => ({ ...r, _type:"club",     _date:r.date_reservation, _label: (!isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6) ? "🎟️ Carte Liberté" : `🏖️ ${r.session==="matin"?"Matin":"Après-midi"}` }));
    setResas([...natFmt, ...clubFmt].sort((a,b) => (a.created_at||"").localeCompare(b.created_at||"")));
    setLoading(false);
  };

  useEffect(() => { loadAll().catch(() => setLoading(false)); }, []);

  const toggleStatut = async (groupe) => {
    const table     = groupe.type === "natation" ? "reservations_natation" : "reservations_club";
    const newStatut = groupe.statut === "pending" ? "confirmed" : "pending";
    await Promise.all(groupe.resas.map(r => sb.from(table).update({ statut: newStatut }).eq("id", r.id)));

    // Si c'est un achat Carte Liberté → créditer ou décréditer le solde
    if (groupe.type === "club" && groupe.resas.some(r => !isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6)) {
      const r = groupe.resas[0];
      const credit = Number(r.enfants?.[0]) || 0;
      if (credit > 0 && r.membre_id) {
        const { data: m } = await sb.from("membres").select("liberte_balance, liberte_total").eq("id", r.membre_id).single();
        if (m) {
          const delta = newStatut === "confirmed" ? credit : -credit;
          await sb.from("membres").update({
            liberte_balance: Math.max(0, (m.liberte_balance||0) + delta),
            liberte_total:   Math.max(0, (m.liberte_total||0) + (newStatut === "confirmed" ? credit : 0)),
          }).eq("id", r.membre_id);
        }
      }
    }

    // Si c'est une utilisation carte liberté → décrémenter ou récréditer
    if (groupe.type === "club" && groupe.resas.some(r => (r.label_jour||"").startsWith("[LIBERTE]"))) {
      const membreId = groupe.resas[0]?.membre_id;
      const nbUtil = groupe.resas.filter(r => (r.label_jour||"").startsWith("[LIBERTE]")).length;
      if (membreId && nbUtil > 0) {
        const { data: m } = await sb.from("membres").select("liberte_balance").eq("id", membreId).single();
        if (m) {
          const delta = newStatut === "confirmed" ? -nbUtil : nbUtil; // confirmer = décrémenter
          await sb.from("membres").update({ liberte_balance: Math.max(0, (m.liberte_balance||0) + delta) }).eq("id", membreId);
        }
      }
    }

    await loadAll();
    onValidate?.();
  };

  // Grouper par membre + type + bloc temporel (créés le même jour)
  const grouper = (liste) => {
    const groups = {};
    liste.forEach(r => {
      // Grouper à la minute : résas d'une même commande créées quasi-simultanément
      const minuteCreation = (r.created_at||"").slice(0,16);
      // Club: grouper par session + enfants (trié) + minute → chaque combinaison enfant/session = 1 groupe
      const enfantsKey = Array.isArray(r.enfants) ? [...r.enfants].sort().join(",") : "";
      const keyClub = r._type === "club"
        ? `${r.membre_id}-club-${r.session}-${enfantsKey}-${minuteCreation}`
        : null;
      const key = keyClub || `${r.membre_id}-${r._type}-${enfantsKey}-${minuteCreation}`;
      if (!groups[key]) groups[key] = {
        key, membre: r.membres, type: r._type, statut: r.statut,
        created_at: r.created_at, resas: [],
      };
      groups[key].resas.push(r);
    });
    return Object.values(groups).sort((a,b) => (b.created_at||"").localeCompare(a.created_at||""));
  };

  const allGroups    = grouper(resas);
  const pending      = allGroups.filter(g => g.statut === "pending").length;
  const confirmed    = allGroups.filter(g => g.statut === "confirmed").length;
  const CAT_COLOR    = { natation: C.ocean, club: C.coral };

  // Label forfait selon nb séances natation
  const LIBERTE_PRIX = { 6: 96, 12: 180, 18: 252, 24: 288, 30: 330 };
  const isLiberte = (g) => g.type === "club" && g.resas.some(r => !isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6);

  const getForfaitLabel = (g) => {
    if (g.type === "natation") {
      const n = g.resas.length;
      if (n === 1)  return "Formule 1 leçon";
      if (n === 5)  return "Formule 5 leçons";
      if (n === 6)  return "Formule 6 leçons";
      if (n === 10) return "Formule 10 leçons";
      return `${n} séances`;
    }
    if (isLiberte(g)) {
      const nb = Number(g.resas[0]?.enfants?.[0]) || 0;
      return `🎟️ Carte Liberté · ${nb} demi-journées`;
    }
    // Club normal
    const resas = g.resas.filter(r => !(Array.isArray(r.enfants) && Number(r.enfants[0]) >= 6));
    const nbMatin  = resas.filter(r => r.session === "matin").length;
    const nbApmidi = resas.filter(r => r.session === "apmidi").length;
    const isJournee = nbMatin > 0 && nbApmidi > 0 && Math.abs(nbMatin - nbApmidi) <= 1;
    const sessionLabel = isJournee ? "Journée" : nbMatin >= nbApmidi ? "☀️ Matin" : "🌊 Après-midi";
    const nbJours = isJournee ? Math.round(resas.length / 2) : resas.length;
    const nbSemaines = Math.round(nbJours / 6);
    const nbEnfants = (resas[0]?.enfants || []).length || 1;
    if (nbSemaines >= 1) return `🏖️ Club ${sessionLabel} · ${nbSemaines} semaine${nbSemaines>1?"s":""} · ${nbEnfants} enfant${nbEnfants>1?"s":""}`;
    return `🏖️ Club ${sessionLabel} · ${nbJours} demi-journée${nbJours>1?"s":""} · ${nbEnfants} enfant${nbEnfants>1?"s":""}`;
  };

  const getClubMontant = (g) => {
    if (isLiberte(g)) {
      const nb = Number(g.resas[0]?.enfants?.[0]) || 0;
      return LIBERTE_PRIX[nb] ? `${LIBERTE_PRIX[nb]} €` : "—";
    }
    // Lire montant stocké dans label_jour [MONTANT:xx]
    const label = g.resas[0]?.label_jour || "";
    const montantMatch = label.match(/\[MONTANT:(\d+)\]/);
    if (montantMatch) return `${montantMatch[1]} €`;

    // Calculer automatiquement depuis les tarifs
    const resas = g.resas.filter(r => !(Array.isArray(r.enfants) && Number(r.enfants[0]) >= 6));
    if (resas.length === 0) return "—";

    // Détecter session dominante
    const nbMatin  = resas.filter(r => r.session === "matin").length;
    const nbApmidi = resas.filter(r => r.session === "apmidi").length;
    const isJournee = nbMatin > 0 && nbApmidi > 0 && Math.abs(nbMatin - nbApmidi) <= 1;
    const session = isJournee ? "journee" : nbMatin >= nbApmidi ? "matin" : "apmidi";

    // Nb de jours réels (journée = 1 jour = 2 résas)
    const nbJours = isJournee ? Math.round(resas.length / 2) : resas.length;
    const nbSemaines = Math.round(nbJours / 6);

    // Nb enfants
    const nbEnfants = (resas[0]?.enfants || []).length || 1;

    const tarif = session === "matin" ? TARIFS_MATIN : session === "apmidi" ? TARIFS_APMIDI : TARIFS_JOURNEE;

    // Trouver la bonne ligne selon nb semaines/jours
    let rowIdx = 0;
    if (nbSemaines >= 4) rowIdx = 4;
    else if (nbSemaines === 3) rowIdx = 3;
    else if (nbSemaines === 2) rowIdx = 2;
    else if (nbSemaines === 1) rowIdx = 1;
    else rowIdx = 0; // 1 demi-journée

    const row = tarif.rows[rowIdx];
    if (!row) return "—";

    let prix = nbEnfants === 1 ? row.e1 : nbEnfants === 2 ? row.e2 : nbEnfants === 3 ? row.e3 : row.e3 + (nbEnfants - 3) * row.sup;
    return `${prix} €`;
  };

  const getMontant = (g) => {
    if (g.type === "natation") {
      const n = g.resas.length;
      // Nb enfants = max enfants dans une résa du groupe
      const nbEnfants = Math.max(1, ...g.resas.map(r => (r.enfants||[]).length));
      const PRIX_NAT = { 1:20, 2:40, 3:60, 4:80, 5:95, 6:113, 7:131, 8:147, 9:162, 10:170 };
      const prixForfait = n <= 10 ? (PRIX_NAT[n] || n*20) : 170 + (n-10)*17;
      return `${prixForfait * nbEnfants} €`;
    }
    return getClubMontant(g);
  };

  const filtered = (() => {
    let g = filter === "tous" ? allGroups
      : filter === "pending" ? allGroups.filter(g => g.statut === "pending")
      : filter === "confirmed" ? allGroups.filter(g => g.statut === "confirmed")
      : allGroups.filter(g => g.statut === "confirmed" && g.resas.some(r => r.mode_paiement === filter));
    if (dateFilter) {
      g = g.filter(gr => {
        const d = gr.resas[0]?._date?.slice(0,10);
        if (!d) return false;
        return d.startsWith(dateFilter);
      });
    }
    return g;
  })();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* Onglets Liste / Cahier de suivi */}
      <div style={{ display:"flex", gap:0, background:"#fff", borderRadius:14, padding:4, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
        {[["liste","📋 Liste"],["suivi","📓 Cahier de suivi"]].map(([k,l]) => (
          <button key={k} onClick={() => setSubTab(k)} style={{ flex:1, background: subTab===k ? `linear-gradient(135deg,${C.ocean},${C.sea})` : "transparent", color: subTab===k?"#fff":"#888", border:"none", borderRadius:10, padding:"9px 4px", cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit" }}>{l}</button>
        ))}
      </div>

      {/* ── CAHIER DE SUIVI ── */}
      {subTab === "suivi" && (() => {
        // Grouper les résas confirmées par jour de validation
        const confirmedAll = allGroups.filter(g => g.statut === "confirmed");
        const parJour = {};
        confirmedAll.forEach(g => {
          const dateVal = (g.resas[0]?.validated_at || g.resas[0]?.created_at || "").slice(0,10);
          if (!dateVal) return;
          if (!parJour[dateVal]) parJour[dateVal] = [];
          parJour[dateVal].push(g);
        });
        const jours = Object.keys(parJour).sort((a,b) => b.localeCompare(a));

        if (jours.length === 0) return (
          <div style={{ textAlign:"center", padding:"32px 0", color:"#bbb", fontSize:14 }}>Aucun encaissement enregistré</div>
        );

        return (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {jours.map(jour => {
              const groupes = parJour[jour];
              const totalJour = groupes.reduce((s,g) => {
                if (g.resas.find(r=>r.mode_paiement)?.mode_paiement === "offert") return s; // Offerts exclus
                const m = getMontant(g).replace(" €","").replace("—","0");
                return s + (Number(m)||0);
              }, 0);
              const dateLabel = new Date(jour+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
              // Répartition par mode
              const modesJour = {};
              let nbOfferts = 0;
              groupes.forEach(g => {
                const mode = g.resas.find(r=>r.mode_paiement)?.mode_paiement || "non_renseigne";
                if (mode === "offert") { nbOfferts++; return; } // Offerts : compter mais pas additionner
                if (!modesJour[mode]) modesJour[mode] = 0;
                const m = getMontant(g).replace(" €","").replace("—","0");
                modesJour[mode] += Number(m)||0;
              });

              return (
                <div key={jour} style={{ background:"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)", borderLeft:`4px solid ${C.green}` }}>
                  {/* Header jour */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:900, color:C.dark, fontSize:14, textTransform:"capitalize" }}>{dateLabel}</div>
                      <div style={{ fontSize:11, color:"#aaa", marginTop:2 }}>{groupes.length} transaction{groupes.length>1?"s":""}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:900, fontSize:20, color:C.green }}>{totalJour} €</div>
                      <div style={{ fontSize:10, color:"#aaa" }}>total du jour</div>
                    </div>
                  </div>

                  {/* Barre modes paiement */}
                  {totalJour > 0 && (
                    <div style={{ display:"flex", borderRadius:6, overflow:"hidden", height:8, marginBottom:8 }}>
                      {MODES_PAIEMENT.map(m => {
                        const montantMode = modesJour[m.id] || 0;
                        const pct = totalJour > 0 ? (montantMode/totalJour)*100 : 0;
                        return pct > 0 ? <div key={m.id} style={{ width:`${pct}%`, background:m.color }} title={`${m.label} : ${montantMode}€`} /> : null;
                      })}
                      {(modesJour["non_renseigne"]||0) > 0 && (
                        <div style={{ flex:1, background:"#e0e0e0" }} />
                      )}
                    </div>
                  )}

                  {/* Détail des transactions */}
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {groupes.map((g, gi) => {
                      const mp = MODES_PAIEMENT.find(m => m.id === g.resas.find(r=>r.mode_paiement)?.mode_paiement);
                      const isOffert = mp?.id === "offert";
                      const montant = getMontant(g);
                      const membre = g.membre ? `${g.membre.prenom} ${(g.membre.nom||"").toUpperCase()}` : "—";
                      const label = g.type === "natation" ? getForfaitLabel(g) : isLiberte(g) ? "🎟️ Carte Liberté" : getForfaitLabel(g);
                      return (
                        <div key={gi} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 8px", background: isOffert ? "#FDF2F8" : "#f8fbff", borderRadius:8, opacity: isOffert ? 0.85 : 1 }}>
                          <div style={{ flex:1 }}>
                            <span style={{ fontWeight:700, fontSize:12, color:C.dark }}>{membre}</span>
                            <span style={{ fontSize:11, color:"#aaa", marginLeft:8 }}>{label}</span>
                          </div>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            {mp && <span style={{ background:`${mp.color}20`, color:mp.color, borderRadius:50, padding:"2px 8px", fontSize:10, fontWeight:800 }}>{mp.label.split(" ").slice(1).join(" ")}</span>}
                            <span style={{ fontWeight:800, color: isOffert ? "#EC4899" : C.dark, fontSize:13, textDecoration: isOffert ? "line-through" : "none" }}>{montant}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Sous-total par mode */}
                  <div style={{ marginTop:8, paddingTop:8, borderTop:"1px solid #f0f0f0", display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                    {MODES_PAIEMENT.filter(m => m.id !== "offert").map(m => {
                      const v = modesJour[m.id];
                      return v ? <span key={m.id} style={{ fontSize:11, color:m.color, fontWeight:800 }}>{m.label.split(" ")[0]} {v} €</span> : null;
                    })}
                    {nbOfferts > 0 && (
                      <span style={{ fontSize:11, color:"#EC4899", fontWeight:800 }}>🎁 {nbOfferts} offert{nbOfferts>1?"s":""} <span style={{ fontWeight:400, color:"#aaa" }}>(non comptabilisé{nbOfferts>1?"s":""})</span></span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── LISTE ── */}
      {subTab === "liste" && <>

      {/* KPIs */}
      <div style={{ display:"flex", gap:8 }}>
        {[
          { label:"En attente", value: pending,   color: C.sun   },
          { label:"Confirmées", value: confirmed, color: C.green },
          { label:"Total",      value: allGroups.length, color: C.ocean },
        ].map(k => (
          <div key={k.label} style={{ flex:1, background:"#fff", borderRadius:16, padding:"12px 8px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight:900, fontSize:20, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:10, color:"#aaa", fontWeight:700 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Graphique dynamique modes de paiement */}
      {confirmed > 0 && (() => {
        const modeCounts = MODES_PAIEMENT.map(m => ({
          ...m,
          count: allGroups.filter(g => g.statut==="confirmed" && g.resas.some(r => r.mode_paiement===m.id)).length,
          montant: allGroups.filter(g => g.statut==="confirmed" && g.resas.some(r => r.mode_paiement===m.id)).reduce((s,g) => {
            const montantStr = getMontant(g).replace(" €","").replace("—","0");
            return s + (Number(montantStr)||0);
          }, 0),
        })).filter(m => m.count > 0);
        const totalMontant = modeCounts.reduce((s,m) => s+m.montant, 0);
        const nonRenseigne = allGroups.filter(g => g.statut==="confirmed" && !g.resas.some(r => r.mode_paiement)).length;
        return (
          <div style={{ background:"#fff", borderRadius:16, padding:"16px 18px", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight:800, color:C.dark, fontSize:13, marginBottom:12 }}>💳 Répartition des paiements</div>
            {/* Barre proportionnelle */}
            <div style={{ display:"flex", borderRadius:10, overflow:"hidden", height:28, marginBottom:12 }}>
              {modeCounts.map((m, i) => {
                const pct = totalMontant > 0 ? Math.round((m.montant/totalMontant)*100) : Math.round((m.count/confirmed)*100);
                return (
                  <div key={m.id} title={`${m.label} : ${pct}%`}
                    style={{ width:`${pct}%`, background:m.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff", fontWeight:800, transition:"width .4s", minWidth: pct>5?0:0 }}>
                    {pct > 8 ? `${pct}%` : ""}
                  </div>
                );
              })}
              {nonRenseigne > 0 && (
                <div style={{ flex:1, background:"#e0e0e0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#aaa", fontWeight:700 }}>
                  {nonRenseigne > 0 ? "?" : ""}
                </div>
              )}
            </div>
            {/* Légende */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
              {modeCounts.map(m => (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:12, height:12, borderRadius:3, background:m.color, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:"#555", fontWeight:700 }}>{m.label}</span>
                  <span style={{ fontSize:11, color:"#aaa" }}>{m.count} · {m.montant} €</span>
                </div>
              ))}
              {nonRenseigne > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ width:12, height:12, borderRadius:3, background:"#e0e0e0", flexShrink:0 }} />
                  <span style={{ fontSize:12, color:"#aaa" }}>Non renseigné · {nonRenseigne}</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Filtres statut */}
      <div style={{ display:"flex", gap:6, background:"#fff", borderRadius:14, padding:5, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
        {[["tous","Toutes"],["pending","⏳ Attente"],["confirmed","✓ Payées"]].map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            flex:1, background: filter===k ? `linear-gradient(135deg,${C.ocean},${C.sea})` : "transparent",
            color: filter===k?"#fff":"#888", border:"none", borderRadius:10,
            padding:"8px 4px", cursor:"pointer", fontWeight:900, fontSize:11, fontFamily:"inherit",
          }}>{l}</button>
        ))}
      </div>

      {/* Filtres par mode de paiement */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {MODES_PAIEMENT.map(m => {
          const count = allGroups.filter(g => g.statut==="confirmed" && g.resas.some(r => r.mode_paiement===m.id)).length;
          return (
            <button key={m.id} onClick={() => setFilter(filter===m.id?"tous":m.id)} style={{
              background: filter===m.id ? m.color : "#fff",
              color: filter===m.id ? "#fff" : "#555",
              border: `1.5px solid ${filter===m.id ? m.color : "#e0e0e0"}`,
              borderRadius:50, padding:"5px 12px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit",
              boxShadow: filter===m.id ? `0 2px 8px ${m.color}44` : "none",
            }}>{m.label} {count > 0 && `(${count})`}</button>
          );
        })}
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <div style={{ fontSize:11, fontWeight:900, color:"#888", whiteSpace:"nowrap" }}>📅 Date :</div>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
          style={{ flex:1, border:"2px solid #e0e8f0", borderRadius:10, padding:"7px 10px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
        {dateFilter && <button onClick={() => setDateFilter("")} style={{ background:"#f0f0f0", border:"none", borderRadius:8, padding:"7px 10px", cursor:"pointer", fontSize:12, fontWeight:800, fontFamily:"inherit", color:"#888" }}>✕</button>}
      </div>

      {/* Liste groupée */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"32px 0", color:"#bbb" }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:"32px 0", color:"#bbb", fontSize:14 }}>Aucune réservation</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(320px, 1fr))", gap:12 }}>
          {filtered.map(g => {
            const color   = CAT_COLOR[g.type];
            const isPaid  = g.statut === "confirmed";
            const enfants = [...new Set(g.resas.flatMap(r => r.enfants||[]))];
            return (
              <div key={g.key} style={{
                background:"#fff", borderRadius:16, padding:"14px 16px",
                boxShadow:"0 2px 8px rgba(0,0,0,0.05)",
                borderLeft:`4px solid ${isPaid ? color : C.sun}`,
              }}>
                {/* Header membre */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div>
                    <div style={{ fontWeight:900, color:C.dark, fontSize:14 }}>
                      {g.membre ? `${g.membre.prenom} ${NOM(g.membre.nom)}` : "—"}
                    </div>
                    {enfants.length > 0 && (
                      <div style={{ fontSize:12, color:"#888", marginTop:1 }}>{enfants.join(", ")}</div>
                    )}
                  </div>
                  <div style={{ fontWeight:900, fontSize:16, color: isPaid ? C.green : "#b45309", marginLeft:8 }}>
                    {getMontant(g)}
                  </div>
                </div>

                {/* Forfait label */}
                <div style={{ fontSize:13, color, fontWeight:700, marginBottom:10 }}>
                  {getForfaitLabel(g)}
                </div>

                {/* Créneaux */}
                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:12 }}>
                  {g.resas.map((r,i) => {
                    const date = r._date?.slice(0,10);
                    return (
                      <div key={i} style={{ background:`${color}12`, color, borderRadius:8, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                        {r._label} · {date ? new Date(date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "—"}
                      </div>
                    );
                  })}
                </div>

                {/* Mode paiement badge */}
                {isPaid && g.resas[0]?.mode_paiement && (
                  <div style={{ marginBottom:8 }}>
                    {(() => {
                      const mp = MODES_PAIEMENT.find(m => m.id === g.resas[0].mode_paiement);
                      return mp ? <span style={{ background:`${mp.color}15`, color:mp.color, borderRadius:50, padding:"3px 12px", fontSize:11, fontWeight:800 }}>{mp.label}</span> : null;
                    })()}
                  </div>
                )}

                {/* Bouton toggle */}
                <button onClick={() => toggleStatut(g)} style={{
                  width:"100%", border:"none", borderRadius:12, padding:"9px",
                  cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit",
                  background: isPaid
                    ? "#f0f0f0"
                    : `linear-gradient(135deg,${C.green},#1E8449)`,
                  color: isPaid ? "#888" : "#fff",
                  boxShadow: isPaid ? "none" : `0 4px 14px ${C.green}44`,
                }}>
                  {isPaid ? "↩ Remettre en attente" : "✅ Marquer comme payé"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      </>}
    </div>
  );
}

// ── PLANNING TAB ──────────────────────────────────────────
// ── PLANNING TAB ──────────────────────────────────────────

// Parse ISO date string sans décalage UTC
function parseLocalDate(iso) {
  if (!iso) return new Date();
  const [y,m,d] = iso.slice(0,10).split("-").map(Number);
  return new Date(y, m-1, d);
}

function calcAge(naissance) {
  const today = new Date(2026, 6, 6); // référence saison
  const [y, m, d] = naissance.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

function DayDetailModal({ day, activity, session, onClose, dbResasNat = [], dbResasClub = [], onSelectEnfant }) {
  const allEnfants = (() => {
    if (!day?.date) return [];
    const dateISO = `${day.date.getFullYear()}-${String(day.date.getMonth()+1).padStart(2,"0")}-${String(day.date.getDate()).padStart(2,"0")}`;

    if (activity === "natation" && dbResasNat.length > 0) {
      const resasJour = dbResasNat.filter(r => r.date_seance?.slice(0,10) === dateISO);
      const enfants = [];
      resasJour.forEach(r => {
        (r.enfants || []).forEach(prenom => {
          // Chercher la fiche complète de l'enfant
          const ficheEnfant = (r.membres?.enfants || []).find(e => e.prenom === prenom);
          enfants.push({
            prenom,
            nom: ficheEnfant?.nom || "",
            naissance: ficheEnfant?.naissance || "",
            activite: "natation",
            niveau: ficheEnfant?.niveau || r.niveau || "debutant",
            allergies: ficheEnfant?.allergies || "",
            parent: r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—",
            parentColor: C.ocean, parentAv: "👤",
            phone: r.membres?.tel || "—",
            adresse: r.membres?.adresse || "", ville: r.membres?.ville || "", cp: r.membres?.cp || "",
            adresse_vac: r.membres?.adresse_vac || "", ville_vac: r.membres?.ville_vac || "", cp_vac: r.membres?.cp_vac || "",
            heure: r.heure,
            _ficheEnfant: ficheEnfant || null,
          });
        });
      });
      return enfants.sort((a, b) => (a.nom||a.prenom).localeCompare(b.nom||b.prenom));
    }

    if (activity === "club" && dbResasClub.length > 0) {
      const resasJour = dbResasClub.filter(r => {
        if (r.date_reservation?.slice(0,10) !== dateISO) return false;
        if (session && r.session !== session) return false;
        return true;
      });
      const liste = [];
      resasJour.forEach(r => {
        // Exclure les achats carte
        if (Array.isArray(r.enfants) && Number(r.enfants[0]) >= 6) return;
        const parentNom = r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—";
        const prenoms = (r.enfants || []).filter(e => isNaN(Number(e)));
        if (prenoms.length > 0) {
          prenoms.forEach(prenom => {
            // Chercher la fiche complète de l'enfant dans le profil membre
            const ficheEnfant = (r.membres?.enfants || []).find(e => e.prenom === prenom);
            liste.push({
              prenom,
              nom: ficheEnfant?.nom || "",
              naissance: ficheEnfant?.naissance || "",
              activite: "club",
              niveau: ficheEnfant?.niveau || "",
              allergies: ficheEnfant?.allergies || "",
              parent: parentNom,
              parentColor: C.coral,
              parentAv: "👤",
              phone: r.membres?.tel || "—",
              adresse: r.membres?.adresse || "", ville: r.membres?.ville || "", cp: r.membres?.cp || "",
              adresse_vac: r.membres?.adresse_vac || "", ville_vac: r.membres?.ville_vac || "", cp_vac: r.membres?.cp_vac || "",
              session: r.session,
              _ficheEnfant: ficheEnfant || null,
            });
          });
        } else {
          liste.push({
            prenom: r.membres?.prenom || "—",
            nom: r.membres?.nom || "",
            naissance: "", activite: "club",
            niveau: "", allergies: "",
            parent: parentNom, parentColor: C.coral, parentAv: "👤",
            phone: r.membres?.tel || "—",
            session: r.session,
            _ficheEnfant: null,
          });
        }
      });
      return liste.sort((a, b) => (a.nom||"").localeCompare(b.nom||""));
    }

    // Fallback mock
    const list = [];
    MEMBRES.forEach(m => {
      m.enfants.forEach(e => {
        const match = activity === "natation"
          ? (e.activite === "natation" || e.activite === "les deux")
          : (e.activite === "club" || e.activite === "les deux");
        if (match) list.push({ ...e, parent: m.name, parentColor: m.color, parentAv: m.av, phone: m.phone });
      });
    });
    return list.sort((a, b) => a.nom.localeCompare(b.nom));
  })();

  const actColor   = activity === "natation" ? C.ocean : C.coral;
  const actLabel   = activity === "natation" ? "Natation" : "Club de Plage";
  const actEmoji   = activity === "natation" ? "🏊" : "🏖️";
  const sessionLabel = session === "matin" ? "Matin · 9h30–12h30" : session === "apmidi" ? "Après-midi · 14h30–18h00" : "Journée complète";
  const niveauLabel = n => n === "avance" ? "Avancé" : n === "intermediaire" ? "Intermédiaire" : "Débutant";
  const niveauColor = n => n === "avance" ? C.green : n === "intermediaire" ? C.ocean : C.sea;
  const dateStr = `${day.label} ${day.num} ${day.month} 2026`;

  const handlePrint = () => {
    const rows = allEnfants.map((e, i) => `
      <tr style="background:${i%2===0?'#f9fbff':'#fff'}">
        <td style="padding:8px 12px;font-weight:700;color:#2C3E50">${i+1}</td>
        <td style="padding:8px 12px;font-weight:900;color:#2C3E50">${(e.nom||"").toUpperCase()}</td>
        <td style="padding:8px 12px;color:#2C3E50">${e.prenom}</td>
        <td style="padding:8px 12px;text-align:center;font-weight:700;color:${actColor}">${e.naissance ? calcAge(e.naissance) + " ans" : "—"}</td>
        ${activity === "natation" ? `<td style="padding:8px 12px;color:#1A8FE3;font-weight:700">${e.heure || "—"}</td>` : ""}
        <td style="padding:8px 12px;color:#555">${e.parent}</td>
        <td style="padding:8px 12px;color:#555">${e.phone || '—'}</td>
        <td style="padding:8px 12px;color:${e.allergies?'#e74c3c':'#aaa'};font-weight:${e.allergies?700:400}">${e.allergies || '—'}</td>
        ${activity === "natation" ? `<td style="padding:8px 12px;color:#555">${niveauLabel(e.niveau)}</td>` : ""}
      </tr>
    `).join('');

    const thNatation = activity === "natation" ? "<th>Heure</th>" : "";
    const thNiveau   = activity === "natation" ? "<th>Niveau</th>" : "";

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Planning ${actLabel} · ${dateStr}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 24px; color: #2C3E50; }
  h1 { color: ${actColor}; font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: #888; font-size: 14px; margin: 0 0 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: ${actColor}; color: #fff; padding: 10px 12px; text-align: left; font-weight: 700; }
  tr:hover { background: #eef5ff !important; }
  .footer { margin-top: 20px; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 10px; }
  .badge { display: inline-block; background: ${actColor}22; color: ${actColor}; padding: 2px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; margin-right: 8px; }
  @media print { body { margin: 12px; } }
</style>
</head><body>
<h1>${actEmoji} ${actLabel} — ${dateStr}</h1>
<p class="subtitle">${sessionLabel} &nbsp;·&nbsp; <span class="badge">${allEnfants.length} enfant${allEnfants.length>1?'s':''}</span>${allEnfants.filter(e=>e.allergies).length>0?`<span class="badge" style="background:#fee;color:#e74c3c">⚠️ ${allEnfants.filter(e=>e.allergies).length} allergie${allEnfants.filter(e=>e.allergies).length>1?'s':''}</span>`:''}
</p>
<table>
  <thead><tr>
    <th>#</th><th>Nom</th><th>Prénom</th><th>Âge</th>${thNatation}<th>Parent</th><th>Téléphone</th><th>Allergies</th>${thNiveau}
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Eole Beach Club · Saison 2026 · Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,20,50,0.65)", backdropFilter: "blur(5px)" }} />
      <div style={{ position: "relative", marginTop: "auto", background: "#F0F4F8", borderRadius: "28px 28px 0 0", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 -12px 48px rgba(0,0,0,0.3)" }}>

        {/* Handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 40, height: 5, borderRadius: 10, background: "#ddd" }} />
        </div>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${actColor}, ${actColor}cc)`, margin: "0 16px", borderRadius: 20, padding: "14px 18px", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 10, right: 12, background: "rgba(255,255,255,0.25)", border: "none", color: "#fff", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontWeight: 900, fontSize: 16, fontFamily: "inherit" }}>✕</button>
          <div style={{ color: "#fff", fontWeight: 900, fontSize: 18 }}>{actEmoji} {actLabel}</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 2 }}>{dateStr} · {sessionLabel}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 50, padding: "5px 14px", color: "#fff", fontSize: 13, fontWeight: 900 }}>
              👧 {allEnfants.length} enfant{allEnfants.length > 1 ? "s" : ""}
            </div>
            {allEnfants.some(e => e.allergies) && (
              <div style={{ background: "rgba(231,76,60,0.35)", borderRadius: 50, padding: "5px 14px", color: "#fff", fontSize: 12, fontWeight: 800 }}>
                ⚠️ {allEnfants.filter(e => e.allergies).length} allergie{allEnfants.filter(e => e.allergies).length > 1 ? "s" : ""}
              </div>
            )}
            {/* Print button */}
            <button onClick={handlePrint} style={{
              marginLeft: "auto", background: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.5)",
              color: "#fff", borderRadius: 50, padding: "5px 14px", cursor: "pointer",
              fontWeight: 900, fontSize: 12, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
            }}>
              🖨️ Imprimer
            </button>
          </div>
        </div>

        {/* List */}
        <div style={{ overflowY: "auto", padding: "12px 16px 28px", display: "flex", flexDirection: "column", gap: 0 }}>
          {allEnfants.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#bbb", fontSize: 14 }}>Aucun enfant inscrit</div>
          ) : (
            <>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "32px 1fr 1fr 50px", gap: 0, background: `${actColor}18`, borderRadius: "12px 12px 0 0", padding: "8px 12px", marginBottom: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: actColor }}>#</div>
                <div style={{ fontSize: 10, fontWeight: 900, color: actColor }}>NOM · PRÉNOM</div>
                <div style={{ fontSize: 10, fontWeight: 900, color: actColor }}>PARENT</div>
                <div style={{ fontSize: 10, fontWeight: 900, color: actColor, textAlign: "center" }}>ÂGE</div>
              </div>
              {allEnfants.map((e, i) => (
                <div key={i} onClick={() => {
                  if (!e.prenom) return;
                  onSelectEnfant?.({
                    prenom: e.prenom,
                    nom: e.nom || "",
                    naissance: e.naissance || (e._ficheEnfant?.naissance) || "",
                    activite: e.activite || "club",
                    niveau: e.niveau || (e._ficheEnfant?.niveau) || "",
                    allergies: e.allergies || (e._ficheEnfant?.allergies) || "",
                    parent: e.parent || "",
                    parentPhone: e.phone || "",
                    ...(e._ficheEnfant || {}),
                    // Adresses parent — toujours depuis la résa, pas depuis _ficheEnfant
                    adresse: e.adresse || "",
                    ville: e.ville || "",
                    cp: e.cp || "",
                    adresse_vac: e.adresse_vac || "",
                    ville_vac: e.ville_vac || "",
                    cp_vac: e.cp_vac || "",
                  });
                }}
                  style={{
                    display: "grid", gridTemplateColumns: "28px 1fr 1fr 44px",
                    background: i % 2 === 0 ? "#fff" : "#F8FBFF",
                    padding: "10px 12px",
                    borderBottom: "1px solid #F0F4F8",
                    borderRadius: i === allEnfants.length - 1 ? "0 0 12px 12px" : 0,
                    alignItems: "center",
                    cursor: "pointer",
                    transition: "background .1s",
                  }}
                  onMouseEnter={ev => { ev.currentTarget.style.background = `${actColor}10`; }}
                  onMouseLeave={ev => ev.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#F8FBFF"}
                >
                  <div style={{ fontSize: 11, color: "#bbb", fontWeight: 700 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontWeight: 900, color: "#2C3E50", fontSize: 13 }}>
                      {e.nom ? <>{e.nom.toUpperCase()} <span style={{ fontWeight: 600 }}>{e.prenom}</span></> : <span style={{ fontWeight: 800 }}>{e.prenom}</span>}
                      {e._ficheEnfant && <span style={{ fontSize:10, color:actColor, marginLeft:4 }}>›</span>}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                      {activity === "natation" && e.niveau && (
                        <span style={{ background: `${niveauColor(e.niveau)}18`, color: niveauColor(e.niveau), borderRadius: 50, padding: "1px 7px", fontSize: 9, fontWeight: 800 }}>
                          {niveauLabel(e.niveau)}
                        </span>
                      )}
                      {e.allergies && (
                        <span style={{ background: "#FFF0F0", color: C.sunset, borderRadius: 50, padding: "1px 7px", fontSize: 9, fontWeight: 800 }}>
                          ⚠️ {e.allergies}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.parent}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {e.naissance ? (
                      <>
                        <div style={{ fontWeight: 900, fontSize: 15, color: actColor }}>{calcAge(e.naissance)}</div>
                        <div style={{ fontSize: 9, color: "#bbb" }}>ans</div>
                      </>
                    ) : <div style={{ fontSize: 11, color: "#ddd" }}>—</div>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanningTab({ allSeasonSessions, clubPlaces, reservations = [] }) {
  const [activity, setActivity] = useState("natation");
  const [viewMode, setViewMode] = useState("semaine");
  const [weekIdx, setWeekIdx] = useState(0);
  const [selectedDayId, setSelectedDayId] = useState(ALL_SEASON_DAYS[0]?.id);
  const [modalDay, setModalDay] = useState(null);
  const [modalSession, setModalSession] = useState(null);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [dbResasNat, setDbResasNat] = useState([]);
  const [dbResasClub, setDbResasClub] = useState([]);

  // Charger résas natation + club + enfants depuis Supabase
  useEffect(() => {
    sb.from("reservations_natation").select("*, membres(id, prenom, nom, tel, adresse, ville, cp, adresse_vac, ville_vac, cp_vac)")
      .eq("statut", "confirmed")
      .then(async ({ data: resasData }) => {
        if (!resasData?.length) { setDbResasNat([]); return; }
        const membreIds = [...new Set(resasData.map(r => r.membre_id).filter(Boolean))];
        const { data: enfantsData } = await sb.from("enfants")
          .select("membre_id, prenom, nom, activite, allergies, naissance, niveau")
          .in("membre_id", membreIds);
        const enriched = resasData.map(r => ({
          ...r,
          membres: r.membres ? {
            ...r.membres,
            enfants: (enfantsData || []).filter(e => e.membre_id === r.membre_id)
          } : null
        }));
        setDbResasNat(enriched);
      })
      .catch(() => {});
    // Charger résas club + enfants séparément
    sb.from("reservations_club").select("*, membres(id, prenom, nom, tel, adresse, ville, cp, adresse_vac, ville_vac, cp_vac)")
      .eq("statut", "confirmed")
      .then(async ({ data: resasData }) => {
        if (!resasData?.length) { setDbResasClub([]); return; }
        // Charger enfants pour chaque membre
        const membreIds = [...new Set(resasData.map(r => r.membre_id).filter(Boolean))];
        const { data: enfantsData } = await sb.from("enfants")
          .select("membre_id, prenom, nom, activite, allergies, naissance, niveau")
          .in("membre_id", membreIds);
        // Joindre enfants dans chaque resa
        const enriched = resasData.map(r => ({
          ...r,
          membres: r.membres ? {
            ...r.membres,
            enfants: (enfantsData || []).filter(e => e.membre_id === r.membre_id)
          } : null
        }));
        setDbResasClub(enriched);
      })
      .catch(() => {});
  }, []);

  // Récupérer les enfants inscrits pour un jour + heure donnés (natation)
  const getEnfantsPourCreneau = (dayId, time) => {
    const dayObj = ALL_SEASON_DAYS.find(d => d.id === dayId);
    if (!dayObj?.date) return [];
    const dateISO = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
    return dbResasNat
      .filter(r => r.date_seance?.slice(0,10) === dateISO && r.heure === time && r.statut === "confirmed")
      .flatMap(r => (r.enfants || []).map(e => ({ prenom: e, parent: r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—", tel: r.membres?.tel || "" })));
  };

  // Places club par date et session depuis Supabase
  const getPlacesClub = (dayId, session) => {
    const dayObj = ALL_SEASON_DAYS.find(d => d.id === dayId);
    if (!dayObj?.date) return 45;
    const dateISO = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
    const taken = dbResasClub.filter(r => r.date_reservation?.slice(0,10) === dateISO && r.session === session
      && !(Array.isArray(r.enfants) && Number(r.enfants[0]) >= 6) // exclure entrées achat carte
    ).length;
    return Math.max(0, 45 - taken);
  };

  // Membres inscrits club par date et session
  const getMembresClub = (dayId, session) => {
    const dayObj = ALL_SEASON_DAYS.find(d => d.id === dayId);
    if (!dayObj?.date) return [];
    const dateISO = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
    return dbResasClub.filter(r => r.date_reservation?.slice(0,10) === dateISO && r.session === session
      && !(Array.isArray(r.enfants) && Number(r.enfants[0]) >= 6)
    );
  };

  // Build weeks from ALL_SEASON_DAYS
  const weeks = [];
  let wk = [];
  ALL_SEASON_DAYS.forEach((d, i) => {
    wk.push(d);
    if (d.label === "Sam" || i === ALL_SEASON_DAYS.length - 1) { weeks.push(wk); wk = []; }
  });
  const currentWeek = weeks[Math.min(weekIdx, weeks.length - 1)] || [];

  const handleWeekChange = (idx) => {
    setWeekIdx(idx);
    const w = weeks[Math.min(idx, weeks.length - 1)];
    if (w?.length) setSelectedDayId(w[0].id);
  };

  const weekLabel = currentWeek.length > 0
    ? `${currentWeek[0].num} ${currentWeek[0].month} – ${currentWeek[currentWeek.length-1].num} ${currentWeek[currentWeek.length-1].month}`
    : "";

  // NATATION : slots from allSeasonSessions
  const getNataSlots = (dayId) => (allSeasonSessions || []).filter(s => s.day === dayId);
  const nataSpotColor = n => n === 0 ? C.sunset : n === 1 ? C.coral : C.green;

  // CLUB : 2 demi-journées par jour avec places globales
  const CLUB_SESSIONS = [
    { id: "matin",  label: "Matin",      horaires: "9h30 – 12h30",  color: C.coral, emoji: "☀️", places: clubPlaces?.matin ?? 45 },
    { id: "apmidi", label: "Après-midi", horaires: "14h30 – 18h00", color: C.ocean, emoji: "🌊", places: clubPlaces?.apmidi ?? 45 },
  ];

  const fillRate = (places) => Math.round(((45 - places) / 45) * 100);
  const placeColor = (places) => places === 0 ? C.sunset : places <= 10 ? C.coral : places <= 25 ? "#FF9500" : C.green;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {selectedEnfant && <FicheEnfantModal enfant={selectedEnfant} onClose={() => setSelectedEnfant(null)} />}
      {modalDay && (
        <DayDetailModal
          day={modalDay}
          activity={activity}
          session={modalSession}
          dbResasNat={dbResasNat}
          dbResasClub={dbResasClub}
          onClose={() => { setModalDay(null); setModalSession(null); }}
          onSelectEnfant={(enfant) => setSelectedEnfant(enfant)}
        />
      )}

      {/* Activity toggle */}
      <div style={{ display: "flex", gap: 0, background: "#fff", borderRadius: 16, padding: 5, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        {[["natation","🏊 Natation", C.ocean], ["club","🏖️ Club de Plage", C.coral]].map(([k, l, col]) => (
          <button key={k} onClick={() => setActivity(k)} style={{
            flex: 1, background: activity === k ? `linear-gradient(135deg, ${col}, ${col}cc)` : "transparent",
            color: activity === k ? "#fff" : "#888", border: "none", borderRadius: 12,
            padding: "10px 8px", cursor: "pointer", fontWeight: 900, fontSize: 13, fontFamily: "inherit", transition: "all .15s",
            boxShadow: activity === k ? `0 4px 12px ${col}44` : "none",
          }}>{l}</button>
        ))}
      </div>

      {/* View mode */}
      <div style={{ display: "flex", gap: 6 }}>
        {[["semaine","📆 Semaine"], ["jour","📅 Jour"]].map(([k, l]) => (
          <button key={k} onClick={() => setViewMode(k)} style={{
            flex: 1, background: viewMode === k ? "#fff" : "#f0f4f8",
            color: viewMode === k ? C.dark : "#aaa", border: `2px solid ${viewMode === k ? "#ddd" : "transparent"}`,
            borderRadius: 12, padding: "8px", cursor: "pointer", fontWeight: 900, fontSize: 12, fontFamily: "inherit",
            boxShadow: viewMode === k ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
          }}>{l}</button>
        ))}
      </div>

      {/* Week navigator */}
      <div style={{ background: "#fff", borderRadius: 14, padding: "10px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => handleWeekChange(Math.max(0, weekIdx-1))} disabled={weekIdx === 0}
          style={{ background: weekIdx === 0 ? "#f0f0f0" : activity === "natation" ? C.ocean : C.coral, border: "none", color: weekIdx === 0 ? "#bbb" : "#fff", borderRadius: "50%", width: 30, height: 30, cursor: weekIdx === 0 ? "not-allowed" : "pointer", fontWeight: 900, fontFamily: "inherit" }}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 900, color: C.dark, fontSize: 13 }}>Semaine {weekIdx + 1} / {weeks.length}</div>
          <div style={{ fontSize: 11, color: "#aaa" }}>🗓️ {weekLabel} 2026</div>
        </div>
        <button onClick={() => handleWeekChange(Math.min(weeks.length-1, weekIdx+1))} disabled={weekIdx >= weeks.length-1}
          style={{ background: weekIdx >= weeks.length-1 ? "#f0f0f0" : activity === "natation" ? C.ocean : C.coral, border: "none", color: weekIdx >= weeks.length-1 ? "#bbb" : "#fff", borderRadius: "50%", width: 30, height: 30, cursor: weekIdx >= weeks.length-1 ? "not-allowed" : "pointer", fontWeight: 900, fontFamily: "inherit" }}>›</button>
      </div>

      {/* Day selector (jour mode) */}
      {viewMode === "jour" && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {currentWeek.map(d => {
            const sel = selectedDayId === d.id;
            const col = activity === "natation" ? C.ocean : C.coral;
            return (
              <button key={d.id} onClick={() => setSelectedDayId(d.id)} style={{
                flexShrink: 0, background: sel ? `linear-gradient(135deg, ${col}, ${col}cc)` : "#fff",
                border: "none", borderRadius: 14, padding: "9px 12px", cursor: "pointer",
                fontFamily: "inherit", boxShadow: sel ? `0 4px 12px ${col}44` : "0 2px 8px rgba(0,0,0,0.05)",
                minWidth: 64, textAlign: "center", transition: "all .15s",
              }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: sel ? "rgba(255,255,255,0.8)" : "#aaa" }}>{d.label}</div>
                <div style={{ fontSize: 17, fontWeight: 900, color: sel ? "#fff" : C.dark }}>{d.num}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── NATATION CONTENT ── */}
      {activity === "natation" && viewMode === "jour" && (() => {
        const dayObj = ALL_SEASON_DAYS.find(d => d.id === selectedDayId);
        const slots = getNataSlots(selectedDayId);
        const morning   = slots.filter(s => parseInt(s.time) < 13);
        const afternoon = slots.filter(s => parseInt(s.time) >= 13);
        const taken = (() => {
          if (!dayObj?.date) return slots.reduce((acc, s) => acc + (2 - s.spots), 0);
          const dateISO = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
          return dbResasNat.filter(r => r.date_seance?.slice(0,10) === dateISO).reduce((s, r) => s + Math.max(1, (r.enfants||[]).length), 0);
        })();
        const avail = Math.max(0, slots.length * 2 - taken);

        const handlePrintJour = () => {
          const makeRows = (list) => list.map(s => {
            const enfants = getEnfantsPourCreneau(selectedDayId, s.time);
            const enfantsHtml = enfants.length > 0
              ? enfants.map(e => `<span style="display:inline-block;background:#EEF8FF;color:#1A8FE3;border-radius:6px;padding:2px 8px;margin:2px;font-size:11px;font-weight:700">👤 ${e.prenom}</span>`).join('')
              : `<span style="color:#bbb;font-size:11px">—</span>`;
            const parentsList = enfants.map(e => e.parent).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
            return `<tr style="background:${s.spots===0?'#fff8f8':'#f9fbff'}">
            <td style="padding:8px 12px;font-weight:900;color:#1A8FE3;font-size:15px">${s.time}</td>
            <td style="padding:8px 12px;text-align:center;font-weight:700;color:${s.spots===0?'#e74c3c':s.spots===1?'#FF8E53':'#6BCB77'}">${s.spots===0?'🔴 Complet':s.spots===1?'🟡 1 place':'🟢 2 places'}</td>
            <td style="padding:8px 12px">${enfantsHtml}</td>
            <td style="padding:8px 12px;color:#888;font-size:11px">${parentsList || '—'}</td>
          </tr>`;
          }).join('');
          const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Planning Natation · ${dayObj?.label} ${dayObj?.num} ${dayObj?.month} 2026</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#2C3E50}h1{color:#1A8FE3;font-size:20px;margin:0 0 4px}
.sub{color:#888;font-size:13px;margin:0 0 18px}h2{color:#1A8FE3;font-size:14px;margin:18px 0 8px;border-bottom:2px solid #1A8FE322;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px}
th{background:#1A8FE3;color:#fff;padding:9px 12px;text-align:left}
tr:nth-child(even){background:#f9fbff}
.footer{margin-top:16px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:8px}
@media print{body{margin:12px}}</style></head><body>
<h1>🏊 Planning Natation</h1>
<p class="sub">${dayObj?.label} ${dayObj?.num} ${dayObj?.month} 2026 · ${slots.length} créneaux · ${avail} places libres · ${taken} places prises</p>
${morning.length>0?`<h2>☀️ Matin</h2><table><thead><tr><th>Heure</th><th>Disponibilité</th><th>Enfants inscrits</th><th>Parent</th></tr></thead><tbody>${makeRows(morning)}</tbody></table>`:''}
${afternoon.length>0?`<h2>🌊 Après-midi</h2><table><thead><tr><th>Heure</th><th>Disponibilité</th><th>Enfants inscrits</th><th>Parent</th></tr></thead><tbody>${makeRows(afternoon)}</tbody></table>`:''}
<div class="footer">Eole Beach Club · Saison 2026 · Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`;
          const win = window.open('', '_blank');
          win.document.write(html); win.document.close(); win.focus();
          setTimeout(() => win.print(), 400);
        };

        return (
          <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.ocean }}>🏊 {slots.length} créneaux</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Pill color={C.green}>{avail} libres</Pill>
                <Pill color={C.coral}>{taken} prises</Pill>
                <button onClick={handlePrintJour} style={{ background: `linear-gradient(135deg,${C.ocean},${C.sea})`, color: "#fff", border: "none", borderRadius: 50, padding: "5px 12px", cursor: "pointer", fontWeight: 900, fontSize: 11, fontFamily: "inherit", boxShadow: `0 3px 10px ${C.ocean}44` }}>🖨️ Imprimer</button>
              </div>
            </div>
            {[["☀️ MATIN", morning], ["🌊 APRÈS-MIDI", afternoon]].map(([title, list]) => list.length > 0 && (
              <div key={title} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: title.includes("MATIN") ? C.coral : C.ocean, marginBottom: 8, letterSpacing: 1 }}>{title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.map(s => {
                    const enfants = getEnfantsPourCreneau(selectedDayId, s.time);
                    return (
                      <div key={s.id} style={{ display:"flex", alignItems:"center", gap:10, background:"#F8FBFF", borderRadius:12, padding:"8px 12px", border:`1.5px solid ${nataSpotColor(s.spots)}30` }}>
                        {/* Heure + dispo */}
                        <div style={{ display:"flex", alignItems:"center", gap:6, minWidth:70 }}>
                          <div style={{ width:8, height:8, borderRadius:"50%", background:nataSpotColor(s.spots), flexShrink:0 }} />
                          <span style={{ fontWeight:900, fontSize:13, color:C.dark }}>{s.time}</span>
                          <span style={{ fontSize:10, color:nataSpotColor(s.spots), fontWeight:700 }}>{s.spots}/2</span>
                        </div>
                        {/* Enfants inscrits */}
                        <div style={{ flex:1, display:"flex", gap:6, flexWrap:"wrap" }}>
                          {enfants.length > 0 ? enfants.map((e, i) => (
                            <div key={i} style={{ background:`${C.ocean}15`, color:C.ocean, borderRadius:8, padding:"3px 8px", fontSize:11, fontWeight:800 }}>
                              👤 {e.prenom}
                            </div>
                          )) : s.spots === 2 ? (
                            <span style={{ fontSize:11, color:"#bbb" }}>—</span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {activity === "natation" && viewMode === "semaine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Print button semaine */}
          <button onClick={() => {
            const rows = currentWeek.map(d => {
              const slots = (allSeasonSessions || []).filter(s => s.day === d.id);
              const morning   = slots.filter(s => parseInt(s.time) < 13);
              const afternoon = slots.filter(s => parseInt(s.time) >= 13);
              const taken = slots.reduce((acc,s)=>acc+(2-s.spots),0);
              const avail = slots.reduce((acc,s)=>acc+s.spots,0);
              const rate  = slots.length*2 > 0 ? Math.round((taken/(slots.length*2))*100) : 0;
              const dateISO = d.date ? `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}` : "";
              const fmt = (list) => list.map(s => {
                const enfants = dbResasNat
                  .filter(r => r.date_seance?.slice(0,10) === dateISO && r.heure === s.time && r.statut === "confirmed")
                  .flatMap(r => r.enfants || []);
                const noms = enfants.length > 0 ? enfants.map(e => `<span style="display:inline-block;background:#EEF8FF;color:#1A8FE3;border-radius:4px;padding:1px 6px;margin:1px;font-size:10px;font-weight:700">👤 ${e}</span>`).join('') : '';
                return `<span style="display:inline-block;background:${s.spots===0?'#fee':'#e8f4ff'};color:${s.spots===0?'#e74c3c':'#1A8FE3'};border-radius:6px;padding:2px 7px;margin:2px;font-size:11px;font-weight:700">${s.time} ${s.spots===0?'●':`${s.spots}/2`}</span>${noms}`;
              }).join('');
              return `<tr><td style="padding:10px 12px;font-weight:900;color:#2C3E50;border-bottom:1px solid #eee;vertical-align:top">${d.label} ${d.num} ${d.month}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top">${fmt(morning)}</td>
                <td style="padding:10px 12px;border-bottom:1px solid #eee;vertical-align:top">${fmt(afternoon)}</td>
                <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #eee;font-weight:700;color:#6BCB77">${avail}</td>
                <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #eee;font-weight:700;color:#FF8E53">${taken}</td>
                <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #eee;color:#888">${rate}%</td></tr>`;
            }).join('');
            const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Planning Natation · Semaine ${weekIdx+1}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#2C3E50}h1{color:#1A8FE3;font-size:20px;margin:0 0 4px}
.sub{color:#888;font-size:13px;margin:0 0 18px}table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#1A8FE3;color:#fff;padding:10px 12px;text-align:left}
.footer{margin-top:16px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:8px}
@media print{body{margin:12px}}</style></head><body>
<h1>🏊 Planning Natation — Semaine ${weekIdx+1}</h1>
<p class="sub">${weekLabel} 2026 · Créneaux 30 min · 2 places max</p>
<table><thead><tr><th>Jour</th><th>☀️ Matin</th><th>🌊 Après-midi</th><th>Libres</th><th>Prises</th><th>Rempli</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="footer">Eole Beach Club · Saison 2026 · Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`;
            const win = window.open('', '_blank');
            win.document.write(html); win.document.close(); win.focus();
            setTimeout(() => win.print(), 400);
          }} style={{
            background: `linear-gradient(135deg,${C.ocean},${C.sea})`, color: "#fff", border: "none",
            borderRadius: 14, padding: "10px 18px", cursor: "pointer", fontWeight: 900, fontSize: 13,
            fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-end",
            boxShadow: `0 4px 14px ${C.ocean}44`,
          }}>🖨️ Imprimer la semaine</button>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {currentWeek.map(d => {
            const slots = getNataSlots(d.id);
            const dateISO = d.date ? `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}` : "";
            // Compter les vraies places prises depuis Supabase (confirmed)
            const resasJour = dbResasNat.filter(r => r.date_seance?.slice(0,10) === dateISO);
            const taken = resasJour.reduce((acc, r) => acc + Math.max(1, (r.enfants||[]).length), 0);
            const total = slots.length * 2;
            const avail = Math.max(0, total - taken);
            const rate  = total > 0 ? Math.round((taken / total) * 100) : 0;
            const enfantsJour = resasJour.flatMap(r => r.enfants || []);
            return (
              <div key={d.id} onClick={() => { setModalDay(d); setModalSession(null); }} style={{ background: "#fff", borderRadius: 18, padding: "14px 16px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)", cursor: "pointer", transition: "transform .15s" }}
                onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform=""}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 900, color: C.dark, fontSize: 14 }}>{d.label} {d.num} {d.month}</div>
                    <div style={{ fontSize: 10, color: C.ocean, fontWeight: 800 }}>👆 voir inscrits</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Pill color={C.green}>{avail} libres</Pill>
                    <Pill color={C.coral}>{taken} prises</Pill>
                  </div>
                </div>
                {/* Prénoms enfants inscrits */}
                {enfantsJour.length > 0 && (
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
                    {enfantsJour.map((prenom, i) => (
                      <div key={i} style={{ background:`${C.ocean}15`, color:C.ocean, borderRadius:8, padding:"2px 8px", fontSize:10, fontWeight:800 }}>
                        👤 {prenom}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ background: "#EEF5FF", borderRadius: 50, height: 7, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${rate}%`, background: `linear-gradient(90deg,${C.ocean},${C.sea})`, borderRadius: 50 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 10, color: "#bbb" }}>
                  <span>{slots.length} créneaux · {rate}% rempli</span>
                  <span>{enfantsJour.length} enfant{enfantsJour.length>1?"s":""} inscrit{enfantsJour.length>1?"s":""}</span>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
      {activity === "club" && viewMode === "jour" && (() => {
        const day = ALL_SEASON_DAYS.find(d => d.id === selectedDayId);
        const SESSIONS_JOUR = [
          { id:"matin",  label:"Matin",      horaires:"9h30 – 12h30",  color:C.coral, emoji:"☀️", places: getPlacesClub(selectedDayId,"matin")  },
          { id:"apmidi", label:"Après-midi", horaires:"14h30 – 18h00", color:C.ocean, emoji:"🌊", places: getPlacesClub(selectedDayId,"apmidi") },
        ];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SESSIONS_JOUR.map(s => {
              const inscrits = getMembresClub(selectedDayId, s.id);
              return (
              <div key={s.id} onClick={() => { setModalDay(day); setModalSession(s.id); }} style={{ background: "#fff", borderRadius: 20, padding: "16px 18px", boxShadow: "0 4px 16px rgba(0,0,0,0.06)", cursor: "pointer", transition: "transform .15s" }}
                onMouseEnter={e => e.currentTarget.style.transform="translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform=""}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg,${s.color},${s.color}aa)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{s.emoji}</div>
                    <div>
                      <div style={{ fontWeight: 900, color: C.dark, fontSize: 15 }}>{s.label}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>🕐 {s.horaires}</div>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 800, marginTop: 2 }}>👆 voir la liste des inscrits</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: placeColor(s.places) }}>{s.places}</div>
                    <div style={{ fontSize: 10, color: "#aaa" }}>/ 45 places</div>
                  </div>
                </div>
                {/* Enfants inscrits */}
                {inscrits.length > 0 && (
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
                    {[...new Set(inscrits.flatMap(r => {
                      // Utiliser les prénoms de la résa directement
                      const enfantsResa = Array.isArray(r.enfants) ? r.enfants.filter(e => isNaN(Number(e))) : [];
                      if (enfantsResa.length > 0) return enfantsResa;
                      // Fallback : nom du parent
                      return r.membres ? [`${r.membres.prenom} ${NOM(r.membres.nom)}`] : [];
                    }))].slice(0,8).map((nom, i) => (
                      <div key={i} style={{ background:`${s.color}15`, color:s.color, borderRadius:8, padding:"2px 8px", fontSize:10, fontWeight:800 }}>
                        👤 {nom}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ background: "#f0f0f0", borderRadius: 50, height: 8, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${fillRate(s.places)}%`, background: `linear-gradient(90deg,${s.color},${s.color}cc)`, borderRadius: 50 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa" }}>
                  <span>{45 - s.places} inscrits</span>
                  <span>{fillRate(s.places)}% rempli</span>
                  <span style={{ fontWeight: 700, color: placeColor(s.places) }}>
                    {s.places === 0 ? "🔴 Complet" : s.places <= 10 ? "🟠 Presque plein" : "🟢 Places dispo"}
                  </span>
                </div>
              </div>
            );})}
          </div>
        );
      })()}

      {activity === "club" && viewMode === "semaine" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {/* En-tête semaine avec totaux */}
          <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
            {/* Header */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", background: "#F0F4F8", padding: "10px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#aaa" }}>JOUR</div>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.coral, textAlign: "center" }}>☀️ MATIN</div>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.ocean, textAlign: "center" }}>🌊 APRÈS-MIDI</div>
            </div>
            {currentWeek.map((d, i) => {
              const placesM = getPlacesClub(d.id, "matin");
              const placesA = getPlacesClub(d.id, "apmidi");
              return (
              <div key={d.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "12px 16px", borderTop: i > 0 ? "1px solid #F0F4F8" : "none", alignItems: "center" }}>
                <div style={{ cursor: "pointer" }} onClick={() => { setModalDay(d); setModalSession(null); }}>
                  <div style={{ fontWeight: 900, color: C.dark, fontSize: 13 }}>{d.label} {d.num}</div>
                  <div style={{ fontSize: 10, color: "#bbb" }}>{d.month}</div>
                  <div style={{ fontSize: 9, color: C.coral, fontWeight: 800, marginTop: 2 }}>👆 inscrits</div>
                </div>
                {[["matin", placesM, C.coral], ["apmidi", placesA, C.ocean]].map(([sess, places, col]) => (
                  <div key={sess} style={{ textAlign: "center", cursor: "pointer" }} onClick={() => { setModalDay(d); setModalSession(sess); }}>
                    <div style={{ fontWeight: 900, color: placeColor(places), fontSize: 16 }}>{places}</div>
                    <div style={{ fontSize: 9, color: "#888" }}>{45-places} inscrits</div>
                    <div style={{ background: "#f0f0f0", borderRadius: 50, height: 4, overflow: "hidden", margin: "4px 8px 0" }}>
                      <div style={{ height: "100%", width: `${fillRate(places)}%`, background: col, borderRadius: 50 }} />
                    </div>
                    <div style={{ fontSize: 9, color: "#bbb", marginTop: 2 }}>{fillRate(places)}%</div>
                  </div>
                ))}
              </div>
            );})}
            {/* Totaux semaine */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "12px 16px", background: "#F8FBFF", borderTop: "2px solid #EEF5FF" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#2C3E50" }}>SEMAINE</div>
              {["matin","apmidi"].map((sess, si) => {
                const totalInscrits = currentWeek.reduce((acc, d) => acc + (45 - getPlacesClub(d.id, sess)), 0);
                const totalPlaces   = currentWeek.length * 45;
                const col = si === 0 ? C.coral : C.ocean;
                return (
                  <div key={sess} style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 900, color: col, fontSize: 15 }}>{totalInscrits} inscrits</div>
                    <div style={{ fontSize: 10, color: "#aaa" }}>{totalPlaces - totalInscrits} places libres</div>
                    <div style={{ fontSize: 9, color: "#bbb" }}>{currentWeek.length} jours × 45</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AGE GROUP CARD ────────────────────────────────────────
const AGE_GROUPS = [
  { label: "3 – 5 ans",  min: 3,  max: 5,  color: "#FF9500",  emoji: "🐥", bg: "#FFF8EE" },
  { label: "6 – 9 ans",  min: 6,  max: 9,  color: C.ocean,    emoji: "🐬", bg: "#EEF8FF" },
  { label: "10 – 12 ans",min: 10, max: 12, color: "#9B59B6",  emoji: "🏅", bg: "#F5EEFF" },
];

function AgeGroupCard({ dbMembres = [] }) {
  const [period, setPeriod] = useState("saison");
  const [weekIdx, setWeekIdx] = useState(0);
  const [selectedDayId, setSelectedDayId] = useState(ALL_SEASON_DAYS[0]?.id);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState("tous");
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const [dbResasNat, setDbResasNat] = useState([]);
  const [dbResasClub, setDbResasClub] = useState([]);
  const [membresLocaux, setMembresLocaux] = useState([]);

  useEffect(() => {
    sb.from("reservations_natation").select("membre_id, date_seance, enfants, statut")
      .eq("statut", "confirmed")
      .then(({ data }) => setDbResasNat(data || [])).catch(() => {});
    sb.from("reservations_club").select("membre_id, date_reservation, enfants, statut")
      .eq("statut", "confirmed")
      .then(({ data }) => setDbResasClub(data || [])).catch(() => {});
    sb.from("membres").select("id, prenom, nom, enfants(*)")
      .then(({ data }) => setMembresLocaux(data || [])).catch(() => {});
  }, []);

  // Utiliser les membres locaux si dbMembres prop est vide
  const membresEffectifs = dbMembres.length > 0 ? dbMembres : membresLocaux;

  // Build season weeks
  const weeks = [];
  let wk = [];
  ALL_SEASON_DAYS.forEach((d, i) => {
    wk.push(d);
    if (d.label === "Sam" || i === ALL_SEASON_DAYS.length - 1) { weeks.push([...wk]); wk = []; }
  });
  const currentWeek = weeks[Math.min(weekIdx, weeks.length - 1)] || [];
  const weekLabel = currentWeek.length > 0
    ? `${currentWeek[0].num} ${currentWeek[0].month} – ${currentWeek[currentWeek.length-1].num} ${currentWeek[currentWeek.length-1].month}`
    : "";

  // Build all children list — Supabase uniquement, pas de données mock
  const allEnfants = [];
  const seenEnfants = new Set();
  membresEffectifs.forEach(m => {
    (m.enfants || []).forEach(e => {
      const key = `${e.prenom}-${e.nom}-${e.naissance}`;
      if (!seenEnfants.has(key)) {
        seenEnfants.add(key);
        allEnfants.push({ ...e, age: calcAge(e.naissance), parent: `${m.prenom} ${NOM(m.nom)}`, parentColor: C.ocean, phone: m.tel,
          adresse: m.adresse, ville: m.ville, cp: m.cp,
          adresse_vac: m.adresse_vac, ville_vac: m.ville_vac, cp_vac: m.cp_vac,
        });
      }
    });
  });

  const total = allEnfants.length;

  // Helper — obtenir les dates ISO d'une période
  const getDayISO = (dayObj) => dayObj?.date
    ? `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`
    : null;

  // Trouver les enfants réellement inscrits selon la période
  const getEnfantsForPeriod = () => {
    const prenomNatSaison = new Set(
      dbResasNat.flatMap(r => Array.isArray(r.enfants) ? r.enfants : [])
    );
    const prenomClubSaison = new Set(
      dbResasClub.flatMap(r => Array.isArray(r.enfants) ? r.enfants : [])
    );
    if (period === "saison") {
      if (dbResasNat.length === 0 && dbResasClub.length === 0) return allEnfants;
      return allEnfants.filter(e =>
        prenomNatSaison.has(e.prenom) || prenomClubSaison.has(e.prenom)
      );
    }
    // Dates concernées
    let dates = [];
    if (period === "jour") {
      const iso = getDayISO(ALL_SEASON_DAYS.find(d => d.id === selectedDayId));
      if (iso) dates = [iso];
    } else if (period === "semaine") {
      dates = currentWeek.map(d => getDayISO(d)).filter(Boolean);
    }
    if (!dates.length) return baseList.length > 0 ? baseList : allEnfants;

    // Prénoms natation sur ces dates
    const prenomNatSet = new Set(
      dbResasNat
        .filter(r => dates.includes(r.date_seance?.slice(0,10)))
        .flatMap(r => Array.isArray(r.enfants) ? r.enfants : [])
    );

    // Prénoms club sur ces dates (depuis colonne enfants)
    const prenomClubSet = new Set(
      dbResasClub
        .filter(r => dates.includes(r.date_reservation?.slice(0,10)))
        .flatMap(r => Array.isArray(r.enfants) ? r.enfants : [])
    );

    return allEnfants.filter(e =>
      prenomNatSet.has(e.prenom) || prenomClubSet.has(e.prenom)
    );
  };

  const baseList = getEnfantsForPeriod();

  const groupCounts = AGE_GROUPS.map(g => ({
    ...g,
    count: baseList.filter(e => e.age >= g.min && e.age <= g.max).length,
  }));
  const baseTotal = baseList.length;

  const prenomNatAll = new Set(dbResasNat.flatMap(r => Array.isArray(r.enfants) ? r.enfants : []));
  
  // Pour le club : charger les prénoms des enfants ayant réellement une résa club
  // En joignant avec la table enfants via membre_id
  const prenomClubAll = new Set(
    dbResasClub.flatMap(r => Array.isArray(r.enfants) ? r.enfants : [])
  );

  const hasNatResa  = (e) => prenomNatAll.has(e.prenom);
  const hasClubResa = (e) => prenomClubAll.has(e.prenom);

  const filteredEnfants = baseList
    .filter(e => !selectedGroup || (e.age >= selectedGroup.min && e.age <= selectedGroup.max))
    .filter(e => {
      if (selectedActivity === "tous") return true;
      if (selectedActivity === "natation") return hasNatResa(e);
      if (selectedActivity === "club") return hasClubResa(e);
      return true;
    })
    .sort((a, b) => a.age - b.age || (a.nom||"").localeCompare(b.nom||""));

  const actLabel = { natation: "🏊 Natation", club: "🏖️ Club", tous: "Toutes" };
  const actColor = { natation: C.ocean, club: C.coral, tous: C.dark };

  const periodLabel = period === "saison" ? "Saison 2026"
    : period === "semaine" ? `Sem. ${weekIdx+1} · ${weekLabel}`
    : `${ALL_SEASON_DAYS.find(d => d.id === selectedDayId)?.label} ${ALL_SEASON_DAYS.find(d => d.id === selectedDayId)?.num} ${ALL_SEASON_DAYS.find(d => d.id === selectedDayId)?.month}`;

  const handlePrint = () => {
    const rows = filteredEnfants.map((e, i) => {
      const grp = AGE_GROUPS.find(g => e.age >= g.min && e.age <= g.max);
      return `<tr style="background:${i%2===0?'#f9fbff':'#fff'}">
        <td style="padding:7px 10px;color:#aaa;font-weight:700">${i+1}</td>
        <td style="padding:7px 10px;font-weight:900;color:#2C3E50">${e.nom.toUpperCase()}</td>
        <td style="padding:7px 10px">${e.prenom}</td>
        <td style="padding:7px 10px;text-align:center;font-weight:900;color:${grp?.color||C.ocean}">${e.age} ans</td>
        <td style="padding:7px 10px;font-weight:700;color:${grp?.color||C.ocean}">${grp?.label||'—'}</td>
        <td style="padding:7px 10px">${e.activite === "natation" ? "🏊 Natation" : e.activite === "club" ? "🏖️ Club" : "🏖️🏊 Les deux"}</td>
        <td style="padding:7px 10px;color:#555">${e.parent}</td>
        <td style="padding:7px 10px;color:${e.allergies?'#e74c3c':'#aaa'}">${e.allergies||"—"}</td>
      </tr>`;
    }).join('');

    // Stats by group
    const statsRows = groupCounts.map(g => `
      <tr>
        <td style="padding:8px 12px;font-size:18px">${g.emoji}</td>
        <td style="padding:8px 12px;font-weight:900;color:${g.color}">${g.label}</td>
        <td style="padding:8px 12px;text-align:center;font-weight:900;font-size:18px;color:${g.color}">${g.count}</td>
        <td style="padding:8px 12px;text-align:center;color:#888">${baseTotal > 0 ? Math.round((g.count/baseTotal)*100) : 0}%</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Fréquentation par âge · ${periodLabel}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#2C3E50}
h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 8px;color:#1A8FE3;border-bottom:2px solid #EEF5FF;padding-bottom:4px}
.sub{color:#888;font-size:13px;margin:0 0 18px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px}
th{background:#1A8FE3;color:#fff;padding:9px 12px;text-align:left}
.footer{margin-top:16px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:8px}
@media print{body{margin:12px}}</style></head><body>
<h1>👧 Fréquentation par groupe d'âge</h1>
<p class="sub">${periodLabel} · ${filteredEnfants.length} enfant${filteredEnfants.length>1?'s':''} · ${actLabel[selectedActivity]}</p>
<h2>Répartition par groupe</h2>
<table><thead><tr><th></th><th>Groupe</th><th style="text-align:center">Effectif</th><th style="text-align:center">%</th></tr></thead>
<tbody>${statsRows}</tbody></table>
<h2>Liste détaillée</h2>
<table><thead><tr><th>#</th><th>Nom</th><th>Prénom</th><th>Âge</th><th>Groupe</th><th>Activité</th><th>Parent</th><th>Allergies</th></tr></thead>
<tbody>${rows}</tbody></table>
<div class="footer">Eole Beach Club · Saison 2026 · Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
</body></html>`;
    const win = window.open('', '_blank');
    win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => win.print(), 400);
  };

  return (
    <div style={{ background: "#fff", borderRadius: 20, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
      {selectedEnfant && <FicheEnfantModal enfant={selectedEnfant} onClose={() => setSelectedEnfant(null)} />}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 14 }}>👧 Fréquentation par groupe d'âge</div>
        <button onClick={handlePrint} style={{ background: `linear-gradient(135deg,${C.ocean},${C.sea})`, color: "#fff", border: "none", borderRadius: 50, padding: "5px 12px", cursor: "pointer", fontWeight: 900, fontSize: 11, fontFamily: "inherit" }}>🖨️</button>
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 0, background: "#F0F4F8", borderRadius: 14, padding: 4, marginBottom: 14 }}>
        {[["saison","🌊 Saison"],["semaine","📆 Semaine"],["jour","📅 Jour"]].map(([k,l]) => (
          <button key={k} onClick={() => setPeriod(k)} style={{
            flex: 1, background: period === k ? "#fff" : "transparent",
            color: period === k ? C.dark : "#aaa", border: "none", borderRadius: 10,
            padding: "8px 4px", cursor: "pointer", fontWeight: 900, fontSize: 11, fontFamily: "inherit",
            boxShadow: period === k ? "0 2px 8px rgba(0,0,0,0.08)" : "none", transition: "all .15s",
          }}>{l}</button>
        ))}
      </div>

      {/* Sub-selectors */}
      {period === "semaine" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F8FBFF", borderRadius: 12, padding: "8px 12px", marginBottom: 12 }}>
          <button onClick={() => setWeekIdx(Math.max(0,weekIdx-1))} disabled={weekIdx===0}
            style={{ background:weekIdx===0?"#eee":C.ocean, border:"none", color:weekIdx===0?"#bbb":"#fff", borderRadius:"50%", width:26, height:26, cursor:weekIdx===0?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:14 }}>‹</button>
          <div style={{ flex:1, textAlign:"center", fontWeight:800, color:C.dark, fontSize:12 }}>Sem. {weekIdx+1}/{weeks.length} · {weekLabel} 2026</div>
          <button onClick={() => setWeekIdx(Math.min(weeks.length-1,weekIdx+1))} disabled={weekIdx>=weeks.length-1}
            style={{ background:weekIdx>=weeks.length-1?"#eee":C.ocean, border:"none", color:weekIdx>=weeks.length-1?"#bbb":"#fff", borderRadius:"50%", width:26, height:26, cursor:weekIdx>=weeks.length-1?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:14 }}>›</button>
        </div>
      )}

      {period === "jour" && (
        <div style={{ marginBottom: 12 }}>
          {/* Week nav for day */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <button onClick={() => { setWeekIdx(Math.max(0,weekIdx-1)); const w=weeks[Math.max(0,weekIdx-1)]; if(w?.length) setSelectedDayId(w[0].id); }} disabled={weekIdx===0}
              style={{ background:weekIdx===0?"#eee":C.ocean, border:"none", color:weekIdx===0?"#bbb":"#fff", borderRadius:"50%", width:26, height:26, cursor:weekIdx===0?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:14 }}>‹</button>
            <div style={{ flex:1, textAlign:"center", fontSize:11, color:"#aaa", fontWeight:700 }}>Sem. {weekIdx+1} · {weekLabel}</div>
            <button onClick={() => { setWeekIdx(Math.min(weeks.length-1,weekIdx+1)); const w=weeks[Math.min(weeks.length-1,weekIdx+1)]; if(w?.length) setSelectedDayId(w[0].id); }} disabled={weekIdx>=weeks.length-1}
              style={{ background:weekIdx>=weeks.length-1?"#eee":C.ocean, border:"none", color:weekIdx>=weeks.length-1?"#bbb":"#fff", borderRadius:"50%", width:26, height:26, cursor:weekIdx>=weeks.length-1?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:14 }}>›</button>
          </div>
          <div style={{ display:"flex", gap:5, overflowX:"auto" }}>
            {currentWeek.map(d => {
              const sel = selectedDayId === d.id;
              return (
                <button key={d.id} onClick={() => setSelectedDayId(d.id)} style={{
                  flexShrink:0, background: sel ? `linear-gradient(135deg,${C.ocean},${C.sea})` : "#F0F4F8",
                  color: sel ? "#fff" : "#888", border:"none", borderRadius:12, padding:"7px 10px",
                  cursor:"pointer", fontWeight:900, fontSize:11, fontFamily:"inherit", transition:"all .15s",
                }}>
                  <div style={{ fontSize:9, opacity:.8 }}>{d.label}</div>
                  <div style={{ fontSize:14, fontWeight:900 }}>{d.num}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Group tiles */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {groupCounts.map(g => {
          const sel = selectedGroup?.label === g.label;
          const pct = baseTotal > 0 ? Math.round((g.count / baseTotal) * 100) : 0;
          return (
            <div key={g.label} onClick={() => setSelectedGroup(sel ? null : g)} style={{
              flex: 1, background: sel ? g.color : g.bg, borderRadius: 16, padding: "12px 8px",
              textAlign: "center", cursor: "pointer", transition: "all .18s",
              border: `2px solid ${sel ? g.color : "transparent"}`,
              boxShadow: sel ? `0 4px 14px ${g.color}44` : "none",
            }}>
              <div style={{ fontSize: 20, marginBottom: 2 }}>{g.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 22, color: sel ? "#fff" : g.color }}>{g.count}</div>
              <div style={{ fontSize: 10, fontWeight: 900, color: sel ? "rgba(255,255,255,0.85)" : "#666", marginTop: 1 }}>{g.label}</div>
              <div style={{ fontSize: 9, color: sel ? "rgba(255,255,255,0.65)" : "#bbb" }}>{pct}%</div>
            </div>
          );
        })}
        <div onClick={() => setSelectedGroup(null)} style={{
          flex: 1, background: !selectedGroup ? C.dark : "#F0F4F8", borderRadius: 16, padding: "12px 8px",
          textAlign: "center", cursor: "pointer", transition: "all .18s",
        }}>
          <div style={{ fontSize: 20, marginBottom: 2 }}>👥</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: !selectedGroup ? "#fff" : "#2C3E50" }}>{baseTotal}</div>
          <div style={{ fontSize: 10, fontWeight: 900, color: !selectedGroup ? "rgba(255,255,255,0.85)" : "#888", marginTop: 1 }}>Total</div>
          <div style={{ fontSize: 9, color: !selectedGroup ? "rgba(255,255,255,0.65)" : "#bbb" }}>100%</div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", height: 7, marginBottom: 14 }}>
        {groupCounts.map(g => (
          <div key={g.label} style={{ width: `${baseTotal>0?(g.count/baseTotal)*100:0}%`, background: g.color, transition: "width .5s" }} />
        ))}
      </div>

      {/* Week breakdown table (semaine view) */}
      {period === "semaine" && (
        <div style={{ background: "#F8FBFF", borderRadius: 14, padding: 12, marginBottom: 14, overflow: "hidden" }}>
          <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 12, marginBottom: 10 }}>📊 Détail par jour</div>
          <div style={{ display: "grid", gridTemplateColumns: `80px repeat(${AGE_GROUPS.length+1}, 1fr)`, gap: 0 }}>
            {/* Header */}
            <div style={{ fontSize: 9, fontWeight: 900, color: "#aaa", padding: "4px 6px" }}>JOUR</div>
            {AGE_GROUPS.map(g => <div key={g.label} style={{ fontSize: 9, fontWeight: 900, color: g.color, textAlign:"center", padding:"4px 2px" }}>{g.emoji}</div>)}
            <div style={{ fontSize: 9, fontWeight: 900, color: "#888", textAlign:"center", padding:"4px 2px" }}>TOT.</div>
            {/* Rows */}
            {currentWeek.map((d, di) => {
              const dayISO = getDayISO(d);
              const prenomNatDay = new Set(
                dbResasNat.filter(r => r.date_seance?.slice(0,10) === dayISO).flatMap(r => Array.isArray(r.enfants) ? r.enfants : [])
              );
              const prenomClubDay = new Set(
                dbResasClub.filter(r => r.date_reservation?.slice(0,10) === dayISO).flatMap(r => Array.isArray(r.enfants) ? r.enfants : [])
              );
              const dayList = allEnfants.filter(e => prenomNatDay.has(e.prenom) || prenomClubDay.has(e.prenom));
              const dayCounts = AGE_GROUPS.map(g => dayList.filter(e => e.age >= g.min && e.age <= g.max).length);
              return (
                <React.Fragment key={di}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.dark, padding:"6px 6px", background: di%2===0?"#fff":"#F0F4FF", borderRadius: di===0?"6px 0 0 0":di===currentWeek.length-1?"0 0 0 6px":"0" }}>
                    {d.label} {d.num}
                  </div>
                  {dayCounts.map((c, gi) => (
                    <div key={gi} style={{ textAlign:"center", fontSize:12, fontWeight:900, color:AGE_GROUPS[gi].color, padding:"6px 2px", background: di%2===0?"#fff":"#F0F4FF" }}>{c}</div>
                  ))}
                  <div style={{ textAlign:"center", fontSize:12, fontWeight:900, color:C.dark, padding:"6px 2px", background: di%2===0?"#fff":"#F0F4FF" }}>{dayList.length}</div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["tous","natation","club"].map(k => (
          <button key={k} onClick={() => setSelectedActivity(k)} style={{
            flex: 1, background: selectedActivity === k ? actColor[k] : "#F0F4F8",
            color: selectedActivity === k ? "#fff" : "#888",
            border: "none", borderRadius: 50, padding: "7px 8px",
            cursor: "pointer", fontWeight: 800, fontSize: 11, fontFamily: "inherit", transition: "all .15s",
          }}>{actLabel[k]}</button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: 12, overflow: "hidden", border: "1px solid #F0F4F8" }}>
        <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 44px", background: "#F8FBFF", padding: "7px 10px" }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#aaa" }}>#</div>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#aaa" }}>NOM · PRÉNOM</div>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#aaa" }}>ACTIVITÉ</div>
          <div style={{ fontSize: 9, fontWeight: 900, color: "#aaa", textAlign: "center" }}>ÂGE</div>
        </div>
        {filteredEnfants.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#bbb", fontSize: 13 }}>Aucun enfant</div>
        ) : filteredEnfants.map((e, i) => {
          const grp = AGE_GROUPS.find(g => e.age >= g.min && e.age <= g.max);
          return (
            <div key={i} onClick={() => setSelectedEnfant(e)} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr 44px", background: i%2===0?"#fff":"#F8FBFF", padding: "8px 10px", alignItems: "center", borderTop: "1px solid #F0F4F8", cursor:"pointer" }}>
              <div style={{ fontSize: 10, color: "#ccc" }}>{i+1}</div>
              <div>
                <div style={{ fontWeight: 900, color: "#2C3E50", fontSize: 12 }}>{e.nom.toUpperCase()} <span style={{ fontWeight: 600 }}>{e.prenom}</span></div>
                {e.allergies && <div style={{ fontSize: 9, color: C.sunset }}>⚠️ {e.allergies}</div>}
              </div>
              <div style={{ fontSize: 11, color: e.activite==="natation"?C.ocean:e.activite==="club"?C.coral:"#9B59B6", fontWeight: 700 }}>
                {e.activite==="natation"?"🏊":e.activite==="club"?"🏖️":"🏖️🏊"}
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 14, color: grp?.color||C.ocean }}>{e.age}</div>
                <div style={{ fontSize: 8, color: "#ccc" }}>ans</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "#bbb", textAlign: "center" }}>
        {filteredEnfants.length} enfant{filteredEnfants.length>1?"s":""} · {periodLabel}
      </div>
    </div>
  );
}

// ── NOUVELLE RÉSERVATION ADMIN ────────────────────────────
// ── MODIFIER RÉSERVATION ──────────────────────────────────
// ── MODIFIER RÉSERVATION ──────────────────────────────────
function ModifierResaModal({ resa, type, onClose, onSaved, dbMembres }) {
  const isNat  = type === "natation";
  const color  = isNat ? C.ocean : C.coral;

  const [membreId, setMembreId]   = useState(resa.membre_id || "");
  const [date, setDate]           = useState(isNat ? (resa.date_seance?.slice(0,10) || "") : (resa.date_reservation?.slice(0,10) || ""));
  const [heure, setHeure]         = useState(resa.heure || "09:00");
  const [session, setSession]     = useState(resa.session || "matin");
  const [statut, setStatut]       = useState(resa.statut || "pending");
  const [enfants, setEnfants]     = useState(resa.enfants || []);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const membre = dbMembres.find(m => m.id === membreId);
  const enfantsDuMembre = (membre?.enfants || []);
  const heures = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];
  const toggleEnfant = (prenom) => setEnfants(prev => prev.includes(prenom) ? prev.filter(e => e !== prenom) : [...prev, prenom]);

  const handleSave = async () => {
    if (!date) { setError("La date est obligatoire."); return; }
    setSaving(true);
    try {
      if (isNat) {
        await sb.from("reservations_natation").update({ membre_id: membreId||null, date_seance: date, heure, enfants, statut }).eq("id", resa.id);
      } else {
        await sb.from("reservations_club").update({ membre_id: membreId||null, date_reservation: date, session, enfants, statut }).eq("id", resa.id);
      }
      onSaved(); onClose();
    } catch(e) { setError("Erreur : " + e.message); setSaving(false); }
  };

  const Field = ({ label, children }) => (
    <div>
      <label style={{ fontSize:11, fontWeight:900, color, display:"block", marginBottom:6, textTransform:"uppercase" }}>{label}</label>
      {children}
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
      <div style={{ position:"relative", background:"#F0F4F8", borderRadius:24, width:"100%", maxWidth:520, maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 24px 64px rgba(0,0,0,0.3)", margin:"0 16px" }}>
        <div style={{ background:`linear-gradient(135deg,${color},${color}cc)`, borderRadius:"24px 24px 0 0", padding:"18px 20px", position:"relative", flexShrink:0 }}>
          <button onClick={onClose} style={{ position:"absolute", top:12, right:14, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
          <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>✏️ Modifier la réservation</div>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>{isNat ? "🏊 Natation" : "🏖️ Club de Plage"}</div>
        </div>
        <div style={{ overflowY:"auto", padding:"20px 20px 24px", display:"flex", flexDirection:"column", gap:14 }}>

          <Field label="Famille">
            <select value={membreId} onChange={e => { setMembreId(e.target.value); setEnfants([]); }}
              style={{ width:"100%", border:"2px solid #e0e8f0", borderRadius:12, padding:"11px 12px", fontSize:14, fontFamily:"inherit", outline:"none", background:"#fff" }}>
              <option value="">— Sélectionner —</option>
              {dbMembres.map(m => <option key={m.id} value={m.id}>{m.prenom} {NOM(m.nom)}</option>)}
            </select>
          </Field>

          <Field label="Statut">
            <div style={{ display:"flex", gap:8 }}>
              {[["pending","⏳ En attente"],["confirmed","✅ Confirmé"]].map(([k,l]) => (
                <button key={k} onClick={() => setStatut(k)} style={{ flex:1, background: statut===k ? (k==="confirmed" ? C.green : C.sun) : "#f0f0f0", color: statut===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"10px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </Field>

          <Field label="Date">
            <input type="date" value={date} onChange={e => setDate(e.target.value)} min="2026-07-06" max="2026-08-22"
              style={{ width:"100%", border:"2px solid #e0e8f0", borderRadius:12, padding:"11px", fontSize:15, fontFamily:"inherit", outline:"none", background:"#fff", boxSizing:"border-box" }} />
          </Field>

          {isNat ? (
            <Field label="Heure">
              <select value={heure} onChange={e => setHeure(e.target.value)}
                style={{ width:"100%", border:"2px solid #e0e8f0", borderRadius:12, padding:"11px", fontSize:15, fontFamily:"inherit", outline:"none", background:"#fff" }}>
                {heures.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Session">
              <div style={{ display:"flex", gap:8 }}>
                {[["matin","☀️ Matin"],["apmidi","🌊 Après-midi"]].map(([k,l]) => (
                  <button key={k} onClick={() => setSession(k)} style={{ flex:1, background: session===k ? color : "#f0f0f0", color: session===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"10px", cursor:"pointer", fontWeight:800, fontSize:13, fontFamily:"inherit" }}>{l}</button>
                ))}
              </div>
            </Field>
          )}

          {enfantsDuMembre.length > 0 && (
            <Field label={"Enfants" + (enfants.length > 0 ? " · " + enfants.join(", ") : "")}>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {enfantsDuMembre
                  .filter(e => isNat ? (e.activite === "natation" || e.activite === "les deux") : (e.activite === "club" || e.activite === "les deux"))
                  .map((e, i) => {
                    const sel = enfants.includes(e.prenom);
                    return (
                      <div key={i} onClick={() => toggleEnfant(e.prenom)} style={{ background: sel ? color : "#f0f0f0", color: sel ? "#fff" : "#888", borderRadius:50, padding:"8px 16px", cursor:"pointer", fontWeight:800, fontSize:13 }}>
                        {sel ? "✓ " : ""}{e.prenom}
                      </div>
                    );
                  })}
              </div>
            </Field>
          )}

          {error && <div style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:10, padding:"9px 14px", fontSize:13, color:"#e74c3c", fontWeight:700 }}>⚠️ {error}</div>}
          <SunBtn color={saving ? "#aaa" : color} full onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Enregistrement..." : "✅ Enregistrer les modifications"}
          </SunBtn>
        </div>
      </div>
    </div>
  );
}


function NouvelleResaModal({ onClose, onSaved, dbMembres, allSeasonSessions, setAllSeasonSessions, clubPlaces, setClubPlaces }) {
  const [type, setType]                 = useState("natation");
  const [membreId, setMembreId]         = useState("");
  const [selectedEnfants, setSelectedEnfants] = useState([]);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");
  const [statutResa, setStatutResa]     = useState("pending");

  // Natation
  const [forfaitNat, setForfaitNat]     = useState("unite");
  const [selectedCreneaux, setSelectedCreneaux] = useState([]); // [{dayISO, time}]
  const [natWeekIdx, setNatWeekIdx]     = useState(0);
  const [dbResasNat, setDbResasNat]     = useState([]);

  // Club
  const [forfaitClub, setForfaitClub]   = useState("unite");
  const [sessionClub, setSessionClub]   = useState("matin");
  const [seancesClub, setSeancesClub]   = useState([{ date:"", session:"matin" }]);
  const [nbLiberte, setNbLiberte]       = useState(1); // nb demi-journées liberté
  const [moisFilter, setMoisFilter]     = useState("juil");
  // Club semaines — calendrier 1er jour
  const [selectedStartDate, setSelectedStartDate] = useState(null); // ISO
  const [nbSemainesClub, setNbSemainesClub] = useState(1);

  useEffect(() => {
    sb.from("reservations_natation").select("date_seance, heure, statut")
      .eq("statut","confirmed")
      .then(({ data }) => setDbResasNat(data || [])).catch(() => {});
  }, []);

  const heuresNatation = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

  const membreSelectionne = dbMembres.find(m => m.id === membreId);
  const enfantsDuMembre   = membreSelectionne?.enfants || [];
  const liberteBalance    = membreSelectionne?.liberte_balance || 0;

  const toggleEnfant = (prenom) => setSelectedEnfants(prev => prev.includes(prenom) ? prev.filter(e => e !== prenom) : [...prev, prenom]);
  const handleMembreChange = (id) => { setMembreId(id); setSelectedEnfants([]); };

  const nbSeancesNat = forfaitNat === "unite" ? 1 : forfaitNat === "forfait5" ? 5 : forfaitNat === "forfait6" ? 6 : 10;

  const getSpots = (dayISO, time) => {
    const taken = dbResasNat.filter(r => r.date_seance?.slice(0,10) === dayISO && r.heure === time).length;
    return Math.max(0, 2 - taken);
  };

  const toggleCreneau = (dayISO, time) => {
    const key = `${dayISO}-${time}`;
    setSelectedCreneaux(prev => {
      const exists = prev.find(c => c.key === key);
      if (exists) return prev.filter(c => c.key !== key);
      if (prev.length >= nbSeancesNat) return prev;
      return [...prev, { key, dayISO, time }];
    });
  };

  // Semaines natation
  const natWeeks = [];
  let wk = [];
  ALL_SEASON_DAYS.forEach((d, i) => {
    wk.push(d);
    if (d.label === "Sam" || i === ALL_SEASON_DAYS.length - 1) { natWeeks.push([...wk]); wk = []; }
  });
  const natCurrentWeek = natWeeks[Math.min(natWeekIdx, natWeeks.length-1)] || [];

  // Génération jours club pour semaines (N×6 jours depuis selectedStartDate)
  const getClubWeekDays = () => {
    if (!selectedStartDate) return [];
    const startIdx = CLUB_SEASON_DAYS.findIndex(d => {
      const iso = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
      return iso === selectedStartDate;
    });
    if (startIdx === -1) return [];
    return CLUB_SEASON_DAYS.slice(startIdx, startIdx + nbSemainesClub * 6);
  };

  const addSeanceClub = () => setSeancesClub(prev => [...prev, { date:"", session:"matin" }]);
  const removeSeanceClub = (idx) => setSeancesClub(prev => prev.filter((_, i) => i !== idx));
  const updateSeanceClub = (idx, field, val) => {
    const next = [...seancesClub];
    next[idx] = { ...next[idx], [field]: val };
    setSeancesClub(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (type === "natation") {
        if (!selectedCreneaux.length) { setError("Sélectionnez au moins un créneau."); setSaving(false); return; }
        for (const c of selectedCreneaux) {
          await creerReservationNatation({
            membreId: membreId || null,
            jour: parseLocalDate(c.dayISO).toLocaleDateString("fr-FR", { weekday: "short" }),
            heure: c.time,
            dateSeance: c.dayISO,
            enfants: selectedEnfants,
            rappelDate: getRappelDate(c.dayISO),
            montant: forfaitNat === "unite" ? 20 : forfaitNat === "forfait5" ? 95 : forfaitNat === "forfait6" ? 113 : 170,
            statut: statutResa,
          });
        }
      } else {
        if (forfaitClub === "semaines") {
          if (!selectedStartDate) { setError("Sélectionnez un jour de début."); setSaving(false); return; }
          const days = getClubWeekDays();
          const sessions = sessionClub === "journee" ? ["matin","apmidi"] : [sessionClub];
          // Calculer le montant par enfant selon les tarifs
          const tarifData = sessionClub === "matin" ? TARIFS_MATIN : sessionClub === "apmidi" ? TARIFS_APMIDI : TARIFS_JOURNEE;
          const nbEnf = selectedEnfants.length || 1;
          const rowIdx = Math.min(nbSemainesClub, 4); // 0=unité,1=1sem,2=2sem,3=3sem,4=4sem
          const tarifRow = tarifData.rows[rowIdx] || tarifData.rows[tarifData.rows.length-1];
          const montantTotal = nbEnf === 1 ? tarifRow.e1 : nbEnf === 2 ? tarifRow.e2 : nbEnf === 3 ? tarifRow.e3 : tarifRow.e3 + (nbEnf-3)*tarifRow.sup;
          const nbJours = days.length * sessions.length;
          const montantParJour = nbJours > 0 ? Math.round(montantTotal / nbJours) : 0;
          for (const day of days) {
            const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth()+1).padStart(2,"0")}-${String(day.date.getDate()).padStart(2,"0")}`;
            for (const sess of sessions) {
              await creerReservationClub({ membreId: membreId||null, dateReservation:dateStr, session:sess, labelJour:`[MONTANT:${montantParJour}] ${day.date.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}`, rappelDate:getRappelDate(dateStr), enfants:selectedEnfants, statut:statutResa });
            }
          }
        } else if (forfaitClub === "liberte") {
          const { error: insertError } = await sb.from("reservations_club").insert([{
            membre_id:        membreId || null,
            date_reservation: new Date().toISOString().slice(0,10),
            session:          "matin", // valeur par défaut, label_jour indique Liberté
            statut:           statutResa,
            enfants:          [String(nbLiberte)],
          }]);
          if (insertError) { setError("Erreur : " + insertError.message); setSaving(false); return; }
          if (statutResa === "confirmed" && membreId) {
            const membre = dbMembres.find(m => m.id === membreId);
            const newBalance = (membre?.liberte_balance || 0) + nbLiberte;
            const newTotal   = (membre?.liberte_total   || 0) + nbLiberte;
            await sb.from("membres").update({ liberte_balance: newBalance, liberte_total: newTotal }).eq("id", membreId);
          }
        } else {
          const seancesValides = seancesClub.filter(s => s.date);
          if (!seancesValides.length) { setError("Ajoutez au moins une séance."); setSaving(false); return; }
          for (const s of seancesValides) {
            const nbEnf = selectedEnfants.length || 1;
            const tarifRow = (s.session === "matin" ? TARIFS_MATIN : TARIFS_APMIDI).rows[0];
            const montantUnite = nbEnf === 1 ? tarifRow.e1 : nbEnf === 2 ? tarifRow.e2 : nbEnf === 3 ? tarifRow.e3 : tarifRow.e3 + (nbEnf-3)*tarifRow.sup;
            await creerReservationClub({ membreId:membreId||null, dateReservation:s.date, session:s.session, labelJour:`[MONTANT:${montantUnite}] ${new Date(s.date).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}`, rappelDate:getRappelDate(s.date), enfants:selectedEnfants, statut:statutResa });
          }
        }
      }
      onSaved();
      onClose();
    } catch(e) { setError("Erreur : " + e.message); setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", flexDirection:"column" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
      <div style={{ position:"relative", marginTop:"auto", background:"#F0F4F8", borderRadius:"28px 28px 0 0", maxHeight:"94vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
        </div>
        <div style={{ background:`linear-gradient(135deg,${C.ocean},${C.sea})`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
          <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>📋 Nouvelle réservation</div>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>Saisie manuelle depuis l'admin</div>
        </div>

        <div style={{ overflowY:"auto", padding:"16px 16px 28px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Type */}
          <div>
            <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Activité</label>
            <div style={{ display:"flex", gap:8 }}>
              {[["natation","🏊 Natation"],["club","🏖️ Club"]].map(([k,l]) => (
                <button key={k} onClick={() => { setType(k); setSelectedCreneaux([]); }} style={{ flex:1, background: type===k ? C.ocean : "#f0f0f0", color: type===k ? "#fff" : "#888", border:"none", borderRadius:14, padding:"10px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Famille */}
          <div>
            <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Famille</label>
            <select value={membreId} onChange={e => handleMembreChange(e.target.value)}
              style={{ width:"100%", border:"2px solid #e0e8f0", borderRadius:12, padding:"10px 12px", fontSize:14, fontFamily:"inherit", outline:"none", background:"#fff" }}>
              <option value="">— Sélectionner —</option>
              {dbMembres.map(m => <option key={m.id} value={m.id}>{m.prenom} {NOM(m.nom)}</option>)}
            </select>
          </div>

          {/* Statut */}
          <div>
            <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Statut paiement</label>
            <div style={{ display:"flex", gap:8 }}>
              {[["pending","⏳ En attente"],["confirmed","✅ Payé"]].map(([k,l]) => (
                <button key={k} onClick={() => setStatutResa(k)} style={{ flex:1, background: statutResa===k ? (k==="confirmed" ? C.green : C.sun) : "#f0f0f0", color: statutResa===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"10px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>{l}</button>
              ))}
            </div>
          </div>

          {/* Enfants */}
          {enfantsDuMembre.length > 0 && (
            <div>
              <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>
                Enfants {selectedEnfants.length > 0 && `· ${selectedEnfants.join(", ")}`}
              </label>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {enfantsDuMembre.map((e, i) => {
                  const sel = selectedEnfants.includes(e.prenom);
                  return (
                    <div key={i} onClick={() => toggleEnfant(e.prenom)} style={{ background: sel ? C.ocean : "#f0f0f0", color: sel?"#fff":"#888", borderRadius:50, padding:"8px 16px", cursor:"pointer", fontWeight:800, fontSize:13 }}>
                      {sel ? "✓ " : ""}{e.prenom}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── NATATION ── */}
          {type === "natation" && (
            <>
              <div>
                <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Formule</label>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {[["unite","1 · 20€"],["forfait5","5 · 95€"],["forfait6","6 · 113€"],["forfait10","10 · 170€"]].map(([k,l]) => (
                    <button key={k} onClick={() => { setForfaitNat(k); setSelectedCreneaux([]); }} style={{ flex:1, background: forfaitNat===k ? C.ocean : "#f0f0f0", color: forfaitNat===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:10, fontFamily:"inherit" }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Navigation semaine */}
              <div style={{ background:"#fff", borderRadius:16, padding:14, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <button onClick={() => setNatWeekIdx(Math.max(0,natWeekIdx-1))} disabled={natWeekIdx===0}
                    style={{ background:natWeekIdx===0?"#eee":C.ocean, border:"none", color:natWeekIdx===0?"#bbb":"#fff", borderRadius:"50%", width:28, height:28, cursor:natWeekIdx===0?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:14 }}>‹</button>
                  <div style={{ flex:1, textAlign:"center", fontWeight:800, color:C.dark, fontSize:12 }}>
                    {natCurrentWeek[0]?.num} {natCurrentWeek[0]?.month} – {natCurrentWeek[natCurrentWeek.length-1]?.num} {natCurrentWeek[natCurrentWeek.length-1]?.month} 2026
                  </div>
                  <button onClick={() => setNatWeekIdx(Math.min(natWeeks.length-1,natWeekIdx+1))} disabled={natWeekIdx>=natWeeks.length-1}
                    style={{ background:natWeekIdx>=natWeeks.length-1?"#eee":C.ocean, border:"none", color:natWeekIdx>=natWeeks.length-1?"#bbb":"#fff", borderRadius:"50%", width:28, height:28, cursor:natWeekIdx>=natWeeks.length-1?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:14 }}>›</button>
                </div>

                <div style={{ fontSize:11, color:"#888", marginBottom:8 }}>{selectedCreneaux.length}/{nbSeancesNat} sélectionné{selectedCreneaux.length>1?"s":""}</div>

                {natCurrentWeek.map(d => {
                  const dayISO = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
                  const daySlots = ALL_SEASON_SLOTS_INIT.filter(s => s.day === d.id);
                  if (!daySlots.length) return null;
                  return (
                    <div key={d.id} style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, fontWeight:900, color:C.ocean, textTransform:"uppercase", marginBottom:5 }}>{d.label} {d.num} {d.month}</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                        {daySlots.map(slot => {
                          const spots = getSpots(dayISO, slot.time);
                          const key = `${dayISO}-${slot.time}`;
                          const sel = selectedCreneaux.find(c => c.key === key);
                          const blocked = !sel && selectedCreneaux.length >= nbSeancesNat;
                          const full = spots === 0;
                          return (
                            <div key={slot.id} onClick={() => !full && !blocked && toggleCreneau(dayISO, slot.time)} style={{
                              background: sel ? `linear-gradient(135deg,${C.ocean},${C.sea})` : full?"#f5f5f5":blocked?"#f8f8f8":"#F0F4F8",
                              color: sel?"#fff":full||blocked?"#ccc":C.dark,
                              borderRadius:8, padding:"5px 10px", cursor:full||blocked?"not-allowed":"pointer",
                              fontWeight:800, fontSize:11, border:`1.5px solid ${sel?C.ocean:"#e0e8f0"}`,
                              boxShadow: sel?`0 2px 8px ${C.ocean}44`:"none",
                            }}>
                              {slot.time} {!full && <span style={{ fontSize:9, opacity:.7 }}>{spots}/2</span>}
                              {full && <span style={{ fontSize:9 }}> Complet</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {selectedCreneaux.length > 0 && (
                  <div style={{ background:`${C.ocean}10`, borderRadius:10, padding:"8px 10px", marginTop:8, fontSize:11, color:C.ocean, fontWeight:700 }}>
                    ✓ {selectedCreneaux.map(c => `${c.time} (${parseLocalDate(c.dayISO).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})})`).join(" · ")}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── CLUB ── */}
          {type === "club" && (
            <>
              <div>
                <label style={{ fontSize:11, fontWeight:900, color:C.coral, display:"block", marginBottom:6, textTransform:"uppercase" }}>Formule</label>
                <div style={{ display:"flex", gap:6 }}>
                  {[["unite","½ Journée"],["semaines","Semaine(s)"],["liberte","Carte Liberté"]].map(([k,l]) => (
                    <button key={k} onClick={() => { setForfaitClub(k); setSelectedStartDate(null); setSeancesClub([{date:"",session:"matin"}]); }} style={{ flex:1, background: forfaitClub===k ? C.coral : "#f0f0f0", color: forfaitClub===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:10, fontFamily:"inherit" }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Club Semaines — calendrier */}
              {forfaitClub === "semaines" && (
                <div style={{ background:"#fff", borderRadius:16, padding:14, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontWeight:800, color:C.dark, fontSize:13, marginBottom:10 }}>📅 Nombre de semaines</div>
                  <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                    {[1,2,3,4].map(n => (
                      <button key={n} onClick={() => { setNbSemainesClub(n); setSelectedStartDate(null); }} style={{ flex:1, background: nbSemainesClub===n ? C.coral : "#f0f0f0", color: nbSemainesClub===n?"#fff":"#888", border:"none", borderRadius:10, padding:"8px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>{n}</button>
                    ))}
                  </div>

                  <div style={{ fontWeight:800, color:C.dark, fontSize:13, marginBottom:6 }}>Choisir le 1er jour</div>
                  {/* Toggle mois */}
                  <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                    {[["juil","Juillet"],["aout","Août"]].map(([k,l]) => (
                      <button key={k} onClick={() => setMoisFilter(k)} style={{ flex:1, background: moisFilter===k ? `linear-gradient(135deg,${C.coral},${C.sun})` : "#f0f0f0", color: moisFilter===k?"#fff":"#888", border:"none", borderRadius:12, padding:"8px", cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit" }}>{l}</button>
                    ))}
                  </div>

                  {/* Calendrier */}
                  {(() => {
                    const year = 2026;
                    const month = moisFilter === "juil" ? 6 : 7;
                    const firstDay = new Date(year, month, 1).getDay();
                    const daysInMonth = new Date(year, month+1, 0).getDate();
                    const offset = firstDay === 0 ? 6 : firstDay - 1;
                    const dowLabels = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
                    return (
                      <div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3, marginBottom:4 }}>
                          {dowLabels.map(d => <div key={d} style={{ textAlign:"center", fontSize:9, fontWeight:900, color:"#aaa" }}>{d}</div>)}
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:3 }}>
                          {Array.from({length:offset}).map((_,i) => <div key={`e${i}`} />)}
                          {Array.from({length:daysInMonth}).map((_,i) => {
                            const day = i+1;
                            const date = new Date(year, month, day);
                            const dow = date.getDay();
                            const iso = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                            const isDim = dow === 0;
                            const inSeason = CLUB_SEASON_DAYS.some(d => {
                              const diso = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
                              return diso === iso;
                            });
                            const startIdx = CLUB_SEASON_DAYS.findIndex(d => {
                              const diso = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
                              return diso === iso;
                            });
                            const disabled = !inSeason || isDim || CLUB_SEASON_DAYS.slice(startIdx, startIdx + nbSemainesClub*6).length < nbSemainesClub*6;
                            const sel = selectedStartDate === iso;
                            return (
                              <div key={day} onClick={() => !disabled && setSelectedStartDate(sel ? null : iso)} style={{
                                height:34, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
                                fontSize:12, fontWeight: inSeason?800:400,
                                background: sel ? `linear-gradient(135deg,${C.coral},${C.sun})` : !inSeason||isDim?"transparent":"#F8FBFF",
                                color: sel?"#fff":!inSeason||isDim?"#ddd":disabled?"#ccc":C.dark,
                                cursor: disabled||!inSeason||isDim?"default":"pointer",
                                border:`1.5px solid ${sel?C.coral:"transparent"}`,
                              }}>{day}</div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {selectedStartDate && (
                    <div style={{ marginTop:10, background:`${C.coral}10`, borderRadius:10, padding:"8px 12px", fontSize:12, color:C.coral, fontWeight:700 }}>
                      ✓ Du {new Date(selectedStartDate).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})} · {nbSemainesClub} sem. · {nbSemainesClub*6} jours
                    </div>
                  )}

                  {selectedStartDate && (
                    <div style={{ marginTop:10 }}>
                      <label style={{ fontSize:11, fontWeight:900, color:C.coral, display:"block", marginBottom:6, textTransform:"uppercase" }}>Session</label>
                      <div style={{ display:"flex", gap:8 }}>
                        {[["matin","☀️ Matin"],["apmidi","🌊 Après-midi"],["journee","☀️🌊 Journée"]].map(([k,l]) => (
                          <button key={k} onClick={() => setSessionClub(k)} style={{ flex:1, background: sessionClub===k ? C.coral : "#f0f0f0", color: sessionClub===k?"#fff":"#888", border:"none", borderRadius:10, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:10, fontFamily:"inherit" }}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Carte Liberté — nb demi-journées, pas de dates */}
              {forfaitClub === "liberte" && (
                <div style={{ background:"#fff", borderRadius:16, padding:14, boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontWeight:800, color:C.dark, fontSize:13, marginBottom:6 }}>🎟️ Carte Liberté</div>
                  <div style={{ fontSize:12, color:"#888", marginBottom:12 }}>
                    Le solde sera crédité sur le compte du client à réception du paiement.
                    {membreId && <><br/>Solde actuel : <strong>{liberteBalance}</strong> demi-j.</>}
                  </div>
                  <label style={{ fontSize:11, fontWeight:900, color:C.coral, display:"block", marginBottom:8, textTransform:"uppercase" }}>Nombre de demi-journées</label>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {[[6,"6"],[12,"12"],[18,"18"],[24,"24"],[30,"30"]].map(([n,l]) => (
                      <button key={n} onClick={() => setNbLiberte(n)} style={{
                        flex:1, background: nbLiberte===n ? `linear-gradient(135deg,${C.coral},${C.sun})` : "#f0f0f0",
                        color: nbLiberte===n?"#fff":"#888", border:"none", borderRadius:12,
                        padding:"12px 4px", cursor:"pointer", fontWeight:900, fontSize:14, fontFamily:"inherit",
                        boxShadow: nbLiberte===n ? `0 4px 12px ${C.coral}44` : "none",
                      }}>{l}</button>
                    ))}
                  </div>
                  <div style={{ marginTop:12, background:`${C.coral}10`, borderRadius:10, padding:"10px 12px", fontSize:13, color:C.coral, fontWeight:700 }}>
                    🎟️ {nbLiberte} demi-journées · valable saison 2026
                  </div>
                </div>
              )}

              {/* Unitaire */}
              {forfaitClub === "unite" && (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {seancesClub.map((s, i) => (
                    <div key={i} style={{ background:"#fff", borderRadius:12, padding:"10px 12px", display:"flex", gap:8, alignItems:"center" }}>
                      <input type="date" value={s.date} onChange={e => updateSeanceClub(i,"date",e.target.value)} min="2026-07-06" max="2026-08-22"
                        style={{ flex:1, border:"1.5px solid #e0e8f0", borderRadius:10, padding:"8px", fontSize:12, fontFamily:"inherit", outline:"none" }} />
                      <select value={s.session} onChange={e => updateSeanceClub(i,"session",e.target.value)}
                        style={{ flex:1, border:"1.5px solid #e0e8f0", borderRadius:10, padding:"8px", fontSize:12, fontFamily:"inherit", outline:"none", background:"#fff" }}>
                        <option value="matin">☀️ Matin</option>
                        <option value="apmidi">🌊 Après-midi</option>
                      </select>
                      {seancesClub.length > 1 && <button onClick={() => removeSeanceClub(i)} style={{ background:"#FFF0F0", border:"none", color:C.sunset, borderRadius:8, width:28, height:28, cursor:"pointer", fontWeight:900, fontFamily:"inherit" }}>✕</button>}
                    </div>
                  ))}
                  <button onClick={addSeanceClub} style={{ background:`${C.coral}10`, border:`1.5px dashed ${C.coral}40`, color:C.coral, borderRadius:12, padding:"8px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>➕ Ajouter une séance</button>
                </div>
              )}
            </>
          )}

          {error && <div style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:10, padding:"9px 14px", fontSize:13, color:"#e74c3c", fontWeight:700 }}>⚠️ {error}</div>}
          <SunBtn color={saving ? "#aaa" : C.ocean} full onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Enregistrement..." : "✅ Créer la réservation"}
          </SunBtn>
        </div>
      </div>
    </div>
  );
}

function CartesLiberteTab({ dbMembres }) {
  const [cartes, setCartes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery]     = useState("");

  useEffect(() => {
    const load = async () => {
      // Résas club confirmed
      const { data: toutesResas } = await sb.from("reservations_club")
        .select("id, membre_id, date_reservation, session, statut, enfants, label_jour, created_at, membres(id, prenom, nom, email, liberte_balance, liberte_total)")
        .eq("statut", "confirmed")
        .order("date_reservation", { ascending: true });

      // Enfants séparément
      const { data: tousEnfants } = await sb.from("enfants")
        .select("membre_id, prenom, activite");

      if (!toutesResas) { setLoading(false); return; }

      // Séparer cartes liberté des résas normales
      // Carte liberté = enfants est un array dont le premier élément est un nombre >= 6
      const isCarteLib = r => {
        const val = r.enfants;
        if (!Array.isArray(val) || val.length === 0) return false;
        const n = Number(val[0]);
        return !isNaN(n) && n >= 6;
      };

      // Grouper par membre
      const byMembre = {};
      toutesResas.forEach(r => {
        if (!r.membre_id) return;
        if (!byMembre[r.membre_id]) {
          byMembre[r.membre_id] = { membre: r.membres, achats: [], utilisees: [] };
        }
        if (isCarteLib(r)) {
          byMembre[r.membre_id].achats.push(r);
        } else if (r.date_reservation && (r.label_jour || "").startsWith("[LIBERTE]")) {
          byMembre[r.membre_id].utilisees.push(r); // uniquement résas utilisées avec la carte
        }
      });

      // Ajouter les enfants club à chaque membre
      (tousEnfants || []).forEach(e => {
        if (byMembre[e.membre_id] && (e.activite === "club" || e.activite === "les deux")) {
          if (!byMembre[e.membre_id].enfantsClub) byMembre[e.membre_id].enfantsClub = [];
          byMembre[e.membre_id].enfantsClub.push(e.prenom);
        }
      });

      const result = Object.values(byMembre).filter(c => c.achats.length > 0);
      setCartes(result);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, []);

  const q = query.toLowerCase().trim();
  const filtered = q
    ? cartes.filter(c =>
        `${c.membre?.prenom} ${c.membre?.nom}`.toLowerCase().includes(q) ||
        c.membre?.email?.toLowerCase().includes(q)
      )
    : cartes;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

      {/* Barre de recherche */}
      <div style={{ position:"relative" }}>
        <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16 }}>🔍</span>
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher par nom ou email…"
          style={{ width:"100%", border:"2px solid #e0e8f0", borderRadius:14, padding:"12px 14px 12px 40px", fontSize:14, fontFamily:"inherit", outline:"none", background:"#fff", boxSizing:"border-box" }} />
        {query && <button onClick={() => setQuery("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color:"#aaa" }}>✕</button>}
      </div>

      {/* KPIs */}
      <div style={{ display:"flex", gap:8 }}>
        {[
          { label:"Cartes actives", value:cartes.length, color:C.coral },
          { label:"Demi-j. restantes", value:cartes.reduce((s,c)=>s+(c.membre?.liberte_balance||0),0), color:C.green },
          { label:"Demi-j. total", value:cartes.reduce((s,c)=>s+(c.membre?.liberte_total||0),0), color:C.ocean },
        ].map(k => (
          <div key={k.label} style={{ flex:1, background:"#fff", borderRadius:16, padding:"12px 8px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight:900, fontSize:20, color:k.color }}>{k.value}</div>
            <div style={{ fontSize:10, color:"#aaa", fontWeight:700 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {loading && <div style={{ textAlign:"center", padding:"32px 0", color:"#bbb" }}>Chargement…</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"32px 0", color:"#bbb", fontSize:14 }}>
          {q ? "Aucun résultat" : "Aucune carte active"}
        </div>
      )}

      {/* Cartes — 4 colonnes desktop */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))", gap:14 }}>
      {filtered.map((c, i) => {
        const balance  = c.membre?.liberte_balance || 0;
        const total    = c.membre?.liberte_total   || 0;
        const used     = Math.max(0, total - balance);
        const pct      = total > 0 ? Math.round((used / total) * 100) : 0;
        // Afficher chaque achat séparément
        const achatsLabels = c.achats.map(r => Number(Array.isArray(r.enfants) ? r.enfants[0] : 0)).filter(n => n >= 6);

        const enfantsClub = c.enfantsClub || [];

        const datesUtil = [...c.utilisees]
          .sort((a,b) => (a.date_reservation||"").localeCompare(b.date_reservation||""));

        return (
          <div key={i} style={{ background:"#fff", borderRadius:20, padding:18, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>

            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <div style={{ width:46, height:46, borderRadius:16, background:`linear-gradient(135deg,${C.coral},${C.sun})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🎟️</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:900, color:C.dark, fontSize:14 }}>{c.membre?.prenom} {NOM(c.membre?.nom)}</div>
                <div style={{ fontSize:11, color:"#aaa" }}>{c.membre?.email}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:900, color: balance > 0 ? C.green : C.sunset, fontSize:24, lineHeight:1 }}>{balance}</div>
                <div style={{ fontSize:10, color:"#aaa" }}>restantes</div>
              </div>
            </div>

            {/* Enfants */}
            {enfantsClub.length > 0 && (
              <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                {enfantsClub.map((e,j) => (
                  <span key={j} style={{ background:`${C.coral}15`, color:C.coral, borderRadius:50, padding:"3px 10px", fontSize:11, fontWeight:800 }}>👧 {e}</span>
                ))}
              </div>
            )}

            {/* Barre progression */}
            <div style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#888", marginBottom:4 }}>
                <span>{achatsLabels.map(n => `${n} demi-j.`).join(" + ")} achetées</span>
                <span>{used} utilisées · {balance} restantes</span>
              </div>
              <div style={{ background:"#F0F4F8", borderRadius:50, height:10, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${C.coral},${C.sun})`, borderRadius:50, transition:"width .3s" }} />
              </div>
            </div>

            {/* Dates utilisées */}
            {datesUtil.length > 0 ? (
              <div>
                <div style={{ fontSize:11, fontWeight:900, color:"#aaa", textTransform:"uppercase", marginBottom:6 }}>
                  📅 {datesUtil.length} demi-journée{datesUtil.length>1?"s":""} utilisée{datesUtil.length>1?"s":""}
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {datesUtil.map((r,j) => (
                    <div key={j} style={{ background:`${C.coral}12`, color:C.coral, borderRadius:8, padding:"4px 10px", fontSize:11, fontWeight:700 }}>
                      {new Date(r.date_reservation).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}
                      {" "}{r.session==="matin"?"☀️ Matin":"🌊 Après-midi"}
                      {Array.isArray(r.enfants) && r.enfants.length > 0 && !isNaN(Number(r.enfants[0])) === false && ` · ${r.enfants.join(", ")}`}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize:12, color:"#bbb", fontStyle:"italic" }}>Aucune demi-journée utilisée pour l'instant</div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}

// ── RÉSAS PAR MEMBRE ─────────────────────────────────────
// Enrichit les prénoms d'enfants avec le nom de famille du membre parent
const enrichEnfants = (enfants, membres) => {
  if (!enfants?.length) return [];
  const nom = membres?.nom ? ` ${NOM(membres.nom)}` : "";
  return enfants.filter(e => isNaN(Number(e))).map(prenom => prenom + nom);
};

function ResasMembreView({ dbResas, dbResasClub, refreshResas, setModifierResa, supprimerResaNatation, supprimerResaClub }) {
  const [modePaiementConfirm, setModePaiementConfirm] = useState(null); // { resa, type }
  const allWeeks = (() => {
    const ws = []; let wk = [];
    ALL_SEASON_DAYS.forEach((d, i) => {
      wk.push(d);
      if (d.label === "Sam" || i === ALL_SEASON_DAYS.length - 1) { ws.push([...wk]); wk = []; }
    });
    return ws;
  })();

  const today = new Date();
  const defaultWeekIdx = (() => {
    let idx = 0;
    allWeeks.forEach((w, i) => {
      if (w.some(d => d.date && Math.abs(d.date - today) < 7*24*3600*1000)) idx = i;
    });
    return idx;
  })();

  const [weekIdx, setWeekIdx]           = useState(defaultWeekIdx);
  const [openMembreIds, setOpenMembreIds] = useState({});
  const [filterStatut, setFilterStatut]  = useState("tous");
  const [showAll, setShowAll]            = useState(false);

  const currentWeek = allWeeks[Math.min(weekIdx, allWeeks.length-1)] || [];
  const weekStart   = currentWeek[0];
  const weekEnd     = currentWeek[currentWeek.length-1];

  const weekISOs = currentWeek.map(d => {
    if (!d.date) return null;
    return `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
  }).filter(Boolean);

  const resasSemNat  = showAll ? dbResas : dbResas.filter(r => weekISOs.includes(r.date_seance?.slice(0,10)));
  const resasSemClub = showAll ? dbResasClub : dbResasClub.filter(r => weekISOs.includes(r.date_reservation?.slice(0,10)));

  const membresMap = {};
  [...resasSemNat.map(r => ({ ...r, _type:"nat" })),
   ...resasSemClub.map(r => ({ ...r, _type:"club" }))
  ].forEach(r => {
    const mid = r.membre_id || "inconnu";
    if (!membresMap[mid]) membresMap[mid] = { membre: r.membres, nat: [], club: [] };
    if (r._type === "nat") membresMap[mid].nat.push(r);
    else membresMap[mid].club.push(r);
  });

  const membres = Object.entries(membresMap)
    .filter(([, g]) => {
      if (filterStatut === "tous") return true;
      return [...g.nat, ...g.club].some(r => r.statut === filterStatut);
    })
    .sort(([,a],[,b]) => {
      const na = a.membre ? `${a.membre.nom} ${a.membre.prenom}` : "z";
      const nb = b.membre ? `${b.membre.nom} ${b.membre.prenom}` : "z";
      return na.localeCompare(nb);
    });

  const toggleMembre = (mid) => setOpenMembreIds(prev => ({ ...prev, [mid]: !prev[mid] }));

  if (membres.length === 0) return (
    <>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:"9px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
          <button onClick={() => setWeekIdx(Math.max(0, weekIdx-1))} disabled={weekIdx===0||showAll}
            style={{ background:weekIdx===0||showAll?"#f0f0f0":C.ocean, border:"none", color:weekIdx===0||showAll?"#bbb":"#fff", borderRadius:"50%", width:30, height:30, cursor:weekIdx===0||showAll?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:16 }}>‹</button>
          <div style={{ textAlign:"center" }}>
            {showAll ? <div style={{ fontWeight:900, color:C.dark, fontSize:13 }}>Toute la saison</div>
              : <div style={{ fontWeight:900, color:C.dark, fontSize:13 }}>{weekStart?.num} {weekStart?.month} – {weekEnd?.num} {weekEnd?.month} 2026</div>}
            <div style={{ fontSize:11, color:"#aaa" }}>{showAll ? "Toutes semaines" : `Semaine ${weekIdx+1}/${allWeeks.length}`} · 0 famille</div>
          </div>
          <button onClick={() => setWeekIdx(Math.min(allWeeks.length-1, weekIdx+1))} disabled={weekIdx>=allWeeks.length-1||showAll}
            style={{ background:weekIdx>=allWeeks.length-1||showAll?"#f0f0f0":C.ocean, border:"none", color:weekIdx>=allWeeks.length-1||showAll?"#bbb":"#fff", borderRadius:"50%", width:30, height:30, cursor:weekIdx>=allWeeks.length-1||showAll?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:16 }}>›</button>
        </div>
        <button onClick={() => setShowAll(v => !v)} style={{ background:showAll?C.ocean:"#f0f0f0", color:showAll?"#fff":"#888", border:"none", borderRadius:10, padding:"7px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit" }}>
          {showAll ? "✓ Toute la saison" : "Voir toute la saison"}
        </button>
      </div>
      <div style={{ textAlign:"center", padding:"32px 0", color:"#bbb", fontSize:14 }}>Aucune réservation {showAll ? "" : "cette semaine"}</div>
    </>
  );

  return (
    <>
      {/* Modal mode de paiement */}
      {modePaiementConfirm && (
        <ModePaiementModal
          titre={`Valider la réservation de ${modePaiementConfirm.resa.membre_id}`}
          onClose={() => setModePaiementConfirm(null)}
          onConfirm={async (mode) => {
            const { resa, type } = modePaiementConfirm;
            if (type === "natation") {
              await sb.from("reservations_natation").update({ statut:"confirmed", validated_at:new Date().toISOString(), mode_paiement:mode }).eq("id", resa.id);
            } else {
              let montant = 0;
              const isLib = !isNaN(Number(resa.enfants?.[0])) && Number(resa.enfants?.[0]) >= 6;
              if (isLib) { const LP={6:96,12:180,18:252,24:288,30:330}; montant = LP[Number(resa.enfants[0])]||0; }
              else { const m2=(resa.label_jour||"").match(/\[MONTANT:(\d+)\]/); montant=m2?Number(m2[1]):0; }
              await sb.from("reservations_club").update({ statut:"confirmed", validated_at:new Date().toISOString(), montant, mode_paiement:mode }).eq("id", resa.id);
            }
            setModePaiementConfirm(null);
            refreshResas();
          }}
        />
      )}
      {/* Nav semaine + filtre */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ background:"#fff", borderRadius:14, padding:"9px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
          <button onClick={() => setWeekIdx(Math.max(0, weekIdx-1))} disabled={weekIdx===0||showAll}
            style={{ background:weekIdx===0||showAll?"#f0f0f0":C.ocean, border:"none", color:weekIdx===0||showAll?"#bbb":"#fff", borderRadius:"50%", width:30, height:30, cursor:weekIdx===0||showAll?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:16 }}>‹</button>
          <div style={{ textAlign:"center" }}>
            {showAll
              ? <div style={{ fontWeight:900, color:C.dark, fontSize:13 }}>🗓️ Toute la saison</div>
              : <div style={{ fontWeight:900, color:C.dark, fontSize:13 }}>{weekStart?.num} {weekStart?.month} – {weekEnd?.num} {weekEnd?.month} 2026</div>}
            <div style={{ fontSize:11, color:"#aaa" }}>{showAll ? `${membres.length} famille${membres.length>1?"s":""}` : `Semaine ${weekIdx+1}/${allWeeks.length} · ${membres.length} famille${membres.length>1?"s":""}`}</div>
          </div>
          <button onClick={() => setWeekIdx(Math.min(allWeeks.length-1, weekIdx+1))} disabled={weekIdx>=allWeeks.length-1||showAll}
            style={{ background:weekIdx>=allWeeks.length-1||showAll?"#f0f0f0":C.ocean, border:"none", color:weekIdx>=allWeeks.length-1||showAll?"#bbb":"#fff", borderRadius:"50%", width:30, height:30, cursor:weekIdx>=allWeeks.length-1||showAll?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit", fontSize:16 }}>›</button>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={() => setShowAll(v => !v)} style={{ flex:1, background:showAll?C.ocean:"#f0f0f0", color:showAll?"#fff":"#888", border:"none", borderRadius:10, padding:"7px 4px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit" }}>
            {showAll ? "✓ Toute la saison" : "🗓️ Toute la saison"}
          </button>
          {[["tous","Tout"],["pending","⏳ Attente"],["confirmed","✅ Confirmés"]].map(([k,l]) => (
            <button key={k} onClick={() => setFilterStatut(k)} style={{ flex:1, background:filterStatut===k?C.ocean:"#f0f0f0", color:filterStatut===k?"#fff":"#888", border:"none", borderRadius:10, padding:"7px 4px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Cartes par membre — 2 colonnes desktop */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:12 }}>
      {membres.map(([mid, g]) => {
        const isOpen = openMembreIds[mid];
        const allR = [...g.nat, ...g.club];
        const hasPending = allR.some(r => r.statut === "pending");
        const nomMembre = g.membre ? `${g.membre.prenom} ${NOM(g.membre.nom)}` : "—";
        return (
          <div key={mid} style={{ background:"#fff", borderRadius:18, boxShadow:"0 3px 12px rgba(0,0,0,0.07)", overflow:"hidden", border: hasPending ? `2px solid ${C.sun}60` : "2px solid transparent" }}>
            <div onClick={() => toggleMembre(mid)} style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer" }}>
              <div style={{ width:42, height:42, borderRadius:14, background:`linear-gradient(135deg,${C.ocean},${C.sea})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>👤</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:900, color:C.dark, fontSize:14 }}>{nomMembre}</div>
                <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap" }}>
                  {g.nat.length > 0 && <span style={{ background:`${C.ocean}15`, color:C.ocean, borderRadius:50, padding:"1px 8px", fontSize:10, fontWeight:800 }}>🏊 {g.nat.length} nat.</span>}
                  {g.club.length > 0 && <span style={{ background:`${C.coral}15`, color:C.coral, borderRadius:50, padding:"1px 8px", fontSize:10, fontWeight:800 }}>🏖️ {g.club.length} club</span>}
                  {hasPending && <span style={{ background:`${C.sun}25`, color:"#b45309", borderRadius:50, padding:"1px 8px", fontSize:10, fontWeight:800 }}>⏳ En attente</span>}
                </div>
              </div>
              <div style={{ fontSize:18, color:"#ccc", transform: isOpen ? "rotate(90deg)" : "none", transition:"transform .15s" }}>›</div>
            </div>

            {isOpen && (
              <div style={{ borderTop:"1px solid #f0f0f0", padding:"10px 14px 14px", display:"flex", flexDirection:"column", gap:8 }}>
                {g.nat.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:900, color:C.ocean, textTransform:"uppercase", marginBottom:6 }}>🏊 Natation</div>
                    {g.nat.map(r => (
                      <div key={r.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:`${C.ocean}08`, borderRadius:10, padding:"7px 10px", marginBottom:4, borderLeft:`3px solid ${r.statut==="pending"?C.sun:C.ocean}` }}>
                        <div>
                          <span style={{ fontWeight:800, color:C.dark, fontSize:12 }}>{r.heure}</span>
                          <span style={{ color:"#aaa", fontSize:11, marginLeft:6 }}>{r.date_seance ? parseLocalDate(r.date_seance).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}) : "—"}</span>
                          {r.enfants?.length > 0 && <span style={{ color:C.ocean, fontSize:10, marginLeft:6, fontWeight:700 }}>{enrichEnfants(r.enfants, r.membres).join(", ")}</span>}
                          {r.created_at && <div style={{ fontSize:9, color:"#bbb", marginTop:2 }}>Envoyé le {new Date(r.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}</div>}
                        </div>
                        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          {r.statut === "pending" ? (
                            <button onClick={() => setModePaiementConfirm({ resa:r, type:"natation" })}
                              style={{ background:C.green, border:"none", color:"#fff", borderRadius:8, padding:"3px 8px", cursor:"pointer", fontWeight:900, fontSize:10, fontFamily:"inherit" }}>✅</button>
                          ) : (
                            <span style={{ fontSize:10, color:C.green, fontWeight:800, display:"flex", alignItems:"center", gap:3 }}>
                              ✓{r.mode_paiement && <span style={{ fontSize:9, color:"#aaa" }}>{MODES_PAIEMENT.find(m=>m.id===r.mode_paiement)?.label.split(" ")[0]}</span>}
                            </span>
                          )}
                          <button onClick={() => setModifierResa({ resa: r, type:"natation" })}
                            style={{ background:`${C.ocean}15`, border:"none", color:C.ocean, borderRadius:8, width:24, height:24, cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>✏️</button>
                          <button onClick={() => { if(window.confirm("Supprimer ?")) supprimerResaNatation(r.id); }}
                            style={{ background:"#FFF0F0", border:"none", color:C.sunset, borderRadius:8, width:24, height:24, cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>🗑</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {g.club.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, fontWeight:900, color:C.coral, textTransform:"uppercase", marginBottom:6 }}>🏖️ Club de Plage</div>
                    {g.club.map(r => {
                      const isLiberte = !isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6;
                      const isLib = (r.label_jour||"").startsWith("[LIBERTE]");
                      return (
                        <div key={r.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:`${C.coral}08`, borderRadius:10, padding:"7px 10px", marginBottom:4, borderLeft:`3px solid ${r.statut==="pending"?C.sun:C.coral}` }}>
                          <div>
                            <span style={{ fontWeight:800, color:C.dark, fontSize:12 }}>
                              {isLiberte ? `🎟️ Carte ${r.enfants[0]} demi-j.` : isLib ? "🎟️ Liberté" : r.session==="matin"?"☀️ Matin":"🌊 Après-midi"}
                            </span>
                            <span style={{ color:"#aaa", fontSize:11, marginLeft:6 }}>{r.date_reservation ? new Date(r.date_reservation).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}) : "—"}</span>
                            {r.enfants?.length > 0 && !isLiberte && <span style={{ color:C.coral, fontSize:10, marginLeft:6, fontWeight:700 }}>{enrichEnfants(r.enfants, r.membres).join(", ")}</span>}
                            {r.created_at && <div style={{ fontSize:9, color:"#bbb", marginTop:2 }}>Envoyé le {new Date(r.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}</div>}
                          </div>
                          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                            {r.statut === "pending" ? (
                              <button onClick={() => setModePaiementConfirm({ resa:r, type:"club" })}
                                style={{ background:C.green, border:"none", color:"#fff", borderRadius:8, padding:"3px 8px", cursor:"pointer", fontWeight:900, fontSize:10, fontFamily:"inherit" }}>✅</button>
                            ) : (
                              <span style={{ fontSize:10, color:C.green, fontWeight:800, display:"flex", alignItems:"center", gap:3 }}>
                                ✓{r.mode_paiement && <span style={{ fontSize:9, color:"#aaa" }}>{MODES_PAIEMENT.find(m=>m.id===r.mode_paiement)?.label.split(" ")[0]}</span>}
                              </span>
                            )}
                            <button onClick={() => setModifierResa({ resa: r, type:"club" })}
                              style={{ background:`${C.coral}15`, border:"none", color:C.coral, borderRadius:8, width:24, height:24, cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>✏️</button>
                            <button onClick={() => { if(window.confirm("Supprimer ?")) supprimerResaClub(r.id); }}
                              style={{ background:"#FFF0F0", border:"none", color:C.sunset, borderRadius:8, width:24, height:24, cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>🗑</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      </div>
    </>
  );
}

// ── ONGLET COMPTES FIN DE SAISON ─────────────────────────
// ── MODAL MODE DE PAIEMENT ───────────────────────────────
const MODES_PAIEMENT = [
  { id:"especes",          label:"💶 Espèces",           color:"#F59E0B" },
  { id:"cheque",           label:"✉️ Chèque",            color:"#3B82F6" },
  { id:"cheques_vacances", label:"🎫 Chèques vacances",  color:"#8B5CF6" },
  { id:"virement",         label:"🏦 Virement",          color:"#10B981" },
  { id:"offert",           label:"🎁 Offert",            color:"#EC4899" },
];

function ModePaiementModal({ onConfirm, onClose, titre }) {
  const [mode, setMode] = useState("");
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1200, display:"flex", alignItems:"center", justifyContent:"center", padding:"0 20px" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
      <div style={{ position:"relative", background:"#fff", borderRadius:24, padding:"24px 20px", width:"100%", maxWidth:380, boxShadow:"0 24px 64px rgba(0,0,0,0.3)" }}>
        <div style={{ fontWeight:900, color:C.dark, fontSize:16, marginBottom:4 }}>💳 Mode de paiement</div>
        <div style={{ fontSize:12, color:"#aaa", marginBottom:16 }}>{titre || "Choisissez le mode de règlement"}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:20 }}>
          {MODES_PAIEMENT.map(m => (
            <div key={m.id} onClick={() => setMode(m.id)}
              style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", borderRadius:14, cursor:"pointer", border:`2px solid ${mode===m.id ? m.color : "#e0e8f0"}`, background: mode===m.id ? `${m.color}12` : "#f8fbff", transition:"all .15s" }}>
              <div style={{ width:20, height:20, borderRadius:"50%", border:`3px solid ${mode===m.id ? m.color : "#ddd"}`, background: mode===m.id ? m.color : "transparent", flexShrink:0 }} />
              <span style={{ fontWeight:800, color: mode===m.id ? m.color : "#555", fontSize:14 }}>{m.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onClose} style={{ flex:1, background:"#f0f0f0", border:"none", color:"#888", borderRadius:12, padding:"11px", cursor:"pointer", fontWeight:800, fontFamily:"inherit" }}>Annuler</button>
          <button onClick={() => { if (!mode) { alert("Choisissez un mode de paiement."); return; } onConfirm(mode); }}
            style={{ flex:2, background: mode ? `linear-gradient(135deg,${C.green},#27AE60)` : "#ddd", border:"none", color:"#fff", borderRadius:12, padding:"11px", cursor: mode ? "pointer" : "not-allowed", fontWeight:900, fontFamily:"inherit", fontSize:14 }}>
            ✅ Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

function ComptesTab({ dbMembres, dbResas, dbResasClub, onRefresh }) {
  const [acomptes, setAcomptes]       = useState({});
  const [exclusions, setExclusions]   = useState({});
  const [showAcompte, setShowAcompte] = useState(null);
  const [acompteForm, setAcompteForm] = useState({ montant:"", date_paiement:"", label:"" });
  const [remises, setRemises]         = useState({});   // { membreId: montant }
  const [showRemise, setShowRemise]   = useState(null);
  const [remiseForm, setRemiseForm]   = useState("");
  const [loading, setLoading]         = useState(true);
  const [selectedMembre, setSelectedMembre] = useState(null);

  // Charger acomptes + exclusions
  useEffect(() => {
    const load = async () => {
      const [{ data: ac }, { data: ex }] = await Promise.all([
        sb.from("comptes_acomptes").select("*").order("date_paiement"),
        sb.from("comptes_exclusions").select("*"),
      ]);
      // Grouper acomptes par membre
      const acMap = {};
      (ac || []).forEach(a => { if (!acMap[a.membre_id]) acMap[a.membre_id] = []; acMap[a.membre_id].push(a); });
      setAcomptes(acMap);
      // Exclusions par resaId
      const exMap = {};
      (ex || []).forEach(e => { exMap[e.resa_id] = e.resa_type; });
      setExclusions(exMap);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, []);

  const PRIX_NAT = { 1:20,2:40,3:60,4:80,5:95,6:113,7:131,8:147,9:162,10:170 };
  const getPrixNat = n => n <= 10 ? (PRIX_NAT[n] || n*20) : 170+(n-10)*17;

  // Membres avec compte fin de saison
  const membresCompte = (dbMembres || []).filter(m => m.compte_fin_saison && !m.compte_solde);

  const getMontantResa = (r, type) => {
    if (type === "natation") return Number(r.montant || 20);
    const nb = Number(r.enfants?.[0]);
    const LP = {6:96,12:180,18:252,24:288,30:330};
    if (nb >= 6 && LP[nb]) return LP[nb];
    const match = (r.label_jour||"").match(/\[MONTANT:(\d+)\]/);
    return match ? Number(match[1]) : 0;
  };

  const getCompte = (membre) => {
    const resasNat  = dbResas.filter(r => r.membre_id === membre.id && r.statut === "confirmed" && !exclusions[r.id]);
    const resasClub = dbResasClub.filter(r => r.membre_id === membre.id && r.statut === "confirmed" && !exclusions[r.id]);

    // Natation : forfait par groupe enfant+minute
    const natGroups = {};
    resasNat.forEach(r => {
      const enfantsKey = Array.isArray(r.enfants) ? [...r.enfants].sort().join(",") : "";
      const minute = (r.created_at||"").slice(0,16);
      const k = `${enfantsKey}-${minute}`;
      if (!natGroups[k]) natGroups[k] = [];
      natGroups[k].push(r);
    });
    const PRIX_NAT = {1:20,2:40,3:60,4:80,5:95,6:113,7:131,8:147,9:162,10:170};
    const totalNat = Object.values(natGroups).reduce((s, g) => {
      const n = g.length;
      return s + (n <= 10 ? (PRIX_NAT[n] || n*20) : 170+(n-10)*17);
    }, 0);

    // Club : r.montant une seule fois par groupe session+enfants+minute
    const clubGroups = {};
    resasClub.forEach(r => {
      const enfantsKey = Array.isArray(r.enfants) ? [...r.enfants].sort().join(",") : "";
      const minute = (r.created_at||"").slice(0,16);
      const k = `${r.session}-${enfantsKey}-${minute}`;
      if (!clubGroups[k]) clubGroups[k] = [];
      clubGroups[k].push(r);
    });
    const LP = {6:96,12:180,18:252,24:288,30:330};
    const totalClub = Object.values(clubGroups).reduce((s, g) => {
      const r0 = g[0];
      const nb = Number(r0.enfants?.[0]);
      if (nb >= 6 && LP[nb]) return s + LP[nb];
      if (r0.montant) return s + Number(r0.montant);
      const match = (r0.label_jour||"").match(/\[MONTANT:(\d+)\]/);
      return s + (match ? Number(match[1]) : 0);
    }, 0);

    const totalPrestations = totalNat + totalClub;
    const totalAcomptes = (acomptes[membre.id] || []).reduce((s, a) => s + a.montant, 0);
    const remise = remises[membre.id] || 0;
    return { resasNat, resasClub, totalPrestations, totalAcomptes, remise, solde: Math.max(0, totalPrestations - totalAcomptes - remise) };
  };

  const toggleExclusion = async (resaId, resaType) => {
    if (exclusions[resaId]) {
      await sb.from("comptes_exclusions").delete().eq("resa_id", resaId);
      setExclusions(prev => { const n = {...prev}; delete n[resaId]; return n; });
    } else {
      await sb.from("comptes_exclusions").insert([{ resa_id: resaId, resa_type: resaType }]);
      setExclusions(prev => ({ ...prev, [resaId]: resaType }));
    }
  };

  const addAcompte = async (membreId) => {
    if (!acompteForm.montant || !acompteForm.date_paiement) { alert("Montant et date requis."); return; }
    try {
      const { data, error } = await sb.from("comptes_acomptes").insert([{
        membre_id: membreId,
        montant: Number(acompteForm.montant),
        date_paiement: acompteForm.date_paiement,
        label: acompteForm.label || "Acompte",
      }]).select().single();
      if (error) throw error;
      setAcomptes(prev => ({ ...prev, [membreId]: [...(prev[membreId]||[]), data] }));
      setAcompteForm({ montant:"", date_paiement:"", label:"" });
      setShowAcompte(null);
    } catch(e) { alert("Erreur : " + e.message); }
  };

  const deleteAcompte = async (membreId, acompteId) => {
    if (!window.confirm("Supprimer cet acompte ?")) return;
    await sb.from("comptes_acomptes").delete().eq("id", acompteId);
    setAcomptes(prev => ({ ...prev, [membreId]: (prev[membreId]||[]).filter(a => a.id !== acompteId) }));
  };

  const toggleCompte = async (membre) => {
    await sb.from("membres").update({ compte_fin_saison: !membre.compte_fin_saison }).eq("id", membre.id);
    onRefresh();
  };

  const genererFacture = (membre, compte) => {
    const remise = compte.remise || 0;
    const nomMembre = `${membre.prenom} ${(membre.nom||"").toUpperCase()}`;
    const lignesNat = compte.resasNat.map(r => `<tr><td>🏊 Natation · ${r.heure}</td><td>${r.date_seance ? parseLocalDate(r.date_seance).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "—"}</td><td style="text-align:right;font-weight:700">${getMontantResa(r,"natation")} €</td></tr>`).join("");
    const lignesClub = compte.resasClub.map(r => {
      const isLib = (r.label_jour||"").startsWith("[LIBERTE]");
      const label = isLib ? "🎟️ Liberté" : r.session==="matin" ? "🏖️ Club Matin" : "🏖️ Club Après-midi";
      return `<tr><td>${label}</td><td>${r.date_reservation ? parseLocalDate(r.date_reservation).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "—"}</td><td style="text-align:right;font-weight:700">${getMontantResa(r,"club")} €</td></tr>`;
    }).join("");
    const lignesAcomptes = (acomptes[membre.id]||[]).map(a => `<tr style="background:#E8F5E9"><td colspan="2">✅ ${a.label} — ${new Date(a.date_paiement).toLocaleDateString("fr-FR")}</td><td style="text-align:right;font-weight:700;color:#2e7d32">- ${a.montant} €</td></tr>`).join("");
    const ligneRemise = remise > 0 ? `<tr style="background:#FDF2F8"><td colspan="2">🎁 Remise</td><td style="text-align:right;font-weight:700;color:#EC4899">- ${remise} €</td></tr>` : "";
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture ${nomMembre}</title>
<style>body{font-family:Arial,sans-serif;color:#2C3E50;padding:30px;max-width:680px;margin:0 auto}
.header{background:linear-gradient(135deg,#1A8FE3,#4ECDC4);color:#fff;padding:20px 24px;border-radius:12px;margin-bottom:24px}
h1{margin:0 0 4px;font-size:20px}
.sub{font-size:12px;opacity:.85;margin:0}
table{width:100%;border-collapse:collapse;margin-bottom:8px}
th{background:#1A8FE3;color:#fff;padding:9px 12px;text-align:left;font-size:11px;text-transform:uppercase}
td{padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px}
.total-row td{font-weight:900;font-size:15px;background:#f0f4f8;border-top:2px solid #1A8FE3}
.solde{background:linear-gradient(135deg,#1A8FE3,#4ECDC4);color:#fff;padding:16px 20px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;margin-top:16px}
.tva{text-align:center;margin-top:12px;padding:8px;background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;font-size:11px;color:#666;font-style:italic}
.footer{margin-top:24px;text-align:center;font-size:11px;color:#888;line-height:1.8}
@media print{button{display:none}}</style></head><body>
<div class="header"><h1>🏖️ Eole Beach Club</h1><p class="sub">Club de Plage · École de Natation · Piriac-sur-Mer · Saison 2026 · SIRET : 839 887 072 00024</p></div>
<h2 style="margin:0 0 4px">Récapitulatif de compte</h2>
<p style="color:#888;font-size:13px;margin:0 0 20px">Client : <strong>${nomMembre}</strong> · ${membre.adresse||""} ${membre.cp||""} ${membre.ville||""}</p>
<table>
<thead><tr><th>Prestation</th><th>Date</th><th style="text-align:right">Montant</th></tr></thead>
<tbody>${lignesNat}${lignesClub}
<tr class="total-row"><td colspan="2">Sous-total prestations</td><td style="text-align:right">${compte.totalPrestations} €</td></tr>
${lignesAcomptes}${ligneRemise}
</tbody></table>
<div class="solde"><span style="font-size:15px;font-weight:700">SOLDE DÛ</span><span style="font-size:26px;font-weight:900">${compte.solde} €</span></div>
<div class="tva">TVA non applicable — article 293 B du CGI</div>
<div class="footer">
Eole Beach Club · SIRET 839 887 072 00024<br/>
Plage Saint-Michel · Rue des Caps Horniers · 44420 Piriac-sur-Mer<br/>
📞 07 67 78 69 22 · clubdeplage.piriacsurmer@hotmail.com<br/>
Document généré le ${new Date().toLocaleDateString("fr-FR")}
</div>
<div style="text-align:center;margin-top:20px"><button onclick="window.print()" style="background:#1A8FE3;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer;font-weight:700">🖨️ Imprimer / PDF</button></div>
</body></html>`;
    const win = window.open("","_blank");
    if (win) { win.document.write(html); win.document.close(); }
  };

  if (loading) return <div style={{ textAlign:"center", padding:40, color:"#bbb" }}>Chargement…</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* En-tête */}
      <div style={{ background:"#fff", borderRadius:16, padding:"14px 18px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
        <div style={{ fontWeight:900, color:C.dark, fontSize:15, marginBottom:4 }}>📒 Comptes fin de saison</div>
        <div style={{ fontSize:12, color:"#aaa" }}>Membres réglant en fin de saison — suivi des prestations et acomptes</div>
      </div>

      {/* Toggle membres non-compte pour les activer */}
      <div style={{ background:"#fff", borderRadius:16, padding:"14px 18px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
        <div style={{ fontWeight:800, color:C.dark, fontSize:13, marginBottom:10 }}>👥 Activer le compte fin de saison</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:8 }}>
          {(dbMembres||[]).map(m => (
            <div key={m.id} onClick={() => toggleCompte(m)} style={{ display:"flex", alignItems:"center", gap:8, background: m.compte_fin_saison ? `${C.ocean}15` : "#f8f8f8", border:`2px solid ${m.compte_fin_saison ? C.ocean : "#e0e0e0"}`, borderRadius:12, padding:"8px 12px", cursor:"pointer" }}>
              <div style={{ width:18, height:18, borderRadius:4, background: m.compte_fin_saison ? C.ocean : "#ddd", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                {m.compte_fin_saison && <span style={{ color:"#fff", fontSize:12, fontWeight:900 }}>✓</span>}
              </div>
              <span style={{ fontSize:12, fontWeight:700, color: m.compte_fin_saison ? C.ocean : "#555" }}>{m.prenom} {NOM(m.nom)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Comptes actifs */}
      {membresCompte.length === 0 ? (
        <div style={{ textAlign:"center", padding:"32px 0", color:"#bbb", fontSize:14 }}>
          Aucun membre en compte fin de saison — activez-en ci-dessus
        </div>
      ) : membresCompte.map(m => {
        const compte = getCompte(m);
        const isOpen = selectedMembre === m.id;
        return (
          <div key={m.id} style={{ background:"#fff", borderRadius:20, boxShadow:"0 4px 16px rgba(0,0,0,0.07)", overflow:"hidden", border: compte.solde > 0 ? `2px solid ${C.ocean}30` : `2px solid ${C.green}30` }}>
            {/* Header carte */}
            <div onClick={() => setSelectedMembre(isOpen ? null : m.id)} style={{ padding:"16px 18px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:46, height:46, borderRadius:14, background:`linear-gradient(135deg,${C.ocean},${C.sea})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>👤</div>
                <div>
                  <div style={{ fontWeight:900, color:C.dark, fontSize:15 }}>{m.prenom} {NOM(m.nom)}</div>
                  <div style={{ fontSize:11, color:"#aaa" }}>{m.email}</div>
                  <div style={{ display:"flex", gap:8, marginTop:4 }}>
                    <span style={{ background:`${C.ocean}15`, color:C.ocean, borderRadius:50, padding:"2px 10px", fontSize:11, fontWeight:800 }}>{compte.resasNat.length + compte.resasClub.length} préstation{compte.resasNat.length+compte.resasClub.length>1?"s":""}</span>
                    {compte.totalAcomptes > 0 && <span style={{ background:`${C.green}15`, color:C.green, borderRadius:50, padding:"2px 10px", fontSize:11, fontWeight:800 }}>✅ {compte.totalAcomptes} € versés</span>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontWeight:900, fontSize:22, color: compte.solde === 0 ? C.green : C.coral }}>{compte.solde} €</div>
                <div style={{ fontSize:10, color:"#aaa" }}>solde dû</div>
                <div style={{ fontSize:16, color:"#ccc", marginTop:4 }}>{isOpen ? "▲" : "▼"}</div>
              </div>
            </div>

            {/* Détail dépliable */}
            {isOpen && (
              <div style={{ borderTop:"1px solid #f0f0f0", padding:"16px 18px" }}>

                {/* Résas natation */}
                {compte.resasNat.length > 0 && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontWeight:800, color:C.ocean, fontSize:12, textTransform:"uppercase", marginBottom:8 }}>🏊 Natation</div>
                    {compte.resasNat.map(r => (
                      <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 10px", background: exclusions[r.id] ? "#f8f8f8" : `${C.ocean}06`, borderRadius:10, marginBottom:4, opacity: exclusions[r.id] ? 0.5 : 1 }}>
                        <div>
                          <span style={{ fontWeight:700, fontSize:13, color: exclusions[r.id] ? "#aaa" : C.dark }}>{r.heure}</span>
                          <span style={{ fontSize:11, color:"#aaa", marginLeft:8 }}>{r.date_seance ? parseLocalDate(r.date_seance).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "—"}</span>
                          {r.enfants?.length > 0 && <span style={{ fontSize:10, color:C.ocean, marginLeft:6 }}>{r.enfants.join(", ")}</span>}
                        </div>
                        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                          <span style={{ fontWeight:700, color: exclusions[r.id] ? "#aaa" : C.ocean, fontSize:13, textDecoration: exclusions[r.id] ? "line-through" : "none" }}>{getMontantResa(r,"natation")} €</span>
                          <button onClick={() => toggleExclusion(r.id, "natation")} title={exclusions[r.id] ? "Inclure" : "Exclure"}
                            style={{ background: exclusions[r.id] ? `${C.green}20` : "#fff0f0", border:"none", borderRadius:6, padding:"3px 8px", cursor:"pointer", fontSize:11, fontWeight:700, color: exclusions[r.id] ? C.green : C.sunset, fontFamily:"inherit" }}>
                            {exclusions[r.id] ? "↩ Inclure" : "✕ Exclure"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Résas club — groupées pour afficher le bon montant */}
                {compte.resasClub.length > 0 && (
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontWeight:800, color:C.coral, fontSize:12, textTransform:"uppercase", marginBottom:8 }}>🏖️ Club de Plage</div>
                    {(() => {
                      // Grouper par session+enfants+minute pour montant correct
                      const groups = {};
                      compte.resasClub.forEach(r => {
                        const enfantsKey = Array.isArray(r.enfants) ? [...r.enfants].sort().join(",") : "";
                        const minute = (r.created_at||"").slice(0,16);
                        const k = `${r.session}-${enfantsKey}-${minute}`;
                        if (!groups[k]) groups[k] = [];
                        groups[k].push(r);
                      });
                      const LP = {6:96,12:180,18:252,24:288,30:330};
                      return Object.values(groups).map((g, gi) => {
                        const r0 = g[0];
                        const isLib = (r0.label_jour||"").startsWith("[LIBERTE]");
                        const label = isLib ? "🎟️ Liberté" : r0.session==="matin" ? "☀️ Matin" : "🌊 Après-midi";
                        // Montant du groupe
                        const nb = Number(r0.enfants?.[0]);
                        let montant = 0;
                        if (nb >= 6 && LP[nb]) montant = LP[nb];
                        else if (r0.montant) montant = Number(r0.montant);
                        else { const m2=(r0.label_jour||"").match(/\[MONTANT:(\d+)\]/); montant=m2?Number(m2[1]):0; }
                        const allExcluded = g.every(r => exclusions[r.id]);
                        const someExcluded = g.some(r => exclusions[r.id]);
                        const dateLabel = g.length > 1
                          ? `${g.length} jour${g.length>1?"s":""}`
                          : (r0.date_reservation ? new Date(r0.date_reservation).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "—");
                        return (
                          <div key={gi} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 10px", background: allExcluded ? "#f8f8f8" : `${C.coral}06`, borderRadius:10, marginBottom:4, opacity: allExcluded ? 0.5 : 1 }}>
                            <div>
                              <span style={{ fontWeight:700, fontSize:13, color: allExcluded ? "#aaa" : C.dark }}>{label}</span>
                              <span style={{ fontSize:11, color:"#aaa", marginLeft:8 }}>{dateLabel}</span>
                            </div>
                            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                              <span style={{ fontWeight:700, color: allExcluded ? "#aaa" : C.coral, fontSize:13, textDecoration: allExcluded ? "line-through" : "none" }}>{montant} €</span>
                              <button onClick={() => g.forEach(r => toggleExclusion(r.id, "club"))} title={allExcluded ? "Inclure" : "Exclure"}
                                style={{ background: allExcluded ? `${C.green}20` : "#fff0f0", border:"none", borderRadius:6, padding:"3px 8px", cursor:"pointer", fontSize:11, fontWeight:700, color: allExcluded ? C.green : C.sunset, fontFamily:"inherit" }}>
                                {allExcluded ? "↩ Inclure" : "✕ Exclure"}
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Acomptes */}
                <div style={{ marginBottom:16 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div style={{ fontWeight:800, color:C.green, fontSize:12, textTransform:"uppercase" }}>💳 Acomptes versés</div>
                    <button onClick={() => setShowAcompte(showAcompte === m.id ? null : m.id)}
                      style={{ background:`${C.green}15`, border:"none", color:C.green, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit" }}>
                      ➕ Ajouter
                    </button>
                  </div>
                  {(acomptes[m.id]||[]).map(a => (
                    <div key={a.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 10px", background:`${C.green}08`, borderRadius:10, marginBottom:4 }}>
                      <div>
                        <span style={{ fontWeight:700, fontSize:13, color:C.dark }}>{a.label}</span>
                        <span style={{ fontSize:11, color:"#aaa", marginLeft:8 }}>{new Date(a.date_paiement).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}</span>
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontWeight:700, color:C.green, fontSize:13 }}>- {a.montant} €</span>
                        <button onClick={() => deleteAcompte(m.id, a.id)}
                          style={{ background:"#fff0f0", border:"none", color:C.sunset, borderRadius:6, width:24, height:24, cursor:"pointer", fontSize:13, fontFamily:"inherit" }}>🗑</button>
                      </div>
                    </div>
                  ))}
                  {(acomptes[m.id]||[]).length === 0 && <div style={{ fontSize:12, color:"#bbb", fontStyle:"italic" }}>Aucun acompte enregistré</div>}

                  {/* Formulaire acompte */}
                  {showAcompte === m.id && (
                    <div style={{ background:`${C.green}08`, border:`2px solid ${C.green}30`, borderRadius:12, padding:"12px 14px", marginTop:10 }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                        <div>
                          <label style={{ fontSize:11, fontWeight:800, color:C.green, display:"block", marginBottom:4 }}>Montant (€) *</label>
                          <input type="number" value={acompteForm.montant} onChange={e => setAcompteForm(p => ({...p, montant:e.target.value}))}
                            style={{ width:"100%", border:`2px solid ${C.green}40`, borderRadius:8, padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} placeholder="Ex: 100" />
                        </div>
                        <div>
                          <label style={{ fontSize:11, fontWeight:800, color:C.green, display:"block", marginBottom:4 }}>Date *</label>
                          <input type="date" value={acompteForm.date_paiement} onChange={e => setAcompteForm(p => ({...p, date_paiement:e.target.value}))}
                            style={{ width:"100%", border:`2px solid ${C.green}40`, borderRadius:8, padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
                        </div>
                      </div>
                      <div style={{ marginBottom:8 }}>
                        <label style={{ fontSize:11, fontWeight:800, color:C.green, display:"block", marginBottom:4 }}>Libellé</label>
                        <input value={acompteForm.label} onChange={e => setAcompteForm(p => ({...p, label:e.target.value}))}
                          style={{ width:"100%", border:`2px solid ${C.green}40`, borderRadius:8, padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} placeholder="Ex: Acompte chèque" />
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={() => setShowAcompte(null)} style={{ flex:1, background:"#f0f0f0", border:"none", color:"#888", borderRadius:8, padding:"8px", cursor:"pointer", fontWeight:700, fontFamily:"inherit" }}>Annuler</button>
                        <button onClick={() => addAcompte(m.id)} style={{ flex:2, background:`linear-gradient(135deg,${C.green},#27AE60)`, border:"none", color:"#fff", borderRadius:8, padding:"8px", cursor:"pointer", fontWeight:900, fontFamily:"inherit" }}>✅ Enregistrer</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Récap total */}
                <div style={{ background:`${C.ocean}08`, borderRadius:14, padding:"14px 16px", display:"grid", gridTemplateColumns:`1fr 1fr${compte.remise > 0 ? " 1fr" : ""} 1fr`, gap:8, marginBottom:14 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontWeight:900, fontSize:18, color:C.ocean }}>{compte.totalPrestations} €</div>
                    <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase" }}>Prestations</div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontWeight:900, fontSize:18, color:C.green }}>- {compte.totalAcomptes} €</div>
                    <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase" }}>Acomptes</div>
                  </div>
                  {compte.remise > 0 && (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontWeight:900, fontSize:18, color:"#EC4899" }}>- {compte.remise} €</div>
                      <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase" }}>Remise</div>
                    </div>
                  )}
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontWeight:900, fontSize:22, color: compte.solde === 0 ? C.green : C.coral }}>{compte.solde} €</div>
                    <div style={{ fontSize:10, color:"#aaa", textTransform:"uppercase" }}>Solde dû</div>
                  </div>
                </div>

                {/* Remise */}
                {showRemise === m.id ? (
                  <div style={{ background:"#FDF2F8", border:"2px solid #EC4899", borderRadius:12, padding:"12px 14px", marginBottom:10 }}>
                    <div style={{ fontWeight:800, color:"#EC4899", fontSize:12, marginBottom:8 }}>🎁 Remise supplémentaire</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <input type="number" value={remiseForm} onChange={e => setRemiseForm(e.target.value)} placeholder="Montant €"
                        style={{ flex:1, border:"2px solid #EC489960", borderRadius:8, padding:"8px 10px", fontSize:13, fontFamily:"inherit", outline:"none" }} />
                      <button onClick={() => {
                        if (!remiseForm) return;
                        setRemises(prev => ({ ...prev, [m.id]: Number(remiseForm) }));
                        setShowRemise(null); setRemiseForm("");
                      }} style={{ background:"#EC4899", border:"none", color:"#fff", borderRadius:8, padding:"8px 14px", cursor:"pointer", fontWeight:900, fontFamily:"inherit" }}>OK</button>
                      <button onClick={() => { setShowRemise(null); setRemiseForm(""); }}
                        style={{ background:"#f0f0f0", border:"none", color:"#888", borderRadius:8, padding:"8px 12px", cursor:"pointer", fontWeight:800, fontFamily:"inherit" }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setShowRemise(m.id); setRemiseForm(String(compte.remise || "")); }}
                    style={{ width:"100%", background:"#FDF2F8", border:"2px dashed #EC489960", color:"#EC4899", borderRadius:12, padding:"8px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit", marginBottom:10 }}>
                    🎁 {compte.remise > 0 ? `Remise : - ${compte.remise} €  (modifier)` : "Ajouter une remise"}
                  </button>
                )}

                {/* Actions */}
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => genererFacture(m, compte)} style={{ flex:1, background:`linear-gradient(135deg,${C.ocean},${C.sea})`, border:"none", color:"#fff", borderRadius:12, padding:"11px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>
                    🖨️ Générer la facture
                  </button>
                  {compte.solde === 0 ? (
                    <button onClick={async () => {
                      if (!window.confirm(`Marquer le compte de ${m.prenom} ${m.nom} comme soldé ?`)) return;
                      await sb.from("membres").update({ compte_solde: true }).eq("id", m.id);
                      onRefresh();
                    }} style={{ flex:1, background:`linear-gradient(135deg,${C.green},#27AE60)`, border:"none", color:"#fff", borderRadius:12, padding:"11px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>
                      ✅ Marquer soldé
                    </button>
                  ) : (
                    <button onClick={() => {
                      setAcompteForm({ montant: String(compte.solde), date_paiement: new Date().toISOString().slice(0,10), label: "Solde final" });
                      setShowAcompte(m.id);
                    }} style={{ flex:1, background:`linear-gradient(135deg,${C.green},#27AE60)`, border:"none", color:"#fff", borderRadius:12, padding:"11px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>
                      💶 Solder le compte
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ONGLET FACTURES ──────────────────────────────────────
// ── ONGLET FACTURES ──────────────────────────────────────
function FacturesTab({ dbMembres, dbResas, dbResasClub }) {
  const [selectedIds, setSelectedIds]   = useState(new Set());
  const [acomptes, setAcomptes]         = useState({});
  const [factures, setFactures]         = useState({});
  const [search, setSearch]             = useState("");
  const [loading, setLoading]           = useState(true);
  const [generating, setGenerating]     = useState(null);
  const [sendingMail, setSendingMail]   = useState(null);
  const [enfantsSelectionnes, setEnfantsSelectionnes] = useState({}); // { membreId: Set(prenom) }

  const PRIX_NAT = {1:20,2:40,3:60,4:80,5:95,6:113,7:131,8:147,9:162,10:170};
  const getPrixNat = n => n<=10?(PRIX_NAT[n]||n*20):170+(n-10)*17;

  useEffect(() => {
    const load = async () => {
      const [{ data: ac }, { data: fn }] = await Promise.all([
        sb.from("comptes_acomptes").select("*").order("date_paiement"),
        sb.from("factures_numeros").select("*"),
      ]);
      const acMap = {};
      (ac||[]).forEach(a => { if (!acMap[a.membre_id]) acMap[a.membre_id] = []; acMap[a.membre_id].push(a); });
      setAcomptes(acMap);
      const fnMap = {};
      (fn||[]).forEach(f => { fnMap[f.membre_id] = f; });
      setFactures(fnMap);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
  }, []);

  const getMontantResa = (r, type) => {
    if (type === "natation") return Number(r.montant || 20);
    const nb = Number(r.enfants?.[0]);
    const LP = {6:96,12:180,18:252,24:288,30:330};
    if (nb >= 6 && LP[nb]) return LP[nb];
    const match = (r.label_jour||"").match(/\[MONTANT:(\d+)\]/);
    return match ? Number(match[1]) : 0;
  };

  // Membres avec au moins une résa confirmée
  const membresAvecResas = (dbMembres||[]).filter(m => {
    const hasNat  = (dbResas||[]).some(r => r.membre_id === m.id && r.statut === "confirmed");
    const hasClub = (dbResasClub||[]).some(r => r.membre_id === m.id && r.statut === "confirmed" && !(Number(r.enfants?.[0]) >= 6 && !isNaN(Number(r.enfants?.[0]))));
    return hasNat || hasClub;
  });

  const filtered = search
    ? membresAvecResas.filter(m => `${m.prenom} ${m.nom}`.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase()))
    : membresAvecResas;

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // Regrouper résas natation par forfait
  const grouperNatation = (resasNat, enfantsFilter = null) => {
    if (resasNat.length === 0) return [];

    // Grouper par enfant pour calculer le bon forfait par enfant
    const parEnfant = {};
    resasNat.forEach(r => {
      const enfs = Array.isArray(r.enfants) && r.enfants.length > 0 ? r.enfants : ["—"];
      enfs.forEach(prenom => {
        if (!parEnfant[prenom]) parEnfant[prenom] = [];
        parEnfant[prenom].push(r);
      });
    });

    // Si plusieurs enfants, forfait par enfant
    const enfantsList = Object.keys(parEnfant);
    if (enfantsList.length > 1) {
      return enfantsList.map(prenom => {
        const n = parEnfant[prenom].length;
        const prix = getPrixNat(n);
        return {
          label: `🏊 École de Natation — Forfait ${n} leçon${n>1?"s":""} (${prenom})`,
          montant: prix,
          detail: `${n} séance${n>1?"s":""} · ${prenom}`
        };
      });
    }

    // Un seul enfant ou résas sans distinction
    const total = resasNat.length;
    const prix = getPrixNat(total);
    const nomsEnfants = enfantsList[0] !== "—" ? enfantsList[0] : "";
    return [{ label: `🏊 École de Natation — Forfait ${total} leçon${total>1?"s":""}`, montant: prix, detail: `${total} séance${total>1?"s":""}${nomsEnfants?" · "+nomsEnfants:""}` }];
  };

  // Regrouper résas club par session et par enfant
  const grouperClub = (resasClub, enfantsFilter = null) => {
    if (resasClub.length === 0) return [];

    // Grouper par enfant + session
    const parEnfantSession = {};
    resasClub.forEach(r => {
      const enfs = Array.isArray(r.enfants) && r.enfants.length > 0 ? r.enfants : ["—"];
      const session = r.session || "matin";
      enfs.forEach(prenom => {
        const k = `${prenom}__${session}`;
        if (!parEnfantSession[k]) parEnfantSession[k] = { prenom, session, resas: [] };
        parEnfantSession[k].resas.push(r);
      });
    });

    const groupes = [];
    Object.values(parEnfantSession).forEach(({ prenom, session, resas }) => {
      // Prendre r.montant de la première résa (= total du groupe stocké à la validation)
      // Si pas de montant stocké, lire [MONTANT:XX] sur la première résa seulement
      let montant = 0;
      const r0 = resas[0];
      if (r0.montant) {
        montant = Number(r0.montant);
      } else {
        const match = (r0.label_jour||"").match(/\[MONTANT:(\d+)\]/);
        montant = match ? Number(match[1]) : 0;
      }
      const sessionLabel = session === "matin" ? "☀️ Club de Plage — Matin" : "🌊 Club de Plage — Après-midi";
      const enfantLabel = prenom !== "—" ? ` (${prenom})` : "";
      groupes.push({
        label: `${sessionLabel}${enfantLabel}`,
        montant,
        detail: `${resas.length} jour${resas.length>1?"s":""}${prenom!=="—"?" · "+prenom:""}`
      });
    });
    return groupes;
  };

  const buildFactureHtml = (membre, numFac, dateEmission, modePaiement = null, remise = 0, enfantsFilter = null) => {
    // Filtrer les résas selon les enfants sélectionnés
    const filterByEnfants = (resas) => {
      if (!enfantsFilter || enfantsFilter.size === 0) return resas;
      return resas.filter(r => {
        const enfs = Array.isArray(r.enfants) ? r.enfants : [];
        // Garder si au moins un enfant de la résa est dans la sélection
        return enfs.some(e => enfantsFilter.has(e));
      });
    };

    const resasNatAll  = (dbResas||[]).filter(r => r.membre_id === membre.id && r.statut === "confirmed");
    const resasClubAll = (dbResasClub||[]).filter(r => r.membre_id === membre.id && r.statut === "confirmed" && !(Number(r.enfants?.[0]) >= 6 && !isNaN(Number(r.enfants?.[0]))));

    const resasNat  = filterByEnfants(resasNatAll);
    const resasClub = filterByEnfants(resasClubAll);
    const acMembre  = acomptes[membre.id] || [];

    const groupesNat  = grouperNatation(resasNat, enfantsFilter);
    const groupesClub = grouperClub(resasClub, enfantsFilter);
    const toutesLignes = [...groupesNat, ...groupesClub];

    const totalPrestations = toutesLignes.reduce((s,l)=>s+l.montant, 0);
    const totalAcomptes    = acMembre.reduce((s,a)=>s+a.montant, 0);
    const solde            = Math.max(0, totalPrestations - totalAcomptes - remise);

    // Résoudre le mode paiement en texte/couleur AVANT le template
    const mpObj = modePaiement ? MODES_PAIEMENT.find(m => m.id === modePaiement) : null;
    const mpLabel = mpObj ? mpObj.label : "";
    const mpColor = mpObj ? mpObj.color : "#888";
    const mpHtml = mpObj ? `<div style="text-align:center;margin-bottom:8px"><span style="background:${mpColor}22;color:${mpColor};border-radius:50px;padding:5px 16px;font-size:13px;font-weight:800">${mpLabel}</span></div>` : "";

    const adresse = [membre.adresse, `${membre.cp||""} ${membre.ville||""}`].filter(Boolean).join("<br/>");

    // Enfants avec date de naissance
    const enfantsFiltres = enfantsFilter && enfantsFilter.size > 0
      ? (membre.enfants||[]).filter(e => enfantsFilter.has(e.prenom))
      : (membre.enfants||[]);
    const enfantsHtml = enfantsFiltres.map(e => {
      let ddn = "—";
      if (e.naissance) {
        const parts = e.naissance.slice(0,10).split("-");
        ddn = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return `<tr><td>${e.sexe==="M"?"👦":"👧"} ${e.prenom} ${(e.nom||"").toUpperCase()}</td><td style="text-align:center">${ddn}</td></tr>`;
    }).join("");

    const lignesPrestations = toutesLignes.map(l =>
      `<tr><td><strong>${l.label}</strong><br/><span style="font-size:11px;color:#888">${l.detail}</span></td><td style="text-align:right;font-weight:700;font-size:15px">${l.montant} €</td></tr>`
    ).join("");

    const lignesAcomptes = acMembre.map(a =>
      `<tr style="background:#f0fdf4"><td style="color:#16a34a">✅ ${a.label} — ${new Date(a.date_paiement).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</td><td style="text-align:right;font-weight:700;color:#16a34a">- ${a.montant} €</td></tr>`
    ).join("");

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Facture ${numFac}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#1a1a1a;background:#fff;padding:40px;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #1A8FE3}
.club h1{font-size:20px;color:#1A8FE3;margin-bottom:6px}
.club p{font-size:11px;color:#555;line-height:1.8}
.fac-num{font-size:22px;font-weight:900;color:#1A8FE3;text-align:right}
.fac-date{font-size:11px;color:#888;text-align:right;margin-top:4px}
.client-box{background:#f8faff;border:1.5px solid #dbe8ff;border-radius:8px;padding:16px 20px;margin-bottom:20px}
.client-box h3{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;margin-bottom:8px}
.client-box .name{font-size:16px;font-weight:900;margin-bottom:4px}
.client-box .info{font-size:12px;color:#555;line-height:1.8}
.section-title{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:0.5px;margin:16px 0 8px;font-weight:700}
table{width:100%;border-collapse:collapse;margin-bottom:4px}
th{background:#1A8FE3;color:#fff;padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
th:last-child{text-align:right}
td{padding:10px 12px;border-bottom:1px solid #f0f0f0}
tr:nth-child(even) td{background:#fafbff}
.subtotal td{font-weight:700;background:#f0f4f8!important;border-top:2px solid #ddd}
.total-box{background:linear-gradient(135deg,#1A8FE3,#4ECDC4);color:#fff;border-radius:10px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin:16px 0}
.total-box .label{font-size:14px;font-weight:700}
.total-box .amount{font-size:28px;font-weight:900}
.tva{text-align:center;margin-top:16px;padding:10px;background:#fafafa;border:1px solid #e0e0e0;border-radius:6px;font-size:11px;color:#666;font-style:italic}
.footer{margin-top:24px;padding-top:16px;border-top:1px solid #e0e0e0;text-align:center;font-size:10px;color:#888;line-height:1.8}
.btn{display:inline-block;padding:11px 24px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:700;border:none;margin:4px}
@media print{.no-print{display:none!important}body{padding:20px}}
</style></head><body>

<div class="header">
  <div class="club">
    <h1>🏖️ Eole Beach Club</h1>
    <p>Club de Plage · École de Natation<br/>
    Plage Saint-Michel · Rue des Caps Horniers · 44420 Piriac-sur-Mer<br/>
    📞 07 67 78 69 22 · clubdeplage.piriacsurmer@hotmail.com<br/>
    SIRET : 839 887 072 00024</p>
  </div>
  <div>
    <div class="fac-num">${numFac}</div>
    <div class="fac-date">Émise le ${dateEmission}</div>
  </div>
</div>

<div class="client-box">
  <h3>Facture établie pour</h3>
  <div class="name">${membre.prenom} ${(membre.nom||"").toUpperCase()}</div>
  <div class="info">${adresse}${membre.email?"<br/>"+membre.email:""}${membre.tel?"<br/>📞 "+membre.tel:""}</div>
</div>

${enfantsFiltres.length > 0 ? `
<div class="section-title">Enfant(s) inscrit(s)</div>
<table>
  <thead><tr><th>Nom</th><th style="text-align:center">Date de naissance</th></tr></thead>
  <tbody>${enfantsHtml}</tbody>
</table>` : ""}

<div class="section-title">Détail des prestations — Saison 2026</div>
<table>
  <thead><tr><th>Prestation</th><th style="text-align:right">Montant</th></tr></thead>
  <tbody>
    ${lignesPrestations}
    <tr class="subtotal"><td>Sous-total prestations</td><td style="text-align:right">${totalPrestations} €</td></tr>
    ${lignesAcomptes}
  </tbody>
</table>

<div class="total-box">
  <span class="label">MONTANT PAYÉ</span>
  <span class="amount">${solde} €</span>
</div>
${remise > 0 ? `<div style="text-align:center;margin-bottom:8px;color:#EC4899;font-size:12px;font-weight:700">🎁 Remise appliquée : - ${remise} €</div>` : ""}
${mpHtml}

<div class="tva">TVA non applicable — article 293 B du CGI</div>

<div class="no-print" style="text-align:center;margin-top:20px">
  <button class="btn" onclick="window.print()" style="background:#1A8FE3;color:#fff">🖨️ Imprimer / Sauvegarder PDF</button>
  <button class="btn" onclick="window.close()" style="background:#f0f0f0;color:#555">✕ Fermer</button>
</div>

<div class="footer">
  Eole Beach Club · SIRET 839 887 072 00024<br/>
  Plage Saint-Michel · Rue des Caps Horniers · 44420 Piriac-sur-Mer<br/>
  clubdeplage.piriacsurmer@hotmail.com · www.clubdeplage-piriacsurmer.fr
</div>
</body></html>`;
  };

  const genererFacture = async (membre) => {
    setGenerating(membre.id);
    try {
      const selEnfants = enfantsSelectionnes[membre.id] || new Set((membre.enfants||[]).map(e => e.prenom));
      const filterByEnfants = (resas) => {
        if (!selEnfants || selEnfants.size === 0) return resas;
        return resas.filter(r => {
          const enfs = Array.isArray(r.enfants) ? r.enfants : [];
          return enfs.some(e => selEnfants.has(e));
        });
      };
      const resasNatAll  = (dbResas||[]).filter(r => r.membre_id === membre.id && r.statut === "confirmed");
      const resasClubAll = (dbResasClub||[]).filter(r => r.membre_id === membre.id && r.statut === "confirmed" && !(Number(r.enfants?.[0]) >= 6 && !isNaN(Number(r.enfants?.[0]))));
      const resasNat  = filterByEnfants(resasNatAll);
      const resasClub = filterByEnfants(resasClubAll);
      const acMembre  = acomptes[membre.id] || [];
      const groupesNat  = grouperNatation(resasNat, selEnfants);
      const groupesClub = grouperClub(resasClub, selEnfants);
      const total = [...groupesNat,...groupesClub].reduce((s,l)=>s+l.montant,0);
      const totalAc = acMembre.reduce((s,a)=>s+a.montant,0);
      const solde = total - totalAc;

      // Détecter le mode de paiement (premier trouvé parmi les résas confirmées)
      const modePaiement = [...resasNat,...resasClub].find(r => r.mode_paiement)?.mode_paiement || null;

      // Numéro de facture
      let numFac;
      const existing = factures[membre.id];
      if (existing) {
        numFac = existing.numero;
        // Mettre à jour le contenu si nécessaire
        await sb.from("factures_numeros").update({ total, solde, contenu:{ groupesNat, groupesClub, acomptes:acMembre } }).eq("id", existing.id);
      } else {
        const count = Object.keys(factures).length + 1;
        numFac = `FAC-2026-${String(count).padStart(3,"0")}`;
        const dateEmission = new Date().toISOString().slice(0,10);
        const contenu = { groupesNat, groupesClub, acomptes: acMembre };
        const { data } = await sb.from("factures_numeros").insert([{
          membre_id: membre.id, numero: numFac,
          date_emission: dateEmission, total, solde, contenu
        }]).select().single();
        if (data) setFactures(prev => ({ ...prev, [membre.id]: data }));
      }

      const dateEmission = existing
        ? (() => { const p=existing.date_emission.slice(0,10).split("-"); return `${p[2]}/${p[1]}/${p[0]}`; })()
        : new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});

      const html = buildFactureHtml(membre, numFac, dateEmission, modePaiement, 0, enfantsSelectionnes[membre.id]);
      const win = window.open("","_blank");
      if (win) { win.document.write(html); win.document.close(); }
    } catch(e) { alert("Erreur : " + e.message); }
    setGenerating(null);
  };

  const envoyerParMail = async (membre) => {
    setSendingMail(membre.id);
    try {
      const resasNat  = (dbResas||[]).filter(r => r.membre_id === membre.id && r.statut === "confirmed");
      const resasClub = (dbResasClub||[]).filter(r => r.membre_id === membre.id && r.statut === "confirmed" && !(Number(r.enfants?.[0]) >= 6 && !isNaN(Number(r.enfants?.[0]))));
      const acMembre  = acomptes[membre.id] || [];
      const modePaiement = [...resasNat,...resasClub].find(r => r.mode_paiement)?.mode_paiement || null;
      const fac = factures[membre.id];
      const numFac = fac?.numero || "FAC-2026-000";
      const dateEmission = fac
        ? (() => { const p=fac.date_emission.slice(0,10).split("-"); return `${p[2]}/${p[1]}/${p[0]}`; })()
        : new Date().toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});
      const factureHtml = buildFactureHtml(membre, numFac, dateEmission, modePaiement, 0, enfantsSelectionnes[membre.id]);
      const mpLabel = modePaiement ? (MODES_PAIEMENT.find(m=>m.id===modePaiement)?.label||modePaiement) : "";

      const emailHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f8;padding:20px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
  <tr><td style="background-color:#1A8FE3;padding:24px 28px">
    <p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#ffffff">🏖️ Eole Beach Club</p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85)">Club de Plage · École de Natation · Piriac-sur-Mer · Saison 2026 · SIRET 839 887 072 00024</p>
  </td></tr>
  <tr><td style="padding:24px 28px">
    <p style="font-size:14px;color:#2C3E50;line-height:1.7;margin:0 0 16px">Bonjour <strong>${membre.prenom}</strong>,</p>
    <p style="font-size:14px;color:#2C3E50;line-height:1.7;margin:0 0 16px">Veuillez trouver ci-joint votre facture <strong>${numFac}</strong> pour la saison 2026.</p>
    ${mpLabel ? `<p style="font-size:14px;color:#2C3E50;margin:0 0 16px">Mode de règlement : <strong>${mpLabel}</strong></p>` : ""}
    <p style="font-size:13px;color:#555;line-height:1.8;margin:0 0 20px">Pour toute question :<br/>📞 07 67 78 69 22<br/>✉️ clubdeplage.piriacsurmer@hotmail.com</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="background:#F0F4F8;border-radius:10px;padding:14px;text-align:center;font-size:11px;color:#888;line-height:1.8">
        <strong>Eole Beach Club · Club de Plage / École de Natation</strong><br/>
        Plage Saint-Michel · Rue des Caps Horniers · 44420 Piriac-sur-Mer<br/>
        SIRET 839 887 072 00024
      </td></tr>
    </table>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

      const resp = await fetch("https://rnaosrftcntomehaepjh.supabase.co/functions/v1/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer sb_publishable_n9m3QjIKt9OnyN_d8n9cAQ_VQpUpnOu" },
        body: JSON.stringify({
          type: "facture",
          to: membre.email,
          toName: `${membre.prenom} ${membre.nom || ""}`.trim(),
          subject: `Facture ${numFac} — Eole Beach Club Saison 2026`,
          htmlContent: emailHtml,
          attachments: {
            factureHtml,
            factureNom: `${numFac}-Eole-Beach-Club.html`,
          },
        }),
      });
      const result = await resp.json();
      if (result.success) {
        alert(`✅ Facture envoyée à ${membre.email}`);
      } else {
        throw new Error(result.error || "Erreur d'envoi");
      }
    } catch(e) { alert("Erreur : " + e.message); }
    setSendingMail(null);
  };

  if (loading) return <div style={{ textAlign:"center", padding:40, color:"#bbb" }}>Chargement…</div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      <div style={{ background:"#fff", borderRadius:16, padding:"16px 18px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontWeight:900, color:C.dark, fontSize:15, marginBottom:2 }}>🧾 Génération de factures</div>
          <div style={{ fontSize:12, color:"#aaa" }}>Numérotation automatique FAC-2026-XXX · Factures mémorisées en base</div>
        </div>
        <div style={{ background:`${C.ocean}15`, color:C.ocean, borderRadius:50, padding:"4px 14px", fontWeight:900, fontSize:13 }}>
          {selectedIds.size} sélectionné{selectedIds.size>1?"s":""}
        </div>
      </div>

      <div style={{ position:"relative" }}>
        <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", fontSize:16 }}>🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un membre…"
          style={{ width:"100%", border:"2px solid #e0e8f0", borderRadius:14, padding:"11px 14px 11px 40px", fontSize:14, fontFamily:"inherit", outline:"none", background:"#fff", boxSizing:"border-box" }} />
      </div>

      <div style={{ display:"flex", gap:8 }}>
        <button onClick={() => setSelectedIds(new Set(filtered.map(m => m.id)))}
          style={{ flex:1, background:`${C.ocean}12`, border:`1.5px solid ${C.ocean}30`, color:C.ocean, borderRadius:10, padding:"8px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>
          ✅ Tout sélectionner
        </button>
        <button onClick={() => setSelectedIds(new Set())}
          style={{ flex:1, background:"#f5f5f5", border:"1.5px solid #e0e0e0", color:"#888", borderRadius:10, padding:"8px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>
          ✕ Tout désélectionner
        </button>
        {selectedIds.size > 0 && (
          <button onClick={async () => { for (const id of selectedIds) { const m = filtered.find(x => x.id === id); if (m) await genererFacture(m); } }}
            style={{ flex:2, background:`linear-gradient(135deg,${C.ocean},${C.sea})`, border:"none", color:"#fff", borderRadius:10, padding:"8px", cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit" }}>
            🧾 Générer {selectedIds.size} facture{selectedIds.size>1?"s":""}
          </button>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(340px, 1fr))", gap:10 }}>
        {filtered.map(m => {
          const resasNat  = (dbResas||[]).filter(r => r.membre_id === m.id && r.statut === "confirmed");
          const resasClub = (dbResasClub||[]).filter(r => r.membre_id === m.id && r.statut === "confirmed" && !(Number(r.enfants?.[0]) >= 6 && !isNaN(Number(r.enfants?.[0]))));
          const gNat  = grouperNatation(resasNat);
          const gClub = grouperClub(resasClub);
          const total = [...gNat,...gClub].reduce((s,l)=>s+l.montant,0);
          const totalAc = (acomptes[m.id]||[]).reduce((s,a)=>s+a.montant,0);
          const solde = total - totalAc;
          const sel = selectedIds.has(m.id);
          const fac = factures[m.id];
          const enfantsListe = m.enfants || [];
          const selEnfants = enfantsSelectionnes[m.id] || new Set(enfantsListe.map(e => e.prenom));
          const toggleEnfant = (e, prenom) => {
            e.stopPropagation();
            setEnfantsSelectionnes(prev => {
              const cur = new Set(prev[m.id] || enfantsListe.map(e2 => e2.prenom));
              cur.has(prenom) ? cur.delete(prenom) : cur.add(prenom);
              return { ...prev, [m.id]: cur };
            });
          };

          return (
            <div key={m.id} onClick={() => toggleSelect(m.id)} style={{ background:"#fff", borderRadius:16, padding:"14px 16px", boxShadow:"0 2px 10px rgba(0,0,0,0.06)", cursor:"pointer", border:`2px solid ${sel ? C.ocean : "#f0f0f0"}`, transition:"all .15s" }}>
              <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <div style={{ width:22, height:22, borderRadius:6, background:sel?C.ocean:"#e0e0e0", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {sel && <span style={{ color:"#fff", fontSize:13, fontWeight:900 }}>✓</span>}
                    </div>
                    <div style={{ fontWeight:900, color:C.dark, fontSize:14 }}>{m.prenom} {(m.nom||"").toUpperCase()}</div>
                  </div>
                  <div style={{ fontSize:11, color:"#aaa", marginBottom:4 }}>{m.email}</div>
                  {enfantsListe.length > 0 && (
                    <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:6 }}>
                      {enfantsListe.map(e => (
                        <div key={e.prenom} onClick={ev => toggleEnfant(ev, e.prenom)}
                          style={{ display:"flex", alignItems:"center", gap:4, background: selEnfants.has(e.prenom) ? `${C.ocean}15` : "#f0f0f0", border:`1.5px solid ${selEnfants.has(e.prenom) ? C.ocean : "#ddd"}`, borderRadius:50, padding:"2px 10px", cursor:"pointer", fontSize:11, fontWeight:700, color: selEnfants.has(e.prenom) ? C.ocean : "#aaa" }}>
                          <span>{selEnfants.has(e.prenom) ? "✓" : "○"}</span>
                          <span>{e.sexe==="M"?"👦":"👧"} {e.prenom}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                    {gNat.map((g,i) => <span key={i} style={{ background:`${C.ocean}15`, color:C.ocean, borderRadius:50, padding:"2px 8px", fontSize:10, fontWeight:800 }}>{g.detail}</span>)}
                    {gClub.map((g,i) => <span key={i} style={{ background:`${C.coral}15`, color:C.coral, borderRadius:50, padding:"2px 8px", fontSize:10, fontWeight:800 }}>{g.label.replace("Club de Plage — ","")}: {g.detail}</span>)}
                  </div>
                  {fac && (
                    <div style={{ marginTop:6, background:`${C.green}10`, borderRadius:8, padding:"4px 8px", fontSize:11, color:C.green, fontWeight:700, display:"inline-block" }}>
                      🧾 {fac.numero} · {new Date(fac.date_emission).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"right", flexShrink:0, display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                  <div style={{ fontWeight:900, fontSize:18, color:solde===0?C.green:C.dark }}>{solde} €</div>
                  {totalAc > 0 && <div style={{ fontSize:10, color:C.green, fontWeight:700 }}>- {totalAc} € versés</div>}
                  <div style={{ fontSize:10, color:"#bbb" }}>sur {total} €</div>
                  <button onClick={e => { e.stopPropagation(); genererFacture(m); }} disabled={generating===m.id}
                    style={{ background:generating===m.id?"#bbb":`linear-gradient(135deg,${C.ocean},${C.sea})`, border:"none", color:"#fff", borderRadius:8, padding:"6px 10px", cursor:generating===m.id?"not-allowed":"pointer", fontWeight:900, fontSize:11, fontFamily:"inherit", whiteSpace:"nowrap" }}>
                    {generating===m.id ? "⏳…" : fac ? "⬇️ Télécharger" : "🧾 Générer"}
                  </button>
                  {fac && (
                    <button onClick={async e => {
                      e.stopPropagation();
                      if (!window.confirm(`Supprimer la facture ${fac.numero} ?`)) return;
                      await sb.from("factures_numeros").delete().eq("id", fac.id);
                      setFactures(prev => { const n = {...prev}; delete n[m.id]; return n; });
                    }} style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", color:"#e74c3c", borderRadius:8, padding:"5px 10px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit", whiteSpace:"nowrap" }}>
                      🗑 Supprimer
                    </button>
                  )}
                  {m.email && (
                    <button onClick={e => { e.stopPropagation(); envoyerParMail(m); }} disabled={sendingMail===m.id}
                      style={{ background:sendingMail===m.id?`${C.green}50`:`${C.green}15`, border:`1.5px solid ${C.green}40`, color:C.green, borderRadius:8, padding:"5px 10px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit", whiteSpace:"nowrap" }}>
                      {sendingMail===m.id ? "✅ Ouvert" : "📧 Envoyer"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign:"center", padding:"32px 0", color:"#bbb", fontSize:14 }}>
          Aucun membre avec des réservations confirmées
        </div>
      )}
    </div>
  );
}

function AdminScreen({ onNav, sessions, setSessions, reservations, allSeasonSessions, setAllSeasonSessions, clubPlaces, setClubPlaces }) {
  const [tab, setTab] = useState("dashboard");
  const [dbResas, setDbResas]         = useState([]);
  const [dbResasClub, setDbResasClub] = useState([]);
  const [dbMembres, setDbMembres]     = useState([]);
  const [dbPaiements, setDbPaiements] = useState([]);
  const [showNouvelleResa, setShowNouvelleResa] = useState(false);
  const [modifierResa, setModifierResa]         = useState(null);
  const [pendingModalConfirm, setPendingModalConfirm] = useState(null); // { groupe } pour dashboard

  const refreshResas = () => {
    sb.from("reservations_natation").select("*, membres(id, prenom, nom, email, tel)").order("date_seance", { ascending: true })
      .then(({ data: d }) => {
      setDbResas(d || []);
      const next = ALL_SEASON_SLOTS_INIT.map(s => ({ ...s, spots: 2 }));
      (d || []).forEach(r => {
        if (!r.date_seance || !r.heure) return;
        const dateResa = r.date_seance.slice(0, 10);
        for (let i = 0; i < next.length; i++) {
          if (next[i].time !== r.heure || next[i].spots <= 0) continue;
          const dayObj = ALL_SEASON_DAYS.find(d2 => d2.id === next[i].day);
          if (!dayObj?.date) continue;
          const slotISO = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
          if (slotISO === dateResa) {
            next[i] = { ...next[i], spots: next[i].spots - 1 };
            break;
          }
        }
      });
      if (setAllSeasonSessions) setAllSeasonSessions(next);
    }).catch(() => {});

    sb.from("reservations_club").select("*, membres(id, prenom, nom, email, tel)").order("created_at", { ascending: false })
      .then(({ data }) => {
        setDbResasClub(data || []);
        if (data && setClubPlaces) {
          const counts = { matin: 0, apmidi: 0 };
          data.forEach(r => { if (r.session === "matin") counts.matin++; else counts.apmidi++; });
          setClubPlaces(prev => ({ ...prev, matin: Math.max(0, 45 - counts.matin), apmidi: Math.max(0, 45 - counts.apmidi) }));
        }
      });
  };

  const supprimerResaNatation = async (id) => {
    try {
      await sb.from("reservations_natation").delete().eq("id", id);
      refreshResas();
    } catch(e) { alert("Erreur suppression : " + e.message); }
  };

  const supprimerResaClub = async (id) => {
    try {
      await sb.from("reservations_club").delete().eq("id", id);
      refreshResas();
    } catch(e) { alert("Erreur suppression : " + e.message); }
  };

  // Charger les données Supabase au montage
  useEffect(() => {
    refreshResas();
    getAllMembres().then(d => setDbMembres(d)).catch(() => {});
  }, []);

  // Uniquement les vraies données Supabase
  const supabaseResas = dbResas.map((r, i) => ({
    id: `sb-${i}`, parent: `${r.membres?.prenom || ''} ${r.membres?.nom || ''}`.trim() || '—',
    email: r.membres?.email || '—', phone: r.membres?.tel || '—',
    enfants: r.enfants || [], session: `${r.heure} - ${r.jour}`, status: r.statut || 'confirmed'
  }));
  const allResas = [...supabaseResas, ...reservations.map((r,i) => ({
    id: 1000+i, parent: r.parent, email: "—", phone: "—", enfants: r.enfants || [],
    session: `${r.time} - ${DAYS.find(d=>d.id===r.day)?.label} ${DAYS.find(d=>d.id===r.day)?.num}`, status: "confirmed"
  }))];

  const todayISO = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`; })();
  const toLocalDate = (iso) => { if (!iso) return null; const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const confirmedNat  = dbResas.filter(r => r.statut === "confirmed");
  const confirmedClub = dbResasClub.filter(r => r.statut === "confirmed");
  const confirmedNatToday  = dbResas.filter(r => r.statut === "confirmed" && toLocalDate(r.validated_at || r.created_at) === todayISO);
  const confirmedClubToday = dbResasClub.filter(r => r.statut === "confirmed" && toLocalDate(r.validated_at || r.created_at) === todayISO);

  // Montant natation selon forfait (groupé par membre+date_creation)
  const montantNat = (resas) => {
    // Grouper par membre + enfants (triés) + minute de création = même logique que le reste
    const groups = {};
    resas.forEach(r => {
      const enfantsKey = Array.isArray(r.enfants) ? [...r.enfants].sort().join(",") : "";
      const minute = (r.created_at||"").slice(0,16);
      const key = `${r.membre_id}-${enfantsKey}-${minute}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    const PRIX_NAT = { 1:20, 2:40, 3:60, 4:80, 5:95, 6:113, 7:131, 8:147, 9:162, 10:170 };
    return Object.values(groups).reduce((total, g) => {
      if (g[0].mode_paiement === "offert") return total; // Offerts → exclus
      const n = g.length;
      const prix = n <= 10 ? (PRIX_NAT[n] || n*20) : 170 + (n-10)*17;
      return total + prix;
    }, 0);
  };

  const LIBERTE_PRIX = { 6:96, 12:180, 18:252, 24:288, 30:330 };
  const montantClub = (resas) => {
    // Grouper par membre + session + enfants + minute
    const groups = {};
    resas.forEach(r => {
      const enfantsKey = Array.isArray(r.enfants) ? [...r.enfants].sort().join(",") : "";
      const minute = (r.created_at||"").slice(0,16);
      const key = `${r.membre_id}-${r.session}-${enfantsKey}-${minute}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    return Object.values(groups).reduce((total, g) => {
      const r0 = g[0];
      // Offerts → exclus du total
      if (r0.mode_paiement === "offert") return total;
      // Carte liberté : prix fixe unique
      const nb = Number(Array.isArray(r0.enfants) ? r0.enfants[0] : 0);
      if (nb >= 6 && LIBERTE_PRIX[nb]) return total + LIBERTE_PRIX[nb];
      // Montant stocké sur la première résa = total du groupe
      if (r0.montant) return total + Number(r0.montant);
      // Fallback : lire [MONTANT:XX] × nb résas
      const parLabelJour = g.reduce((s, r) => {
        const match = (r.label_jour||"").match(/\[MONTANT:(\d+)\]/);
        return s + (match ? Number(match[1]) : 0);
      }, 0);
      return total + parLabelJour;
    }, 0);
  };

  const realTotal = montantNat(confirmedNatToday) + montantClub(confirmedClubToday);
  const pendingCount = dbResas.filter(r => r.statut === "pending").length + dbResasClub.filter(r => r.statut === "pending").length;

  // Taux de remplissage natation — toute la saison
  const totalSlotsNat  = ALL_SEASON_SLOTS_INIT.length * 2; // 2 places par créneau
  const takenNat       = confirmedNat.reduce((s, r) => s + Math.max(1, (r.enfants||[]).length), 0); // places réelles utilisées
  const fillRateNat    = totalSlotsNat > 0 ? Math.round((takenNat / totalSlotsNat) * 100) : 0;
  const freeNat        = Math.max(0, totalSlotsNat - takenNat);

  // Taux de remplissage club — toute la saison
  const totalJoursClub  = CLUB_SEASON_DAYS.length;
  const totalPlacesClub = totalJoursClub * 45;
  const takenClub       = confirmedClub.length; // uniquement résas validées
  const fillRateClub    = totalPlacesClub > 0 ? Math.round((takenClub / (totalPlacesClub * 2)) * 100) : 0;

  // Pour l'affichage en header (semaine courante)
  const takenSpots = sessions.reduce((s,x) => s + (2 - x.spots), 0);
  const totalSpots = sessions.reduce((s,x) => s + x.spots, 0);
  const fillRate   = fillRateNat;

  const tabs = [
    { id: "dashboard",    emoji: "📊", label: "Dashboard"  },
    { id: "seances",      emoji: "🏊", label: "Séances"    },
    { id: "reservations", emoji: "📋", label: "Réservations" },
    { id: "membres",      emoji: "👥", label: "Membres"    },
    { id: "planning",     emoji: "🗓️", label: "Planning"   },
    { id: "paiements",    emoji: "💳", label: "Paiements"  },
    { id: "libertes",     emoji: "🎟️", label: "Liberté"   },
    { id: "comptes",      emoji: "📒", label: "Comptes"    },
    { id: "factures",     emoji: "🧾", label: "Factures"   },
    { id: "recherche",    emoji: "🔍", label: "Recherche"  },
  ];

  return (
    <div style={{ background: "#F0F4F8", minHeight: "100%" }}>

      {/* Modal mode paiement — Dashboard pending */}
      {pendingModalConfirm && (
        <ModePaiementModal
          titre={`Valider ${pendingModalConfirm.resas?.length} réservation${pendingModalConfirm.resas?.length>1?"s":""}`}
          onClose={() => setPendingModalConfirm(null)}
          onConfirm={async (mode) => {
            const g = pendingModalConfirm;
            const table = g.type === "natation" ? "reservations_natation" : "reservations_club";
            if (g.type === "club") {
              const LIBERTE_PRIX_V = {6:96,12:180,18:252,24:288,30:330};
              for (const r of g.resas) {
                let montant = 0;
                const isLib = !isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6;
                if (isLib) { montant = LIBERTE_PRIX_V[Number(r.enfants[0])]||0; }
                else { const m2=(r.label_jour||"").match(/\[MONTANT:(\d+)\]/); montant=m2?Number(m2[1]):0; }
                await sb.from(table).update({ statut:"confirmed", validated_at:new Date().toISOString(), montant, mode_paiement:mode }).eq("id", r.id);
              }
            } else {
              await Promise.all(g.resas.map(r => sb.from(table).update({ statut:"confirmed", validated_at:new Date().toISOString(), mode_paiement:mode }).eq("id", r.id)));
            }
            // Carte liberté → créditer
            if (g.type === "club" && g.resas.some(r => !isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6)) {
              const r0 = g.resas[0];
              const credit = Number(r0.enfants?.[0])||0;
              if (credit > 0 && r0.membre_id) {
                const { data: m } = await sb.from("membres").select("liberte_balance, liberte_total").eq("id", r0.membre_id).single();
                if (m) await sb.from("membres").update({ liberte_balance:(m.liberte_balance||0)+credit, liberte_total:(m.liberte_total||0)+credit }).eq("id", r0.membre_id);
              }
            }
            // Liberté → décrémenter
            if (g.type === "club" && g.resas.some(r => (r.label_jour||"").startsWith("[LIBERTE]"))) {
              const membreId = g.resas[0]?.membre_id;
              const nbUtil = g.resas.filter(r => (r.label_jour||"").startsWith("[LIBERTE]")).length;
              if (membreId && nbUtil > 0) {
                const { data: m } = await sb.from("membres").select("liberte_balance").eq("id", membreId).single();
                if (m) await sb.from("membres").update({ liberte_balance:Math.max(0,(m.liberte_balance||0)-nbUtil) }).eq("id", membreId);
              }
            }
            setPendingModalConfirm(null);
            refreshResas();
          }}
        />
      )}

      <div style={{ background: `linear-gradient(135deg, ${C.ocean}, ${C.sea}, ${C.sky})`, padding: "24px 24px 0" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BackBtn onNav={onNav} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>🏖️ EOLE BEACH CLUB · Piriac-sur-Mer</div>
              <h2 style={{ color: "#fff", margin: 0, fontWeight: 900, fontSize: 22 }}>Administration</h2>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 14, padding: "8px 14px", textAlign: "center", backdropFilter:"blur(10px)" }}>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight:700 }}>Natation</div>
              <div style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>{fillRateNat}%</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 14, padding: "8px 14px", textAlign: "center", backdropFilter:"blur(10px)" }}>
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, fontWeight:700 }}>En attente</div>
              <div style={{ color: C.sun, fontWeight: 900, fontSize: 20 }}>{pendingCount}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: tab === t.id ? "#fff" : "rgba(255,255,255,0.15)", color: tab === t.id ? C.ocean : "rgba(255,255,255,0.85)", border: "none", borderRadius: "14px 14px 0 0", padding: "10px 4px 8px", cursor: "pointer", fontWeight: 900, fontSize: 10, fontFamily: "inherit", transition: "all .15s", backdropFilter:"blur(10px)" }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{t.emoji}</div>
              <div>{t.label}</div>
            </button>
          ))}
        </div>
        </div>
      </div>

      <div style={{ padding: "16px 24px 24px", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
        {tab === "dashboard" && (() => {

          const pendingNat  = dbResas.filter(r => r.statut === "pending");
          const pendingClub = dbResasClub.filter(r => r.statut === "pending");
          const allPending  = [
            ...pendingNat.map(r => ({ ...r, _type:"natation", _date: r.date_seance, _label: `🏊 ${r.heure}` })),
            ...pendingClub.map(r => ({ ...r, _type:"club", _date: r.date_reservation, _label: (!isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6) ? "🎟️ Carte Liberté" : `🏖️ ${r.session==="matin"?"Matin":"Après-midi"}` })),
          ].sort((a,b) => (a.created_at||"").localeCompare(b.created_at||""));

          const pendingGroups = (() => {
            const groups = {};
            allPending.forEach(r => {
              const minuteCreation = (r.created_at||"").slice(0,16);
              const enfantsKey = Array.isArray(r.enfants) ? [...r.enfants].sort().join(",") : "";
              const keyClub = r._type === "club"
                ? `${r.membre_id}-club-${r.session}-${enfantsKey}-${minuteCreation}`
                : null;
              const key = keyClub || `${r.membre_id}-${r._type}-${enfantsKey}-${minuteCreation}`;
              if (!groups[key]) groups[key] = { membre: r.membres, type: r._type, resas: [] };
              groups[key].resas.push(r);
            });
            return Object.values(groups);
          })();

          return (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(340px, 1fr))", gap:14 }}>

            {/* Colonne 1 */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Familles",        value: dbMembres.length,      emoji: "👨‍👩‍👧", bg: `linear-gradient(135deg,${C.ocean},#0099FF)`,   sh: C.ocean },
                  { label: "Séances nat.",    value: dbResas.length,        emoji: "🏊",  bg: `linear-gradient(135deg,${C.sea},#00C9FF)`,    sh: C.sea },
                  { label: "Résas club",      value: dbResasClub.length,    emoji: "🏖️", bg: `linear-gradient(135deg,${C.coral},${C.sun})`,  sh: C.coral },
                  { label: "Encaissé auj.",   value: `${realTotal} €`,      emoji: "💶",  bg: `linear-gradient(135deg,${C.green},#00B894)`,   sh: C.green },
                ].map(s => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: 22, padding: "18px 16px", boxShadow: `0 8px 24px ${s.sh}55` }}>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>{s.emoji}</div>
                    <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: 700, marginTop: 6, textTransform:"uppercase", letterSpacing:0.5 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Taux remplissage */}
              <div style={{ background:"#fff", borderRadius:20, padding:18, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight:800, color:"#2C3E50", fontSize:14, marginBottom:14 }}>📈 Taux de remplissage — Saison 2026</div>
                <div style={{ marginBottom:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#555" }}>🏊 Natation</span>
                    <span style={{ fontWeight:900, color:C.ocean, fontSize:13 }}>{fillRateNat}%</span>
                  </div>
                  <div style={{ background:"#EEF5FF", borderRadius:50, height:10, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${fillRateNat}%`, background:`linear-gradient(90deg,${C.ocean},${C.sea})`, borderRadius:50 }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, fontSize:11, color:"#aaa" }}>
                    <span>{takenNat} places prises</span><span>{freeNat} libres</span>
                  </div>
                </div>
                <div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:13, fontWeight:700, color:"#555" }}>🏖️ Club de Plage</span>
                    <span style={{ fontWeight:900, color:C.coral, fontSize:13 }}>{fillRateClub}%</span>
                  </div>
                  <div style={{ background:"#FFF0EE", borderRadius:50, height:10, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${fillRateClub}%`, background:`linear-gradient(90deg,${C.coral},${C.sun})`, borderRadius:50 }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, fontSize:11, color:"#aaa" }}>
                    <span>{takenClub} réservations</span><span>{totalJoursClub} jours · 45 pl./session</span>
                  </div>
                </div>
              </div>

              {/* Paiements du jour */}
              <div style={{ background:"#fff", borderRadius:20, padding:18, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                  <div style={{ fontWeight:800, color:"#2C3E50", fontSize:14 }}>💳 Paiements du jour</div>
                  <div style={{ background:`${C.green}18`, color:C.green, borderRadius:50, padding:"4px 14px", fontWeight:900, fontSize:13 }}>{realTotal} €</div>
                </div>
                {confirmedNatToday.length + confirmedClubToday.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"16px 0", color:"#bbb", fontSize:13 }}>Aucun paiement aujourd'hui</div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
                    {[...confirmedNatToday, ...confirmedClubToday]
                      .sort((a,b) => (b.updated_at||b.created_at||"").localeCompare(a.updated_at||a.created_at||""))
                      .map((r, i, arr) => {
                        const isNat = !!r.date_seance;
                        const isLib = !isNat && Array.isArray(r.enfants) && Number(r.enfants[0]) >= 6;
                        const color = isNat ? C.ocean : C.coral;
                        const label = isNat ? `🏊 ${r.heure}` : isLib ? `🎟️ Carte Liberté · ${r.enfants[0]} demi-j.` : `🏖️ ${r.session==="matin"?"Matin":"Après-midi"}`;
                        const LIBP = {6:96,12:180,18:252,24:288,30:330};
                        const montant = isNat ? `${r.montant||20} €` : isLib ? `${LIBP[Number(r.enfants[0])]||"—"} €` : "";
                        return (
                          <div key={`${isNat?"n":"c"}-${r.id}`} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<arr.length-1?"1px solid #F0F4F8":"none" }}>
                            <div style={{ width:32, height:32, borderRadius:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, background:`${color}18`, color, fontWeight:900 }}>✓</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:800, fontSize:13, color:"#2C3E50", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.membres ? `${r.membres.prenom} ${NOM(r.membres.nom)}` : "—"}</div>
                              <div style={{ fontSize:11, color:"#aaa" }}>{label}</div>
                            </div>
                            <div style={{ fontWeight:900, fontSize:13, color:C.green, flexShrink:0 }}>{montant}</div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Membres inscrits */}
              <div style={{ background:"#fff", borderRadius:20, padding:18, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight:800, color:"#2C3E50", fontSize:14, marginBottom:14 }}>👤 Derniers membres</div>
                {dbMembres.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"12px 0", color:"#bbb", fontSize:13 }}>Aucun membre</div>
                ) : dbMembres.slice(0,5).map((m, i) => (
                  <div key={m.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 0", borderBottom:i<Math.min(dbMembres.length,5)-1?"1px solid #F0F4F8":"none" }}>
                    <div style={{ width:36, height:36, borderRadius:12, background:`linear-gradient(135deg,${C.ocean},${C.sea})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>👤</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, color:"#2C3E50", fontSize:13 }}>{m.prenom} {NOM(m.nom)}</div>
                      <div style={{ fontSize:11, color:"#aaa" }}>{m.email}</div>
                    </div>
                    <Pill color={C.green}>✓</Pill>
                  </div>
                ))}
              </div>
            </div>

            {/* Colonne 2 */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* En attente de validation */}
              {pendingGroups.length > 0 && (
                <div style={{ background:"#fff", borderRadius:20, padding:18, boxShadow:`0 4px 20px ${C.sun}44`, border:`2px solid ${C.sun}60` }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                    <div style={{ fontWeight:800, color:"#2C3E50", fontSize:14 }}>⏳ En attente de validation</div>
                    <div style={{ background:`${C.sun}20`, color:"#b45309", borderRadius:50, padding:"3px 12px", fontWeight:900, fontSize:12 }}>
                      {allPending.length} demande{allPending.length>1?"s":""}
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {pendingGroups.map((g, gi) => {
                      const color = g.type === "natation" ? C.ocean : C.coral;
                      return (
                        <div key={gi} style={{ background:`${C.sun}08`, borderRadius:14, padding:"12px 14px", borderLeft:`4px solid ${C.sun}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                            <div>
                              <div style={{ fontWeight:900, color:"#2C3E50", fontSize:13 }}>
                                {g.membre ? `${g.membre.prenom} ${NOM(g.membre.nom)}` : "—"}
                              </div>
                              <div style={{ fontSize:11, color, fontWeight:700 }}>
                                {g.type==="natation" ? `🏊 Natation · ${g.resas.length} séance${g.resas.length>1?"s":""}` : g.resas.some(r => !isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6) ? `🎟️ Carte Liberté · ${Number(g.resas[0]?.enfants?.[0])} demi-journées` : `🏖️ Club · ${g.resas.length} séance${g.resas.length>1?"s":""}`}
                              </div>
                            </div>
                            <button onClick={() => setPendingModalConfirm(g)} style={{ background:`linear-gradient(135deg,${C.green},#1E8449)`, border:"none", color:"#fff", borderRadius:50, padding:"5px 14px", cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit", boxShadow:`0 3px 10px ${C.green}44`, flexShrink:0, marginLeft:8 }}>✅ Valider</button>
                            <button onClick={async () => {
                              if (!window.confirm(`Supprimer ${g.resas.length} réservation${g.resas.length>1?"s":""} en attente ?`)) return;
                              const table = g.type === "natation" ? "reservations_natation" : "reservations_club";
                              const results = await Promise.all(g.resas.map(r => sb.from(table).delete().eq("id", r.id)));
                              const errors = results.filter(r => r.error);
                              if (errors.length > 0) {
                                alert("Erreur suppression : " + errors[0].error.message);
                                return;
                              }
                              refreshResas();
                            }} style={{ background:"#FFF0F0", border:"1.5px solid #fca5a5", color:"#e74c3c", borderRadius:50, padding:"5px 12px", cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit", flexShrink:0, marginLeft:4 }}>🗑</button>
                          </div>
                          <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                            {g.resas.map((r,ri) => {
                              const date = r._date?.slice(0,10);
                              return (
                                <div key={ri} style={{ background:`${color}15`, color, borderRadius:8, padding:"2px 8px", fontSize:10, fontWeight:700 }}>
                                  {r._label} · {date ? new Date(date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "—"}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fréquentation par âge */}
              <AgeGroupCard dbMembres={dbMembres} />
            </div>
          </div>
          );
        })()}

        {tab === "seances" && (
          <SeancesTab sessions={allSeasonSessions} setSessions={setAllSeasonSessions} />
        )}

        {tab === "reservations" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {showNouvelleResa && (
              <NouvelleResaModal
                dbMembres={dbMembres}
                allSeasonSessions={allSeasonSessions}
                setAllSeasonSessions={setAllSeasonSessions}
                clubPlaces={clubPlaces}
                setClubPlaces={setClubPlaces}
                onClose={() => setShowNouvelleResa(false)}
                onSaved={() => { setShowNouvelleResa(false); refreshResas(); }}
              />
            )}
            {modifierResa && (
              <ModifierResaModal
                resa={modifierResa.resa}
                type={modifierResa.type}
                dbMembres={dbMembres}
                onClose={() => setModifierResa(null)}
                onSaved={() => { setModifierResa(null); refreshResas(); }}
              />
            )}

            {/* Totaux */}
            <div style={{ display:"flex", gap:8 }}>
              <div style={{ flex:1, background:"#fff", borderRadius:16, padding:"12px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ fontWeight:900, color:C.ocean, fontSize:20 }}>{dbResas.length}</div>
                <div style={{ fontSize:11, color:"#aaa" }}>🏊 Natation</div>
              </div>
              <div style={{ flex:1, background:"#fff", borderRadius:16, padding:"12px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ fontWeight:900, color:C.coral, fontSize:20 }}>{dbResasClub.length}</div>
                <div style={{ fontSize:11, color:"#aaa" }}>🏖️ Club</div>
              </div>
              <div style={{ flex:1, background:"#fff", borderRadius:16, padding:"12px", textAlign:"center", boxShadow:"0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ fontWeight:900, color:C.green, fontSize:20 }}>{dbResas.length + dbResasClub.length}</div>
                <div style={{ fontSize:11, color:"#aaa" }}>Total</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight:900, color:"#2C3E50", fontSize:13 }}>{dbResas.length + dbResasClub.length} réservation(s) Supabase</div>
              <button onClick={() => setShowNouvelleResa(true)} style={{ background:`linear-gradient(135deg,${C.green},#1E8449)`, color:"#fff", border:"none", borderRadius:50, padding:"6px 14px", cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit" }}>
                ➕ Nouvelle
              </button>
            </div>

            {/* ⏳ Bloc En attente de validation */}
            {(() => {
              const pendingNat  = dbResas.filter(r => r.statut === "pending");
              const pendingClub = dbResasClub.filter(r => r.statut === "pending");
              const allPending  = [
                ...pendingNat.map(r => ({ ...r, _type:"natation", _date: r.date_seance,      _label:`🏊 ${r.heure}` })),
                ...pendingClub.map(r => ({ ...r, _type:"club",    _date: r.date_reservation, _label:(!isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6) ? "🎟️ Carte Liberté" : `🏖️ ${r.session==="matin"?"Matin":"Après-midi"}` })),
              ].sort((a,b) => (a.created_at||"").localeCompare(b.created_at||""));
              if (allPending.length === 0) return null;
              return (
                <div style={{ background:"#fff", borderRadius:18, padding:16, border:`2px solid ${C.sun}60`, boxShadow:`0 4px 16px ${C.sun}30` }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                    <div style={{ fontWeight:900, color:"#b45309", fontSize:13 }}>⏳ En attente de validation</div>
                    <span style={{ background:`${C.sun}20`, color:"#b45309", borderRadius:50, padding:"2px 10px", fontWeight:900, fontSize:11 }}>{allPending.length}</span>
                  </div>
                  {/* Regrouper par membre */}
                  {(() => {
                    const groups = {};
                    allPending.forEach(r => {
                      const minuteCreation = (r.created_at||"").slice(0,16);
                      const enfantsKey = Array.isArray(r.enfants) ? [...r.enfants].sort().join(",") : "";
                      const keyClub = r._type === "club"
                        ? `${r.membre_id}-club-${r.session}-${enfantsKey}-${minuteCreation}`
                        : null;
                      const key = keyClub || `${r.membre_id}-${r._type}-${enfantsKey}-${minuteCreation}`;
                      if (!groups[key]) groups[key] = { membre: r.membres, type: r._type, resas: [] };
                      groups[key].resas.push(r);
                    });
                    return Object.entries(groups).map(([key, g]) => {
                      const color = g.type === "natation" ? C.ocean : C.coral;
                      return (
                        <div key={key} style={{ background:`${C.sun}08`, borderRadius:12, padding:"12px 14px", borderLeft:`3px solid ${C.sun}` }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                            <div>
                              <div style={{ fontWeight:900, color:"#2C3E50", fontSize:13 }}>
                                {g.membre ? `${g.membre.prenom} ${NOM(g.membre.nom)}` : "—"}
                              </div>
                              <div style={{ fontSize:11, color, fontWeight:700, marginTop:2 }}>
                                {g.type === "natation" ? `🏊 Natation · ${g.resas.length} séance${g.resas.length>1?"s":""}` : g.resas.some(r => !isNaN(Number(r.enfants?.[0])) && Number(r.enfants?.[0]) >= 6) ? `🎟️ Carte Liberté · ${Number(g.resas[0]?.enfants?.[0])} demi-journées` : `🏖️ Club · ${g.resas.length} séance${g.resas.length>1?"s":""}`}
                              </div>
                              {g.membre?.email && <div style={{ fontSize:10, color:"#bbb", marginTop:2 }}>{g.membre.email}</div>}
                              {g.resas[0]?.created_at && <div style={{ fontSize:10, color:"#bbb", marginTop:1 }}>📅 Envoyé le {new Date(g.resas[0].created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}</div>}
                            </div>
                            <button onClick={() => setPendingModalConfirm(g)} style={{
                              background:`linear-gradient(135deg,${C.green},#1E8449)`, border:"none",
                              color:"#fff", borderRadius:50, padding:"7px 14px",
                              cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit",
                              boxShadow:`0 3px 10px ${C.green}44`, flexShrink:0, marginLeft:8,
                            }}>✅ Valider tout</button>
                            <button onClick={async () => {
                              if (!window.confirm(`Supprimer ${g.resas.length} réservation${g.resas.length>1?"s":""} ?`)) return;
                              const table = g.type === "natation" ? "reservations_natation" : "reservations_club";
                              const results = await Promise.all(g.resas.map(r => sb.from(table).delete().eq("id", r.id)));
                              const errors = results.filter(r => r.error);
                              if (errors.length > 0) {
                                alert("Erreur suppression : " + errors[0].error.message);
                                return;
                              }
                              refreshResas();
                            }} style={{ background:"#FFF0F0", border:"1.5px solid #fca5a5", color:"#e74c3c", borderRadius:50, padding:"7px 12px", cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit", flexShrink:0, marginLeft:4 }}>🗑</button>
                          </div>
                          {/* Liste des créneaux */}
                          <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                            {g.resas.map((r,i) => {
                              const date = r._date?.slice(0,10);
                              return (
                                <div key={i} style={{ background:`${color}15`, color, borderRadius:8, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                                  {r._label} · {date ? new Date(date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "—"}
                                  {r.enfants?.length > 0 && ` · ${enrichEnfants(r.enfants, r.membres).join(", ")}`}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              );
            })()}

            {/* ── VUE PAR MEMBRE · SEMAINE ── */}
            <ResasMembreView
              dbResas={dbResas}
              dbResasClub={dbResasClub}
              refreshResas={refreshResas}
              setModifierResa={setModifierResa}
              supprimerResaNatation={supprimerResaNatation}
              supprimerResaClub={supprimerResaClub}
            />

            {/* Si aucune donnée Supabase, afficher mock */}
            {dbResas.length === 0 && dbResasClub.length === 0 && allResas.map(r => (
              <div key={r.id} style={{ background:"#fff", borderRadius:18, padding:"12px 14px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
                <div style={{ fontWeight:900, color:"#2C3E50", fontSize:13 }}>{r.parent}</div>
                <div style={{ fontSize:11, color:"#aaa" }}>🏊 {r.session}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "membres" && (
          <MembresTab allResas={allResas} dbMembres={dbMembres} onRefresh={() => getAllMembres().then(d => setDbMembres(d)).catch(() => {})} />
        )}

        {tab === "paiements" && (
          <PaiementsTab dbPaiements={dbPaiements} onValidate={refreshResas} />
        )}

        {tab === "planning" && (
          <PlanningTab allSeasonSessions={allSeasonSessions} clubPlaces={clubPlaces} reservations={reservations} />
        )}

        {tab === "libertes" && (
          <CartesLiberteTab dbMembres={dbMembres} />
        )}

        {tab === "comptes" && (
          <ComptesTab dbMembres={dbMembres} dbResas={dbResas} dbResasClub={dbResasClub} onRefresh={() => getAllMembres().then(d => setDbMembres(d)).catch(() => {})} />
        )}

        {tab === "factures" && (
          <FacturesTab dbMembres={dbMembres} dbResas={dbResas} dbResasClub={dbResasClub} />
        )}

        {tab === "recherche" && (
          <RechercheTab allResas={allResas} sessions={sessions} dbMembres={dbMembres} />
        )}
      </div>
    </div>
  );
}
// ── BOTTOM NAV ────────────────────────────────────────────
// ── PANIER ────────────────────────────────────────────────
function PanierScreen({ onNav, user, panier, setPanier }) {
  const [sending, setSending]   = useState(false);
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");

  // Si panier vide et pas en mode "done" ni en cours d'envoi, retourner aux formules
  useEffect(() => {
    // Ne pas rediriger si panier vide — afficher l'écran panier vide
  }, [panier.length, done, sending]);

  const removeItem = (id) => setPanier(prev => prev.filter(item => item.id !== id));

  // Grille tarifaire natation
  const PRIX_NAT_FORFAIT = { 1:20, 2:40, 3:60, 4:80, 5:95, 6:113, 7:131, 8:147, 9:162, 10:170 };
  const getPrixNat = (nbSeances) => {
    if (nbSeances <= 10) return PRIX_NAT_FORFAIT[nbSeances] || nbSeances * 20;
    return 170 + (nbSeances - 10) * 17; // forfait 10 + 17€ par séance supplémentaire
  };

  // Calculer le prix natation par enfant selon le total de séances dans le panier
  const natItems = panier.filter(i => i.type === "natation");
  const prixNatParEnfant = (() => {
    // Compter les séances par enfant
    const seancesParEnfant = {};
    natItems.forEach(item => {
      const enfants = item.enfants?.length > 0 ? item.enfants : (item.enfant ? [item.enfant] : ["_"]);
      const nbCreneaux = item.creneaux?.length || 1;
      enfants.forEach(e => {
        seancesParEnfant[e] = (seancesParEnfant[e] || 0) + nbCreneaux;
      });
    });
    // Prix forfait pour chaque enfant
    const prix = {};
    Object.entries(seancesParEnfant).forEach(([e, nb]) => { prix[e] = getPrixNat(nb); });
    return prix;
  })();

  const totalNat = Object.values(prixNatParEnfant).reduce((s, p) => s + p, 0);
  const totalAutres = panier.filter(i => i.type !== "natation").reduce((s, i) => s + (i.prix || 0), 0);
  const total = totalNat + totalAutres;

  const handleEnvoyer = async () => {
    if (!panier.length) return;
    if (!user?.supabaseId) { setError("Vous devez être connecté."); return; }
    setSending(true);
    setError("");
    try {
      // Regrouper natation par enfant pour appliquer forfait
      const natItemsAll = panier.filter(i => i.type === "natation");
      const natGroupes = {};
      natItemsAll.forEach(item => {
        const enfants = item.enfants?.length > 0 ? item.enfants : (item.enfant ? [item.enfant] : ["_"]);
        const key = enfants.join("+");
        if (!natGroupes[key]) natGroupes[key] = { enfants, creneaux: [] };
        natGroupes[key].creneaux.push(...(item.creneaux || []));
      });
      for (const [, groupe] of Object.entries(natGroupes)) {
        const nbSeances = groupe.creneaux.length;
        const prixForfait = getPrixNat(nbSeances);
        const montantParSeance = Math.round(prixForfait / nbSeances);
        for (const c of groupe.creneaux) {
          const { error: e } = await sb.from("reservations_natation").insert([{
            membre_id:   user.supabaseId,
            heure:       c.time,
            date_seance: c.dayISO,
            enfants:     groupe.enfants.filter(e => e !== "_"),
            statut:      "pending",
            montant:     montantParSeance,
            jour:        parseLocalDate(c.dayISO).toLocaleDateString("fr-FR", {weekday:"short"}),
          }]);
          if (e) throw e;
        }
      }

      for (const item of panier.filter(i => i.type !== "natation")) {
        if (item.type === "eveil") {
          const { error: e } = await sb.from("reservations_natation").insert([{
            membre_id:   user.supabaseId,
            heure:       item.heure,
            date_seance: item.date,
            enfants:     item.enfant ? [item.enfant] : [],
            statut:      "pending",
            montant:     20,
            jour:        item.jour || "",
          }]);
          if (e) throw e;
        } else if (item.type === "club") {
          const sessions = item.session === "journee" ? ["matin","apmidi"] : [item.session || "matin"];
          // Charger les résas existantes pour éviter les doublons
          const { data: existingClub } = await sb.from("reservations_club")
            .select("date_reservation, session, enfants")
            .eq("membre_id", user.supabaseId)
            .in("statut", ["pending","confirmed"]);
          const existingSet = new Set((existingClub||[]).map(r =>
            (r.enfants||[]).map(enf => `${r.date_reservation?.slice(0,10)}-${r.session}-${enf}`).join("|")
          ).join("|").split("|").filter(Boolean));

          const doublons = [];
          for (const iso of (item.dates || [])) {
            for (const sess of sessions) {
              // Vérifier si un des enfants est déjà inscrit ce jour/session
              const enfantsDeja = (item.enfants||[]).filter(enf =>
                existingSet.has(`${iso}-${sess}-${enf}`)
              );
              if (enfantsDeja.length > 0) {
                doublons.push(`${new Date(iso).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} ${sess==="matin"?"matin":"après-midi"} (${enfantsDeja.join(", ")})`);
                continue;
              }
              const { error: e } = await sb.from("reservations_club").insert([{
                membre_id:        user.supabaseId,
                date_reservation: iso,
                session:          sess,
                statut:           "pending",
                enfants:          item.enfants || [],
                label_jour:       `[MONTANT:${item.prix}] ${new Date(iso).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}`,
              }]);
              if (e) throw e;
            }
          }
          if (doublons.length > 0) {
            alert(`⚠️ Inscription(s) ignorée(s) car déjà existante(s) :\n${doublons.join("\n")}`);
          }
        } else if (item.type === "liberte") {
          const { error: e } = await sb.from("reservations_club").insert([{
            membre_id:        user.supabaseId,
            date_reservation: new Date().toISOString().slice(0,10),
            session:          "matin",
            statut:           "pending",
            enfants:          [String(item.nbDemiJ)],
            label_jour:       `Carte Liberté · ${item.nbDemiJ} demi-journées`,
          }]);
          if (e) throw e;
        }
      }
      setDone(true); // Marquer comme envoyé AVANT de vider le panier
      setPanier([]);

      // Générer l'email de confirmation
      const lignesNat = Object.entries(natGroupes).map(([, g]) => {
        const nb = g.creneaux.length;
        const prix = getPrixNat(nb);
        const creneauxStr = g.creneaux.map(c => `${c.time} – ${parseLocalDate(c.dayISO).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})}`).join("<br/>      ");
        const enfantsStr = g.enfants.filter(e => e !== "_").join(", ") || "—";
        return `<tr><td style="padding:8px 12px;font-weight:700;color:#1A8FE3">🏊 Natation</td><td style="padding:8px 12px">${enfantsStr}</td><td style="padding:8px 12px;font-size:12px;color:#555">${creneauxStr}</td><td style="padding:8px 12px;font-weight:900;color:#FF8E53;text-align:right">${prix} €</td></tr>`;
      }).join("");

      const lignesAutres = panier.filter(i => i.type !== "natation").map(item => {
        const detail = item.dates?.length > 0
          ? item.dates.map(d => new Date(d).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})).join(", ")
          : item.details || "";
        const typeLabel = item.type === "club" ? "🏖️ Club" : item.type === "liberte" ? "🎟️ Liberté" : item.type === "eveil" ? "🌊 Éveil" : item.type;
        return `<tr><td style="padding:8px 12px;font-weight:700;color:#FF8E53">${typeLabel}</td><td style="padding:8px 12px">${item.enfants?.join(", ") || "—"}</td><td style="padding:8px 12px;font-size:12px;color:#555">${detail}</td><td style="padding:8px 12px;font-weight:900;color:#FF8E53;text-align:right">${item.prix} €</td></tr>`;
      }).join("");

      const nomMembre = `${user.prenom || ""} ${(user.nom || "").toUpperCase()}`.trim();
      // Détecter les types de prestations pour adapter le règlement
      const hasNat = Object.keys(natGroupes).length > 0;
      const hasClub = panier.filter(i => i.type === "club").length > 0;
      const hasLiberte = panier.filter(i => i.type === "liberte").length > 0;

      const reglementSections = [];
      if (hasNat) reglementSections.push(`
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px">
          <tr><td style="background:#EEF8FF;border-left:4px solid #1A8FE3;border-radius:8px;padding:14px 16px">
            <p style="margin:0 0 6px;font-weight:700;color:#1A8FE3;font-size:13px">🏊 École de Natation</p>
            <p style="margin:0;font-size:13px;color:#555;line-height:1.7">
              Vos séances seront confirmées dès réception du paiement.<br/>
              <strong>Rappel :</strong> Arriver 5 minutes avant le créneau. Prévoir maillot de bain, serviette et lunettes si besoin.
            </p>
          </td></tr>
        </table>`);
      if (hasClub) reglementSections.push(`
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px">
          <tr><td style="background:#EEF8FF;border-left:4px solid #1A8FE3;border-radius:8px;padding:14px 16px">
            <p style="margin:0 0 6px;font-weight:700;color:#1A8FE3;font-size:13px">🏖️ Club de Plage</p>
            <p style="margin:0;font-size:13px;color:#555;line-height:1.7">
              L'accès au club sera activé dès réception du paiement.<br/>
              <strong>Rappel :</strong> Prévoir casquette, gourde, serviette de bain et crème solaire.
            </p>
          </td></tr>
        </table>`);
      if (hasLiberte) reglementSections.push(`
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px">
          <tr><td style="background:#EEF8FF;border-left:4px solid #1A8FE3;border-radius:8px;padding:14px 16px">
            <p style="margin:0 0 6px;font-weight:700;color:#1A8FE3;font-size:13px">🎟️ Carte Liberté</p>
            <p style="margin:0;font-size:13px;color:#555;line-height:1.7">
              La carte Liberté est valable toute la saison 2026.<br/>
              Elle sera créditée sur votre compte dès réception du paiement.<br/>
              Vous pourrez ensuite réserver vos demi-journées librement depuis l'application.
            </p>
          </td></tr>
        </table>`);

      const emailHtml = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Confirmation Eole Beach Club</title></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f0f4f8;padding:20px 0">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">

  <!-- HEADER -->
  <tr><td style="background-color:#1A8FE3;padding:24px 28px">
    <p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#ffffff">🏖️ Eole Beach Club</p>
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85)">Club de Plage · École de Natation · Piriac-sur-Mer · Saison 2026</p>
  </td></tr>

  <!-- BODY -->
  <tr><td style="padding:24px 28px">
    <p style="font-size:14px;color:#2C3E50;line-height:1.7;margin:0 0 20px">Bonjour <strong>${nomMembre}</strong>,<br/>
    Merci pour votre inscription ! Votre demande a bien été pré-enregistrée. Voici le récapitulatif de votre commande ainsi que les informations de règlement.</p>

    <!-- TABLEAU PRESTATIONS -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <tr>
        <th style="background:#1A8FE3;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase">Prestation</th>
        <th style="background:#1A8FE3;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase">Enfant(s)</th>
        <th style="background:#1A8FE3;color:#fff;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase">Détails</th>
        <th style="background:#1A8FE3;color:#fff;padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase">Prix</th>
      </tr>
      ${lignesNat}${lignesAutres}
    </table>

    <!-- TOTAL -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px">
      <tr>
        <td style="background-color:#1A8FE3;padding:16px 20px;border-radius:12px">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="color:#ffffff;font-size:15px;font-weight:700">Total à régler</td>
              <td align="right" style="color:#ffffff;font-size:24px;font-weight:900">${total} €</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- PAIEMENT -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px">
      <tr>
        <td style="background:#FFF9F0;border:2px solid #FFD93D;border-radius:12px;padding:18px 20px">
          <p style="margin:0 0 10px;color:#b45309;font-size:14px;font-weight:700">💳 Comment régler votre inscription ?</p>
          <p style="margin:0 0 12px;font-size:13px;color:#555;line-height:1.7">Vous pouvez régler votre inscription selon les modes de paiement suivants :</p>
          <table cellpadding="0" cellspacing="3" border="0" style="width:100%">
            <tr>
              <td style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;color:#555;text-align:center;white-space:nowrap">🏦 Virement</td>
              <td width="3"></td>
              <td style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;color:#555;text-align:center;white-space:nowrap">✉️ Chèque</td>
              <td width="3"></td>
              <td style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;color:#555;text-align:center;white-space:nowrap">💶 Espèces</td>
              <td width="3"></td>
              <td style="background:#fff;border:1px solid #e0e0e0;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:700;color:#555;text-align:center;white-space:nowrap">🎫 Chèques vacances</td>
            </tr>
          </table>
          <p style="margin:10px 0 4px;font-size:11px;color:#e67e22;font-weight:700;font-style:italic">⚠️ Virement bancaire accepté jusqu'au 15 juin.</p>
          <p style="margin:4px 0 0;font-size:12px;color:#888;line-height:1.8">
            Pour le virement ou chèque, merci de préciser le nom de votre enfant en référence.<br/>
            <span style="display:block;text-align:center;margin-top:8px">Le chèque est à libeller à l'ordre de : <strong>SAUZEAU Charlène</strong></span>
            <span style="display:block;text-align:center;margin-top:8px">En avant saison, celui-ci est à envoyer à :<br/>
            <strong>Mme SAUZEAU Charlène<br/>4 allée des Roitelets<br/>44500 LA BAULE</strong></span>
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px">
            <tr>
              <td style="background:#EFF6FF;border:1.5px solid #1A8FE3;border-radius:10px;padding:14px 16px">
                <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#1A8FE3">🏦 Coordonnées bancaires pour virement</p>
                <table cellpadding="0" cellspacing="0" border="0" style="font-size:12px;color:#2C3E50;line-height:2">
                  <tr><td style="font-weight:700;padding-right:12px">Titulaire</td><td>SAUZEAU CHARLENE</td></tr>
                  <tr><td style="font-weight:700;padding-right:12px">IBAN</td><td>FR76 1027 8360 6600 0130 5200 228</td></tr>
                  <tr><td style="font-weight:700;padding-right:12px">BIC</td><td>CMCIFR2A</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${reglementSections.join("")}

    <!-- PROCHAINES ÉTAPES -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px">
      <tr>
        <td style="background:#E8F5E9;border-left:4px solid #6BCB77;border-radius:8px;padding:16px 18px">
          <p style="margin:0 0 8px;font-size:13px;color:#2e7d32;font-weight:700">✅ Prochaines étapes</p>
          <ol style="font-size:13px;color:#555;line-height:1.9;margin:0;padding-left:18px">
            <li>Effectuez le règlement selon l'un des modes ci-dessus</li>
            <li>L'équipe Eole Beach Club valide votre pré-réservation</li>
            <li>Votre accès est activé dans l'application</li>
            <li>À vous la plage ! 🏖️</li>
          </ol>
        </td>
      </tr>
    </table>

    <!-- FOOTER -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#F0F4F8;border-radius:10px;padding:14px;text-align:center;font-size:11px;color:#888;line-height:1.8">
          <strong>Eole Beach Club · Club de Plage / École de Natation</strong><br/>
          Plage Saint-Michel · Rue des Caps Horniers · 44420 Piriac-sur-Mer<br/>
          📞 07 67 78 69 22 · clubdeplage.piriacsurmer@hotmail.com<br/>
          🌐 www.clubdeplage-piriacsurmer.fr<br/><br/>
          <em>Cet email est généré automatiquement depuis l'application Eole Beach Club.</em>
        </td>
      </tr>
    </table>

  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

      // Envoyer l'email via Brevo (Edge Function Supabase)
      const emailDest = user.email || "";
      if (emailDest) {
        try {
          await fetch("https://rnaosrftcntomehaepjh.supabase.co/functions/v1/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer sb_publishable_n9m3QjIKt9OnyN_d8n9cAQ_VQpUpnOu" },
            body: JSON.stringify({
              type: "confirmation",
              to: emailDest,
              toName: `${user.prenom} ${user.nom || ""}`.trim(),
              subject: "🏖️ Eole Beach Club — Confirmation de votre demande",
              htmlContent: emailHtml,
            }),
          });
        } catch(mailErr) {
          console.warn("Email non envoyé :", mailErr);
        }
      }

    } catch(e) { setError("Erreur : " + e.message); }
    setSending(false);
  };

  if (done) return (
    <div style={{ background:C.shell, minHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 28px", textAlign:"center" }}>
      <div style={{ fontSize:80, marginBottom:16 }}>📨</div>
      <h2 style={{ color:C.ocean, margin:"0 0 8px" }}>Demande envoyée !</h2>
      <p style={{ color:"#888", fontSize:14, lineHeight:1.8 }}>
        Toutes vos prestations ont été enregistrées.<br/>
        L'équipe Eole Beach Club vous contactera pour le paiement.
      </p>
      <div style={{ background:`${C.ocean}10`, borderRadius:14, padding:"12px 20px", margin:"12px 0 24px", fontSize:13, color:C.ocean, fontWeight:700 }}>
        ⏳ Vos accès seront activés à réception du paiement
      </div>
      <SunBtn color={C.ocean} onClick={() => { setDone(false); onNav("home"); }}>Retour à l'accueil</SunBtn>
    </div>
  );

  return (
    <div style={{ background:C.shell, minHeight:"100%" }}>
      <div style={{ background:`linear-gradient(135deg,${C.ocean},${C.sea})`, padding:"20px 20px 0" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <BackBtn onNav={onNav} to="home" />
          <div>
            <h2 style={{ color:"#fff", margin:0, fontWeight:900, fontSize:20 }}>🛒 Mon panier</h2>
            <p style={{ color:"rgba(255,255,255,0.8)", margin:0, fontSize:12 }}>{panier.length} prestation{panier.length>1?"s":""}</p>
          </div>
        </div>
        <Wave fill={C.shell} />
      </div>

      <div style={{ padding:"12px 18px 100px", display:"flex", flexDirection:"column", gap:12 }}>
        {panier.length === 0 ? (
          <div style={{ textAlign:"center", padding:"48px 24px" }}>
            <div style={{ fontSize:64, marginBottom:12 }}>🛒</div>
            <h3 style={{ color:C.dark, margin:"0 0 8px" }}>Panier vide</h3>
            <p style={{ color:"#888", fontSize:14 }}>Ajoutez des prestations depuis les écrans Formules</p>
            <SunBtn color={C.ocean} onClick={() => onNav("formules")} style={{ marginTop:16 }}>Voir les formules</SunBtn>
          </div>
        ) : (
          <>
            {/* Regrouper les items natation par enfant */}
            {(() => {
              // Séparer nat et non-nat
              const natItems = panier.filter(i => i.type === "natation");
              const autresItems = panier.filter(i => i.type !== "natation");

              // Regrouper natation par enfant
              const natParEnfant = {};
              natItems.forEach(item => {
                const enfantKey = (item.enfants?.length > 0 ? item.enfants.join("+") : item.enfant || "sans");
                if (!natParEnfant[enfantKey]) natParEnfant[enfantKey] = { enfants: item.enfants || (item.enfant ? [item.enfant] : []), items: [] };
                natParEnfant[enfantKey].items.push(item);
              });

              return (
                <>
                  {/* Items natation groupés par enfant */}
                  {Object.entries(natParEnfant).map(([key, groupe]) => {
                    const totalCreneaux = groupe.items.flatMap(i => i.creneaux || []);
                    const enfantLabel = groupe.enfants.length > 0 ? groupe.enfants.join(", ") : "Sans nom";
                    const nbSeances = totalCreneaux.length;
                    const prixForfait = getPrixNat(nbSeances);
                    const prixBase = nbSeances * 20;
                    const economie = prixBase - prixForfait;
                    const forfaitLabel = nbSeances === 1 ? "Tarif unitaire" : `Forfait ${nbSeances} leçons`;
                    return (
                      <div key={key} style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:"0 4px 14px rgba(0,0,0,0.06)", borderLeft:`4px solid ${C.ocean}` }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:900, color:C.dark, fontSize:14 }}>🏊 Natation · {enfantLabel}</div>
                            <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:4 }}>
                              <span style={{ fontSize:12, color:C.ocean, fontWeight:700 }}>{nbSeances} créneau{nbSeances>1?"x":""}</span>
                              <span style={{ background:`${C.ocean}15`, color:C.ocean, borderRadius:50, padding:"1px 8px", fontSize:10, fontWeight:800 }}>{forfaitLabel}</span>
                              {economie > 0 && <span style={{ background:`${C.green}15`, color:C.green, borderRadius:50, padding:"1px 8px", fontSize:10, fontWeight:800 }}>🎁 -{economie} €</span>}
                            </div>
                            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                              {totalCreneaux.map((c,i) => (
                                <span key={i} style={{ background:`${C.ocean}15`, color:C.ocean, borderRadius:8, padding:"2px 8px", fontSize:10, fontWeight:700 }}>
                                  {c.time} · {parseLocalDate(c.dayISO).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                            <div style={{ fontWeight:900, fontSize:16, color:C.ocean }}>{prixForfait} €</div>
                            {economie > 0 && <div style={{ fontSize:11, color:"#aaa", textDecoration:"line-through" }}>{prixBase} €</div>}
                            <button onClick={() => groupe.items.forEach(i => removeItem(i.id))} style={{ background:"#fff0f0", border:"none", color:"#e74c3c", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:16, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center" }}>🗑</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Autres items */}
                  {autresItems.map(item => (
                    <div key={item.id} style={{ background:"#fff", borderRadius:18, padding:16, boxShadow:"0 4px 14px rgba(0,0,0,0.06)", borderLeft:`4px solid ${item.color || C.coral}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:900, color:C.dark, fontSize:14 }}>{item.emoji} {item.label}</div>
                          {item.enfants?.length > 0 && <div style={{ fontSize:12, color:"#888", marginTop:2 }}>👤 {item.enfants.join(", ")}</div>}
                          {item.details && <div style={{ fontSize:11, color:"#aaa", marginTop:4 }}>{item.details}</div>}
                          {item.dates?.length > 0 && (
                            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:6 }}>
                              {item.dates.map((d,i) => (
                                <span key={i} style={{ background:`${item.color||C.coral}15`, color:item.color||C.coral, borderRadius:8, padding:"2px 8px", fontSize:10, fontWeight:700 }}>
                                  {new Date(d).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                          <div style={{ fontWeight:900, fontSize:16, color:item.color||C.coral }}>{item.prix} €</div>
                          <button onClick={() => removeItem(item.id)} style={{ background:"#fff0f0", border:"none", color:"#e74c3c", borderRadius:8, width:32, height:32, cursor:"pointer", fontSize:16, fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center" }}>🗑</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}

            {/* Total */}
            <div style={{ background:`linear-gradient(135deg,${C.ocean},${C.sea})`, borderRadius:18, padding:18, color:"#fff" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <div style={{ fontWeight:800, fontSize:15 }}>Total</div>
                <div style={{ fontWeight:900, fontSize:24 }}>{total} €</div>
              </div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>
                🏦 Virement · ✉️ Chèque · 💶 Espèces · 🎫 Chèques vacances
              </div>
            </div>

            {error && <div style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:12, padding:"10px 14px", fontSize:13, color:"#e74c3c", fontWeight:700 }}>⚠️ {error}</div>}

            <SunBtn color={sending ? "#aaa" : C.coral} full onClick={handleEnvoyer} disabled={sending}>
              {sending ? "⏳ Envoi en cours..." : `📨 Envoyer la demande · ${total} €`}
            </SunBtn>

            <button onClick={() => onNav("formules")} style={{ width:"100%", background:"transparent", border:`2px solid ${C.ocean}`, color:C.ocean, borderRadius:14, padding:"12px", cursor:"pointer", fontWeight:800, fontSize:14, fontFamily:"inherit" }}>
              ➕ Ajouter une nouvelle prestation
            </button>

            <div style={{ textAlign:"center", fontSize:12, color:"#aaa" }}>
              ⏳ Vos accès seront activés après réception du paiement
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function BottomNav({ current, onNav, panierCount = 0, hidepanier = false }) {
  const items = [
    { id:"home",             emoji:"🏠", label:"Accueil"    },
    { id:"formules",         emoji:"🎫", label:"Formules"   },
    { id:"reservation",      emoji:"🏊", label:"Réserver"   },
    { id:"mes-reservations", emoji:"🎫", label:"Mes accès"  },
    { id:"profil",           emoji:"👤", label:"Profil"     },
  ];
  return (
    <div style={{ background:"#fff", borderTop:"2.5px solid #EEF5FF", display:"flex", boxShadow:"0 -6px 24px rgba(0,102,204,0.09)" }}>
      {items.map(item => (
        <button key={item.id} onClick={() => onNav(item.id)} style={{ flex:1, background:"none", border:"none", padding:"9px 4px 11px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
          <span style={{ fontSize:21, filter:current===item.id?"none":"grayscale(0.6) opacity(0.5)" }}>{item.emoji}</span>
          <span style={{ fontSize:9, fontWeight:900, color:current===item.id?C.ocean:"#ccc", letterSpacing:0.2 }}>{item.label}</span>
          {current===item.id && <div style={{ width:18, height:3, background:`linear-gradient(90deg,${C.ocean},${C.sea})`, borderRadius:10, marginTop:1 }} />}
        </button>
      ))}
      {/* Bouton panier flottant */}
      {!hidepanier && <button onClick={() => onNav("panier")} style={{
        position:"fixed", bottom:80, right:18, zIndex:200,
        background: panierCount > 0 ? `linear-gradient(135deg,${C.coral},${C.sun})` : "#fff",
        border: panierCount > 0 ? "none" : `2px solid #e0e0e0`,
        borderRadius:"50%", width:52, height:52, cursor:"pointer",
        boxShadow: panierCount > 0 ? `0 6px 20px ${C.coral}55` : "0 2px 10px rgba(0,0,0,0.1)",
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:22,
        transition:"all .2s",
      }}>
        🛒
        {panierCount > 0 && (
          <div style={{ position:"absolute", top:-4, right:-4, background:C.ocean, color:"#fff", borderRadius:"50%", width:20, height:20, fontSize:11, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center" }}>
            {panierCount}
          </div>
        )}
      </button>}
    </div>
  );
}

// ── ADMIN CODE ACCESS ─────────────────────────────────────
const ADMIN_CODE = "club2026";

// Liste blanche emails admin (Option 2 — double protection avec is_admin en base)
const ADMIN_EMAILS = [
  "charlenesauzeau@mac.com",
  "clubdeplage.piriacsurmer@hotmail.com",
  "charlene-sauzeau@live.fr",
];

function ProfilConnecte({ user, setUser, setScreen, reservations }) {
  const [loading, setLoading]         = useState(true);
  const [liberteBalance, setLiberteBalance] = useState(user?.liberteBalance || 0);
  const [liberteTotal, setLiberteTotal]     = useState(user?.liberteTotal   || 0);
  const [enfants, setEnfants]         = useState(user?.enfants || []);
  const [facture, setFacture]         = useState(null); // facture générée par admin
  const [showAddEnfant, setShowAddEnfant] = useState(false);
  const [editEnfant, setEditEnfant]   = useState(null);
  const [enfantForm, setEnfantForm]   = useState({ prenom:"", nom:"", naissance:"", sexe:"", activite:"club", niveau:"debutant", allergies:"", personnesAutorisees:"" });
  const [savingEnfant, setSavingEnfant] = useState(false);

  const loadData = async () => {
    if (!user?.supabaseId) { setLoading(false); return; }
    const [{ data: membreFrais }, { data: enf }, { data: fac }] = await Promise.all([
      sb.from("membres").select("*").eq("id", user.supabaseId).single(),
      sb.from("enfants").select("*").eq("membre_id", user.supabaseId),
      sb.from("factures_numeros").select("*").eq("membre_id", user.supabaseId).order("created_at", { ascending: false }).limit(1),
    ]);
    // Mettre à jour user avec les données fraîches depuis Supabase
    if (membreFrais) {
      setUser(prev => ({ ...prev, ...membreFrais, supabaseId: membreFrais.id }));
      setLiberteBalance(membreFrais.liberte_balance || 0);
      setLiberteTotal(membreFrais.liberte_total || 0);
    }
    setEnfants(enf || []);
    setFacture(fac?.[0] || null);
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch(() => setLoading(false));
    // Rafraîchir la facture toutes les 30s (pour détecter suppression côté admin)
    const interval = setInterval(() => {
      if (user?.supabaseId) {
        sb.from("factures_numeros").select("*").eq("membre_id", user.supabaseId).order("created_at", { ascending: false }).limit(1)
          .then(({ data }) => setFacture(data?.[0] || null))
          .catch(() => {});
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [user?.supabaseId]);

  const openAddEnfant = () => {
    setEnfantForm({ prenom:"", nom:"", naissance:"", sexe:"", activite:"club", niveau:"debutant", allergies:"", personnesAutorisees:"" });
    setEditEnfant(null);
    setShowAddEnfant(true);
  };

  const openEditEnfant = (e) => {
    setEnfantForm({ prenom:e.prenom||"", nom:e.nom||"", naissance:e.naissance||"", sexe:e.sexe||"", activite:e.activite||"club", niveau:e.niveau||"debutant", allergies:e.allergies||"", personnesAutorisees:e.personnes_autorisees||"" });
    setEditEnfant(e);
    setShowAddEnfant(true);
  };

  const saveEnfant = async () => {
    if (!enfantForm.prenom || !enfantForm.naissance) { alert("Prénom et date de naissance requis."); return; }
    const age = calcAge(enfantForm.naissance);
    if (age < 2) { alert("L'enfant doit avoir au moins 2 ans."); return; }
    if (age > 13) { alert("L'inscription est réservée aux enfants de 13 ans maximum."); return; }
    setSavingEnfant(true);
    try {
      if (editEnfant) {
        await sb.from("enfants").update({ prenom:enfantForm.prenom, nom:enfantForm.nom, naissance:enfantForm.naissance, sexe:enfantForm.sexe, activite:enfantForm.activite, niveau:enfantForm.niveau, allergies:enfantForm.allergies, personnes_autorisees:enfantForm.personnesAutorisees }).eq("id", editEnfant.id);
      } else {
        await sb.from("enfants").insert([{ membre_id:user.supabaseId, prenom:enfantForm.prenom, nom:enfantForm.nom||user.nom, naissance:enfantForm.naissance, sexe:enfantForm.sexe, activite:enfantForm.activite, niveau:enfantForm.niveau, allergies:enfantForm.allergies, personnes_autorisees:enfantForm.personnesAutorisees }]);
      }
      await loadData();
      setShowAddEnfant(false);
    } catch(e) { alert("Erreur : " + e.message); }
    setSavingEnfant(false);
  };

  return (
    <>
      {/* Modal ajout/modification enfant */}
      {showAddEnfant && (
        <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", flexDirection:"column" }}>
          <div onClick={() => setShowAddEnfant(false)} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
          <div style={{ position:"relative", marginTop:"auto", background:"#F0F4F8", borderRadius:"28px 28px 0 0", maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
            <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
              <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
            </div>
            <div style={{ background:`linear-gradient(135deg,${C.ocean},${C.sea})`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
              <button onClick={() => setShowAddEnfant(false)} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
              <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>{editEnfant ? "✏️ Modifier l'enfant" : "➕ Ajouter un enfant"}</div>
              <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>{editEnfant ? editEnfant.prenom : user.prenom}</div>
            </div>
            <div style={{ overflowY:"auto", padding:"16px 16px 32px", display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <FInput label="Prénom *" value={enfantForm.prenom} onChange={v => setEnfantForm(p => ({...p, prenom:v}))} required />
                <FInput label="Nom" value={enfantForm.nom} onChange={v => setEnfantForm(p => ({...p, nom:v}))} />
              </div>
              <FInput label="Date de naissance *" type="date" value={enfantForm.naissance} onChange={v => setEnfantForm(p => ({...p, naissance:v}))} required />
              <div>
                <label style={{ fontSize:11, fontWeight:900, color:C.deep, display:"block", marginBottom:6, textTransform:"uppercase" }}>Sexe</label>
                <div style={{ display:"flex", gap:8 }}>
                  {[["M","👦 Garçon"],["F","👧 Fille"]].map(([val, label]) => (
                    <div key={val} onClick={() => setEnfantForm(p => ({...p, sexe:val}))} style={{ flex:1, textAlign:"center", padding:"10px", borderRadius:14, cursor:"pointer", fontWeight:800, fontSize:13, background:enfantForm.sexe===val?(val==="M"?C.green:"#9B59B6"):"#f0f0f0", color:enfantForm.sexe===val?"#fff":"#888" }}>{label}</div>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:900, color:C.deep, display:"block", marginBottom:6, textTransform:"uppercase" }}>Activité</label>
                <div style={{ display:"flex", gap:8 }}>
                  {[["club","🏖️ Club"],["natation","🏊 Natation"],["les deux","🏖️🏊 Les deux"]].map(([val, label]) => (
                    <div key={val} onClick={() => setEnfantForm(p => ({...p, activite:val}))} style={{ flex:1, textAlign:"center", padding:"9px 4px", borderRadius:14, cursor:"pointer", fontWeight:800, fontSize:11, background:enfantForm.activite===val?C.sea:"#f0f0f0", color:enfantForm.activite===val?"#fff":"#888" }}>{label}</div>
                  ))}
                </div>
              </div>
              {(enfantForm.activite==="natation"||enfantForm.activite==="les deux") && (
                <div>
                  <label style={{ fontSize:11, fontWeight:900, color:C.deep, display:"block", marginBottom:5, textTransform:"uppercase" }}>Niveau 🏊</label>
                  <div style={{ display:"flex", gap:6 }}>
                    {[["debutant","🌱 Débutant"],["intermediaire","🌊 Intermédiaire"],["avance","🏊 Avancé"]].map(([val, label]) => (
                      <div key={val} onClick={() => setEnfantForm(p => ({...p, niveau:val}))} style={{ flex:1, textAlign:"center", padding:"8px 4px", borderRadius:12, cursor:"pointer", fontWeight:800, fontSize:11, background:enfantForm.niveau===val?C.ocean:"#f0f0f0", color:enfantForm.niveau===val?"#fff":"#888" }}>{label}</div>
                    ))}
                  </div>
                </div>
              )}
              <FInput label="Allergies / infos médicales" value={enfantForm.allergies} onChange={v => setEnfantForm(p => ({...p, allergies:v}))} placeholder="Aucune si vide" />
              <FInput label="Personnes autorisées à récupérer l'enfant" value={enfantForm.personnesAutorisees} onChange={v => setEnfantForm(p => ({...p, personnesAutorisees:v}))} placeholder="Ex: Marie Dupont (grand-mère)…" />
              <SunBtn color={savingEnfant?"#aaa":C.ocean} full onClick={saveEnfant} disabled={savingEnfant}>
                {savingEnfant ? "⏳ Enregistrement..." : editEnfant ? "✅ Enregistrer les modifications" : "✅ Ajouter l'enfant"}
              </SunBtn>
            </div>
          </div>
        </div>
      )}

      <Card style={{ marginTop:14 }}>
        <div style={{ textAlign:"center", marginBottom:16 }}>
          <div style={{ width:72, height:72, borderRadius:24, background:`linear-gradient(135deg,${C.ocean},${C.sea})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:36, margin:"0 auto 12px" }}>👤</div>
          <h2 style={{ color:C.dark, margin:"0 0 4px" }}>{user.prenom} {NOM(user.nom)}</h2>
          <p style={{ color:"#888", fontSize:13, margin:"0 0 2px" }}>{user.email}</p>
          <p style={{ margin:0 }}><a href={`tel:${user.tel}`} style={{ color:C.ocean, fontWeight:700, textDecoration:"none", fontSize:13 }}>📞 {user.tel}</a></p>
        </div>

        {/* Enfants */}
        <div style={{ borderTop:"1px solid #f0f0f0", paddingTop:12, marginBottom:12 }}>
          <div style={{ fontWeight:800, color:C.dark, fontSize:13, marginBottom:8 }}>👧 Mes enfants inscrits</div>
          {enfants.length === 0 ? (
            <div style={{ fontSize:12, color:"#bbb", fontStyle:"italic", marginBottom:8 }}>Aucun enfant inscrit</div>
          ) : enfants.map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:`${C.sea}10`, border:`1.5px solid ${C.sea}30`, borderRadius:12, padding:"8px 12px", marginBottom:6 }}>
              <div>
                <span style={{ fontWeight:700, color:C.dark, fontSize:13 }}>{e.sexe==="M"?"👦":"👧"} {e.prenom} {NOM(e.nom)}</span>
                <div style={{ fontSize:11, color:"#aaa" }}>{e.activite==="club"?"🏖️ Club":e.activite==="natation"?"🏊 Natation":"🏖️🏊 Club & Natation"}</div>
              </div>
              <button onClick={() => openEditEnfant(e)} style={{ background:`${C.ocean}15`, border:"none", color:C.ocean, borderRadius:8, padding:"5px 10px", cursor:"pointer", fontWeight:800, fontSize:11, fontFamily:"inherit" }}>✏️ Modifier</button>
            </div>
          ))}
          <button onClick={openAddEnfant} style={{ width:"100%", background:`${C.ocean}08`, border:`2px dashed ${C.ocean}30`, color:C.ocean, borderRadius:12, padding:"10px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>
            ➕ {enfants.length === 0 ? "Ajouter un enfant" : "Ajouter un autre enfant"}
          </button>
        </div>

        {/* Facture si disponible */}
        {facture && (
          <div style={{ borderTop:"1px solid #f0f0f0", paddingTop:12, marginBottom:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontWeight:800, color:C.dark, fontSize:13 }}>🧾 Ma facture</div>
              <button onClick={() => loadData()} style={{ background:"none", border:"none", color:"#aaa", cursor:"pointer", fontSize:16, padding:4 }} title="Actualiser">🔄</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:`${C.ocean}08`, border:`1.5px solid ${C.ocean}30`, borderRadius:12, padding:"10px 14px" }}>
              <div>
                <div style={{ fontWeight:800, color:C.ocean, fontSize:13 }}>{facture.numero}</div>
                <div style={{ fontSize:11, color:"#aaa" }}>
                  {facture.date_emission ? (() => { const p=facture.date_emission.slice(0,10).split("-"); return `Émise le ${p[2]}/${p[1]}/${p[0]}`; })() : ""}
                  {facture.total ? ` · ${facture.total} €` : ""}
                </div>
              </div>
              <button onClick={() => {
                const contenu = facture.contenu || {};
                const lignesNat  = (contenu.groupesNat||[]).map(g => `<tr><td><strong>${g.label}</strong><br/><span style="font-size:11px;color:#888">${g.detail}</span></td><td style="text-align:right;font-weight:700">${g.montant} €</td></tr>`).join("");
                const lignesClub = (contenu.groupesClub||[]).map(g => `<tr><td><strong>${g.label}</strong><br/><span style="font-size:11px;color:#888">${g.detail}</span></td><td style="text-align:right;font-weight:700">${g.montant} €</td></tr>`).join("");
                const lignesAc   = (contenu.acomptes||[]).map(a => `<tr style="background:#f0fdf4"><td style="color:#16a34a">✅ ${a.label} — ${new Date(a.date_paiement).toLocaleDateString("fr-FR")}</td><td style="text-align:right;color:#16a34a;font-weight:700">- ${a.montant} €</td></tr>`).join("");
                const adresse = [user.adresse, `${user.cp||""} ${user.ville||""}`].filter(Boolean).join("<br/>");
                const enfantsHtml = enfants.map(e => { const p=e.naissance?.slice(0,10).split("-")||[]; const ddn=p.length===3?`${p[2]}/${p[1]}/${p[0]}`:"—"; return `<tr><td>${e.sexe==="M"?"👦":"👧"} ${e.prenom} ${(e.nom||"").toUpperCase()}</td><td style="text-align:center">${ddn}</td></tr>`; }).join("");
                const dateEm = facture.date_emission ? (() => { const p=facture.date_emission.slice(0,10).split("-"); return `${p[2]}/${p[1]}/${p[0]}`; })() : "";
                const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${facture.numero}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#1a1a1a;padding:40px;font-size:13px}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #1A8FE3}.club h1{font-size:18px;color:#1A8FE3;margin-bottom:4px}.club p{font-size:11px;color:#555;line-height:1.7}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#1A8FE3;color:#fff;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:8px 12px;border-bottom:1px solid #f0f0f0}.total-box{background:linear-gradient(135deg,#1A8FE3,#4ECDC4);color:#fff;padding:14px 18px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin:14px 0}.tva{text-align:center;font-size:11px;color:#666;font-style:italic;margin-top:10px}.footer{margin-top:20px;text-align:center;font-size:10px;color:#888;line-height:1.8}@media print{.no-print{display:none}}</style></head><body>
<div class="header"><div class="club"><h1>🏖️ Eole Beach Club</h1><p>Club de Plage · École de Natation<br/>Plage Saint-Michel · Rue des Caps Horniers · 44420 Piriac-sur-Mer<br/>SIRET : 839 887 072 00024</p></div><div style="text-align:right"><div style="font-size:20px;font-weight:900;color:#1A8FE3">${facture.numero}</div><div style="font-size:11px;color:#888">Émise le ${dateEm}</div></div></div>
<div style="background:#f8faff;border:1.5px solid #dbe8ff;border-radius:8px;padding:14px 18px;margin-bottom:16px"><div style="font-size:10px;text-transform:uppercase;color:#888;margin-bottom:6px">Facture établie pour</div><div style="font-size:15px;font-weight:900">${user.prenom} ${(user.nom||"").toUpperCase()}</div><div style="font-size:12px;color:#555;line-height:1.7">${adresse}${user.email?"<br/>"+user.email:""}${user.tel?"<br/>📞 "+user.tel:""}</div></div>
${enfants.length>0?`<div style="font-size:10px;text-transform:uppercase;color:#888;margin-bottom:6px;margin-top:12px">Enfant(s) inscrit(s)</div><table><thead><tr><th>Nom</th><th style="text-align:center">Date de naissance</th></tr></thead><tbody>${enfantsHtml}</tbody></table>`:""}
<div style="font-size:10px;text-transform:uppercase;color:#888;margin-bottom:6px;margin-top:12px">Prestations — Saison 2026</div>
<table><thead><tr><th>Prestation</th><th style="text-align:right">Montant</th></tr></thead><tbody>${lignesNat}${lignesClub}${lignesAc}</tbody></table>
<div class="total-box"><span style="font-weight:700">MONTANT PAYÉ</span><span style="font-size:26px;font-weight:900">${facture.solde||0} €</span></div>
<div class="tva">TVA non applicable — article 293 B du CGI</div>
<div class="footer">Eole Beach Club · SIRET 839 887 072 00024<br/>Plage Saint-Michel · 44420 Piriac-sur-Mer · clubdeplage.piriacsurmer@hotmail.com</div>
<div class="no-print" style="text-align:center;margin-top:16px"><button onclick="window.print()" style="background:#1A8FE3;color:#fff;border:none;padding:10px 24px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:700">🖨️ Télécharger / Imprimer</button></div>
</body></html>`;
                const win = window.open("","_blank");
                if (win) { win.document.write(html); win.document.close(); }
              }} style={{ background:`linear-gradient(135deg,${C.ocean},${C.sea})`, border:"none", color:"#fff", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontWeight:900, fontSize:12, fontFamily:"inherit" }}>
                📥 Télécharger
              </button>
            </div>
          </div>
        )}

        <SunBtn color={C.sunset} full onClick={async () => {
          try { await sb.auth.signOut(); } catch(e) {}
          setUser(null); setScreenPersist("home");
        }}>Se déconnecter</SunBtn>
      </Card>
    </>
  );
}

function AdminCodeAccess({ onUnlock, user }) {
  const [open, setOpen]     = useState(false);
  const [code, setCode]     = useState("");
  const [error, setError]   = useState("");
  const [shake, setShake]   = useState(false);
  const [checking, setChecking] = useState(false);

  // Vérifier si l'utilisateur connecté est admin
  const userEmail = user?.email || "";
  const isWhitelisted = ADMIN_EMAILS.includes(userEmail.toLowerCase());

  const handleChange = async (val) => {
    const clean = val.slice(0, 8);
    setCode(clean);
    setError("");
    if (clean.length === 8) {
      if (clean.toLowerCase() !== ADMIN_CODE.toLowerCase()) {
        setError("Code incorrect");
        setShake(true);
        setTimeout(() => { setShake(false); setCode(""); setError(""); }, 800);
        return;
      }
      // Code correct — vérifier is_admin en base si connecté
      if (!user?.supabaseId) {
        setError("Vous devez être connecté pour accéder à l'admin.");
        setShake(true);
        setTimeout(() => { setShake(false); setCode(""); setError(""); }, 1200);
        return;
      }
      setChecking(true);
      try {
        const { data } = await sb.from("membres").select("is_admin, email").eq("id", user.supabaseId).single();
        const emailOk = ADMIN_EMAILS.includes((data?.email || "").toLowerCase());
        const dbOk    = data?.is_admin === true;
        if (emailOk || dbOk) {
          setOpen(false);
          setCode("");
          onUnlock();
        } else {
          setError("Accès non autorisé pour ce compte.");
          setShake(true);
          setTimeout(() => { setShake(false); setCode(""); setError(""); }, 1200);
        }
      } catch {
        setError("Erreur de vérification.");
        setShake(true);
        setTimeout(() => { setShake(false); setCode(""); setError(""); }, 1000);
      }
      setChecking(false);
    }
  };

  const handleOpen = () => {
    if (!user?.supabaseId) {
      alert("Vous devez être connecté pour accéder à l'espace administrateur.");
      return;
    }
    setOpen(true);
    setCode("");
    setError("");
    setTimeout(() => document.getElementById("admin-hidden-input")?.focus(), 100);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div onClick={handleOpen} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#f0f0f0", borderRadius: 12, padding: "10px 16px", cursor: "pointer", border: "1.5px solid #e0e0e0" }}>
        <span style={{ fontSize: 14 }}>⚙️</span>
        <span style={{ fontSize: 12, color: "#888", fontWeight: 800 }}>Espace administrateur</span>
        <span style={{ fontSize: 12, color: "#ccc" }}>›</span>
      </div>

      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,10,30,0.7)", backdropFilter: "blur(6px)" }} />
          <div style={{
            position: "relative", background: "#fff", borderRadius: 28, padding: "36px 20px",
            width: "100%", maxWidth: 380, textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
            animation: shake ? "shake .4s" : "none",
          }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: "linear-gradient(135deg, #0F2027, #203A43)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, margin: "0 auto 16px" }}>⚙️</div>
            <h2 style={{ color: "#2C3E50", fontSize: 20, fontWeight: 900, margin: "0 0 6px" }}>Espace Admin</h2>
            <p style={{ color: "#888", fontSize: 13, margin: "0 0 24px" }}>Saisissez le code d'accès</p>

            {/* Input caché qui reçoit la vraie saisie */}
            <input
              id="admin-hidden-input"
              type="text"
              value={code}
              onChange={e => handleChange(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
              style={{ position: "absolute", opacity: 0, width: 1, height: 1, top: 0, left: 0 }}
            />

            {/* Cases visuelles */}
            <div onClick={() => document.getElementById("admin-hidden-input")?.focus()}
              style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20, cursor: "text" }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  width: 36, height: 48, borderRadius: 12,
                  border: `3px solid ${error ? "#e74c3c" : i < code.length ? "#1A8FE3" : i === code.length ? "#1A8FE3" : "#e0e0e0"}`,
                  background: error ? "#fff5f5" : i < code.length ? "#EEF8FF" : "#fafafa",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 900, color: "#2C3E50",
                  boxShadow: i === code.length ? `0 0 0 3px #1A8FE322` : "none",
                  transition: "all .15s",
                }}>
                  {i < code.length ? "•" : ""}
                </div>
              ))}
            </div>

            {error && (
              <div style={{ background: "#fff0f0", border: "1.5px solid #fca5a5", borderRadius: 12, padding: "8px 14px", marginBottom: 16, fontSize: 13, color: "#e74c3c", fontWeight: 700 }}>
                ❌ {error}
              </div>
            )}

            {checking && (
              <div style={{ background: "#EEF8FF", border: "1.5px solid #1A8FE3", borderRadius: 12, padding: "8px 14px", marginBottom: 16, fontSize: 13, color: C.ocean, fontWeight: 700 }}>
                ⏳ Vérification en cours…
              </div>
            )}

            <button onClick={() => setOpen(false)} style={{ background: "#f0f0f0", border: "none", color: "#888", borderRadius: 50, padding: "10px 28px", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-8px)} 80%{transform:translateX(4px)}
        }
      `}</style>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(() => {
    try {
      const savedScreen = localStorage.getItem("fncp_screen");
      const savedUser = localStorage.getItem("fncp_user");
      return savedScreen === "admin" && savedUser ? "admin" : "home";
    }
    catch { return "home"; }
  });

  const setScreenPersist = (s) => {
    setScreen(s);
    try { if (s === "admin") localStorage.setItem("fncp_screen", "admin"); else localStorage.removeItem("fncp_screen"); }
    catch {}
  };

  // Restaurer user depuis localStorage si disponible
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("fncp_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [sessions, setSessions] = useState(INIT_SESSIONS);
  const [allSeasonSessions, setAllSeasonSessions] = useState(ALL_SEASON_SLOTS_INIT);

  // Synchroniser les créneaux natation avec Supabase (suppressions/ajouts admin)
  useEffect(() => {
    sb.from("seances_natation").select("date, heure, spots").then(({ data }) => {
      if (!data || data.length === 0) return;
      setAllSeasonSessions(prev => {
        let updated = [...prev];
        data.forEach(({ date, heure, spots }) => {
          if (spots === -1) {
            // Supprimé par l'admin → retirer du client
            updated = updated.filter(slot => {
              const dayObj = ALL_SEASON_DAYS.find(d => d.id === slot.day);
              if (!dayObj?.date) return true;
              const d = dayObj.date;
              const dateISO = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
              return !(dateISO === date && slot.time === heure);
            });
          } else if (spots >= 0) {
            // Ajouté par l'admin → vérifier qu'il est présent
            const dayObj = ALL_SEASON_DAYS.find(d => {
              const dd = d.date;
              if (!dd) return false;
              const dateISO = `${dd.getFullYear()}-${String(dd.getMonth()+1).padStart(2,"0")}-${String(dd.getDate()).padStart(2,"0")}`;
              return dateISO === date;
            });
            if (dayObj && !updated.some(s => s.day === dayObj.id && s.time === heure)) {
              updated.push({ id: `sb-${date}-${heure}`, day: dayObj.id, time: heure, spots });
            }
          }
        });
        return updated;
      });
    }).catch(() => {});
  }, []);
  const [reservations, setReservations] = useState([]);
  const [clubPlaces, setClubPlaces] = useState({ matin: 45, apmidi: 45, journee: 45 });
  const [panier, setPanier]         = useState([]); // reset à chaque session

  // Sauvegarder user dans localStorage à chaque changement
  useEffect(() => {
    try {
      if (user) localStorage.setItem("fncp_user", JSON.stringify(user));
      else localStorage.removeItem("fncp_user");
    } catch {}
  }, [user]);

  // Rafraîchir les données membre au focus de la fenêtre
  useEffect(() => {
    const refreshUser = async () => {
      try {
        const { data: { session } } = await sb.auth.getSession();
        if (!session?.user) return;
        const { data } = await sb.from("membres").select("*, enfants(*)").eq("id", session.user.id).single();
        if (data) setUser(prev => prev ? { ...prev, ...data, enfants: data.enfants, supabaseId: data.id } : null);
      } catch {}
    };
    window.addEventListener("focus", refreshUser);
    return () => window.removeEventListener("focus", refreshUser);
  }, []);

  // Écouter les changements d'authentification Supabase (magic link)
  useEffect(() => {
    // Vérifier si déjà connecté (session Supabase active)
      sb.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          // Chercher par id Supabase Auth pour avoir les données fraîches (même si admin a modifié l'email)
          sb.from("membres").select("*, enfants(*)").eq("id", session.user.id).single()
            .then(({ data }) => {
              if (data) setUser({ ...data, supabaseId: data.id });
              else {
                // Fallback par email
                sb.from("membres").select("*, enfants(*)").eq("email", session.user.email).single()
                  .then(({ data: d }) => {
                    if (d) setUser({ ...d, supabaseId: d.id });
                    else {
                      setUser({ email: session.user.email, prenom: "", nom: "", supabaseId: session.user.id });
                      // Admins sans fiche membre → accueil, pas inscription
                      if (ADMIN_EMAILS.includes((session.user.email||"").toLowerCase())) setScreen("home");
                    }
                  });
              }
            });
        }
      });

      // Auto-refresh de session toutes les 5 min
      const refreshInterval = setInterval(() => {
        sb.auth.refreshSession().catch(() => {});
      }, 5 * 60 * 1000);

      // Refresh immédiat au démarrage
      sb.auth.refreshSession().catch(() => {});

      // Écouter les connexions (magic link cliqué)
      const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          sb.from("membres").select("*, enfants(*)").eq("id", session.user.id).single()
            .then(({ data }) => {
              const membre = data || null;
              if (membre) {
                setUser({ ...membre, supabaseId: membre.id });
                const isAdmin = ADMIN_EMAILS.includes((membre.email||"").toLowerCase());
                const savedScreen = localStorage.getItem("fncp_screen");
                if (isAdmin && savedScreen === "admin") {
                  setScreen("admin");
                } else {
                  setScreen("home");
                }
              } else {
                setUser({ email: session.user.email, prenom: "", nom: "", supabaseId: session.user.id });
                // Admins → accueil, clients sans fiche → inscription
                const isAdminEmail = ADMIN_EMAILS.includes((session.user.email||"").toLowerCase());
                setScreen(isAdminEmail ? "home" : "inscription");
              }
            });
        }
        if (event === "SIGNED_OUT") {
          setUser(null);
          localStorage.removeItem("fncp_user");
          setScreen("home");
        }
        if (event === "TOKEN_REFRESHED" && session?.user) {
          sb.from("membres").select("*, enfants(*)").eq("id", session.user.id).single()
            .then(({ data }) => {
              if (data) setUser(prev => prev ? { ...prev, ...data, supabaseId: data.id } : null);
            }).catch(() => {});
        }
      });

      return () => {
        subscription.unsubscribe();
        clearInterval(refreshInterval);
      };
  }, []);
  const props = { onNav: setScreenPersist, user, setUser, sessions, setSessions, reservations, setReservations, allSeasonSessions, setAllSeasonSessions, clubPlaces, setClubPlaces, panier, setPanier };

  const renderScreen = () => {
    switch (screen) {
      case "home":             return <HomeScreen {...props} />;
      case "login":            return <LoginScreen {...props} />;
      case "formules":          return <FormulesChoixScreen {...props} />;
      case "formules-natation": return <FormulesNatationScreen {...props} />;
      case "formules-eveil":    return <FormulesEveilScreen {...props} />;
      case "reservation":      return <ReservationScreen {...props} />;
      case "prestations":      return <PrestationsScreen {...props} />;
      case "reservation-club": return <ReservationClubScreen {...props} />;
      case "mes-reservations": return <MesReservationsScreen {...props} />;
      case "panier":            return <PanierScreen {...props} />;
      case "inscription":      return (user?.supabaseId && !ADMIN_EMAILS.includes((user?.email||"").toLowerCase())) ? (
        <div style={{ padding:24, background:C.shell, minHeight:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <div style={{ fontSize:60, marginBottom:16 }}>👋</div>
          <h3 style={{ color:C.dark, margin:"0 0 8px", textAlign:"center" }}>Vous êtes déjà inscrit !</h3>
          <p style={{ color:"#888", fontSize:13, textAlign:"center", margin:"0 0 20px", lineHeight:1.6 }}>
            Votre compte est actif. Vous pouvez directement accéder aux réservations ou consulter votre profil.
          </p>
          <SunBtn color={C.ocean} full onClick={() => setScreen("home")}>🏖️ Retour à l'accueil</SunBtn>
          <div style={{ marginTop:10 }}>
            <button onClick={() => setScreen("profil")} style={{ background:"none", border:"none", color:C.coral, fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>
              👤 Voir mon profil →
            </button>
          </div>
        </div>
      ) : <InscriptionScreen {...props} />;
      case "infos":            return <InfosScreen {...props} />;
      case "admin":            return <AdminScreen {...props} />;
      case "profil":           return (
        <div style={{ padding:24, background:C.shell, minHeight:"100%" }}>
          <button onClick={() => setScreen("home")} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer" }}>←</button>
          {user ? (
            <ProfilConnecte user={user} setUser={setUser} setScreen={setScreen} reservations={reservations} />
          ) : (
            <Card style={{ textAlign:"center", marginTop:14 }}>
              <div style={{ fontSize:60, marginBottom:8 }}>🌊</div>
              <h3 style={{ color:C.dark, margin:"0 0 6px" }}>Bienvenue !</h3>
              <p style={{ color:"#888", fontSize:13, margin:"0 0 16px" }}>Connectez-vous pour accéder à votre espace personnel</p>
              <SunBtn color={C.ocean} onClick={() => setScreen("login")} style={{ marginBottom: 10 }}>🔑 Se connecter</SunBtn>
              <div style={{ marginTop: 10 }}>
                <button onClick={() => setScreen("inscription")} style={{ background:"none", border:"none", color:C.coral, fontSize:13, cursor:"pointer", fontFamily:"inherit", fontWeight:700 }}>
                  Pas encore de compte ? S'inscrire →
                </button>
              </div>
            </Card>
          )}
          {/* Accès Admin — visible uniquement pour les emails admin */}
          {user?.supabaseId && ADMIN_EMAILS.includes((user?.email||"").toLowerCase()) && (
            <AdminCodeAccess onUnlock={() => setScreenPersist("admin")} user={user} />
          )}
        </div>
      );
      default: return <HomeScreen {...props} />;
    }
  };

  const isAdmin = screen === "admin";

  useEffect(() => {
    document.body.style.background = isAdmin ? "#F0F4F8" : "#87CEEB";
  }, [isAdmin]);

  return (
    <div style={{ margin:"0 auto", minHeight:"100vh", display:"flex", flexDirection:"column", fontFamily:"'Nunito','Segoe UI',sans-serif", background: isAdmin ? "#F0F4F8" : C.shell }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body, #root { margin: 0; padding: 0; width: 100%; }
        input:focus, select:focus { border-color: #1A8FE3 !important; box-shadow: 0 0 0 3px rgba(26,143,227,0.15); outline: none; }
        a { text-decoration: none; color: inherit; }
        a:hover { text-decoration: underline; }
        ::-webkit-scrollbar { width: 0; }
        button { font-family: 'Nunito', sans-serif; }
      `}</style>
      <div style={{ flex:1, overflowY:"auto" }}>{renderScreen()}</div>
      {screen !== "inscription" && <BottomNav current={screen} onNav={setScreenPersist} panierCount={screen === "admin" ? 0 : panier.length} hidepanier={screen === "admin"} />}
    </div>
  );
}
// seances sync client Mon Apr  6 22:49:47 CEST 2026
