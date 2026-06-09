/**
 * FFDREAME SYSTEM
 * Système de JDR pour Foundry VTT v13
 */

// Import des modules Foundry
import { FFdreameActor } from "./documents/actor.js";
import { FFdreameItem } from "./documents/item.js";
import { FFdreameActorSheet } from "./sheets/actor-sheet.js";
import { FFdreameCyberpunkSheet } from "./sheets/cyberpunk-sheet.js";
import { FFdreameGMTrackerSheet } from "./sheets/gm-tracker-sheet.js";
import { FFdreameNPCSheet } from "./sheets/npc-sheet.js";
import { FFdreameItemSheet } from "./sheets/item-sheet.js";
import { FFdreameTokenHUD } from "./canvas/token-hud.js";
import { FFdreameMovement } from "./helpers/movement.js";
import { FFdreameMovementBlocker } from "./helpers/movement-blocker.js";
import { FFdreameDiceHelper } from "./helpers/dice-helper.js";
import { FFdreameCombatSystem } from "./combat/combat-system.js";
import { FFdreameTeleportation } from "./combat/teleportation-system.js";
import { FFdreamePersistentZones } from "./combat/persistent-zones.js";
import { FFdreameZonesCanalisation } from "./combat/zones-canalisation.js";
import { FFdreameAOER } from "./combat/aoer-system.js";
import { FFdreameNotifications } from "./ui/notifications-bg3.js";
import { FFdreameInitiativeBar } from "./combat/initiative-bar.js";
import { FFdreameCombatBar } from "./ui/combat-bar.js";

// Exposer les systèmes globalement (accessible depuis macros et console Foundry)
window.FFdreameDiceHelper = FFdreameDiceHelper;
window.FFdreameMovementBlocker = FFdreameMovementBlocker;
window.FFdreameTeleportation = FFdreameTeleportation;
window.FFdreamePersistentZones = FFdreamePersistentZones;
window.FFdreameZonesCanalisation = FFdreameZonesCanalisation;
window.FFdreameAOER = FFdreameAOER;
window.FFdreameNotifications = FFdreameNotifications;

/* ================================
   INITIALISATION DU SYSTÈME
   ================================ */
