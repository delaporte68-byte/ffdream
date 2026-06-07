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
import { FFdreameTechniqueMacro } from "./macros/technique-macro.js";
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

// Exposer DiceHelper globalement
window.FFdreameDiceHelper = FFdreameDiceHelper;

// Exposer le système de déplacement globalement
window.FFdreameMovementBlocker = FFdreameMovementBlocker;

// Exposer les systèmes de combat avancés
window.FFdreameTeleportation = FFdreameTeleportation;
window.FFdreamePersistentZones = FFdreamePersistentZones;
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
  
  // Mode de dés (Auto/Manuel) pour le MJ
  game.settings.register('ffdreame', 'manualDiceMode', {
    name: "Mode Dés Manuel",
    hint: "Si activé, le MJ entre manuellement les résultats des dés au lieu de les lancer automatiquement.",
    scope: "world",
    config: false, // Géré via le GM Tracker
    type: Boolean,
    default: false
  });

  // Configuration de l'initiative
  CONFIG.Combat.initiative = {
    formula: "1d100",
    decimals: 0
  };
  
  // Override de la fonction rollInitiative pour gérer le bonus "Prend l'Initiative"
  CONFIG.Combat.documentClass.prototype._getInitiativeFormula = function(combatant) {
    const actor = combatant.actor;
    
    if (!actor) return "1d100";
    
    // Vérifier le bonus "Prend l'Initiative"
    const initiativeBonus = actor.system.combat?.initiativeBonus || false;
    
    if (initiativeBonus) {
      // Toujours premier : 999
      return "999";
    }
    
    return "1d100";
  };
});

/* ================================
   HOOKS APRÈS INITIALISATION
   ================================ */
Hooks.once('ready', async function() {
  console.log('FFdreame | Système prêt');
  
  // Initialiser le système de blocage de déplacement
  FFdreameMovementBlocker.init();
  
  // Initialiser le système de combat
  FFdreameCombatSystem.init();
  
  // Initialiser la barre d'initiative horizontale
  FFdreameInitiativeBar.init();
  
  // Initialiser la barre de combat en bas
  FFdreameCombatBar.init();
  
  // Initialiser le système de zones persistantes
  FFdreamePersistentZones.init();

  // Initialiser les zones de canalisation (MULTIS surSoi)
  FFdreameZonesCanalisation.init();

  // Initialiser le système AOER
  FFdreameAOER.init();
  
  // Initialiser les notifications stylées
  FFdreameNotifications.init();
  
  // Initialiser le système Drag Ruler (si installé)
  FFdreameMovement.initDragRuler();
});

/* ================================
   GESTION ÉTAT MORT
   ================================ */
Hooks.on('updateActor', async (actor, change, options, userId) => {
  // Vérifier si les PV ont changé
  if (!change.system?.aptitudes?.pv?.value) return;
  
  const pvActuel = actor.system.aptitudes.pv.value;
  const token = actor.getActiveTokens()[0];
  
  if (!token) return;
  
  // Si PV = 0 → Ajouter icône mort
  if (pvActuel <= 0) {
    const hasSkull = token.document.effects.includes("icons/svg/skull.svg");
    if (!hasSkull) {
      await token.document.update({
        effects: [...token.document.effects, "icons/svg/skull.svg"]
      });
      ui.notifications.warn(`💀 ${actor.name} est mort !`);
    }
  } 
  // Si PV > 0 → Retirer icône mort (résurrection)
  else {
    const effects = token.document.effects.filter(e => e !== "icons/svg/skull.svg");
    if (effects.length !== token.document.effects.length) {
      await token.document.update({ effects });
      ui.notifications.info(`✨ ${actor.name} est ressuscité !`);
    }
  }
});

/* ================================
   AUTO-REFRESH GM TRACKER
   ================================ */
Hooks.on('updateActor', (actor, change, options, userId) => {
  // Rafraîchir tous les GM Trackers ouverts quand un personnage change
  if (actor.type === 'character' || actor.type === 'cyberpunk') {
    game.actors.filter(a => a.type === 'gm-tracker').forEach(tracker => {
      if (tracker.sheet.rendered) {
        tracker.sheet.render(false);
      }
    });
  }
});

/* ================================
   HELPER HANDLEBARS PERSONNALISÉS
   ================================ */
