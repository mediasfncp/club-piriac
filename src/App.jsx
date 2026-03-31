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
            <span style={{ color: "#fff", fontSize: 18, fontWeight: 900, letterSpacing: 4, textTransform: "uppercase" }}>FNCP</span>
          </div>
          <h1 style={{ color: "#fff", fontSize: 29, margin: "6px 0 2px", fontWeight: 900, textShadow: "0 3px 14px rgba(0,0,0,0.22)", letterSpacing: -0.5 }}>Clubs de Plage</h1>
          <p style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, margin: "0 0 2px", fontWeight: 700 }}>
            {user ? `Bonjour ${user.prenom} 👋` : "Club de plage · Natation · Soleil pour tous !"}
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
            { screen: "reservation",      emoji: "🏊", label: "Réserver",              sub: "Créneaux 30 min",            bg: `linear-gradient(135deg, ${C.sea}, #00B09B)`,      sh: C.sea   },
            { screen: "prestations",      emoji: "🏖️", label: "Club de Plage",        sub: "Demi-journée matin / après-midi", bg: `linear-gradient(135deg, ${C.coral}, ${C.sunset})`, sh: C.coral },
            { screen: "mes-reservations", emoji: "📅", label: "Mes séances",           sub: "Historique & suivi",         bg: `linear-gradient(135deg, ${C.green}, #27AE60)`,    sh: C.green },
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
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Séances de 30 min · Chaque dimanche</div>
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