Hooks.once('init', async function() {
  console.log('FFdreame | Initialisation du système');

  // Configuration du système
  CONFIG.Actor.documentClass = FFdreameActor;
  CONFIG.Item.documentClass = FFdreameItem;

  // Initialiser le Token HUD personnalisé
  FFdreameTokenHUD.init();

  // Enregistrement des feuilles de personnage
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("ffdreame", FFdreameActorSheet, {
    types: ["character"],
    makeDefault: true,
    label: "Fiche Fantasy"
  });

  // Enregistrement de la feuille Cyberpunk
  Actors.registerSheet("ffdreame", FFdreameCyberpunkSheet, {
    types: ["cyberpunk"],
    makeDefault: true,
    label: "Fiche Cyberpunk"
  });

  // Enregistrement de la feuille GM Tracker
  Actors.registerSheet("ffdreame", FFdreameGMTrackerSheet, {
    types: ["gm-tracker"],
    makeDefault: true,
    label: "GM Tracker"
  });

  // Enregistrement de la feuille NPC
  Actors.registerSheet("ffdreame", FFdreameNPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "Fiche NPC/Monstre"
  });

  // Enregistrement des feuilles d'items
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("ffdreame", FFdreameItemSheet, {
    types: ["talent", "technique", "equipement", "posture"],
    makeDefault: true,
    label: "Fiche Item FFdreame"
  });

  // ===== PARAMÈTRES DU SYSTÈME =====

  game.settings.register('ffdreame', 'manualDiceMode', {
    name: "Mode Dés Manuel",
    hint: "Si activé, le MJ entre manuellement les résultats des dés au lieu de les lancer automatiquement.",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  // Configuration de l'initiative
  CONFIG.Combat.initiative = {
    formula: "1d100",
    decimals: 0
  };

  // Override pour le bonus "Prend l'Initiative" (initiative = 999, toujours premier)
  CONFIG.Combat.documentClass.prototype._getInitiativeFormula = function(combatant) {
    const actor = combatant.actor;
    if (!actor) return "1d100";
    const initiativeBonus = actor.system.combat?.initiativeBonus || false;
    return initiativeBonus ? "999" : "1d100";
  };

  // ===== HELPERS HANDLEBARS =====

  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('gte', (a, b) => a >= b);
  Handlebars.registerHelper('gt', (a, b) => a > b);
  Handlebars.registerHelper('lt', (a, b) => a < b);
  Handlebars.registerHelper('and', (a, b) => a && b);

  Handlebars.registerHelper('isGM', function() {
    return game.user.isGM;
  });

  Handlebars.registerHelper('add', function(a, b) {
    return (parseInt(a) || 0) + (parseInt(b) || 0);
  });

  Handlebars.registerHelper('inc', function(value) {
    return parseInt(value) + 1;
  });

  Handlebars.registerHelper('range', function(start, end) {
    const result = [];
    for (let i = start; i < end; i++) result.push(i);
    return result;
  });

  Handlebars.registerHelper('division', function(a, b) {
    if (!b || b === 0) return 0;
    return Math.round((a / b) * 100);
  });

  Handlebars.registerHelper('get', function(obj, ...path) {
    const actualPath = path.slice(0, -1);
    let result = obj;
    for (const key of actualPath) {
      if (result && typeof result === 'object') result = result[key];
      else return '';
    }
    return result || '';
  });

  Handlebars.registerHelper('concat', function(...args) {
    return args.slice(0, -1).join('');
  });

  Handlebars.registerHelper('totalCompetencesDepensees', function(system) {
    let total = 0;
    total += parseInt(system.physique?.force?.value) || 0;
    total += parseInt(system.physique?.endurance?.value) || 0;
    total += parseInt(system.physique?.athletisme?.value) || 0;
    total += parseInt(system.dexterite?.furtivite?.value) || 0;
    total += parseInt(system.dexterite?.agilite?.value) || 0;
    total += parseInt(system.dexterite?.perception?.value) || 0;
    total += parseInt(system.intelligence?.culture?.value) || 0;
    total += parseInt(system.intelligence?.magie?.value) || 0;
    total += parseInt(system.intelligence?.volonte?.value) || 0;
    total += parseInt(system.charisme?.intimidation?.value) || 0;
    total += parseInt(system.charisme?.psychologie?.value) || 0;
    total += parseInt(system.charisme?.persuasion?.value) || 0;
    return total;
  });

  Handlebars.registerHelper('totalAptitudesDepensees', function(system) {
    let total = 0;
    total += parseInt(system.aptitudes?.attaque?.investissement) || 0;
    total += parseInt(system.aptitudes?.puissanceMagique?.investissement) || 0;
    total += parseInt(system.aptitudes?.pv?.investissement) || 0;
    total += parseInt(system.aptitudes?.pm?.investissement) || 0;
    return total;
  });

  Handlebars.registerHelper('hasPointsCompetences', function(system) {
    const depenses = parseInt(Handlebars.helpers.totalCompetencesDepensees(system)) || 0;
    const max = parseInt(system.pointsCompetences) || 0;
    return depenses < max;
  });

  Handlebars.registerHelper('hasPointsAptitudes', function(system) {
    const depenses = parseInt(Handlebars.helpers.totalAptitudesDepensees(system)) || 0;
    const max = parseInt(system.pointsAptitudesCumulees) || 0;
    return depenses < max;
  });

  Handlebars.registerHelper('hasPostures', function(items) {
    if (!items) return false;
    return items.some(item => item.type === "posture");
  });

  Handlebars.registerHelper('hasTechniquesForPosture', function(items, postureName) {
    if (!items || !postureName) return false;
    return items.some(item =>
      item && item.type === "technique" &&
      item.system?.postureAssociee === postureName
    );
  });

  Handlebars.registerHelper('effetIcon', function(type) {
    const icons = {
      'bonus_degats': '💥', 'recuperation_pa': '⚡', 'initiative_first': '🏁',
      'bonus_reussite': '🎯', 'reduction_malus': '🛡️', 'parade_gratuite': '🔰',
      'change_posture': '🔄', 'jet_risque': '🎲'
    };
    return icons[type] || '✨';
  });

  Handlebars.registerHelper('effetNom', function(type) {
    const noms = {
      'bonus_degats': 'Bonus Dégâts', 'recuperation_pa': 'Récup PA',
      'initiative_first': 'Initiative', 'bonus_reussite': 'Bonus Réussite',
      'reduction_malus': 'Réduction Malus', 'parade_gratuite': 'Parade Gratuite',
      'change_posture': 'Change de Posture', 'jet_risque': 'Jet du Risque'
    };
    return noms[type] || 'Effet';
  });

  Handlebars.registerHelper('progressionPourcent', function(compteur, seuil) {
    if (!seuil || seuil === 0) return 0;
    return Math.min(100, Math.floor((compteur / seuil) * 100));
  });
});

/* ================================
   HOOKS APRÈS INITIALISATION
   ================================ */
Hooks.once('ready', async function() {
  console.log('FFdreame | Système prêt');

  FFdreameMovementBlocker.init();
  FFdreameCombatSystem.init();
  FFdreameInitiativeBar.init();
  FFdreameCombatBar.init();
  FFdreamePersistentZones.init();
  FFdreameZonesCanalisation.init();
  FFdreameAOER.init();
  FFdreameNotifications.init();
  FFdreameMovement.initDragRuler();
});

/* ================================
   GESTION ÉTAT MORT (API Foundry v13)
   ================================ */
Hooks.on('updateActor', async (actor, change, options, userId) => {
  // Vérifier si les PV ont changé (=== undefined pour ne pas bloquer sur 0)
  if (change.system?.aptitudes?.pv?.value === undefined) return;

  const pvActuel = actor.system.aptitudes.pv.value;
  const token = actor.getActiveTokens()[0];

  if (!token) return;

  if (pvActuel <= 0) {
    // API Foundry v13 : overlayEffect pour l'icône de statut sur le token
    if (token.document.overlayEffect !== "icons/svg/skull.svg") {
      await token.document.update({ overlayEffect: "icons/svg/skull.svg" });
      ui.notifications.warn(`💀 ${actor.name} est mort !`);
    }
  } else {
    if (token.document.overlayEffect === "icons/svg/skull.svg") {
      await token.document.update({ overlayEffect: "" });
      ui.notifications.info(`✨ ${actor.name} est ressuscité !`);
    }
  }
});

/* ================================
   AUTO-REFRESH GM TRACKER
   ================================ */
Hooks.on('updateActor', (actor, change, options, userId) => {
  if (actor.type === 'character' || actor.type === 'cyberpunk') {
    game.actors.filter(a => a.type === 'gm-tracker').forEach(tracker => {
      if (tracker.sheet.rendered) tracker.sheet.render(false);
    });
  }
});

/* ================================
   DÉPLACEMENT LIÉ À L'ATHLÉTISME
   ================================ */
Hooks.on('updateActor', async (actor, changes, options, userId) => {
  if (changes.system?.physique?.athletisme?.value !== undefined) {
    const athletisme = changes.system.physique.athletisme.value;
    const deplacementMetres = 2 + athletisme;
    console.log(`🏃 ${actor.name} - Athlétisme: ${athletisme} → Déplacement: ${deplacementMetres}m`);
    await FFdreameMovement.updateTokenMovement(actor);
    ui.notifications.info(`🏃 Déplacement mis à jour: ${deplacementMetres}m (Athlétisme: ${athletisme})`);
  }
});