Hooks.once('init', function() {
  // Helper pour comparer des valeurs
  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  // Helper pour vérifier si une valeur est >= à une autre
  Handlebars.registerHelper('gte', function(a, b) {
    return a >= b;
  });

  // Helper pour vérifier si une valeur est > à une autre
  Handlebars.registerHelper('gt', function(a, b) {
    return a > b;
  });

  // Helper pour vérifier si le joueur est MJ
  Handlebars.registerHelper('isGM', function() {
    return game.user.isGM;
  });

  // Helper pour calculer le total des points de compétences dépensés
  Handlebars.registerHelper('totalCompetencesDepensees', function(system) {
    let total = 0;
    
    // Physique
    total += parseInt(system.physique?.force?.value) || 0;
    total += parseInt(system.physique?.endurance?.value) || 0;
    total += parseInt(system.physique?.athletisme?.value) || 0;
    
    // Dextérité
    total += parseInt(system.dexterite?.furtivite?.value) || 0;
    total += parseInt(system.dexterite?.agilite?.value) || 0;
    total += parseInt(system.dexterite?.perception?.value) || 0;
    
    // Intelligence
    total += parseInt(system.intelligence?.culture?.value) || 0;
    total += parseInt(system.intelligence?.magie?.value) || 0;
    total += parseInt(system.intelligence?.volonte?.value) || 0;
    
    // Charisme
    total += parseInt(system.charisme?.intimidation?.value) || 0;
    total += parseInt(system.charisme?.psychologie?.value) || 0;
    total += parseInt(system.charisme?.persuasion?.value) || 0;
    
    return total;
  });

  // Helper pour calculer les points d'aptitudes dépensés (somme des investissements)
  Handlebars.registerHelper('totalAptitudesDepensees', function(system) {
    let total = 0;
    total += parseInt(system.aptitudes?.attaque?.investissement) || 0;
    total += parseInt(system.aptitudes?.puissanceMagique?.investissement) || 0;
    total += parseInt(system.aptitudes?.pv?.investissement) || 0;
    total += parseInt(system.aptitudes?.pm?.investissement) || 0;
    return total;
  });

  // Helper pour calculer les points restants (max - dépensés), retourne true si > 0
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

  // Helper pour vérifier si l'acteur a des postures
  Handlebars.registerHelper('hasPostures', function(items) {
    if (!items) return false;
    return items.some(item => item.type === "posture");
  });

  // Helper pour additionner deux valeurs
  Handlebars.registerHelper('add', function(a, b) {
    return (parseInt(a) || 0) + (parseInt(b) || 0);
  });
  
  // Helper pour incrémenter (utilisé dans les boucles)
  Handlebars.registerHelper('inc', function(value) {
    return parseInt(value) + 1;
  });

  // Helper AND logique
  Handlebars.registerHelper('and', function(a, b) {
    return a && b;
  });

  // Helper pour vérifier si une posture a des techniques
  Handlebars.registerHelper('hasTechniquesForPosture', function(items, postureName) {
    if (!items || !postureName) return false;
    
    // Filtrer les items pour trouver les techniques associées à cette posture
    const techniques = items.filter(item => {
      return item && 
             item.type === "technique" && 
             item.system && 
             item.system.postureAssociee === postureName;
    });
    
    return techniques.length > 0;
  });

  // Helper less than
  Handlebars.registerHelper('lt', function(a, b) {
    return a < b;
  });

  // Helper range (pour boucles)
  Handlebars.registerHelper('range', function(start, end) {
    const result = [];
    for (let i = start; i < end; i++) {
      result.push(i);
    }
    return result;
  });

  // Helper division (pour pourcentages)
  Handlebars.registerHelper('division', function(a, b) {
    if (!b || b === 0) return 0;
    return Math.round((a / b) * 100);
  });

  // Helper get (accès dynamique aux propriétés)
  Handlebars.registerHelper('get', function(obj, ...path) {
    // Le dernier argument est options, on l'ignore
    const actualPath = path.slice(0, -1);
    let result = obj;
    for (const key of actualPath) {
      if (result && typeof result === 'object') {
        result = result[key];
      } else {
        return '';
      }
    }
    return result || '';
  });

  // Helper concat (concaténation de strings)
  Handlebars.registerHelper('concat', function(...args) {
    // Le dernier argument est options, on l'ignore
    return args.slice(0, -1).join('');
  });
  
  // ===== HELPERS POUR EFFETS DE TABLEAUX =====
  
  // Retourne l'icône selon le type d'effet
  Handlebars.registerHelper('effetIcon', function(type) {
    const icons = {
      'bonus_degats': '💥',
      'recuperation_pa': '⚡',
      'initiative_first': '🏁',
      'bonus_reussite': '🎯',
      'reduction_malus': '🛡️',
      'parade_gratuite': '🔰',
      'change_posture': '🔄',
      'jet_risque': '🎲'
    };
    return icons[type] || '✨';
  });
  
  // Retourne le nom selon le type d'effet
  Handlebars.registerHelper('effetNom', function(type) {
    const noms = {
      'bonus_degats': 'Bonus Dégâts',
      'recuperation_pa': 'Récup PA',
      'initiative_first': 'Initiative',
      'bonus_reussite': 'Bonus Réussite',
      'reduction_malus': 'Réduction Malus',
      'parade_gratuite': 'Parade Gratuite',
      'change_posture': 'Change de Posture',
      'jet_risque': 'Jet du Risque'
    };
    return noms[type] || 'Effet';
  });
  
  // Calcule le pourcentage de progression
  Handlebars.registerHelper('progressionPourcent', function(compteur, seuil) {
    if (!seuil || seuil === 0) return 0;
    return Math.min(100, Math.floor((compteur / seuil) * 100));
  });
});

/* ================================
   DÉPLACEMENT LIÉ À L'ATHLÉTISME
   ================================ */
Hooks.on('updateActor', async (actor, changes, options, userId) => {
  // Vérifier si l'athlétisme a changé
  if (changes.system?.physique?.athletisme?.value !== undefined) {
    const athletisme = changes.system.physique.athletisme.value;
    const deplacementMetres = 2 + athletisme;
    
    console.log(`🏃 ${actor.name} - Athlétisme: ${athletisme} → Déplacement: ${deplacementMetres}m`);
    
    // Mettre à jour via le module
    await FFdreameMovement.updateTokenMovement(actor);
    
    ui.notifications.info(`🏃 Déplacement mis à jour: ${deplacementMetres}m (Athlétisme: ${athletisme})`);
  }
});