function FormulesEveilScreen({ onNav, user }) {
  const [eveilSundays, setEveilSundays] = useState(() => buildEveilSundays());
  const [selectedSunday, setSelectedSunday] = useState(0);
  const [booking, setBooking] = useState(null);
  const [done, setDone] = useState(null);
  const [showWero, setShowWero] = useState(false);

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
          Pour réserver une séance d'éveil aquatique, tu dois d'abord t'inscrire au Club de Plage FNCP.
        </p>
        <SunBtn color={C.coral} onClick={() => onNav("inscription")} style={{ marginBottom: 14 }}>📋 S'inscrire maintenant</SunBtn>
        <button onClick={() => onNav("home")} style={{ background: "none", border: "none", color: "#aaa", fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>← Retour à l'accueil</button>
      </div>
    </div>
  );

  const handleBook = (sundayIdx, slotId) => {
    setBooking({ sundayIdx, slotId });
  };

  const confirmBook = () => {
    setShowWero(true);
  };

  const onWeroSuccess = () => {
    setShowWero(false);
    setEveilSundays(prev => prev.map((sun, si) =>
      si === booking.sundayIdx
        ? { ...sun, slots: sun.slots.map(sl => sl.id === booking.slotId ? { ...sl, spots: Math.max(0, sl.spots - 1) } : sl) }
        : sun
    ));
    const sun = eveilSundays[booking.sundayIdx];
    const sl = sun.slots.find(s => s.id === booking.slotId);
    // Programmer rappel veille à 20h
    const resaDate = new Date(sun.date);
    const resaDateISO = `${resaDate.getFullYear()}-${String(resaDate.getMonth()+1).padStart(2,"0")}-${String(resaDate.getDate()).padStart(2,"0")}`;
    const rappelDate = getRappelDate(resaDateISO);
    scheduleRappel({
      titre: "🌊 Rappel Éveil Aquatique demain !",
      corps: `Séance d'éveil aquatique demain à ${sl.time}. N'oublie pas !`,
      dateStr: rappelDate,
    });
    setDone({ sunday: sun.label, slot: sl.time, rappelDate });
    setBooking(null);
  };

  if (done) return (
    <div style={{ padding: 32, textAlign: "center", background: C.shell, minHeight: "100%" }}>
      <div style={{ width: 90, height: 90, borderRadius: "50%", background: "linear-gradient(135deg, #9B59B6, #8E44AD)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, margin: "0 auto 20px" }}>✓</div>
      <h2 style={{ color: "#9B59B6", fontSize: 24, margin: "0 0 8px" }}>Réservation confirmée !</h2>
      <p style={{ color: "#666", fontSize: 15, lineHeight: 1.6 }}>
        🌊 Éveil Aquatique<br />
        <strong>{done.sunday}</strong><br />
        🕐 {done.slot}
      </p>
      <p style={{ color: "#aaa", fontSize: 13 }}>20 €</p>
      {done.rappelDate && <RappelBanner rappels={[done]} />}
      <div style={{ marginTop: 16 }}>
        <SunBtn color="#9B59B6" onClick={() => { setDone(null); }}>Réserver un autre créneau</SunBtn>
      </div>
      <div style={{ marginTop: 14 }}>
        <button onClick={() => onNav("home")} style={{ background: "none", border: "none", color: "#aaa", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>← Retour à l'accueil</button>
      </div>
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
          <div style={{ background: "#F3E8FF", border: "2px solid #9B59B640", borderRadius: 16, padding: "14px 18px" }}>
            <div style={{ fontWeight: 900, color: "#9B59B6", marginBottom: 4 }}>💰 Tarif : 20 €</div>
            <div style={{ fontSize: 13, color: "#777" }}>1 séance d'éveil aquatique · 30 min</div>
          </div>
          <SunBtn color="#9B59B6" full onClick={confirmBook}>🌊 Payer et confirmer · 20 €</SunBtn>
          {showWero && (
            <WeroModal
              amount={20}
              label="Éveil Aquatique · 1 séance"
              onSuccess={onWeroSuccess}
              onCancel={() => setShowWero(false)}
            />
          )}
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
function FormulesNatationScreen({ onNav }) {
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(false);
  const [showWero, setShowWero] = useState(false);
  if (done) return (
    <div style={{ padding: 32, textAlign: "center", background: C.shell, minHeight: "100%" }}>
      <div style={{ fontSize: 90 }}>🎉</div>
      <h2 style={{ color: C.green, fontSize: 24 }}>Super choix !</h2>
      <p style={{ color: "#666" }}>Ta formule <strong>{selected?.label}</strong> ({selected?.price} €) est enregistrée.</p>
      <SunBtn color={C.ocean} onClick={() => { setDone(false); setSelected(null); onNav("home"); }}>Retour à l'accueil</SunBtn>
    </div>
  );
  return (
    <div style={{ background: C.shell, minHeight: "100%" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.ocean}, ${C.sea})`, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <BackBtn onNav={onNav} to="formules" />
          <div><h2 style={{ color: "#fff", margin: 0, fontWeight: 900, fontSize: 22 }}>🎫 Formules Natation</h2><p style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, margin: 0 }}>Choisis ta formule et plonge ! 🏊‍♀️</p></div>
        </div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding: "10px 18px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 13, marginBottom: 18 }}>
          {FORMULES_NAT.map(f => {
            const sel = selected?.id === f.id;
            return (
              <div key={f.id} onClick={() => setSelected(f)} style={{ background: sel ? `linear-gradient(135deg, ${f.color}18, ${f.color}08)` : "#fff", border: `3px solid ${sel ? f.color : "#f0f0f0"}`, borderRadius: 22, padding: "16px 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: sel ? `0 8px 28px ${f.color}33` : "0 4px 14px rgba(0,0,0,0.06)", transform: sel ? "scale(1.02)" : "scale(1)", transition: "all .2s" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 58, height: 58, borderRadius: 18, background: `linear-gradient(135deg, ${f.color}, ${f.color}aa)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>{f.emoji}</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 900, fontSize: 17, color: C.dark }}>{f.label}</span>
                      <Pill color={f.color}>{f.badge}</Pill>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: f.color }}>{f.price} €</div>
                    {f.saving && <div style={{ fontSize: 12, color: C.green, fontWeight: 800 }}>🎁 {f.saving}</div>}
                    <div style={{ fontSize: 11, color: "#bbb", marginTop: 1 }}>soit {(f.price / f.qty).toFixed(1)} €/leçon</div>
                  </div>
                </div>
                <div style={{ width: 26, height: 26, borderRadius: "50%", border: `3px solid ${sel ? f.color : "#ddd"}`, background: sel ? f.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13, transition: "all .2s", flexShrink: 0 }}>{sel ? "✓" : ""}</div>
              </div>
            );
          })}
        </div>
        {selected && (
          <Card style={{ background: `linear-gradient(135deg, ${selected.color}15, ${selected.color}05)`, border: `2px solid ${selected.color}40`, textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 6 }}>{selected.emoji}</div>
            <div style={{ fontWeight: 900, color: C.dark, marginBottom: 2 }}>Formule : {selected.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: selected.color, marginBottom: 16 }}>{selected.price} €</div>
            <SunBtn color={selected.color} full onClick={() => setShowWero(true)}>🔒 Payer et commander · {selected?.price} €</SunBtn>
            {showWero && (
              <WeroModal
                amount={selected?.price}
                label={`Formule Natation · ${selected?.label}`}
                onSuccess={() => { setShowWero(false); setDone(true); }}
                onCancel={() => setShowWero(false)}
              />
            )}
          </Card>
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
  const [selectedDayId, setSelectedDayId] = useState(CLUB_SEASON_DAYS[0]?.id);
  const [selectedSession, setSelectedSession] = useState(null);
  const [done, setDone] = useState(null);
  const [weekIdx, setWeekIdx] = useState(0);
  const [resasClubDB, setResasClubDB] = useState([]);

  // Charger les résas club pour calculer les places par date
  useEffect(() => {
    sb.from("reservations_club").select("date_reservation, session")
      .then(({ data }) => setResasClubDB(data || []))
      .catch(() => {});
  }, []);

  // Calculer places restantes pour la date et session sélectionnées
  const getPlacesForDate = (dateISO, session) => {
    const taken = resasClubDB.filter(r =>
      r.date_reservation?.slice(0,10) === dateISO && r.session === session
    ).length;
    return Math.max(0, 45 - taken);
  };

  // Build weeks
  const weeks = [];
  let wk = [];
  CLUB_SEASON_DAYS.forEach((d, i) => {
    wk.push(d);
    if (d.label === "Sam" || i === CLUB_SEASON_DAYS.length - 1) { weeks.push(wk); wk = []; }
  });
  const currentWeek = weeks[Math.min(weekIdx, weeks.length-1)] || [];
  const handleWeekChange = (idx) => { setWeekIdx(idx); const w = weeks[Math.min(idx, weeks.length-1)]; if (w?.length) setSelectedDayId(w[0].id); };

  if (!user) return (
    <div style={{ background:C.shell,minHeight:"100%",display:"flex",flexDirection:"column" }}>
      <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`,padding:"20px 20px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}><BackBtn onNav={onNav} to="profil" /><h2 style={{ color:"#fff",margin:0,fontWeight:900 }}>🏖️ Réserver Club</h2></div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",textAlign:"center" }}>
        <div style={{ fontSize:72 }}>🔒</div>
        <h2 style={{ color:C.dark }}>Inscription requise</h2>
        <SunBtn color={C.coral} onClick={() => onNav("inscription")}>📋 S'inscrire</SunBtn>
      </div>
    </div>
  );

  const balance = user.liberteBalance || 0;

  if (balance === 0) return (
    <div style={{ background:C.shell,minHeight:"100%",display:"flex",flexDirection:"column" }}>
      <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`,padding:"20px 20px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:8 }}><BackBtn onNav={onNav} to="profil" /><h2 style={{ color:"#fff",margin:0,fontWeight:900 }}>🏖️ Réserver Club</h2></div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 24px",textAlign:"center" }}>
        <div style={{ fontSize:72 }}>🎟️</div>
        <h2 style={{ color:C.dark }}>Plus de demi-journées disponibles</h2>
        <p style={{ color:"#888",fontSize:14 }}>Recharge ta Carte Liberté pour continuer à réserver.</p>
        <SunBtn color={C.coral} onClick={() => onNav("prestations")}>Recharger ma carte</SunBtn>
      </div>
    </div>
  );

  if (done) return (
    <div style={{ minHeight:"100%",background:`linear-gradient(135deg,${C.coral},${C.sun})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 28px",textAlign:"center" }}>
      <div style={{ width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,0.25)",border:"3px solid rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:42 }}>✓</div>
      <h1 style={{ color:"#fff",fontSize:26,fontWeight:900,margin:"0 0 8px" }}>Réservation confirmée !</h1>
      <p style={{ color:"rgba(255,255,255,0.9)",fontSize:15,margin:"0 0 4px" }}>{done.day} · {done.session}</p>
      <div style={{ background:"rgba(255,255,255,0.2)",borderRadius:14,padding:"10px 20px",margin:"12px 0 24px" }}>
        <span style={{ color:"#fff",fontWeight:900 }}>🎟️ {user.liberteBalance} demi-j. restante{user.liberteBalance>1?"s":""}</span>
      </div>
      <button onClick={() => { setDone(null); setSelectedSession(null); onNav("profil"); }}
        style={{ background:"#fff",color:C.coral,border:"none",borderRadius:50,padding:"14px 36px",fontSize:15,fontWeight:900,cursor:"pointer",fontFamily:"inherit" }}>
        Voir mon compte
      </button>
    </div>
  );

  const weekLabel = currentWeek.length > 0 ? `${currentWeek[0].num} ${currentWeek[0].month} – ${currentWeek[currentWeek.length-1].num} ${currentWeek[currentWeek.length-1].month}` : "";
  const selectedDay = CLUB_SEASON_DAYS.find(d => d.id === selectedDayId);
  const selectedDayISO = selectedDay ? `${selectedDay.date.getFullYear()}-${String(selectedDay.date.getMonth()+1).padStart(2,"0")}-${String(selectedDay.date.getDate()).padStart(2,"0")}` : "";
  const SESSIONS = [
    { id:"matin",  label:"Demi-journée Matin",      horaires:"9h30 – 12h30",  color:C.coral,  emoji:"☀️", places: getPlacesForDate(selectedDayISO, "matin")  },
    { id:"apmidi", label:"Demi-journée Après-midi", horaires:"14h30 – 18h00", color:C.ocean,  emoji:"🌊", places: getPlacesForDate(selectedDayISO, "apmidi") },
  ];

  const handleConfirm = async () => {
    if (!selectedSession) return;
    setUser(prev => ({ ...prev, liberteBalance: Math.max(0, (prev.liberteBalance||0) - 1) }));
    if (setClubPlaces) setClubPlaces(prev => ({ ...prev, [selectedSession]: Math.max(0, (prev[selectedSession]||45) - 1) }));
    const s = SESSIONS.find(s => s.id === selectedSession);
    // Programmer rappel veille à 20h
    const resaDate = selectedDay?.date;
    let rappelDate = null;
    if (resaDate) {
      const iso = `${resaDate.getFullYear()}-${String(resaDate.getMonth()+1).padStart(2,"0")}-${String(resaDate.getDate()).padStart(2,"0")}`;
      rappelDate = getRappelDate(iso);
      scheduleRappel({
        titre: `🏖️ Rappel Club de Plage demain !`,
        corps: `${s?.label} demain (${s?.horaires}). À demain !`,
        dateStr: rappelDate,
      });
      // Sauvegarder dans Supabase
      try {
        await creerReservationClub({
          membreId:         user?.supabaseId || null,
          dateReservation:  iso,
          session:          selectedSession,
          labelJour:        `${selectedDay?.label} ${selectedDay?.num} ${selectedDay?.month}`,
          rappelDate:       rappelDate,
          enfants:          (user?.enfants || []).filter(e => e.activite === "club" || e.activite === "les deux").map(e => e.prenom),
        });
        const newBalance = Math.max(0, (user?.liberteBalance||0) - 1);
        if (user?.supabaseId) await updateLiberte(user.supabaseId, newBalance, user.liberteTotal || newBalance);
      } catch(e) { console.warn("Supabase:", e.message); }
    }
    setDone({ day: `${selectedDay?.label} ${selectedDay?.num} ${selectedDay?.month} 2026`, session: s?.label, rappelDate });
    setSelectedSession(null);
  };

  return (
    <div style={{ background:C.shell, minHeight:"100%" }}>
      <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, padding:"20px 20px 0" }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
          <BackBtn onNav={onNav} to="profil" />
          <div>
            <h2 style={{ color:"#fff",margin:0,fontWeight:900,fontSize:20 }}>🏖️ Réserver · Club de Plage</h2>
            <p style={{ color:"rgba(255,255,255,0.85)",margin:0,fontSize:12 }}>Carte Liberté · {balance} demi-j. restante{balance>1?"s":""}</p>
          </div>
        </div>
        {/* Solde carte */}
        <div style={{ background:"rgba(255,255,255,0.2)",borderRadius:16,padding:"10px 16px",marginBottom:4,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <span style={{ color:"#fff",fontWeight:800,fontSize:13 }}>🎟️ Solde Carte Liberté</span>
          <span style={{ color:"#fff",fontWeight:900,fontSize:20 }}>{balance} / {user.liberteTotal || balance}</span>
        </div>
        <Wave fill={C.shell} />
      </div>

      <div style={{ padding:"12px 18px 24px" }}>
        {/* Week nav */}
        <div style={{ background:"#fff",borderRadius:14,padding:"9px 14px",marginBottom:12,boxShadow:"0 2px 8px rgba(0,0,0,0.05)",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <button onClick={() => handleWeekChange(Math.max(0,weekIdx-1))} disabled={weekIdx===0} style={{ background:weekIdx===0?"#f0f0f0":C.coral,border:"none",color:weekIdx===0?"#bbb":"#fff",borderRadius:"50%",width:28,height:28,cursor:weekIdx===0?"not-allowed":"pointer",fontWeight:900,fontFamily:"inherit" }}>‹</button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontWeight:900,color:C.dark,fontSize:13 }}>Semaine {weekIdx+1}/{weeks.length}</div>
            <div style={{ fontSize:11,color:"#aaa" }}>{weekLabel} 2026</div>
          </div>
          <button onClick={() => handleWeekChange(Math.min(weeks.length-1,weekIdx+1))} disabled={weekIdx>=weeks.length-1} style={{ background:weekIdx>=weeks.length-1?"#f0f0f0":C.coral,border:"none",color:weekIdx>=weeks.length-1?"#bbb":"#fff",borderRadius:"50%",width:28,height:28,cursor:weekIdx>=weeks.length-1?"not-allowed":"pointer",fontWeight:900,fontFamily:"inherit" }}>›</button>
        </div>

        {/* Day selector */}
        <div style={{ display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:2 }}>
          {currentWeek.map(d => {
            const sel = selectedDayId === d.id;
            const dISO = `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}`;
            const placesM = getPlacesForDate(dISO, "matin");
            const placesA = getPlacesForDate(dISO, "apmidi");
            const fullDay = placesM === 0 && placesA === 0;
            return (
              <button key={d.id} onClick={() => { setSelectedDayId(d.id); setSelectedSession(null); }} style={{
                flexShrink:0,
                background: sel ? `linear-gradient(135deg,${C.coral},${C.sun})` : fullDay ? "#f5f5f5" : "#fff",
                border:"none",borderRadius:16,padding:"10px 14px",cursor:"pointer",
                fontFamily:"inherit",boxShadow:sel?`0 4px 14px ${C.coral}44`:"0 2px 8px rgba(0,0,0,0.06)",
                transition:"all .15s",minWidth:65,textAlign:"center",
                opacity: fullDay ? 0.5 : 1,
              }}>
                <div style={{ fontSize:10,fontWeight:900,color:sel?"rgba(255,255,255,0.8)":"#aaa" }}>{d.label}</div>
                <div style={{ fontSize:17,fontWeight:900,color:sel?"#fff":C.dark }}>{d.num}</div>
                <div style={{ fontSize:9,color:sel?"rgba(255,255,255,0.7)":fullDay?"#e74c3c":"#bbb",marginTop:3 }}>
                  {fullDay ? "Complet" : d.month}
                </div>
              </button>
            );
          })}
        </div>

        {/* Session choice */}
        <div style={{ display:"flex",flexDirection:"column",gap:12, marginBottom:14 }}>
          {SESSIONS.map(s => {
            const sel = selectedSession === s.id;
            const full = s.places === 0;
            return (
              <div key={s.id} onClick={() => !full && setSelectedSession(sel ? null : s.id)} style={{
                background: sel ? `linear-gradient(135deg,${s.color}20,${s.color}08)` : full ? "#f9f9f9" : "#fff",
                border:`2.5px solid ${sel?s.color:full?"#f0f0f0":"#f0f0f0"}`,
                borderRadius:20,padding:"16px 18px",cursor:full?"not-allowed":"pointer",
                boxShadow:sel?`0 6px 20px ${s.color}33`:"0 2px 10px rgba(0,0,0,0.05)",
                opacity:full?0.6:1,transition:"all .18s",
              }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div style={{ display:"flex",alignItems:"center",gap:14 }}>
                    <div style={{ width:50,height:50,borderRadius:16,background:full?"#eee":`linear-gradient(135deg,${s.color},${s.color}aa)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24 }}>{s.emoji}</div>
                    <div>
                      <div style={{ fontWeight:900,color:full?"#bbb":C.dark,fontSize:15 }}>{s.label}</div>
                      <div style={{ fontSize:12,color:"#888" }}>🕐 {s.horaires}</div>
                      <div style={{ fontSize:12,fontWeight:700,color:full?C.sunset:s.places<=10?C.coral:C.green,marginTop:2 }}>
                        {full?"🔴 Complet":`🟢 ${s.places}/45 places`}
                      </div>
                    </div>
                  </div>
                  <div style={{ width:26,height:26,borderRadius:"50%",border:`3px solid ${sel?s.color:"#ddd"}`,background:sel?s.color:"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:13 }}>{sel?"✓":""}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recap + confirm */}
        {selectedSession && selectedDay && (
          <Card style={{ background:`linear-gradient(135deg,${C.coral}12,${C.sun}08)`,border:`2px solid ${C.coral}30`,textAlign:"center" }}>
            <div style={{ fontWeight:900,color:C.dark,marginBottom:2 }}>
              {SESSIONS.find(s=>s.id===selectedSession)?.emoji} {SESSIONS.find(s=>s.id===selectedSession)?.label}
            </div>
            <div style={{ fontWeight:800,color:"#888",fontSize:13,marginBottom:8 }}>
              {selectedDay.label} {selectedDay.num} {selectedDay.month} 2026
            </div>
            <div style={{ background:`${C.coral}15`,borderRadius:12,padding:"8px",marginBottom:14,fontSize:13,color:C.coral,fontWeight:700 }}>
              🎟️ Décomptera 1 demi-journée · il restera {balance-1} après
            </div>
            <SunBtn color={C.coral} full onClick={handleConfirm}>✓ Confirmer la réservation</SunBtn>
          </Card>
        )}
      </div>
    </div>
  );
}

function PrestationsScreen({ onNav, clubPlaces, setClubPlaces, user, setUser }) {
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
    <div style={{ minHeight:"100%", background:`linear-gradient(160deg,${C.coral}cc,${C.sun})`, display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 28px",textAlign:"center" }}>
      <div style={{ width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,0.25)",border:"3px solid rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:44 }}>🎟️</div>
      <h1 style={{ color:"#fff",fontSize:28,fontWeight:900,margin:"0 0 8px" }}>Carte Liberté activée !</h1>
      <p style={{ color:"rgba(255,255,255,0.9)",fontSize:15,margin:"0 0 8px" }}>
        <strong>{getDjCount(selectedLiberte.label)} demi-journées</strong> créditées sur ton compte
      </p>
      <div style={{ background:"rgba(255,255,255,0.2)",borderRadius:16,padding:"10px 20px",marginBottom:8 }}>
        <span style={{ color:"#fff",fontWeight:900,fontSize:13 }}>⚠️ Valable uniquement sur la saison 2026</span>
      </div>
      <p style={{ color:"rgba(255,255,255,0.75)",fontSize:13,margin:"0 0 28px" }}>Du 6 juillet au 22 août 2026</p>
      <button onClick={() => { setDone(null); setSelectedLiberte(null); onNav("home"); }}
        style={{ background:"#fff",color:C.coral,border:"none",borderRadius:50,padding:"16px 40px",fontSize:16,fontWeight:900,cursor:"pointer",boxShadow:"0 8px 28px rgba(0,0,0,0.18)",fontFamily:"inherit" }}>
        C'est parti ! 🏖️
      </button>
    </div>
  );

  if (done === "club") return (
    <div style={{ padding:32, textAlign:"center", background:C.shell, minHeight:"100%" }}>
      <div style={{ fontSize:80 }}>📨</div>
      <h2 style={{ color:C.coral }}>Demande envoyée ! 🎉</h2>
      <div style={{ background:"#fff", borderRadius:20, padding:20, margin:"16px 0", boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:14, color:"#555", lineHeight:1.8 }}>
          Votre demande de réservation a bien été enregistrée.<br/>
          <strong>L'équipe FNCP va vous contacter</strong> pour finaliser le paiement par :<br/>
          🏦 Virement · ✉️ Chèque · 🎫 Chèques vacances
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
                  <button onClick={() => { setNbEnfants(Math.max(1, nbEnfants-1)); setSelectedRow(null); }} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: C.coral, color: "#fff", fontWeight: 900, fontSize: 18, cursor: "pointer" }}>−</button>
                  <span style={{ fontWeight: 900, fontSize: 20, color: C.dark, minWidth: 24, textAlign: "center" }}>{nbEnfants}</span>
                  <button onClick={() => {
                    const max = clubPlaces ? (clubPlaces[formulType] || 45) : 45;
                    if (nbEnfants < max) { setNbEnfants(nbEnfants+1); setSelectedRow(null); }
                  }} disabled={clubPlaces && nbEnfants >= (clubPlaces[formulType] || 45)}
                    style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: (clubPlaces && nbEnfants >= (clubPlaces[formulType] || 45)) ? "#ddd" : C.coral, color: "#fff", fontWeight: 900, fontSize: 18, cursor: (clubPlaces && nbEnfants >= (clubPlaces[formulType] || 45)) ? "not-allowed" : "pointer" }}>+</button>
                </div>
              </div>
              {nbEnfants > 3 && <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>3 enfants + {nbEnfants-3} enfant(s) supplémentaire(s)</div>}
            </Card>

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
              <SunBtn color={tarifData.color} full onClick={() => { setStep("dates"); setSelectedDates([]); }}>
                Choisir mes dates →
              </SunBtn>
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
                  {[["🏦","Virement bancaire"],["✉️","Chèque"],["🎫","Chèques vacances"]].map(([icon,label]) => (
                    <div key={label} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, fontSize:13, color:"#555" }}>
                      <span style={{ fontSize:16 }}>{icon}</span>{label}
                    </div>
                  ))}
                  <div style={{ fontSize:11, color:"#aaa", marginTop:8, fontStyle:"italic" }}>
                    Votre réservation sera confirmée à réception du paiement par l'équipe FNCP.
                  </div>
                </div>

                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={() => setStep("dates")} style={{ flex:1, background:"#f0f0f0", border:"none", color:"#888", borderRadius:14, padding:"11px", cursor:"pointer", fontWeight:800, fontFamily:"inherit" }}>← Dates</button>
                  <SunBtn color={tarifData.color} onClick={async () => {
                    // Créer résas en statut "pending"
                    try {
                      for (const iso of selectedDates) {
                        await creerReservationClub({
                          membreId: user?.supabaseId || null,
                          dateReservation: iso,
                          session: formulType === "journee" ? "matin" : formulType,
                          labelJour: new Date(iso).toLocaleDateString("fr-FR", {weekday:"long",day:"numeric",month:"long"}),
                          rappelDate: null,
                          enfants: (user?.enfants||[]).filter(e => e.activite==="club"||e.activite==="les deux").map(e=>e.prenom),
                        });
                      }
                    } catch(e) { console.warn(e); }
                    if (setClubPlaces) setClubPlaces(prev => ({ ...prev, [formulType]: Math.max(0, (prev[formulType]||45) - nbEnfants) }));
                    setDone("club");
                  }}>📨 Envoyer la demande · {selectedRow.price} €</SunBtn>
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
              <Card style={{ background: `${C.sun}15`, border: `2px solid ${C.sun}40`, textAlign: "center" }}>
                <div style={{ fontWeight: 900, color: C.dark, marginBottom: 4 }}>🎟️ {selectedLiberte.label}</div>
                <div style={{ background: `${C.coral}15`, borderRadius: 12, padding: "8px 12px", marginBottom: 8, fontSize: 12, color: C.coral, fontWeight: 700 }}>
                  ⚠️ Valable uniquement saison 2026 · 6 juil – 22 août
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.coral, marginBottom: 16 }}>{selectedLiberte.price} €</div>
                <SunBtn color={C.coral} full onClick={async () => {
                  // Crédite les demi-journées sur le compte utilisateur
                  if (setUser && user) {
                    const djCount = getDjCount(selectedLiberte.label);
                    const newBalance = (user.liberteBalance || 0) + djCount;
                    const newTotal = (user.liberteTotal || 0) + djCount;
                    setUser(prev => ({ ...prev, liberteBalance: newBalance, liberteTotal: newTotal }));
                    try {
                      if (user.supabaseId) await updateLiberte(user.supabaseId, newBalance, newTotal);
                      await enregistrerPaiement({
                        membreId: user.supabaseId || null,
                        montant:  selectedLiberte.price,
                        type:     'liberte',
                        label:    `Carte Liberté · ${selectedLiberte.label}`,
                      });
                    } catch(e) { console.warn("Supabase:", e.message); }
                  }
                  setDone("liberte");
                }}>Activer ma Carte Liberté 🎟️</SunBtn>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── RESERVATION ───────────────────────────────────────────
function ReservationScreen({ onNav, user, allSeasonSessions, setAllSeasonSessions, reservations, setReservations }) {
  const [weekIdx, setWeekIdx]           = useState(0);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [booking, setBooking]           = useState(null);
  const [selectedEnfants, setSelectedEnfants] = useState([]);
  const [done, setDone]                 = useState(null);
  const [showWero, setShowWero]         = useState(false);

  // Construire les semaines depuis ALL_SEASON_DAYS
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

  // Init selectedDayId quand semaine change
  useEffect(() => {
    if (currentWeek[0]) setSelectedDayId(currentWeek[0].id);
  }, [weekIdx]);

  // Synchroniser les places depuis Supabase au chargement
  useEffect(() => {
    sb.from("reservations_natation").select("date_seance, heure")
      .then(({ data }) => {
        if (!data?.length) return;
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

  // Date ISO du jour sélectionné
  const getDateISO = (day) => {
    if (!day?.date) return "";
    return `${day.date.getFullYear()}-${String(day.date.getMonth()+1).padStart(2,"0")}-${String(day.date.getDate()).padStart(2,"0")}`;
  };

  const handleConfirm = () => setShowWero(true);
  const onWeroSuccess = async () => {
    setShowWero(false);
    if (setAllSeasonSessions) setAllSeasonSessions(prev => prev.map(s => s.id === booking.id ? { ...s, spots: Math.max(0, s.spots-1) } : s));
    const resa = { ...booking, parent: user?.prenom || "Invité", enfants: selectedEnfants, id: Date.now() };
    setReservations(prev => [...prev, resa]);
    const resaDateISO = getDateISO(selectedDay);
    const rappelDate = getRappelDate(resaDateISO);
    scheduleRappel({ titre:"🏊 Rappel séance natation demain !", corps:`Ta séance à ${booking.time} est demain !`, dateStr:rappelDate });
    resa.rappelDate = rappelDate;
    try {
      await creerReservationNatation({ membreId:user?.supabaseId||null, jour:booking.day, heure:booking.time, dateSeance:resaDateISO, enfants:selectedEnfants, rappelDate, montant:20 });
      await enregistrerPaiement({ membreId:user?.supabaseId||null, montant:20, type:'natation', label:`Natation ${booking.time}`, transactionWero:null });
    } catch(e) { console.warn("Supabase:", e.message); }
    setDone(resa); setBooking(null); setSelectedEnfants([]);
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
      <div style={{ fontSize:90 }}>🎊</div>
      <h2 style={{ color:C.green, fontSize:24 }}>C'est réservé !</h2>
      <Card style={{ margin:"16px 0", textAlign:"left" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontSize:44 }}>🏊</div>
          <div>
            <div style={{ fontWeight:900, fontSize:24, color:C.ocean }}>{done.time}</div>
            <div style={{ color:"#666" }}>{selectedDay?.label} {selectedDay?.num} {selectedDay?.month} 2026</div>
            {done.enfants?.length > 0 && <div style={{ marginTop:6, display:"flex", gap:4, flexWrap:"wrap" }}>{done.enfants.map(e => <Pill key={e} color={C.sea}>{e}</Pill>)}</div>}
          </div>
        </div>
        {done.rappelDate && <RappelBanner rappels={[done]} />}
      </Card>
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
            <span style={{ color:"#aaa" }}>Tél.</span><span>{user?.tel||"—"}</span>
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
        <SunBtn color={C.green} full onClick={handleConfirm}>🏊 Payer et confirmer · 20 €</SunBtn>
        {showWero && <WeroModal amount={20} label={`Natation · ${booking?.time}`} onSuccess={onWeroSuccess} onCancel={() => setShowWero(false)} />}
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
function MesReservationsScreen({ onNav, reservations }) {
  return (
    <div style={{ background: C.shell, minHeight: "100%" }}>
      <div style={{ background: `linear-gradient(135deg, ${C.green}, #27AE60)`, padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}><BackBtn onNav={onNav} /><h2 style={{ color: "#fff", margin: 0, fontWeight: 900 }}>📅 Mes séances</h2></div>
        <Wave fill={C.shell} />
      </div>
      <div style={{ padding: "10px 18px 24px" }}>
        {reservations.length === 0 ? (
          <Card style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 60, marginBottom: 10 }}>🌊</div>
            <h3 style={{ color: C.dark }}>Aucune séance pour l'instant</h3>
            <p style={{ color: "#888", fontSize: 14 }}>Plonge et réserve ta première séance !</p>
            <SunBtn color={C.ocean} onClick={() => onNav("reservation")}>🏊 Réserver maintenant</SunBtn>
          </Card>
        ) : reservations.map(r => (
          <Card key={r.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg, ${C.ocean}, ${C.sea})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏊</div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22, color: C.ocean }}>{r.time}</div>
                  <div style={{ fontSize: 13, color: "#999" }}>{DAYS.find(d => d.id === r.day)?.label} {DAYS.find(d => d.id === r.day)?.num} Juillet · 30 min</div>
                </div>
              </div>
              <Pill color={C.green}>✓ Confirmé</Pill>
            </div>
            {r.enfants?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{r.enfants.map(e => <Pill key={e} color={C.sea}>{e}</Pill>)}</div>}
          </Card>
        ))}
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
          <h2 style={{ color: "#fff", margin: 0, fontWeight: 900, fontSize: 20 }}>Mon espace FNCP</h2>
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
  const [form, setForm] = useState({ prenom: "", nom: "", email: "", tel: "", tel2: "", adresse: "", ville: "", cp: "", enfants: [], droitImage: false, droitDiffusion: false });
  const [newEnfant, setNewEnfant] = useState({ prenom: "", nom: "", naissance: "", activite: "club", niveau: "debutant", allergies: "" });
  const [done, setDone] = useState(false);
  const [step1Error, setStep1Error] = useState(false);
  const f = k => v => setForm(p => ({ ...p, [k]: v }));

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
  const cpValid = /^\d{5}$/.test(form.cp);
  const step1Valid = form.prenom && form.nom && form.email && emailValid && form.tel && form.adresse && form.ville && form.cp && cpValid;

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
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, margin: "0 0 32px", fontWeight: 600 }}>Tu fais maintenant partie de la famille FNCP 🌊</p>
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
            <FInput label="Adresse" value={form.adresse} onChange={f("adresse")} required />
            {step1Error && !form.adresse && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ L'adresse est obligatoire</div>}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0 12px" }}>
              <div>
                <FInput label="Ville" value={form.ville} onChange={f("ville")} required />
                {step1Error && !form.ville && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ Obligatoire</div>}
              </div>
              <div>
                <FInput label="Code postal" value={form.cp} onChange={f("cp")} required />
                {form.cp && !cpValid && <div style={{ fontSize: 12, color: C.sunset, fontWeight: 700, marginTop: -10, marginBottom: 12 }}>⚠️ 5 chiffres</div>}
              </div>
            </div>
            {step1Error && (
              <div style={{ background: `${C.sunset}18`, border: `2px solid ${C.sunset}`, borderRadius: 14, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>⚠️</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.sunset }}>
                  {form.email && !emailValid ? "L'adresse email n'est pas valide (ex : prenom@exemple.fr)"
                    : form.cp && !cpValid ? "Le code postal doit contenir 5 chiffres (ex : 44500)"
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
            {form.enfants.map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: `${C.sea}18`, border: `2px solid ${C.sea}40`, borderRadius: 14, padding: "10px 14px", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, color: C.dark }}>{e.prenom} {NOM(e.nom)}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>
                    {e.naissance ? e.naissance.split("-").reverse().join("/") : ""} · {e.activite === "club" ? "🏖️ Club" : e.activite === "natation" ? "🏊 Natation" : "🏖️🏊 Club & Natation"}
                    {e.activite !== "club" && ` · ${e.niveau}`}
                  </div>
                  {e.allergies && <div style={{ fontSize: 12, color: C.sunset }}>⚠️ {e.allergies}</div>}
                </div>
                <button onClick={() => setForm(p => ({ ...p, enfants: p.enfants.filter(x => x.id !== e.id) }))} style={{ background: `${C.sunset}20`, border: "none", color: C.sunset, borderRadius: "50%", width: 28, height: 28, cursor: "pointer", fontWeight: 900 }}>✕</button>
              </div>
            ))}
            <div style={{ border: `2.5px dashed ${C.sea}`, borderRadius: 18, padding: 16, marginBottom: 14, background: `${C.sea}06` }}>
              <h4 style={{ color: C.ocean, marginTop: 0 }}>+ Ajouter un enfant</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
                <FInput label="Prénom" value={newEnfant.prenom} onChange={v => setNewEnfant(e => ({ ...e, prenom: v }))} required />
                <FInput label="Nom" value={newEnfant.nom} onChange={v => setNewEnfant(e => ({ ...e, nom: v }))} required />
              </div>
              <FInput label="Date de naissance" type="date" value={newEnfant.naissance} onChange={v => setNewEnfant(e => ({ ...e, naissance: v }))} required />
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 900, color: C.deep, display: "block", marginBottom: 6, letterSpacing: 0.5, textTransform: "uppercase" }}>Activité</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[["club","🏖️ Club"],["natation","🏊 Natation"],["les deux","🏖️🏊 Les deux"]].map(([val, label]) => (
                    <div key={val} onClick={() => setNewEnfant(e => ({ ...e, activite: val }))} style={{ flex: 1, textAlign: "center", padding: "9px 6px", borderRadius: 14, cursor: "pointer", fontWeight: 800, fontSize: 12, background: newEnfant.activite === val ? C.sea : "#f0f0f0", color: newEnfant.activite === val ? "#fff" : "#888", border: `2px solid ${newEnfant.activite === val ? C.sea : "transparent"}`, transition: "all .15s" }}>{label}</div>
                  ))}
                </div>
              </div>
              {(newEnfant.activite === "natation" || newEnfant.activite === "les deux") && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 900, color: C.deep, display: "block", marginBottom: 5, letterSpacing: 0.5, textTransform: "uppercase" }}>Niveau 🏊</label>
                  <select value={newEnfant.niveau} onChange={e => setNewEnfant(n => ({ ...n, niveau: e.target.value }))} style={{ width: "100%", border: `2.5px solid ${C.sky}`, borderRadius: 12, padding: "10px 14px", fontSize: 15, fontFamily: "inherit", background: "#fafcff" }}>
                    <option value="debutant">🌱 Débutant</option>
                    <option value="intermediaire">🌊 Intermédiaire</option>
                    <option value="avance">🏊 Avancé</option>
                  </select>
                </div>
              )}
              <FInput label="Allergies / informations médicales" value={newEnfant.allergies} onChange={v => setNewEnfant(e => ({ ...e, allergies: v }))} placeholder="Aucune si vide" />
              <SunBtn small color={C.sea} full onClick={() => {
                if (newEnfant.prenom && newEnfant.nom && newEnfant.naissance) {
                  const age = calcAge(newEnfant.naissance);
                  if (age < 3) { alert("L'enfant doit avoir au moins 3 ans pour s'inscrire."); return; }
                  setForm(p => ({ ...p, enfants: [...p.enfants, { ...newEnfant, id: Date.now() }] }));
                  setNewEnfant({ prenom: "", nom: "", naissance: "", activite: "club", niveau: "debutant", allergies: "" });
                }
              }}>+ Ajouter cet enfant</SunBtn>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <SunBtn color="#bbb" onClick={() => setStep(1)} style={{ flex: 1 }}>← Retour</SunBtn>
              <SunBtn color={C.coral} onClick={() => setStep(3)} style={{ flex: 2 }}>Suivant → Droits 📸</SunBtn>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <h3 style={{ color: C.dark, marginTop: 0 }}>📸 Droit à l'image</h3>
            <div style={{ background: `${C.sky}20`, border: `2px solid ${C.sky}`, borderRadius: 16, padding: 16, marginBottom: 20, fontSize: 14, color: "#555", lineHeight: 1.7 }}>
              Dans le cadre des activités du Club de Plage FNCP, des photos et/ou vidéos pourront être réalisées lors des séances. Ces images peuvent être utilisées à des fins de communication non commerciale.
            </div>
            {[
              { key: "droitImage",    label: "J'autorise le Club de Plage FNCP à photographier et/ou filmer mon/mes enfant(s) lors des activités.", icon: "📷" },
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

            {/* CGV acceptance */}
            <div style={{ background: `${C.deep}08`, border: `1.5px solid ${C.deep}25`, borderRadius: 14, padding: 14, marginBottom: 14 }}>
              <div style={{ fontWeight: 800, color: C.deep, fontSize: 13, marginBottom: 8 }}>📄 Conditions Générales de Vente</div>
              <div style={{ background: `${C.sunset}10`, border: `1px solid ${C.sunset}30`, borderRadius: 10, padding: "9px 12px", marginBottom: 10, fontSize: 12, color: "#555", lineHeight: 1.6 }}>
                💶 <strong>Remboursement :</strong> Aucune prestation ne pourra être remboursée, excepté sur présentation d'une attestation médicale justifiant l'impossibilité de participer.
              </div>
              <div onClick={() => setForm(p => ({ ...p, cgvAccepted: !p.cgvAccepted }))} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <div style={{ width: 22, height: 22, borderRadius: 8, border: `2.5px solid ${form.cgvAccepted ? C.green : "#ccc"}`, background: form.cgvAccepted ? C.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: 13, flexShrink: 0, marginTop: 1, transition: "all .15s" }}>
                  {form.cgvAccepted ? "✓" : ""}
                </div>
                <div style={{ fontSize: 12, color: "#555", lineHeight: 1.5 }}>
                  J'ai lu et j'accepte les <span style={{ color: C.ocean, fontWeight: 700, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onNav("infos"); }}>Conditions Générales de Vente</span> ainsi que le règlement intérieur du Club de Plage FNCP, et j'autorise la prise en charge de mon/mes enfant(s) dans le cadre des activités.
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
            <div>🏖️ <strong>Club de Plage FNCP</strong></div>
            <div>📍 Promenade des Sables, 44500 La Baule</div>
            <div>📞 <a href="tel:0240000000" style={{ color: C.ocean, fontWeight: 700 }}>02 40 00 00 00</a></div>
            <div>✉️ <a href="mailto:contact@fncp-plage.fr" style={{ color: C.ocean, fontWeight: 700 }}>contact@fncp-plage.fr</a></div>
            <div>🌐 <a href="https://www.fncp.fr" target="_blank" rel="noreferrer" style={{ color: C.ocean, fontWeight: 700 }}>www.fncp.fr</a></div>
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
                  { icon:"🔄", title:"Report de séance", text:"En cas d'annulation par le club (météo, force majeure), les séances seront reportées ou remboursées au prorata." },
                  { icon:"👶", title:"Responsabilité", text:"Les enfants sont placés sous la responsabilité des moniteurs diplômés pendant la durée de la prestation. Les parents sont responsables avant et après la séance." },
                  { icon:"⚠️", title:"Informations médicales", text:"Tout problème de santé, allergie ou contre-indication doit être signalé lors de l'inscription. Le club se réserve le droit de refuser un enfant pour des raisons de sécurité." },
                ].map(item => (
                  <div key={item.title} style={{ background:"#fff", borderRadius:14, padding:"12px 14px" }}>
                    <div style={{ fontWeight:900, color:C.deep, fontSize:13, marginBottom:4 }}>{item.icon} {item.title}</div>
                    <div style={{ fontSize:13, color:"#666", lineHeight:1.6 }}>{item.text}</div>
                  </div>
                ))}
                <div style={{ background:"#F0F4F8", borderRadius:12, padding:"10px 12px", fontSize:11, color:"#888", textAlign:"center" }}>
                  En effectuant une réservation, vous acceptez l'intégralité des présentes CGV.<br />
                  <span style={{ color:C.ocean, fontWeight:700 }}>FNCP · Club de Plage · La Baule · Saison 2026</span>
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
    sb.from("reservations_natation").select("date_seance, heure")
      .then(({ data }) => setDbResasNat(data || []))
      .catch(() => {});
  }, []);

  // Calculer places réelles par créneau selon Supabase
  const getSpots = (dayId, time) => {
    const dayObj = ALL_SEASON_DAYS.find(d => d.id === dayId);
    if (!dayObj?.date) return 2;
    const dateISO = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
    const taken = dbResasNat.filter(r => r.date_seance?.slice(0,10) === dateISO && r.heure === time).length;
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

  const doCancel = (id) => { setSessions(prev => prev.filter(x => x.id !== id)); setConfirmCancel(null); };

  const weekLabel = currentWeek.length > 0
    ? `${currentWeek[0].num} ${currentWeek[0].month} – ${currentWeek[currentWeek.length-1].num} ${currentWeek[currentWeek.length-1].month}`
    : "";

  const heuresDisponibles = [
    "09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30",
    "13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"
  ];

  const handleAddCreneau = () => {
    setAddError("");
    // Vérifier si ce créneau existe déjà ce jour
    const exists = daySessions.some(s => s.time === newHeure);
    if (exists) { setAddError(`Un créneau à ${newHeure} existe déjà ce jour.`); return; }
    const newSlot = {
      id: `custom-${selectedDayId}-${newHeure}-${Date.now()}`,
      day: selectedDayId,
      time: newHeure,
      spots: 2,
    };
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

      {/* Day selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
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

      {/* Slot grid */}
      {daySessions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#aaa", fontSize: 14 }}>Aucun créneau ce jour</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 20, padding: 16, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          {morning.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.coral, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>☀️ Matin</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
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
            </>
          )}
          {afternoon.length > 0 && (
            <>
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
            </>
          )}
          <div style={{ marginTop: 14, fontSize: 11, color: "#bbb", fontStyle: "italic" }}>
            💡 Appuie sur un créneau pour l'annuler
          </div>
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
  const actColor = enfant.activite === "natation" ? C.ocean : enfant.activite === "club" ? C.coral : "#9B59B6";
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
            <div style={{ width:60, height:60, borderRadius:20, background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32 }}>👧</div>
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
              <span style={{ color:"#aaa" }}>Activité</span>
              <span style={{ fontWeight:700, color:actColor }}>{actLabel}</span>
              {enfant.activite !== "club" && <><span style={{ color:"#aaa" }}>Niveau</span><span style={{ fontWeight:700, color:C.sea }}>{enfant.niveau || "—"}</span></>}
              <span style={{ color:"#aaa" }}>Parent</span>
              <span style={{ fontWeight:700, color:"#2C3E50" }}>{enfant.parent || "—"}</span>
              {enfant.parentPhone && <><span style={{ color:"#aaa" }}>Téléphone</span><span style={{ fontWeight:700, color:"#2C3E50" }}>{enfant.parentPhone}</span></>}
            </div>
          </div>

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
              <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 13 }}>📞 {membre.phone}</div>
            </div>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Adresse */}
          <div style={{ background: "#fff", borderRadius: 16, padding: "12px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 12, marginBottom: 4 }}>📍 ADRESSE</div>
            <div style={{ fontSize: 14, color: "#555" }}>{membre.adresse}</div>
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
                          <div style={{ fontSize:11, color:"#888" }}>{r.date_seance ? new Date(r.date_seance).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}) : "—"}</div>
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
  const [form, setForm] = useState({ prenom:"", nom:"", email:"", tel:"", tel2:"", adresse:"", ville:"", cp:"", droitImage:false, droitDiffusion:false });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const f = k => v => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.prenom || !form.nom || !form.email || !form.tel) { setError("Prénom, nom, email et téléphone sont obligatoires."); return; }
    setSaving(true);
    try {
      await creerMembre({ ...form, enfants: [], cgvAccepted: true });
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
          <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>👤 Nouveau membre</div>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>Création manuelle depuis l'admin</div>
        </div>
        <div style={{ overflowY:"auto", padding:"16px 16px 28px", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Prénom *</label><FInput value={form.prenom} onChange={f("prenom")} required /></div>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Nom *</label><FInput value={form.nom} onChange={f("nom")} required /></div>
          </div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Email *</label><FInput type="email" value={form.email} onChange={f("email")} required /></div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Téléphone *</label><FInput type="tel" value={form.tel} onChange={f("tel")} required /></div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Téléphone 2</label><FInput type="tel" value={form.tel2} onChange={f("tel2")} /></div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Adresse</label><FInput value={form.adresse} onChange={f("adresse")} /></div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Ville</label><FInput value={form.ville} onChange={f("ville")} /></div>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>CP</label><FInput value={form.cp} onChange={f("cp")} /></div>
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
    adresse:membre.adresse|| "",
    ville:  membre.ville  || "",
    cp:     membre.cp     || "",
    droitImage:     membre.droitImage     || false,
    droitDiffusion: membre.droitDiffusion || false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const f = k => v => setForm(prev => ({...prev, [k]: v}));

  const handleSave = async () => {
    if (!form.prenom || !form.nom || !form.email || !form.tel) { setError("Prénom, nom, email et téléphone sont obligatoires."); return; }
    setSaving(true);
    try {
      await sb.from("membres").update({
        prenom: form.prenom, nom: form.nom, email: form.email,
        tel: form.tel, tel2: form.tel2, adresse: form.adresse,
        ville: form.ville, cp: form.cp,
        droit_image: form.droitImage, droit_diffusion: form.droitDiffusion,
      }).eq("id", membre.id);
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
        <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
          <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>✏️ Modifier le membre</div>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>{form.prenom} {NOM(form.nom)}</div>
        </div>
        <div style={{ overflowY:"auto", padding:"16px 16px 28px", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Prénom *</label><FInput value={form.prenom} onChange={f("prenom")} required /></div>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Nom *</label><FInput value={form.nom} onChange={f("nom")} required /></div>
          </div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Email *</label><FInput type="email" value={form.email} onChange={f("email")} required /></div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Téléphone *</label><FInput type="tel" value={form.tel} onChange={f("tel")} required /></div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Téléphone 2</label><FInput type="tel" value={form.tel2} onChange={f("tel2")} /></div>
          <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Adresse</label><FInput value={form.adresse} onChange={f("adresse")} /></div>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>Ville</label><FInput value={form.ville} onChange={f("ville")} /></div>
            <div><label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:4 }}>CP</label><FInput value={form.cp} onChange={f("cp")} /></div>
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
  const [activite, setActivite] = useState("club");
  const [niveau, setNiveau]     = useState("debutant");
  const [allergies, setAllergies] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  const handleSave = async () => {
    if (!prenom || !nom || !naissance) { setError("Prénom, nom et date de naissance sont requis."); return; }
    setSaving(true);
    try {
      await creerEnfants(membre.id, [{ prenom, nom, naissance, activite, niveau, allergies }]);
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
    color: C.ocean, av: "👤", enfants: m.enfants || [], resa: 0,
    droitImage: m.droit_image, droitDiffusion: m.droit_diffusion, supabase: true,
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
              </div>
            </div>
            <div style={{ fontSize:20, color:"#ddd" }}>›</div>
          </div>
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
  );
}

function RechercheTab({ allResas, sessions, dbMembres }) {
  const [query, setQuery]           = useState("");
  const [filterType, setFilterType] = useState("tous");
  const [selectedMembre, setSelectedMembre] = useState(null);
  const [selectedEnfant, setSelectedEnfant] = useState(null);
  const q = query.toLowerCase().trim();

  // Construire les données depuis Supabase
  const membresData = (dbMembres || []).map(m => ({
    id: m.id, name: `${m.prenom} ${m.nom}`, prenom: m.prenom, nom: m.nom,
    email: m.email, phone: m.tel, color: C.ocean, av: "👤",
    enfants: m.enfants || [], droitImage: m.droit_image, droitDiffusion: m.droit_diffusion,
    supabase: true,
  }));
  const tousLesMembres = membresData.length > 0 ? membresData : MEMBRES;

  // Tous les enfants avec leur parent
  const tousLesEnfants = tousLesMembres.flatMap(m =>
    (m.enfants || []).map(e => ({ ...e, parent: m.name || `${m.prenom} ${m.nom}`, parentId: m.id, parentColor: m.color || C.ocean, parentPhone: m.phone || m.tel }))
  );

  // Résultats filtrés
  const resMembres = (filterType === "tous" || filterType === "membre") && q
    ? tousLesMembres.filter(m =>
        m.name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.phone?.includes(q) ||
        (m.enfants||[]).some(e => `${e.prenom} ${e.nom}`.toLowerCase().includes(q))
      )
    : [];

  const resEnfants = (filterType === "tous" || filterType === "enfant") && q
    ? tousLesEnfants.filter(e =>
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

      {/* Filtres */}
      <div style={{ display:"flex", gap:8 }}>
        {[["tous","🔍 Tout"],["membre","👤 Membres"],["enfant","👧 Enfants"],["activite","🏊 Activités"]].map(([k,l]) => (
          <button key={k} onClick={() => setFilterType(k)}
            style={{ flex:1, background: filterType===k ? C.ocean : "#f0f0f0", color: filterType===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:10, fontFamily:"inherit" }}>
            {l}
          </button>
        ))}
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

function PaiementsTab() {
  const [period, setPeriod] = useState("semaine"); // jour | semaine | mois | saison
  const [selectedDate, setSelectedDate] = useState("2026-07-06");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState("2026-07");

  const CAT_COLOR = { natation: C.ocean, club: C.coral, eveil: "#9B59B6" };
  const CAT_LABEL = { natation: "🏊 Natation", club: "🏖️ Club", eveil: "🌊 Éveil" };

  // Build season weeks for selector
  const seasonWeeks = [];
  let wk = [], prev = null;
  ALL_PAYMENTS.forEach(p => {
    const d = new Date(p.date);
    const dow = d.getDay();
    if (prev && (new Date(p.date) - new Date(prev)) > 1000*60*60*24*2) { if(wk.length) { seasonWeeks.push(wk); wk=[]; } }
    wk.push(p);
    prev = p.date;
  });
  if (wk.length) seasonWeeks.push(wk);

  // Compute season weeks properly by date
  const weekGroups = {};
  ALL_PAYMENTS.forEach(p => {
    const d = new Date(p.date);
    const dow = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    const key = `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,"0")}-${String(mon.getDate()).padStart(2,"0")}`;
    if (!weekGroups[key]) weekGroups[key] = [];
    weekGroups[key].push(p);
  });
  const weekKeys = Object.keys(weekGroups).sort();

  const monthGroups = {};
  ALL_PAYMENTS.forEach(p => {
    const key = p.date.slice(0,7);
    if (!monthGroups[key]) monthGroups[key] = [];
    monthGroups[key].push(p);
  });

  const allDates = [...new Set(ALL_PAYMENTS.map(p => p.date))].sort();

  const getPayments = () => {
    if (period === "jour")    return ALL_PAYMENTS.filter(p => p.date === selectedDate);
    if (period === "semaine") return weekGroups[weekKeys[selectedWeek]] || [];
    if (period === "mois")    return monthGroups[selectedMonth] || [];
    return ALL_PAYMENTS; // saison
  };

  const payments = getPayments();
  const total = payments.reduce((s, p) => s + p.montant, 0);
  const byCategorie = { natation: 0, club: 0, eveil: 0 };
  payments.forEach(p => { byCategorie[p.categorie] = (byCategorie[p.categorie] || 0) + p.montant; });

  const formatDate = d => { const [y,m,day] = d.split("-"); return `${day}/${m}/${y}`; };
  const months = { "2026-07": "Juillet 2026", "2026-08": "Août 2026" };
  const weekLabel = (key) => {
    const d = new Date(key);
    const end = new Date(d); end.setDate(d.getDate() + 5);
    return `${d.getDate()} – ${end.getDate()} ${["jan","fév","mar","avr","mai","jun","juil","août"][end.getMonth()]}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 6, background: "#fff", borderRadius: 16, padding: 6, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        {[["jour","📅 Jour"],["semaine","📆 Semaine"],["mois","🗓️ Mois"],["saison","🌊 Saison"]].map(([k,l]) => (
          <button key={k} onClick={() => setPeriod(k)} style={{
            flex: 1, background: period === k ? `linear-gradient(135deg, ${C.ocean}, ${C.sea})` : "transparent",
            color: period === k ? "#fff" : "#888", border: "none", borderRadius: 12,
            padding: "8px 4px", cursor: "pointer", fontWeight: 900, fontSize: 11, fontFamily: "inherit", transition: "all .15s",
          }}>{l}</button>
        ))}
      </div>

      {/* Sub-selector */}
      {period === "jour" && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {allDates.map(d => (
            <button key={d} onClick={() => setSelectedDate(d)} style={{
              flexShrink: 0, background: selectedDate === d ? `linear-gradient(135deg, ${C.ocean}, ${C.sea})` : "#fff",
              color: selectedDate === d ? "#fff" : C.dark, border: "none", borderRadius: 12,
              padding: "7px 12px", cursor: "pointer", fontWeight: 800, fontSize: 12, fontFamily: "inherit",
              boxShadow: selectedDate === d ? `0 4px 12px ${C.ocean}44` : "0 2px 6px rgba(0,0,0,0.05)",
            }}>{formatDate(d)}</button>
          ))}
        </div>
      )}
      {period === "semaine" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 14, padding: "10px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <button onClick={() => setSelectedWeek(Math.max(0, selectedWeek-1))} disabled={selectedWeek === 0}
            style={{ background: selectedWeek===0?"#f0f0f0":C.ocean, border:"none", color: selectedWeek===0?"#bbb":"#fff", borderRadius:"50%", width:28,height:28, cursor:selectedWeek===0?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit" }}>‹</button>
          <div style={{ flex:1, textAlign:"center", fontWeight:900, color:C.dark, fontSize:13 }}>
            Sem. {selectedWeek+1}/{weekKeys.length} · {weekLabel(weekKeys[selectedWeek])} 2026
          </div>
          <button onClick={() => setSelectedWeek(Math.min(weekKeys.length-1, selectedWeek+1))} disabled={selectedWeek>=weekKeys.length-1}
            style={{ background: selectedWeek>=weekKeys.length-1?"#f0f0f0":C.ocean, border:"none", color: selectedWeek>=weekKeys.length-1?"#bbb":"#fff", borderRadius:"50%", width:28,height:28, cursor:selectedWeek>=weekKeys.length-1?"not-allowed":"pointer", fontWeight:900, fontFamily:"inherit" }}>›</button>
        </div>
      )}
      {period === "mois" && (
        <div style={{ display: "flex", gap: 8 }}>
          {Object.keys(months).map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)} style={{
              flex:1, background: selectedMonth===m ? `linear-gradient(135deg,${C.ocean},${C.sea})` : "#fff",
              color: selectedMonth===m?"#fff":C.dark, border:"none", borderRadius:14,
              padding:"10px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit",
              boxShadow: selectedMonth===m?`0 4px 14px ${C.ocean}44`:"0 2px 8px rgba(0,0,0,0.05)",
            }}>{months[m]}</button>
          ))}
        </div>
      )}

      {/* KPI */}
      <div style={{ background: "#fff", borderRadius: 20, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 16 }}>
          <div style={{ fontWeight:900, color:"#2C3E50", fontSize:15 }}>Total encaissé</div>
          <div style={{ fontWeight:900, color:C.green, fontSize:26 }}>{total} €</div>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {Object.entries(byCategorie).map(([cat, val]) => (
            <div key={cat} style={{ flex:1, background:`${CAT_COLOR[cat]}12`, borderRadius:14, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontWeight:900, color:CAT_COLOR[cat], fontSize:16 }}>{val} €</div>
              <div style={{ fontSize:10, color:"#aaa", marginTop:2 }}>{CAT_LABEL[cat]}</div>
            </div>
          ))}
        </div>
        {/* Stacked bar */}
        {total > 0 && (
          <div style={{ display:"flex", borderRadius:50, overflow:"hidden", height:8 }}>
            {Object.entries(byCategorie).map(([cat, val]) => (
              val > 0 && <div key={cat} style={{ width:`${(val/total)*100}%`, background:CAT_COLOR[cat], transition:"width .4s" }} />
            ))}
          </div>
        )}
        <div style={{ display:"flex", gap:12, marginTop:8 }}>
          {Object.entries(byCategorie).map(([cat, val]) => (
            val > 0 && <div key={cat} style={{ display:"flex", alignItems:"center", gap:4 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:CAT_COLOR[cat] }} />
              <span style={{ fontSize:10, color:"#888" }}>{Math.round((val/total)*100)}%</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:11, color:"#bbb" }}>
          <span>{payments.length} transaction{payments.length>1?"s":""}</span>
          <span>Moy. {payments.length ? Math.round(total/payments.length) : 0} € / paiement</span>
        </div>
      </div>

      {/* Transaction list */}
      <div style={{ background:"#fff", borderRadius:20, padding:18, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" }}>
        <div style={{ fontWeight:800, color:"#2C3E50", fontSize:13, marginBottom:12 }}>
          {payments.length} transaction{payments.length>1?"s":""}
        </div>
        {payments.length === 0 ? (
          <div style={{ textAlign:"center", padding:"20px 0", color:"#bbb", fontSize:14 }}>Aucun paiement sur cette période</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {payments.map((p, i) => (
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom: i < payments.length-1 ? "1px solid #F0F4F8" : "none" }}>
                <div style={{ width:34, height:34, borderRadius:12, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, background:`${CAT_COLOR[p.categorie]}18`, color:CAT_COLOR[p.categorie], fontWeight:900 }}>✓</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:800, fontSize:13, color:"#2C3E50", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.parent}</div>
                  <div style={{ fontSize:11, color:"#aaa", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.type}</div>
                  {period !== "jour" && <div style={{ fontSize:10, color:"#ccc" }}>{formatDate(p.date)} · Wero</div>}
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontWeight:900, fontSize:14, color:CAT_COLOR[p.categorie] }}>{p.montant} €</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PLANNING TAB ──────────────────────────────────────────
// ── PLANNING TAB ──────────────────────────────────────────
function calcAge(naissance) {
  const today = new Date(2026, 6, 6); // référence saison
  const [y, m, d] = naissance.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

function DayDetailModal({ day, activity, session, onClose, dbResasNat = [], dbResasClub = [] }) {
  const allEnfants = (() => {
    if (!day?.date) return [];
    const dateISO = `${day.date.getFullYear()}-${String(day.date.getMonth()+1).padStart(2,"0")}-${String(day.date.getDate()).padStart(2,"0")}`;

    if (activity === "natation" && dbResasNat.length > 0) {
      const resasJour = dbResasNat.filter(r => r.date_seance?.slice(0,10) === dateISO);
      const enfants = [];
      resasJour.forEach(r => {
        (r.enfants || []).forEach(prenom => {
          enfants.push({
            prenom, nom: "", naissance: "",
            activite: "natation", niveau: r.niveau || "debutant", allergies: "",
            parent: r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—",
            parentColor: C.ocean, parentAv: "👤",
            phone: r.membres?.tel || "—",
            heure: r.heure,
          });
        });
      });
      return enfants.sort((a, b) => a.prenom.localeCompare(b.prenom));
    }

    if (activity === "club" && dbResasClub.length > 0) {
      const resasJour = dbResasClub.filter(r => {
        if (r.date_reservation?.slice(0,10) !== dateISO) return false;
        if (session && r.session !== session) return false;
        return true;
      });
      const liste = [];
      resasJour.forEach(r => {
        const parentNom = r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—";
        const enfants = (r.membres?.enfants || [])
          .filter(e => e.activite === "club" || e.activite === "les deux");
        enfants.forEach(e => liste.push({
          prenom: e.prenom, nom: e.nom || "",
          naissance: e.naissance || "", activite: "club",
          niveau: e.niveau || "", allergies: e.allergies || "",
          parent: parentNom, parentColor: C.coral, parentAv: "👤",
          phone: r.membres?.tel || "—",
          session: r.session,
        }));
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
<div class="footer">FNCP Club de Plage · Saison 2026 · Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
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
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "32px 1fr 1fr 50px",
                  background: i % 2 === 0 ? "#fff" : "#F8FBFF",
                  padding: "10px 12px",
                  borderBottom: "1px solid #F0F4F8",
                  borderRadius: i === allEnfants.length - 1 ? "0 0 12px 12px" : 0,
                  alignItems: "center",
                }}>
                  <div style={{ fontSize: 11, color: "#bbb", fontWeight: 700 }}>{i + 1}</div>
                  <div>
                    <div style={{ fontWeight: 900, color: "#2C3E50", fontSize: 14 }}>
                      {e.nom.toUpperCase()} <span style={{ fontWeight: 600, textTransform: "none" }}>{e.prenom}</span>
                    </div>
                    <div style={{ display: "flex", gap: 5, marginTop: 3, flexWrap: "wrap" }}>
                      {activity === "natation" && (
                        <span style={{ background: `${niveauColor(e.niveau)}18`, color: niveauColor(e.niveau), borderRadius: 50, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>
                          {niveauLabel(e.niveau)}
                        </span>
                      )}
                      {e.allergies && (
                        <span style={{ background: "#FFF0F0", color: C.sunset, borderRadius: 50, padding: "1px 8px", fontSize: 10, fontWeight: 800 }}>
                          ⚠️ {e.allergies}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.parent.split(" ")[0]}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: actColor }}>{calcAge(e.naissance)}</div>
                    <div style={{ fontSize: 9, color: "#bbb" }}>ans</div>
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
  const [dbResasNat, setDbResasNat] = useState([]);
  const [dbResasClub, setDbResasClub] = useState([]);

  // Charger résas natation + club + enfants depuis Supabase
  useEffect(() => {
    sb.from("reservations_natation").select("*, membres(prenom, nom, tel)")
      .then(({ data }) => setDbResasNat(data || []))
      .catch(() => {});
    // Charger résas club + enfants séparément
    sb.from("reservations_club").select("*, membres(id, prenom, nom, tel)")
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
      .filter(r => r.date_seance?.slice(0,10) === dateISO && r.heure === time)
      .flatMap(r => (r.enfants || []).map(e => ({ prenom: e, parent: r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—", tel: r.membres?.tel || "" })));
  };

  // Places club par date et session depuis Supabase
  const getPlacesClub = (dayId, session) => {
    const dayObj = ALL_SEASON_DAYS.find(d => d.id === dayId);
    if (!dayObj?.date) return 45;
    const dateISO = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
    const taken = dbResasClub.filter(r => r.date_reservation?.slice(0,10) === dateISO && r.session === session).length;
    return Math.max(0, 45 - taken);
  };

  // Membres inscrits club par date et session
  const getMembresClub = (dayId, session) => {
    const dayObj = ALL_SEASON_DAYS.find(d => d.id === dayId);
    if (!dayObj?.date) return [];
    const dateISO = `${dayObj.date.getFullYear()}-${String(dayObj.date.getMonth()+1).padStart(2,"0")}-${String(dayObj.date.getDate()).padStart(2,"0")}`;
    return dbResasClub.filter(r => r.date_reservation?.slice(0,10) === dateISO && r.session === session);
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
      {modalDay && (
        <DayDetailModal
          day={modalDay}
          activity={activity}
          session={modalSession}
          dbResasNat={dbResasNat}
          dbResasClub={dbResasClub}
          onClose={() => { setModalDay(null); setModalSession(null); }}
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
        const taken = slots.reduce((acc, s) => acc + (2 - s.spots), 0);
        const avail = slots.reduce((acc, s) => acc + s.spots, 0);

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
<div class="footer">FNCP Club de Plage · Saison 2026 · Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
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
                  .filter(r => r.date_seance?.slice(0,10) === dateISO && r.heure === s.time)
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
<div class="footer">FNCP Club de Plage · Saison 2026 · Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
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

          {currentWeek.map(d => {
            const slots = getNataSlots(d.id);
            const taken = slots.reduce((acc, s) => acc + (2 - s.spots), 0);
            const avail = slots.reduce((acc, s) => acc + s.spots, 0);
            const total = slots.length * 2;
            const rate  = total > 0 ? Math.round((taken / total) * 100) : 0;
            // Enfants inscrits ce jour depuis Supabase
            const dateISO = d.date ? `${d.date.getFullYear()}-${String(d.date.getMonth()+1).padStart(2,"0")}-${String(d.date.getDate()).padStart(2,"0")}` : "";
            const resasJour = dbResasNat.filter(r => r.date_seance?.slice(0,10) === dateISO);
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
      )}

      {/* ── CLUB CONTENT ── */}
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
                    {inscrits.flatMap(r => {
                      const enfants = (r.membres?.enfants || [])
                        .filter(e => e.activite === "club" || e.activite === "les deux");
                      return enfants.map(e => e.prenom);
                    }).slice(0,8).map((nom, i) => (
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "#F0F4F8", padding: "10px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#aaa" }}>JOUR</div>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.coral, textAlign: "center" }}>☀️ MATIN</div>
              <div style={{ fontSize: 11, fontWeight: 900, color: C.ocean, textAlign: "center" }}>🌊 APRÈS-MIDI</div>
            </div>
            {currentWeek.map((d, i) => {
              const placesM = getPlacesClub(d.id, "matin");
              const placesA = getPlacesClub(d.id, "apmidi");
              return (
              <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "12px 16px", borderTop: i > 0 ? "1px solid #F0F4F8" : "none", alignItems: "center" }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "12px 16px", background: "#F8FBFF", borderTop: "2px solid #EEF5FF" }}>
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
    sb.from("reservations_natation").select("membre_id, date_seance, enfants")
      .then(({ data }) => setDbResasNat(data || [])).catch(() => {});
    sb.from("reservations_club").select("membre_id, date_reservation, enfants")
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
        allEnfants.push({ ...e, age: calcAge(e.naissance), parent: `${m.prenom} ${NOM(m.nom)}`, parentColor: C.ocean, phone: m.tel });
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
<div class="footer">FNCP Club de Plage · Saison 2026 · Imprimé le ${new Date().toLocaleDateString('fr-FR')}</div>
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
function ModifierResaModal({ resa, type, onClose, onSaved, dbMembres }) {
  const isNat   = type === "natation";
  const color   = isNat ? C.ocean : C.coral;
  const [date, setDate]     = useState(isNat ? (resa.date_seance?.slice(0,10) || "") : (resa.date_reservation?.slice(0,10) || ""));
  const [heure, setHeure]   = useState(resa.heure || "09:00");
  const [session, setSession] = useState(resa.session || "matin");
  const [enfants, setEnfants] = useState(isNat ? (resa.enfants || []) : (resa.enfants || []));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const membre = dbMembres.find(m => m.id === resa.membre_id);
  const enfantsDuMembre = membre?.enfants || [];

  const heures = ["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"];

  const toggleEnfant = (prenom) => setEnfants(prev => prev.includes(prenom) ? prev.filter(e => e !== prenom) : [...prev, prenom]);

  const handleSave = async () => {
    if (!date) { setError("La date est obligatoire."); return; }
    setSaving(true);
    try {
      if (isNat) {
        await sb.from("reservations_natation").update({ date_seance: date, heure, enfants }).eq("id", resa.id);
      } else {
        await sb.from("reservations_club").update({ date_reservation: date, session, enfants }).eq("id", resa.id);
      }
      onSaved();
      onClose();
    } catch(e) { setError("Erreur : " + e.message); setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1100, display:"flex", flexDirection:"column" }}>
      <div onClick={onClose} style={{ position:"absolute", inset:0, background:"rgba(0,20,50,0.65)", backdropFilter:"blur(5px)" }} />
      <div style={{ position:"relative", marginTop:"auto", background:"#F0F4F8", borderRadius:"28px 28px 0 0", maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 -12px 48px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 4px" }}>
          <div style={{ width:40, height:5, borderRadius:10, background:"#ddd" }} />
        </div>
        <div style={{ background:`linear-gradient(135deg,${color},${color}cc)`, margin:"0 16px", borderRadius:20, padding:"14px 18px", position:"relative" }}>
          <button onClick={onClose} style={{ position:"absolute", top:10, right:12, background:"rgba(255,255,255,0.25)", border:"none", color:"#fff", borderRadius:"50%", width:30, height:30, cursor:"pointer", fontWeight:900, fontSize:16, fontFamily:"inherit" }}>✕</button>
          <div style={{ color:"#fff", fontWeight:900, fontSize:17 }}>✏️ Modifier la réservation</div>
          <div style={{ color:"rgba(255,255,255,0.85)", fontSize:13, marginTop:2 }}>
            {isNat ? "🏊 Natation" : "🏖️ Club de Plage"} · {membre ? `${membre.prenom} ${NOM(membre.nom)}` : "—"}
          </div>
        </div>
        <div style={{ overflowY:"auto", padding:"16px 16px 28px", display:"flex", flexDirection:"column", gap:12 }}>

          {/* Date */}
          <div>
            <label style={{ fontSize:11, fontWeight:900, color:color, display:"block", marginBottom:6, textTransform:"uppercase" }}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} min="2026-07-06" max="2026-08-22"
              style={{ width:"100%", border:"2px solid #e0e8f0", borderRadius:14, padding:"12px", fontSize:15, fontFamily:"inherit", outline:"none", background:"#fff", boxSizing:"border-box" }} />
          </div>

          {/* Heure (natation) ou Session (club) */}
          {isNat ? (
            <div>
              <label style={{ fontSize:11, fontWeight:900, color:color, display:"block", marginBottom:6, textTransform:"uppercase" }}>Heure</label>
              <select value={heure} onChange={e => setHeure(e.target.value)}
                style={{ width:"100%", border:"2px solid #e0e8f0", borderRadius:14, padding:"12px", fontSize:15, fontFamily:"inherit", outline:"none", background:"#fff" }}>
                {heures.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <label style={{ fontSize:11, fontWeight:900, color:color, display:"block", marginBottom:6, textTransform:"uppercase" }}>Session</label>
              <div style={{ display:"flex", gap:8 }}>
                {[["matin","☀️ Matin"],["apmidi","🌊 Après-midi"]].map(([k,l]) => (
                  <button key={k} onClick={() => setSession(k)} style={{ flex:1, background: session===k ? color : "#f0f0f0", color: session===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"10px", cursor:"pointer", fontWeight:800, fontSize:13, fontFamily:"inherit" }}>{l}</button>
                ))}
              </div>
            </div>
          )}

          {/* Enfants */}
          {enfantsDuMembre.length > 0 && (
            <div>
              <label style={{ fontSize:11, fontWeight:900, color:color, display:"block", marginBottom:8, textTransform:"uppercase" }}>
                Enfants {enfants.length > 0 && `· ${enfants.join(", ")}`}
              </label>
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
            </div>
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

  // Natation
  const [forfaitNat, setForfaitNat]     = useState("unite"); // unite | forfait5 | forfait10
  const [seancesNat, setSeancesNat]     = useState([{ date:"", heure:"" }]);

  // Club
  const [forfaitClub, setForfaitClub]     = useState("unite"); // unite | semaines | liberte
  const [sessionClub, setSessionClub]     = useState("matin");
  const [seancesClub, setSeancesClub]     = useState([{ date:"", session:"matin" }]);
  const [selectedWeeks, setSelectedWeeks] = useState([]); // indices des semaines sélectionnées
  const [moisFilter, setMoisFilter]       = useState("juil"); // juil | aout

  const heuresNatation = [
    "09:00","09:30","10:00","10:30","11:00","11:30","12:00",
    "13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00"
  ];

  const membreSelectionne = dbMembres.find(m => m.id === membreId);
  const enfantsDuMembre   = membreSelectionne?.enfants || [];
  const liberteBalance    = membreSelectionne?.liberte_balance || 0;

  const toggleEnfant = (prenom) => setSelectedEnfants(prev =>
    prev.includes(prenom) ? prev.filter(e => e !== prenom) : [...prev, prenom]
  );
  const handleMembreChange = (id) => { setMembreId(id); setSelectedEnfants([]); };

  // Natation : nombre de séances selon forfait
  const nbSeancesNat = forfaitNat === "unite" ? 1 : forfaitNat === "forfait5" ? 5 : 10;

  const updateSeanceNat = (idx, field, val) => {
    const next = [...seancesNat];
    next[idx] = { ...next[idx], [field]: val };
    setSeancesNat(next);
  };
  const addSeanceNat = () => setSeancesNat(prev => [...prev, { date:"", heure:"" }]);
  const removeSeanceNat = (idx) => setSeancesNat(prev => prev.filter((_, i) => i !== idx));

  const updateSeanceClub = (idx, field, val) => {
    const next = [...seancesClub];
    next[idx] = { ...next[idx], [field]: val };
    setSeancesClub(next);
  };
  const addSeanceClub = () => setSeancesClub(prev => [...prev, { date:"", session:"matin" }]);
  const removeSeanceClub = (idx) => setSeancesClub(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (type === "natation") {
        const seancesValides = seancesNat.filter(s => s.date && s.heure);
        if (!seancesValides.length) { setError("Ajoutez au moins une séance avec date et heure."); setSaving(false); return; }
        for (const s of seancesValides) {
          await creerReservationNatation({
            membreId: membreId || null,
            jour: new Date(s.date).toLocaleDateString("fr-FR", { weekday: "short" }),
            heure: s.heure,
            dateSeance: s.date,
            enfants: selectedEnfants,
            rappelDate: getRappelDate(s.date),
            montant: forfaitNat === "unite" ? 20 : forfaitNat === "forfait5" ? 95 : 170,
          });
          // Décrémenter 1 place dans allSeasonSessions
          if (setAllSeasonSessions) {
            setAllSeasonSessions(prev => {
              let decremented = false;
              return prev.map(slot => {
                if (!decremented && slot.time === s.heure && slot.spots > 0) {
                  // Trouver le slot du bon jour
                  const dayObj = ALL_SEASON_DAYS.find(d => d.id === slot.day);
                  if (dayObj) {
                    const y = 2026;
                    const m = String(dayObj.month === "Juillet" ? 7 : 8).padStart(2,"0");
                    const d2 = String(dayObj.num).padStart(2,"0");
                    const slotDate = `${y}-${m}-${d2}`;
                    if (slotDate === s.date) { decremented = true; return { ...slot, spots: Math.max(0, slot.spots - 1) }; }
                  }
                }
                return slot;
              });
            });
          }
        }
      } else {
        // SEMAINES — générer toutes les séances des semaines sélectionnées
        if (forfaitClub === "semaines") {
          if (!selectedWeeks.length) { setError("Sélectionnez au moins une semaine."); setSaving(false); return; }
          const sessions = sessionClub === "journee" ? ["matin","apmidi"] : [sessionClub];
          for (const wIdx of selectedWeeks) {
            const week = SEASON_WEEKS[wIdx];
            for (const day of week.days) {
              const dateStr = `${day.date.getFullYear()}-${String(day.date.getMonth()+1).padStart(2,"0")}-${String(day.date.getDate()).padStart(2,"0")}`;
              for (const sess of sessions) {
                await creerReservationClub({
                  membreId: membreId || null,
                  dateReservation: dateStr,
                  session: sess,
                  labelJour: day.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
                  rappelDate: getRappelDate(dateStr),
                  enfants: selectedEnfants,
                });
                if (setClubPlaces) setClubPlaces(prev => ({ ...prev, [sess]: Math.max(0, (prev[sess]||45) - 1) }));
              }
            }
          }
        } else {
          const seancesValides = seancesClub.filter(s => s.date);
          if (!seancesValides.length) { setError("Ajoutez au moins une séance."); setSaving(false); return; }
          if (forfaitClub === "liberte" && seancesValides.length > liberteBalance) {
            setError(`Solde insuffisant : ${liberteBalance} demi-journée(s) restante(s).`); setSaving(false); return;
          }
          for (const s of seancesValides) {
            await creerReservationClub({
              membreId: membreId || null,
              dateReservation: s.date,
              session: s.session,
              labelJour: new Date(s.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
              rappelDate: getRappelDate(s.date),
              enfants: selectedEnfants,
            });
            if (setClubPlaces) setClubPlaces(prev => ({ ...prev, [s.session]: Math.max(0, (prev[s.session]||45) - 1) }));
          }
        }
      }
      onSaved();
      onClose();
    } catch(e) {
      setError("Erreur : " + e.message);
      setSaving(false);
    }
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
                <button key={k} onClick={() => setType(k)} style={{ flex:1, background: type===k ? C.ocean : "#f0f0f0", color: type===k ? "#fff" : "#888", border:"none", borderRadius:14, padding:"10px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>{l}</button>
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

          {/* Enfants */}
          {enfantsDuMembre.length > 0 && (
            <div>
              <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>
                Enfants {selectedEnfants.length > 0 && `· ${selectedEnfants.length} sélectionné${selectedEnfants.length>1?"s":""}`}
              </label>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {enfantsDuMembre.map((e, i) => {
                  const sel = selectedEnfants.includes(e.prenom);
                  return (
                    <div key={i} onClick={() => toggleEnfant(e.prenom)} style={{
                      display:"flex", alignItems:"center", gap:10,
                      background: sel ? `${C.ocean}15` : "#fff",
                      border: `2px solid ${sel ? C.ocean : "#e0e8f0"}`,
                      borderRadius:12, padding:"10px 14px", cursor:"pointer",
                    }}>
                      <div style={{ width:28, height:28, borderRadius:8, background: sel ? C.ocean : "#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", color: sel?"#fff":"#bbb", fontWeight:900, fontSize:13 }}>{sel?"✓":""}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:900, color:"#2C3E50", fontSize:13 }}>{e.prenom} {NOM(e.nom)}</div>
                        <div style={{ fontSize:11, color:"#aaa" }}>{calcAge(e.naissance)} ans</div>
                      </div>
                      {e.allergies && <div style={{ background:"#FFF0F0", color:C.sunset, borderRadius:50, padding:"2px 8px", fontSize:10, fontWeight:800 }}>⚠️</div>}
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
                <div style={{ display:"flex", gap:6 }}>
                  {[["unite","1 séance · 20€"],["forfait5","5 séances · 95€"],["forfait10","10 séances · 170€"]].map(([k,l]) => (
                    <button key={k} onClick={() => { setForfaitNat(k); const n = k==="unite"?1:k==="forfait5"?5:10; setSeancesNat(Array.from({length:n},()=>({date:"",heure:""})));  }} style={{ flex:1, background: forfaitNat===k ? C.ocean : "#f0f0f0", color: forfaitNat===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:10, fontFamily:"inherit" }}>{l}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>
                  Séances ({seancesNat.length}/{nbSeancesNat})
                </label>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {seancesNat.map((s, i) => (
                    <div key={i} style={{ background:"#fff", borderRadius:12, padding:"10px 12px", display:"flex", gap:8, alignItems:"center" }}>
                      <div style={{ width:24, height:24, borderRadius:8, background:`${C.ocean}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, color:C.ocean, flexShrink:0 }}>{i+1}</div>
                      <input type="date" value={s.date} onChange={e => updateSeanceNat(i,"date",e.target.value)} min="2026-07-06" max="2026-08-22"
                        style={{ flex:1, border:"1.5px solid #e0e8f0", borderRadius:10, padding:"8px", fontSize:12, fontFamily:"inherit", outline:"none" }} />
                      <select value={s.heure} onChange={e => updateSeanceNat(i,"heure",e.target.value)}
                        style={{ flex:1, border:"1.5px solid #e0e8f0", borderRadius:10, padding:"8px", fontSize:12, fontFamily:"inherit", outline:"none", background:"#fff" }}>
                        <option value="">Heure</option>
                        {heuresNatation.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                      {seancesNat.length > 1 && <button onClick={() => removeSeanceNat(i)} style={{ background:"#FFF0F0", border:"none", color:C.sunset, borderRadius:8, width:28, height:28, cursor:"pointer", fontWeight:900, fontFamily:"inherit" }}>✕</button>}
                    </div>
                  ))}
                  {seancesNat.length < nbSeancesNat && (
                    <button onClick={addSeanceNat} style={{ background:`${C.ocean}10`, border:`1.5px dashed ${C.ocean}40`, color:C.ocean, borderRadius:12, padding:"8px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>
                      ➕ Ajouter une séance
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── CLUB ── */}
          {type === "club" && (
            <>
              <div>
                <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Formule</label>
                <div style={{ display:"flex", gap:6 }}>
                  {[["unite","Unité"],["semaines","Semaine(s)"],["liberte","Carte Liberté"]].map(([k,l]) => (
                    <button key={k} onClick={() => { setForfaitClub(k); setSelectedWeeks([]); setSeancesClub([{date:"",session:"matin"}]); }} style={{ flex:1, background: forfaitClub===k ? C.coral : "#f0f0f0", color: forfaitClub===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:10, fontFamily:"inherit" }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Semaines — grille 2 colonnes */}
              {forfaitClub === "semaines" && (
                <div>
                  <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:8, textTransform:"uppercase" }}>
                    Semaine(s) {selectedWeeks.length > 0 && <span style={{ color:C.coral }}>· {selectedWeeks.length} sélectionnée{selectedWeeks.length>1?"s":""}</span>}
                  </label>

                  {/* Toggle Juillet / Août */}
                  <div style={{ display:"flex", gap:8, marginBottom:10 }}>
                    {[["juil","🌊 Juillet"],["aout","☀️ Août"]].map(([k,l]) => (
                      <button key={k} onClick={() => setMoisFilter(k)}
                        style={{ flex:1, background: moisFilter===k ? `linear-gradient(135deg,${C.ocean},${C.sea})` : "#f0f0f0", color: moisFilter===k ? "#fff" : "#888", border:"none", borderRadius:14, padding:"10px", cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit", boxShadow: moisFilter===k ? `0 4px 12px ${C.ocean}44` : "none" }}>
                        {l}
                      </button>
                    ))}
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    {SEASON_WEEKS.filter(w => {
                      const m = w.days[0].date.getMonth();
                      return moisFilter === "juil" ? m === 6 : m === 7;
                    }).map((w, i) => {
                      const realIdx = SEASON_WEEKS.indexOf(w);
                      const sel = selectedWeeks.includes(realIdx);
                      const first = w.days[0];
                      const last  = w.days[w.days.length-1];
                      return (
                        <div key={realIdx} onClick={() => setSelectedWeeks(prev => sel ? prev.filter(x=>x!==realIdx) : [...prev, realIdx])}
                          style={{
                            background: sel ? `linear-gradient(135deg,${C.coral},${C.sun})` : "#fff",
                            border: `2px solid ${sel ? C.coral : "#e0e8f0"}`,
                            borderRadius: 16, padding: "10px 10px 8px",
                            cursor: "pointer",
                            boxShadow: sel ? `0 4px 14px ${C.coral}44` : "0 2px 6px rgba(0,0,0,0.04)",
                          }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                            <div style={{ fontSize:9, fontWeight:900, color: sel?"rgba(255,255,255,0.8)":"#aaa", textTransform:"uppercase" }}>
                              {first.label} → {last.label}
                            </div>
                            <div style={{ width:16, height:16, borderRadius:5, background: sel?"rgba(255,255,255,0.35)":"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, color: sel?"#fff":"#bbb", fontWeight:900 }}>
                              {sel ? "✓" : ""}
                            </div>
                          </div>
                          <div style={{ fontWeight:900, color: sel?"#fff":"#2C3E50", fontSize:13 }}>
                            {first.num} {first.month}
                          </div>
                          <div style={{ fontSize:11, color: sel?"rgba(255,255,255,0.75)":"#aaa", marginBottom:6 }}>
                            → {last.num} {last.month}
                          </div>
                          <div style={{ display:"flex", gap:2, flexWrap:"wrap" }}>
                            {w.days.map((d, di) => (
                              <div key={di} style={{
                                background: sel ? "rgba(255,255,255,0.25)" : "#F0F4F8",
                                color: sel ? "#fff" : "#888",
                                borderRadius:4, padding:"1px 4px",
                                fontSize:9, fontWeight:800,
                              }}>{d.label}</div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedWeeks.length > 0 && (
                    <div style={{ marginTop:12 }}>
                      <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>Session</label>
                      <div style={{ display:"flex", gap:8 }}>
                        {[["matin","Matin"],["apmidi","Après-midi"],["journee","Journée"]].map(([k,l]) => (
                          <button key={k} onClick={() => setSessionClub(k)} style={{ flex:1, background: sessionClub===k ? C.coral : "#f0f0f0", color: sessionClub===k ? "#fff" : "#888", border:"none", borderRadius:12, padding:"8px 4px", cursor:"pointer", fontWeight:800, fontSize:10, fontFamily:"inherit" }}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Carte Liberté — solde */}
              {forfaitClub === "liberte" && (
                <div style={{ background: liberteBalance > 0 ? `${C.coral}12` : "#fff0f0", border:`1.5px solid ${liberteBalance>0?C.coral:"#fca5a5"}`, borderRadius:12, padding:"10px 14px" }}>
                  <div style={{ fontWeight:900, color: liberteBalance>0?C.coral:"#e74c3c", fontSize:13 }}>
                    🎟️ Solde Carte Liberté : <strong>{liberteBalance}</strong> demi-journée{liberteBalance>1?"s":""}
                  </div>
                  {liberteBalance === 0 && <div style={{ fontSize:11, color:"#e74c3c", marginTop:4 }}>Solde insuffisant — rechargez la carte</div>}
                </div>
              )}

              {/* Séances unitaires ou liberté */}
              {(forfaitClub === "unite" || forfaitClub === "liberte") && (
                <div>
                  <label style={{ fontSize:11, fontWeight:900, color:C.ocean, display:"block", marginBottom:6, textTransform:"uppercase" }}>
                    Séances {forfaitClub==="liberte" ? `(${seancesClub.length}/${liberteBalance} demi-j.)` : ""}
                  </label>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {seancesClub.map((s, i) => (
                      <div key={i} style={{ background:"#fff", borderRadius:12, padding:"10px 12px", display:"flex", gap:8, alignItems:"center" }}>
                        <div style={{ width:24, height:24, borderRadius:8, background:`${C.coral}20`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:900, color:C.coral, flexShrink:0 }}>{i+1}</div>
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
                    {(forfaitClub !== "liberte" || seancesClub.length < liberteBalance) && (
                      <button onClick={addSeanceClub} style={{ background:`${C.coral}10`, border:`1.5px dashed ${C.coral}40`, color:C.coral, borderRadius:12, padding:"8px", cursor:"pointer", fontWeight:800, fontSize:12, fontFamily:"inherit" }}>
                        ➕ Ajouter une séance
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {error && <div style={{ background:"#fff0f0", border:"1.5px solid #fca5a5", borderRadius:10, padding:"9px 14px", fontSize:13, color:"#e74c3c", fontWeight:700 }}>⚠️ {error}</div>}

          <SunBtn color={saving ? "#aaa" : C.green} full onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Enregistrement..." : "✅ Créer la réservation"}
          </SunBtn>
        </div>
      </div>
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
  const [modifierResa, setModifierResa]         = useState(null); // { resa, type }

  const refreshResas = () => {
    getAllReservations().then(d => {
      setDbResas(d || []);
      // Reconstruire allSeasonSessions depuis zéro + décrémenter selon résas réelles
      const next = ALL_SEASON_SLOTS_INIT.map(s => ({ ...s, spots: 2 }));
      (d || []).forEach(r => {
        if (!r.date_seance || !r.heure) return;
        const dateResa = r.date_seance.slice(0, 10);
        // Trouver tous les slots qui matchent heure + date
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
    getPaiements().then(d => setDbPaiements(d)).catch(() => {});
  }, []);

  const MOCK_RESAS = [
    { id: 1, parent: "Martin Dupont",  email: "martin@gmail.com",  phone: "06 00 00 00 00", enfants: ["Emma","Lucas"], session: "09:00 - Lun 7",  status: "confirmed" },
    { id: 2, parent: "Sophie Bernard", email: "sophie@gmail.com",  phone: "06 12 34 56 78", enfants: ["Léo","Chloé"],  session: "13:30 - Lun 7",  status: "confirmed" },
    { id: 3, parent: "Pierre Martin",  email: "pierre@gmail.com",  phone: "06 55 44 33 22", enfants: ["Noah"],          session: "10:00 - Mar 8",  status: "pending"   },
    { id: 4, parent: "Julie Leroy",    email: "julie@gmail.com",   phone: "06 77 88 99 11", enfants: ["Manon","Tom"],   session: "11:30 - Mer 9",  status: "confirmed" },
  ];

  // Fusionner données mock + vraies données Supabase
  const supabaseResas = dbResas.map((r, i) => ({
    id: `sb-${i}`, parent: `${r.membres?.prenom || ''} ${r.membres?.nom || ''}`.trim() || '—',
    email: r.membres?.email || '—', phone: r.membres?.tel || '—',
    enfants: r.enfants || [], session: `${r.heure} - ${r.jour}`, status: r.statut || 'confirmed'
  }));
  const allResas = [...MOCK_RESAS, ...supabaseResas, ...reservations.map((r,i) => ({
    id: 1000+i, parent: r.parent, email: "—", phone: "—", enfants: r.enfants || [],
    session: `${r.time} - ${DAYS.find(d=>d.id===r.day)?.label} ${DAYS.find(d=>d.id===r.day)?.num}`, status: "confirmed"
  }))];

  // Paiements réels Supabase
  const realTotal = dbPaiements.reduce((s, p) => s + Number(p.montant || 0), 0);

  // Taux de remplissage natation — toute la saison
  const totalSlotsNat  = ALL_SEASON_SLOTS_INIT.length * 2; // total places saison
  const takenNat       = dbResas.length; // chaque resa = 1 place prise
  const fillRateNat    = totalSlotsNat > 0 ? Math.round((takenNat / totalSlotsNat) * 100) : 0;
  const freeNat        = Math.max(0, totalSlotsNat - takenNat);

  // Taux de remplissage club — toute la saison
  const totalJoursClub  = CLUB_SEASON_DAYS.length; // nb jours saison
  const totalPlacesClub = totalJoursClub * 45; // 45 places/jour/session × 2 sessions
  const takenClub       = dbResasClub.length;
  const fillRateClub    = totalPlacesClub > 0 ? Math.round((takenClub / (totalPlacesClub * 2)) * 100) : 0;

  // Pour l'affichage en header (semaine courante)
  const takenSpots = sessions.reduce((s,x) => s + (2 - x.spots), 0);
  const totalSpots = sessions.reduce((s,x) => s + x.spots, 0);
  const fillRate   = fillRateNat; // utiliser le taux saison

  const tabs = [
    { id: "dashboard",    emoji: "📊", label: "Dashboard"  },
    { id: "seances",      emoji: "🏊", label: "Séances"    },
    { id: "reservations", emoji: "📋", label: "Résas"      },
    { id: "membres",      emoji: "👥", label: "Membres"    },
    { id: "planning",     emoji: "🗓️", label: "Planning"   },
    { id: "paiements",    emoji: "💳", label: "Paiements"  },
    { id: "recherche",    emoji: "🔍", label: "Recherche"  },
  ];

  return (
    <div style={{ background: "#F0F4F8", minHeight: "100%" }}>
      <div style={{ background: "linear-gradient(135deg, #0F2027, #203A43, #2C5364)", padding: "24px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BackBtn onNav={onNav} />
            <div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Espace</div>
              <h2 style={{ color: "#fff", margin: 0, fontWeight: 900, fontSize: 20 }}>Administration</h2>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "6px 12px", textAlign: "center" }}>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>Remplissage</div>
            <div style={{ color: C.sun, fontWeight: 900, fontSize: 18 }}>{fillRateNat}%</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: tab === t.id ? "#fff" : "rgba(255,255,255,0.1)", color: tab === t.id ? "#203A43" : "rgba(255,255,255,0.7)", border: "none", borderRadius: "12px 12px 0 0", padding: "10px 4px 8px", cursor: "pointer", fontWeight: 900, fontSize: 10, fontFamily: "inherit", transition: "all .15s" }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{t.emoji}</div>
              <div>{t.label}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "16px 16px 24px" }}>
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* KPI principaux — données réelles Supabase */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Membres inscrits",  value: dbMembres.length,               emoji: "👤", bg: `linear-gradient(135deg, ${C.ocean}, #0052A3)`, sh: C.ocean },
                { label: "Résas natation",    value: dbResas.length,                  emoji: "🏊", bg: `linear-gradient(135deg, ${C.green}, #1E8449)`, sh: C.green },
                { label: "Résas club",        value: dbResasClub.length,              emoji: "🏖️", bg: `linear-gradient(135deg, ${C.coral}, #C0392B)`, sh: C.coral },
                { label: "Total encaissé",    value: `${realTotal} €`,               emoji: "💳", bg: `linear-gradient(135deg, #9B59B6, #6C3483)`,   sh: "#9B59B6" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 20, padding: "16px 14px", boxShadow: `0 6px 20px ${s.sh}44` }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>{s.emoji}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 700, marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Taux de remplissage */}
            <div style={{ background: "#fff", borderRadius: 20, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 14, marginBottom: 14 }}>📈 Taux de remplissage — Saison 2026</div>

              {/* Natation */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>🏊 Natation</span>
                  <span style={{ fontWeight: 900, color: C.ocean, fontSize: 13 }}>{fillRateNat}%</span>
                </div>
                <div style={{ background: "#EEF5FF", borderRadius: 50, height: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${fillRateNat}%`, background: `linear-gradient(90deg, ${C.ocean}, ${C.sea})`, borderRadius: 50 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#aaa" }}>
                  <span>{takenNat} places prises</span>
                  <span>{freeNat} places libres</span>
                </div>
              </div>

              {/* Club */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#555" }}>🏖️ Club de Plage</span>
                  <span style={{ fontWeight: 900, color: C.coral, fontSize: 13 }}>{fillRateClub}%</span>
                </div>
                <div style={{ background: "#FFF0EE", borderRadius: 50, height: 10, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${fillRateClub}%`, background: `linear-gradient(90deg, ${C.coral}, ${C.sun})`, borderRadius: 50 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: "#aaa" }}>
                  <span>{takenClub} réservations club</span>
                  <span>{totalJoursClub} jours · 45 places/session</span>
                </div>
              </div>
            </div>

            {/* 💳 Paiements réels Supabase */}
            <div style={{ background: "#fff", borderRadius: 20, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 14 }}>💳 Paiements reçus</div>
                <div style={{ background: `${C.green}18`, color: C.green, borderRadius: 50, padding: "4px 14px", fontWeight: 900, fontSize: 13 }}>
                  {realTotal} € encaissés
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {[
                  { label: "Total", value: `${realTotal} €`, color: C.green },
                  { label: "Transactions", value: dbPaiements.length, color: C.ocean },
                  { label: "Moyenne", value: dbPaiements.length > 0 ? `${Math.round(realTotal/dbPaiements.length)} €` : "—", color: "#9B59B6" },
                ].map(k => (
                  <div key={k.label} style={{ background: `${k.color}12`, borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontWeight: 900, color: k.color, fontSize: 16 }}>{k.value}</div>
                    <div style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>{k.label}</div>
                  </div>
                ))}
              </div>
              {dbPaiements.length === 0 ? (
                <div style={{ textAlign: "center", padding: "12px 0", color: "#bbb", fontSize: 13 }}>Aucun paiement enregistré</div>
              ) : dbPaiements.slice(0, 6).map((p, i) => {
                const catColor = p.type === "natation" ? C.ocean : p.type === "club" ? C.coral : p.type === "liberte" ? "#FF9500" : "#9B59B6";
                const dateStr = p.date_paiement ? new Date(p.date_paiement).toLocaleDateString("fr-FR") : "—";
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i < Math.min(dbPaiements.length,6)-1 ? "1px solid #F0F4F8" : "none" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: `${catColor}18`, color: catColor, fontWeight: 900 }}>✓</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: "#2C3E50", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.membres ? `${p.membres.prenom} ${p.membres.nom}` : "—"}
                      </div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{p.label} · {dateStr}</div>
                    </div>
                    <div style={{ fontWeight: 900, fontSize: 14, color: catColor, flexShrink: 0 }}>{p.montant} €</div>
                  </div>
                );
              })}
            </div>

            {/* 👤 Derniers membres inscrits */}
            <div style={{ background: "#fff", borderRadius: 20, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 14, marginBottom: 14 }}>👤 Derniers membres inscrits</div>
              {dbMembres.length === 0 ? (
                <div style={{ textAlign: "center", padding: "12px 0", color: "#bbb", fontSize: 13 }}>Aucun membre inscrit</div>
              ) : dbMembres.slice(0, 5).map((m, i) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < Math.min(dbMembres.length,5)-1 ? "1px solid #F0F4F8" : "none" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${C.ocean}, ${C.sea})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>👤</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 13 }}>{m.prenom} {NOM(m.nom)}</div>
                    <div style={{ fontSize: 11, color: "#aaa" }}>{m.email}</div>
                    <div style={{ fontSize: 10, color: "#bbb" }}>
                      {m.enfants?.length || 0} enfant{(m.enfants?.length||0)>1?"s":""} · {new Date(m.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <Pill color={C.green}>✓</Pill>
                </div>
              ))}
            </div>

            {/* 🔔 Dernières réservations */}
            <div style={{ background: "#fff", borderRadius: 20, padding: 18, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
              <div style={{ fontWeight: 800, color: "#2C3E50", fontSize: 14, marginBottom: 14 }}>🔔 Dernières réservations</div>
              {(() => {
                // Fusionner natation + club, trier par date
                const resasNat = dbResas.map(r => ({
                  id: r.id, type: "natation",
                  parent: r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—",
                  detail: `🏊 ${r.heure} · ${r.date_seance ? new Date(r.date_seance).toLocaleDateString("fr-FR") : "—"}`,
                  date: r.date_seance || r.created_at || "",
                }));
                const resasClub = dbResasClub.map(r => ({
                  id: r.id, type: "club",
                  parent: r.membres ? `${r.membres.prenom} ${r.membres.nom}` : "—",
                  detail: `🏖️ ${r.session === "matin" ? "Matin" : "Après-midi"} · ${r.date_reservation ? new Date(r.date_reservation).toLocaleDateString("fr-FR") : "—"}`,
                  date: r.date_reservation || r.created_at || "",
                }));
                const toutes = [...resasNat, ...resasClub]
                  .sort((a, b) => new Date(b.date) - new Date(a.date))
                  .slice(0, 6);
                if (toutes.length === 0) return <div style={{ color:"#bbb", fontSize:13, textAlign:"center", padding:"12px 0" }}>Aucune réservation</div>;
                return toutes.map((r, i) => (
                  <div key={r.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"9px 0", borderBottom: i < toutes.length-1 ? "1px solid #F0F4F8" : "none" }}>
                    <div style={{ width:36, height:36, borderRadius:12, background: r.type==="natation" ? `linear-gradient(135deg,${C.ocean},${C.sea})` : `linear-gradient(135deg,${C.coral},${C.sun})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                      {r.type === "natation" ? "🏊" : "🏖️"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:800, color:"#2C3E50", fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.parent}</div>
                      <div style={{ fontSize:11, color:"#aaa" }}>{r.detail}</div>
                    </div>
                    <Pill color={C.green}>✓</Pill>
                  </div>
                ));
              })()}
            </div>

            {/* Tri par groupe d'âge */}
            <AgeGroupCard dbMembres={dbMembres} />
          </div>
        )}

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

            {/* Natation */}
            {dbResas.length > 0 && (
              <>
                <div style={{ fontWeight:800, color:C.ocean, fontSize:12, marginBottom:-4 }}>🏊 NATATION ({dbResas.length})</div>
                {dbResas.map(r => (
                  <div key={r.id} style={{ background:"#fff", borderRadius:18, padding:"12px 14px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", borderLeft:`4px solid ${r.statut==="pending"?C.sun:C.ocean}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <div style={{ fontWeight:900, color:"#2C3E50", fontSize:13 }}>{r.membres ? `${r.membres.prenom} ${NOM(r.membres.nom)}` : "—"}</div>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        {r.statut === "pending" ? (
                          <>
                            <Pill color={C.sun}>⏳ En attente</Pill>
                            <button onClick={async () => { await sb.from("reservations_natation").update({statut:"confirmed"}).eq("id",r.id); refreshResas(); }}
                              style={{ background:`${C.green}15`, border:`1.5px solid ${C.green}40`, color:C.green, borderRadius:8, padding:"3px 10px", cursor:"pointer", fontWeight:900, fontSize:11, fontFamily:"inherit" }}>✅ Payé</button>
                          </>
                        ) : (
                          <Pill color={C.green}>✓ Confirmé</Pill>
                        )}
                        <button onClick={() => setModifierResa({ resa: r, type: "natation" })}
                          style={{ background:`${C.ocean}15`, border:"none", color:C.ocean, borderRadius:8, width:28, height:28, cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>✏️</button>
                        <button onClick={() => { if(window.confirm("Supprimer cette réservation ?")) supprimerResaNatation(r.id); }}
                          style={{ background:"#FFF0F0", border:"none", color:C.sunset, borderRadius:8, width:28, height:28, cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>🗑</button>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:C.ocean, fontWeight:700 }}>🕐 {r.heure} · {r.date_seance ? new Date(r.date_seance).toLocaleDateString("fr-FR") : "—"}</div>
                    {r.enfants?.length > 0 && <div style={{ display:"flex", gap:5, marginTop:6, flexWrap:"wrap" }}>{r.enfants.map((e,i) => <Pill key={i} color={C.sea}>{e}</Pill>)}</div>}
                  </div>
                ))}
              </>
            )}

            {/* Club */}
            {dbResasClub.length > 0 && (
              <>
                <div style={{ fontWeight:800, color:C.coral, fontSize:12, marginBottom:-4 }}>🏖️ CLUB DE PLAGE ({dbResasClub.length})</div>
                {dbResasClub.map(r => (
                  <div key={r.id} style={{ background:"#fff", borderRadius:18, padding:"12px 14px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", borderLeft:`4px solid ${r.statut==="pending"?C.sun:C.coral}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <div style={{ fontWeight:900, color:"#2C3E50", fontSize:13 }}>{r.membres ? `${r.membres.prenom} ${NOM(r.membres.nom)}` : "—"}</div>
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        {r.statut === "pending" ? (
                          <>
                            <Pill color={C.sun}>⏳ En attente</Pill>
                            <button onClick={async () => { await sb.from("reservations_club").update({statut:"confirmed"}).eq("id",r.id); refreshResas(); }}
                              style={{ background:`${C.green}15`, border:`1.5px solid ${C.green}40`, color:C.green, borderRadius:8, padding:"3px 10px", cursor:"pointer", fontWeight:900, fontSize:11, fontFamily:"inherit" }}>✅ Payé</button>
                          </>
                        ) : (
                          <Pill color={C.green}>✓ Confirmé</Pill>
                        )}
                        <button onClick={() => setModifierResa({ resa: r, type: "club" })}
                          style={{ background:`${C.coral}15`, border:"none", color:C.coral, borderRadius:8, width:28, height:28, cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>✏️</button>
                        <button onClick={() => { if(window.confirm("Supprimer cette réservation ?")) supprimerResaClub(r.id); }}
                          style={{ background:"#FFF0F0", border:"none", color:C.sunset, borderRadius:8, width:28, height:28, cursor:"pointer", fontWeight:900, fontSize:13, fontFamily:"inherit" }}>🗑</button>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:C.coral, fontWeight:700 }}>
                      {r.session === "matin" ? "☀️ Matin" : "🌊 Après-midi"} · {r.date_reservation ? new Date(r.date_reservation).toLocaleDateString("fr-FR") : "—"}
                    </div>
                    {r.enfants?.length > 0 && <div style={{ display:"flex", gap:5, marginTop:6, flexWrap:"wrap" }}>{r.enfants.map((e,i) => <Pill key={i} color={C.coral}>{e}</Pill>)}</div>}
                  </div>
                ))}
              </>
            )}

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
          <PaiementsTab dbPaiements={dbPaiements} />
        )}

        {tab === "planning" && (
          <PlanningTab allSeasonSessions={allSeasonSessions} clubPlaces={clubPlaces} reservations={reservations} />
        )}

        {tab === "recherche" && (
          <RechercheTab allResas={allResas} sessions={sessions} dbMembres={dbMembres} />
        )}
      </div>
    </div>
  );
}
// ── BOTTOM NAV ────────────────────────────────────────────
function BottomNav({ current, onNav }) {
  const items = [
    { id:"home",             emoji:"🏠", label:"Accueil"    },
    { id:"formules",         emoji:"🎫", label:"Formules"   },
    { id:"reservation",      emoji:"🏊", label:"Réserver"   },
    { id:"mes-reservations", emoji:"📅", label:"Mes séances" },
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
    </div>
  );
}

// ── ADMIN CODE ACCESS ─────────────────────────────────────
const ADMIN_CODE = "club2026";

function ProfilConnecte({ user, setUser, setScreen, reservations }) {
  const [resasNat, setResasNat] = useState([]);
  const [resasClub, setResasClub] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.supabaseId) { setLoading(false); return; }
    Promise.all([
      sb.from("reservations_natation").select("*").eq("membre_id", user.supabaseId).order("date_seance"),
      sb.from("reservations_club").select("*").eq("membre_id", user.supabaseId).order("date_reservation"),
    ]).then(([{data: nat}, {data: club}]) => {
      setResasNat(nat || []);
      setResasClub(club || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.supabaseId]);

  return (
    <>
      <Card style={{ marginTop:14, textAlign:"center" }}>
        <div style={{ width:80, height:80, borderRadius:26, background:`linear-gradient(135deg,${C.ocean},${C.sea})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:40, margin:"0 auto 14px" }}>👤</div>
        <h2 style={{ color:C.dark, margin:"0 0 4px" }}>{user.prenom} {NOM(user.nom)}</h2>
        <p style={{ color:"#888", fontSize:14, margin:"0 0 2px" }}>{user.email}</p>
        <p style={{ color:"#888", fontSize:14, margin:"0 0 16px" }}>{user.tel}</p>
        {user.enfants?.length > 0 && <div style={{ marginBottom:16, display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center" }}>{user.enfants.map(e => <Pill key={e.id} color={C.sea}>{e.prenom}</Pill>)}</div>}
        <SunBtn color={C.sunset} onClick={async () => {
          try { await sb.auth.signOut(); } catch(e) {}
          setUser(null); setScreen("home");
        }}>Se déconnecter</SunBtn>
      </Card>

      <div style={{ marginTop:16 }}>
        <div style={{ fontWeight:900, color:C.dark, fontSize:14, marginBottom:10 }}>🎫 Mes accès saison 2026</div>

        {/* Carte Liberté */}
        {(user.liberteBalance > 0 || user.liberteTotal > 0) ? (
          <div style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, borderRadius:20, padding:18, marginBottom:12, boxShadow:`0 6px 20px ${C.coral}44` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div>
                <div style={{ color:"#fff", fontWeight:900, fontSize:16 }}>🎟️ Carte Liberté</div>
                <div style={{ color:"rgba(255,255,255,0.8)", fontSize:11 }}>Valable saison 2026 · 6 juil – 22 août</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ color:"#fff", fontWeight:900, fontSize:28, lineHeight:1 }}>{user.liberteBalance || 0}</div>
                <div style={{ color:"rgba(255,255,255,0.8)", fontSize:11 }}>demi-j. restantes</div>
              </div>
            </div>
            <div style={{ background:"rgba(255,255,255,0.25)", borderRadius:50, height:8, overflow:"hidden", marginBottom:8 }}>
              <div style={{ height:"100%", width:`${((user.liberteBalance||0)/(user.liberteTotal||1))*100}%`, background:"#fff", borderRadius:50 }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"rgba(255,255,255,0.75)" }}>
              <span>{(user.liberteTotal||0)-(user.liberteBalance||0)} utilisée{((user.liberteTotal||0)-(user.liberteBalance||0))>1?"s":""}</span>
              <span>{user.liberteTotal||0} au total</span>
            </div>
            {(user.liberteBalance||0) > 0 && (
              <div style={{ marginTop:12 }}>
                <button onClick={() => setScreen("reservation-club")} style={{ width:"100%", background:"rgba(255,255,255,0.25)", border:"2px solid rgba(255,255,255,0.5)", color:"#fff", borderRadius:50, padding:"11px", fontWeight:900, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
                  📅 Réserver avec ma carte
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background:"#fff", borderRadius:18, padding:16, marginBottom:12, boxShadow:"0 2px 10px rgba(0,0,0,0.06)", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:32 }}>🎟️</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, color:C.dark }}>Carte Liberté</div>
              <div style={{ fontSize:12, color:"#aaa" }}>Pas encore de carte active</div>
            </div>
            <button onClick={() => setScreen("prestations")} style={{ background:`linear-gradient(135deg,${C.coral},${C.sun})`, border:"none", color:"#fff", borderRadius:50, padding:"8px 14px", fontWeight:900, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Acheter</button>
          </div>
        )}

        {/* Réservations Natation */}
        <div style={{ background:"#fff", borderRadius:18, padding:16, marginBottom:12, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontWeight:800, color:C.dark, fontSize:15 }}>🏊 Natation</div>
            <Pill color={C.ocean}>{resasNat.length} séance{resasNat.length>1?"s":""}</Pill>
          </div>
          {loading ? <div style={{ fontSize:12, color:"#bbb", textAlign:"center" }}>Chargement…</div>
          : resasNat.length === 0 ? <div style={{ fontSize:12, color:"#bbb", textAlign:"center", padding:"8px 0" }}>Aucune séance réservée</div>
          : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {resasNat.slice(0,4).map((r,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:`${C.ocean}08`, borderRadius:12, padding:"8px 12px" }}>
                  <div style={{ fontSize:13, fontWeight:800, color:C.ocean }}>{r.heure}</div>
                  {r.enfants?.length > 0 && <div style={{ fontSize:11, color:C.ocean, fontWeight:700 }}>{r.enfants.join(", ")}</div>}
                  <div style={{ fontSize:11, color:"#888" }}>{r.date_seance ? new Date(r.date_seance).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}) : "—"}</div>
                  <Pill color={C.green}>✓</Pill>
                </div>
              ))}
              {resasNat.length > 4 && <div style={{ fontSize:11, color:"#aaa", textAlign:"center" }}>+{resasNat.length-4} séances</div>}
            </div>
          }
        </div>

        {/* Réservations Club */}
        <div style={{ background:"#fff", borderRadius:18, padding:16, marginBottom:12, boxShadow:"0 2px 10px rgba(0,0,0,0.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ fontWeight:800, color:C.dark, fontSize:15 }}>🏖️ Club de Plage</div>
            <Pill color={C.coral}>{resasClub.length} demi-j.</Pill>
          </div>
          {loading ? <div style={{ fontSize:12, color:"#bbb", textAlign:"center" }}>Chargement…</div>
          : resasClub.length === 0 ? <div style={{ fontSize:12, color:"#bbb", textAlign:"center", padding:"8px 0" }}>Aucune réservation club</div>
          : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {resasClub.slice(0,4).map((r,i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:`${C.coral}08`, borderRadius:12, padding:"8px 12px" }}>
                  <div style={{ fontSize:12, fontWeight:800, color:C.coral }}>{r.session==="matin"?"Matin":"Après-midi"}</div>
                  {r.enfants?.length > 0 && <div style={{ fontSize:11, color:C.coral, fontWeight:700 }}>{r.enfants.join(", ")}</div>}
                  <div style={{ fontSize:11, color:"#888" }}>{r.date_reservation ? new Date(r.date_reservation).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}) : "—"}</div>
                  <Pill color={C.green}>✓</Pill>
                </div>
              ))}
              {resasClub.length > 4 && <div style={{ fontSize:11, color:"#aaa", textAlign:"center" }}>+{resasClub.length-4} demi-journées</div>}
            </div>
          }
        </div>
      </div>
    </>
  );
}

function AdminCodeAccess({ onUnlock }) {
  const [open, setOpen]   = useState(false);
  const [code, setCode]   = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleChange = (val) => {
    const clean = val.slice(0, 8);
    setCode(clean);
    setError(false);
    if (clean.length === 8) {
      if (clean.toLowerCase() === ADMIN_CODE.toLowerCase()) {
        setOpen(false);
        setCode("");
        onUnlock();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => { setShake(false); setCode(""); setError(false); }, 800);
      }
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setCode("");
    setError(false);
    setTimeout(() => document.getElementById("admin-hidden-input")?.focus(), 100);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div onClick={handleOpen} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "linear-gradient(135deg, #0F2027, #203A43)", borderRadius: 20, padding: "14px 18px", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚙️</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>Espace Administrateur</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>🔒 Accès protégé par code</div>
          </div>
        </div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 20 }}>›</div>
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
                ❌ Code incorrect. Réessayez.
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
  const [screen, setScreen] = useState("home");

  // Restaurer user depuis localStorage si disponible
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("fncp_user");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const [sessions, setSessions] = useState(INIT_SESSIONS);
  const [allSeasonSessions, setAllSeasonSessions] = useState(ALL_SEASON_SLOTS_INIT);
  const [reservations, setReservations] = useState([]);
  const [clubPlaces, setClubPlaces] = useState({ matin: 45, apmidi: 45, journee: 45 });

  // Sauvegarder user dans localStorage à chaque changement
  useEffect(() => {
    try {
      if (user) localStorage.setItem("fncp_user", JSON.stringify(user));
      else localStorage.removeItem("fncp_user");
    } catch {}
  }, [user]);

  // Écouter les changements d'authentification Supabase (magic link)
  useEffect(() => {
      // Vérifier si déjà connecté (session Supabase active)
      sb.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          sb.from("membres").select("*, enfants(*)").eq("email", session.user.email).single()
            .then(({ data }) => {
              if (data) setUser({ ...data, prenom: data.prenom, nom: data.nom, email: data.email, tel: data.tel, supabaseId: data.id });
              else setUser({ email: session.user.email, prenom: "", nom: "", supabaseId: session.user.id });
            });
        }
      });

      // Auto-refresh de session toutes les 10 min
      const refreshInterval = setInterval(() => {
        sb.auth.refreshSession().catch(() => {});
      }, 10 * 60 * 1000);

      // Écouter les connexions (magic link cliqué)
      const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          sb.from("membres").select("*, enfants(*)").eq("email", session.user.email).single()
            .then(({ data }) => {
              if (data) {
                setUser({ ...data, prenom: data.prenom, nom: data.nom, email: data.email, tel: data.tel, supabaseId: data.id });
                setScreen("profil");
              } else {
                setUser({ email: session.user.email, prenom: "", nom: "", supabaseId: session.user.id });
                setScreen("inscription");
              }
            });
        }
        if (event === "SIGNED_OUT") {
          setUser(null);
          localStorage.removeItem("fncp_user");
          setScreen("home");
        }
        if (event === "TOKEN_REFRESHED" && session?.user) {
          // Rafraîchir les données membre silencieusement
          sb.from("membres").select("*, enfants(*)").eq("email", session.user.email).single()
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
  const props = { onNav: setScreen, user, setUser, sessions, setSessions, reservations, setReservations, allSeasonSessions, setAllSeasonSessions, clubPlaces, setClubPlaces };

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
      case "inscription":      return <InscriptionScreen {...props} />;
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
          {/* Accès Admin protégé par code */}
          <AdminCodeAccess onUnlock={() => setScreen("admin")} />
        </div>
      );
      default: return <HomeScreen {...props} />;
    }
  };

  return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", display:"flex", flexDirection:"column", fontFamily:"'Nunito','Segoe UI',sans-serif", background:C.shell }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #87CEEB; }
        input:focus, select:focus { border-color: #1A8FE3 !important; box-shadow: 0 0 0 3px rgba(26,143,227,0.15); outline: none; }
        a { text-decoration: none; color: inherit; }
        a:hover { text-decoration: underline; }
        ::-webkit-scrollbar { width: 0; }
        button { font-family: 'Nunito', sans-serif; }
      `}</style>
      <div style={{ flex:1, overflowY:"auto" }}>{renderScreen()}</div>
      {screen !== "inscription" && <BottomNav current={screen} onNav={setScreen} />}
    </div>
  );
}
