/**
 * Feuille de personnage pour FFdreame
 */
import { FFdreameTechniqueMacro } from "../macros/technique-macro.js";
import { FFdreameMultiZone } from "../combat/multi-zone.js";
import { FFdreameZonesCanalisation } from "../combat/zones-canalisation.js";

export class FFdreameActorSheet extends ActorSheet {

  /* ================================
     OPTIONS DE LA FEUILLE
     ================================ */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ffdreame", "sheet", "actor"],
      template: "systems/ffdreame/templates/actor/character-sheet.html",
      width: 900,
      height: 700,
      resizable: true,
      tabs: [{ 
        navSelector: ".sheet-tabs", 
        contentSelector: ".sheet-body", 
        initial: "principal" 
      }],
      dragDrop: [{ dragSelector: ".item-list .item", dropSelector: null }]
    });
  }

  /* ================================
     PRÉPARATION DES DONNÉES
     ================================ */
  async getData() {
    const context = super.getData();
    
    // Récupération des données du système
    const actorData = this.actor.toObject(false);
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Vérifier si l'utilisateur est MJ
    context.isGM = game.user.isGM;

    // Enrichir les données avec les infos de rang
    context.rangInfo = this._getRangInfo(context.system.rang);

    // ─── TABLEAUX INTERACTIFS : Récupérer les noms des items + calculs ───
    console.log("🔍 DEBUG: Début récupération tableaux");
    console.log("Combat:", context.system.combat);
    
    for (let tableNum = 1; tableNum <= 2; tableNum++) {
      const tableau = context.system.combat?.[`tableau${tableNum}`];
      console.log(`Tableau ${tableNum}:`, tableau);
      
      if (tableau?.slots) {
        for (let slotNum = 1; slotNum <= 8; slotNum++) {
          const itemId = tableau.slots[`slot${slotNum}`];
          console.log(`  Slot ${slotNum}: itemId =`, itemId);
          
          if (itemId) {
            const item = this.actor.items.get(itemId);
            console.log(`    Item trouvé:`, item?.name);
            
            if (item) {
              // Préparer les infos d'affichage
              const displayInfo = {
                name: item.name,
                img: item.img,
                type: item.type
              };

              // Calculer les infos selon le type
              if (item.type === 'technique') {
                const atq = context.system.aptitudes?.attaque?.total || 0;
                const pm = context.system.aptitudes?.puissanceMagique?.total || 0;
                const baseDegats = item.system.baseDegats || 0;
                const style = item.system.style || 'cac';
                
                console.log(`    Technique: ATQ=${atq}, PM=${pm}, Base=${baseDegats}, Style=${style}`);
                
                // Calcul des dégâts selon le style
                let degatsCalcules = 0;
                switch(style) {
                  case 'cac':
                    degatsCalcules = atq + Math.floor(pm / 2) + baseDegats;
                    break;
                  case 'mg':
                    degatsCalcules = Math.floor(atq / 2) + pm + baseDegats;
                    break;
                  case 'p':
                    degatsCalcules = atq + pm + baseDegats;
                    break;
                  case 'eha':
                    degatsCalcules = atq + baseDegats;
                    break;
                  case 'ehm':
                    degatsCalcules = pm + baseDegats;
                    break;
                  case 'ef':
                    degatsCalcules = pm + baseDegats + Math.floor(atq / 2);
                    break;
                  default:
                    degatsCalcules = baseDegats;
                }

                displayInfo.coutPM = item.system.coutPM || 0;
                displayInfo.degats = Math.floor(degatsCalcules);
                
                console.log(`    → PM: ${displayInfo.coutPM}, Dégâts: ${displayInfo.degats}`);
              } else if (item.type === 'attaque') {
                const atq = context.system.aptitudes?.attaque?.total || 0;
                displayInfo.degats = atq + (item.system.degats || 0);
                displayInfo.coutPM = 0;
              } else if (item.type === 'ultimate') {
                displayInfo.degats = item.system.degats || 0;
                displayInfo.coutPM = 0;
              }

              tableau.slots[`slot${slotNum}_item`] = displayInfo;
              console.log(`    ✅ DisplayInfo ajouté:`, displayInfo);
            } else {
              // L'item n'existe plus, nettoyer le slot
              tableau.slots[`slot${slotNum}`] = null;
              console.log(`    ⚠️ Item n'existe plus, slot nettoyé`);
            }
          }
        }
      } else {
        console.log(`  ⚠️ Pas de slots dans tableau${tableNum}`);
      }
    }

    console.log("✅ DEBUG: Fin récupération tableaux");

    // ─── ZONE DE CANALISATION : état actif pour le template ───
    context.isZoneActive = FFdreameZonesCanalisation.zoneActiveFor(this.actor);
    context.zoneTechniqueId = this.actor.getFlag("ffdreame", "zoneCanalisation")?.techniqueId ?? null;

    return context;
  }

  /* ================================
     INFORMATIONS SUR LES RANGS
     ================================ */
  _getRangInfo(rang) {
    const info = {
      'F': { 
        name: 'F', 
        jet: 40, 
        points: 0, 
        multiplier: 1,
        color: '#666666'
      },
      'D': { 
        name: 'D', 
        jet: 45, 
        points: 5, 
        multiplier: 1,
        color: '#8b4513'
      },
      'C': { 
        name: 'C', 
        jet: 50, 
        points: 5, 
        multiplier: 1.2,
        color: '#cd7f32'
      },
      'B': { 
        name: 'B', 
        jet: 55, 
        points: 10, 
        multiplier: 1.5,
        color: '#c0c0c0'
      },
      'A': { 
        name: 'A', 
        jet: 60, 
        points: 5, 
        multiplier: 1.7,
        color: '#ffd700'
      },
      'S': { 
        name: 'S', 
        jet: 60, 
        points: 10, 
        multiplier: 2,
        color: '#00ffff'
      },
      'SS': { 
        name: 'SS', 
        jet: 65, 
        points: 5, 
        multiplier: 2,
        color: '#ff00ff'
      }
    };

    return info[rang] || info['F'];
  }

  /* ================================
     ACTIVATION DES ÉCOUTEURS
     ================================ */
  activateListeners(html) {
    super.activateListeners(html);

    // Rendre la fiche non-éditable pour les joueurs sur certains champs
    if (!this.isEditable) return;

    // Boutons de jet de compétence
    html.find('.competence-item').on('click', this._onCompetenceRoll.bind(this));

    // Modification du niveau (seulement MJ)
    if (game.user.isGM) {
      html.find('input[name="system.lv"]').on('change', this._onLevelChange.bind(this));
      html.find('select[name="system.rang"]').on('change', this._onRangChange.bind(this));
    }

    // Validation des points de compétences pour les joueurs (pas pour le MJ)
    if (!game.user.isGM) {
      html.find('.competence-item input').on('change', this._onCompetenceChangePlayer.bind(this));
    }

    // ─── COMBAT : Fatigue & Blessures toggle ───
    html.find('.status-case').on('click', this._onStatusCaseClick.bind(this));

    // ─── COMBAT : Points d'action (petit click) ───
    html.find('.ap-petit').on('click', this._onApPetitClick.bind(this));

    // ─── COMBAT : Points d'action (grand click = consomme les 2 petits) ───
    html.find('.ap-grand-click').on('click', this._onApGrandClick.bind(this));

    // ─── COMBAT : Boutons de Réaction (Esquive, Défense, Marche) ───
    html.find('.btn-reaction').on('click', this._onToggleReaction.bind(this));

    // ─── COMBAT : Bouton Nouveau Tour ───
    html.find('.btn-nouveau-tour').on('click', this._onNouveauTour.bind(this));
    
    // ─── TABLEAUX : Toggle activation T1/T2 ───
    html.find('.table-toggle-btn').on('click', this._onToggleTableau.bind(this));

    // ─── COMBAT : Attaques de base ───
    html.find('.btn-attaque-base').on('click', this._onAttaqueBase.bind(this));

    // ─── POSTURES : Toggle activation ───
    html.find('.btn-toggle-posture').on('click', this._onTogglePosture.bind(this));

    // ─── POSTURES : Attaque posture ───
    html.find('.btn-attaque-posture').on('click', this._onAttaquePosture.bind(this));

    // ─── POSTURES : Utiliser technique ───
    html.find('.btn-use-technique').on('click', this._onUseTechnique.bind(this));

    // ─── POSTURES : Utiliser technique embarquée (nouvelle méthode) ───
    html.find('.btn-use-technique-embedded').on('click', this._onUseTechniqueEmbedded.bind(this));
    html.find('.cyber-btn-technique-embedded').on('click', this._onUseTechniqueEmbedded.bind(this));

    // ─── POSTURES : Lancer Ultimate ───
    html.find('.btn-use-ultimate').on('click', this._onUseUltimate.bind(this));

    // ─── COMBAT : Initialiser les anneaux SVG des orbes PV/PM ───
    this._initOrbRings(html);

    // ─── PRINCIPAL : Bouton + compétence ───
    html.find('.btn-plus-competence').on('click', this._onPlusCompetence.bind(this));

    // ─── PRINCIPAL : Bouton + aptitude ───
    html.find('.btn-plus-aptitude').on('click', this._onPlusAptitude.bind(this));

    // ─── PRINCIPAL : Clic sur base d'aptitude (GM uniquement) ───
    if (game.user.isGM) {
      html.find('.aptitude-base-value.editable').on('click', this._onAptitudeBaseClick.bind(this));
    }

    // ─── TABLEAUX INTERACTIFS : Drag & Drop d'objets ───
    html.find('.table-slot').on('drop', this._onDropTableSlot.bind(this));
    html.find('.table-slot').on('dragover', this._onDragOverTableSlot.bind(this));
    html.find('.table-slot').on('click', this._onClickTableSlot.bind(this));
    
    // ─── TABLEAUX INTERACTIFS : Toggle activation ───
    html.find('.table-toggle-btn').on('click', this._onToggleTableau.bind(this));
    
    // ─── TABLEAUX INTERACTIFS : Configuration des effets ───
    html.find('.btn-config-effet').on('click', this._onConfigureEffetTableau.bind(this));
    
    // ─── DRAG & DROP : Techniques vers Macro Bar ───
    FFdreameTechniqueMacro.makeTechniquesDraggable(html, this.actor);
  }

  /* ================================
     VALIDATION POINTS COMPÉTENCES (JOUEURS)
     ================================ */
  async _onCompetenceChangePlayer(event) {
    event.preventDefault();
    
    // Calculer le total des points dépensés
    const system = this.actor.system;
    let totalDepense = 0;
    
    // Physique
    totalDepense += parseInt(system.physique.force?.value) || 0;
    totalDepense += parseInt(system.physique.endurance?.value) || 0;
    totalDepense += parseInt(system.physique.athletisme?.value) || 0;
    
    // Dextérité
    totalDepense += parseInt(system.dexterite.furtivite?.value) || 0;
    totalDepense += parseInt(system.dexterite.agilite?.value) || 0;
    totalDepense += parseInt(system.dexterite.perception?.value) || 0;
    
    // Intelligence
    totalDepense += parseInt(system.intelligence.culture?.value) || 0;
    totalDepense += parseInt(system.intelligence.magie?.value) || 0;
    totalDepense += parseInt(system.intelligence.volonte?.value) || 0;
    
    // Charisme
    totalDepense += parseInt(system.charisme.intimidation?.value) || 0;
    totalDepense += parseInt(system.charisme.psychologie?.value) || 0;
    totalDepense += parseInt(system.charisme.persuasion?.value) || 0;
    
    const pointsDisponibles = system.pointsCompetences || 0;
    
    // Si dépassement, annuler et avertir
    if (totalDepense > pointsDisponibles) {
      ui.notifications.warn(`⚠️ Points insuffisants ! Vous avez ${pointsDisponibles} points disponibles.`);
      
      // Réinitialiser la valeur modifiée
      const inputName = event.currentTarget.name;
      const oldValue = Math.max(0, parseInt(event.currentTarget.value) - 1);
      
      await this.actor.update({
        [inputName]: oldValue
      });
      
      return false;
    }
  }

  /* ================================
     GESTION DES JETS DE COMPÉTENCE
     ================================ */
  async _onCompetenceRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    
    // Empêcher le clic sur le bouton + de déclencher le jet
    if (event.target.classList.contains('btn-plus-competence')) {
      return;
    }
    
    // Récupérer le label et la valeur de la compétence
    const label = element.querySelector('label')?.textContent || 'Compétence';
    
    // Récupérer la valeur depuis le span (pas d'input dans le template)
    const valueSpan = element.querySelector('.competence-value');
    const value = parseInt(valueSpan?.textContent) || 0;

    // Lancer le jet
    if (this.actor) {
      await this.actor.rollCompetence(label, value);
    }
  }

  /* ================================
     CHANGEMENT DE NIVEAU
     ================================ */
  async _onLevelChange(event) {
    event.preventDefault();
    const newLevel = parseInt(event.currentTarget.value) || 1;
    
    await this.actor.update({
      'system.lv': newLevel
    });

    ui.notifications.info(`Niveau changé : ${newLevel}`);
  }

  /* ================================
     CHANGEMENT DE RANG
     ================================ */
  async _onRangChange(event) {
    event.preventDefault();
    const newRang = event.currentTarget.value;
    
    await this.actor.update({
      'system.rang': newRang
    });

    ui.notifications.info(`Rang changé : ${newRang}`);
  }

  /* ================================
     MISE À JOUR SUR DÉPÔT D'ITEMS
     ================================ */
  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;
    const item = await Item.implementation.fromDropData(data);
    
    // Gérer le dépôt selon le type d'item
    return await this._onDropItemCreate(item);
  }

  async _onDropItemCreate(itemData) {
    // Créer une copie de l'item sur l'acteur
    return await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  /* ================================
     COMBAT : TOGGLE FATIGUE / BLESSURE
     ================================ */
  async _onStatusCaseClick(event) {
    event.preventDefault();
    const el = event.currentTarget;
    const field = el.dataset.field;  // ex: "system.combat.fatigue.f3"
    const currentVal = el.classList.contains('active');
    const newVal = !currentVal;

    await this.actor.update({ [field]: newVal });
  }

  /* ================================
     COMBAT : POINTS D'ACTION – PETIT (click individuel)
     ================================ */
  async _onApPetitClick(event) {
    event.preventDefault();
    event.stopPropagation(); // ne pas déclencher le grand click
    const el = event.currentTarget;
    const field = el.dataset.field;  // ex: "system.combat.actionPoints.grand1.petit1"
    const isAvailable = el.classList.contains('available');

    // Extraire grand et petit numéros
    const grandNum = el.dataset.grand;
    const petitNum = el.dataset.petit;
    
    // Vérifier si on peut utiliser ce petit point
    // On peut l'utiliser seulement si les deux petits du grand sont encore disponibles
    const grand = this.actor.system.combat.actionPoints[`grand${grandNum}`];
    
    if (isAvailable) {
      // Si on utilise un petit, le grand n'est plus utilisable
      // On marque donc le grand comme "partiellement utilisé"
      await this.actor.update({ [field]: false });
    } else {
      // Si on remet disponible un petit, on peut réactiver le grand si l'autre petit est dispo
      const autrePetitField = `system.combat.actionPoints.grand${grandNum}.petit${petitNum === '1' ? '2' : '1'}`;
      const autrePetitValue = petitNum === '1' ? grand.petit2 : grand.petit1;
      
      await this.actor.update({ [field]: true });
    }
  }

  /* ================================
     COMBAT : POINTS D'ACTION – GRAND (consomme les 2 petits d'un coup)
     ================================ */
  async _onApGrandClick(event) {
    event.preventDefault();
    const el = event.currentTarget;
    const grandNum = el.dataset.grand;
    const fieldP1 = el.dataset.fieldP1;
    const fieldP2 = el.dataset.fieldP2;

    // Vérifier si les deux petits sont disponibles
    const grand = this.actor.system.combat.actionPoints[`grand${grandNum}`];
    const p1Val = grand.petit1;
    const p2Val = grand.petit2;

    // On peut utiliser le grand SEULEMENT si les deux petits sont disponibles
    if (p1Val && p2Val) {
      // Consommer les deux petits
      await this.actor.update({ [fieldP1]: false, [fieldP2]: false });
    } else if (!p1Val && !p2Val) {
      // Si les deux sont déjà consommés, on peut tout réactiver
      await this.actor.update({ [fieldP1]: true, [fieldP2]: true });
    }
    // Si un seul petit est utilisé, le grand n'est pas cliquable (ne rien faire)
  }

  /* ================================
     COMBAT : RESET NOUVEAU TOUR (tous les points d'action)
     ================================ */
  /* ================================
     BOUTONS DE RÉACTION
     ================================ */
  async _onToggleReaction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const reactionType = button.dataset.reaction; // 'esquive', 'defense', 'marche'
    
    // Vérifier si bloqué par le MJ
    const actionBlocked = this.actor.getFlag('ffdreame', 'actionBlocked');
    if (actionBlocked) {
      ui.notifications.warn("🔒 Vous ne pouvez pas agir, votre tour est terminé !");
      return;
    }
    
    // Vérifier l'état actuel
    const currentState = this.actor.system.combat.reactions[reactionType];
    
    if (currentState) {
      // Désactiver
      await this.actor.update({
        [`system.combat.reactions.${reactionType}`]: false
      });
      
      const labels = {
        esquive: 'Esquive',
        defense: 'Défense',
        marche: 'Marche'
      };
      
      ui.notifications.info(`${labels[reactionType]} désactivée`);
    } else {
      // Activer → Consommer 1 Petit PA
      
      // Vérifier si un Petit PA est disponible
      const actionPoints = this.actor.system.combat.actionPoints;
      let petitDispo = null;
      
      for (let g = 1; g <= 3; g++) {
        for (let p = 1; p <= 2; p++) {
          if (actionPoints[`grand${g}`]?.[`petit${p}`]) {
            petitDispo = { grand: g, petit: p };
            break;
          }
        }
        if (petitDispo) break;
      }
      
      if (!petitDispo) {
        ui.notifications.warn("⚠️ Pas de Petit PA disponible !");
        return;
      }
      
      // Consommer le Petit PA et activer la réaction
      await this.actor.update({
        [`system.combat.actionPoints.grand${petitDispo.grand}.petit${petitDispo.petit}`]: false,
        [`system.combat.reactions.${reactionType}`]: true
      });
      
      const labels = {
        esquive: 'Esquive',
        defense: 'Défense', 
        marche: 'Marche'
      };
      
      const icons = {
        esquive: '🤸',
        defense: '🛡️',
        marche: '🚶'
      };
      
      ui.notifications.info(`${icons[reactionType]} ${labels[reactionType]} activée ! (1 Petit PA consommé)`);
    }
  }

  /* ================================
     NOUVEAU TOUR
     ================================ */
  async _onNouveauTour(event) {
    event.preventDefault();
    
    // Vérifier fatigue f8 (perte d'1 grand point d'action)
    const fatigue = this.actor.system.combat.fatigue;
    const perdGrand3 = fatigue.f8;

    // Trouver le premier grand PA complètement utilisé et le restaurer
    const actionPoints = this.actor.system.combat.actionPoints;
    let restored = false;
    
    for (let i = 1; i <= 3; i++) {
      // Skip grand3 si fatigue f8 active
      if (i === 3 && perdGrand3) continue;
      
      const grand = actionPoints[`grand${i}`];
      
      // Si ce grand est complètement utilisé (les 2 petits à false)
      if (!grand.petit1 && !grand.petit2) {
        await this.actor.update({
          [`system.combat.actionPoints.grand${i}.petit1`]: true,
          [`system.combat.actionPoints.grand${i}.petit2`]: true
        });
        restored = true;
        ui.notifications.info(`🔄 Nouveau tour - Grand PA ${i} restauré (2 petits)`);
        break;
      }
    }
    
    if (!restored) {
      ui.notifications.warn("⚠️ Aucun grand PA complètement utilisé à restaurer");
    }

    // Appliquer les pertes de PV automatiques (blessures 7 et 8)
    await this._appliquerPertesPVTour();
  }

  /* ================================
     TABLEAUX : TOGGLE ACTIVATION
     ================================ */
  async _onToggleTableau(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const tableauNum = button.dataset.table; // "1" ou "2"
    
    const tableau1Actif = this.actor.system.combat.tableau1.actif;
    const tableau2Actif = this.actor.system.combat.tableau2.actif;
    
    // Vérifier si on est en combat
    const enCombat = game.combat && game.combat.started;
    
    if (tableauNum === "1") {
      // Si T1 déjà actif, on ne peut pas le désactiver
      if (tableau1Actif) {
        ui.notifications.warn("⚠️ Tableau 1 déjà actif ! (Activez Tableau 2 pour le changer)");
        return;
      }
      
      // Activer T1 (et désactiver T2)
      // Si en combat et qu'un autre tableau était actif → Coûte 1 Petit PA
      if (enCombat && tableau2Actif) {
        // Vérifier si action bloquée
        const actionBlocked = this.actor.getFlag('ffdreame', 'actionBlocked');
        if (actionBlocked) {
          ui.notifications.warn("🔒 Votre tour est terminé !");
          return;
        }
        
        // Trouver un Petit PA disponible
        const actionPoints = this.actor.system.combat.actionPoints;
        let petitDispo = null;
        
        for (let g = 1; g <= 3; g++) {
          for (let p = 1; p <= 2; p++) {
            if (actionPoints[`grand${g}`]?.[`petit${p}`]) {
              petitDispo = { grand: g, petit: p };
              break;
            }
          }
          if (petitDispo) break;
        }
        
        if (!petitDispo) {
          ui.notifications.warn("⚠️ Pas de Petit PA disponible pour changer de tableau !");
          return;
        }
        
        // Consommer le Petit PA
        await this.actor.update({
          [`system.combat.actionPoints.grand${petitDispo.grand}.petit${petitDispo.petit}`]: false,
          'system.combat.tableau1.actif': true,
          'system.combat.tableau2.actif': false
        });
        
        ui.notifications.info("✅ Tableau 1 activé (-1 Petit PA)");
      } else {
        // Hors combat ou début de combat : gratuit
        await this.actor.update({
          'system.combat.tableau1.actif': true,
          'system.combat.tableau2.actif': false
        });
        ui.notifications.info("✅ Tableau 1 activé");
      }
      
    } else if (tableauNum === "2") {
      // Si T2 déjà actif, on ne peut pas le désactiver
      if (tableau2Actif) {
        ui.notifications.warn("⚠️ Tableau 2 déjà actif ! (Activez Tableau 1 pour le changer)");
        return;
      }
      
      // Activer T2 (et désactiver T1)
      // Si en combat et qu'un autre tableau était actif → Coûte 1 Petit PA
      if (enCombat && tableau1Actif) {
        // Vérifier si action bloquée
        const actionBlocked = this.actor.getFlag('ffdreame', 'actionBlocked');
        if (actionBlocked) {
          ui.notifications.warn("🔒 Votre tour est terminé !");
          return;
        }
        
        // Trouver un Petit PA disponible
        const actionPoints = this.actor.system.combat.actionPoints;
        let petitDispo = null;
        
        for (let g = 1; g <= 3; g++) {
          for (let p = 1; p <= 2; p++) {
            if (actionPoints[`grand${g}`]?.[`petit${p}`]) {
              petitDispo = { grand: g, petit: p };
              break;
            }
          }
          if (petitDispo) break;
        }
        
        if (!petitDispo) {
          ui.notifications.warn("⚠️ Pas de Petit PA disponible pour changer de tableau !");
          return;
        }
        
        // Consommer le Petit PA
        await this.actor.update({
          [`system.combat.actionPoints.grand${petitDispo.grand}.petit${petitDispo.petit}`]: false,
          'system.combat.tableau1.actif': false,
          'system.combat.tableau2.actif': true
        });
        
        ui.notifications.info("✅ Tableau 2 activé (-1 Petit PA)");
      } else {
        // Hors combat ou début de combat : gratuit
        await this.actor.update({
          'system.combat.tableau1.actif': false,
          'system.combat.tableau2.actif': true
        });
        ui.notifications.info("✅ Tableau 2 activé");
      }
    }
  }

  /* ================================
     COMBAT : APPLIQUER PERTES PV PAR TOUR
     ================================ */
  async _appliquerPertesPVTour() {
    const blessures = this.actor.system.combat.blessures;
    const pvMax = this.actor.system.aptitudes.pv.max;
    const pvActuel = this.actor.system.aptitudes.pv.value;
    
    let perteTotale = 0;
    
    // b7: -10% PV max par tour
    if (blessures.b7) {
      perteTotale += Math.floor(pvMax * 0.10);
    }
    
    // b8: -20% PV max par tour (cumulé avec b7)
    if (blessures.b8) {
      perteTotale += Math.floor(pvMax * 0.20);
    }
    
    if (perteTotale > 0) {
      const nouveauPV = Math.max(0, pvActuel - perteTotale);
      await this.actor.update({ 'system.aptitudes.pv.value': nouveauPV });
      
      ui.notifications.warn(`💔 Perte de ${perteTotale} PV due aux blessures !`);
    }
  }

  /* ================================
     COMBAT : LANCER ATTAQUE DE BASE
     ================================ */
  async _onAttaqueBase(event) {
    event.preventDefault();
    const posture = event.currentTarget.dataset.posture;
    
    // Vérifier qu'on a un petit point d'action disponible
    const actionPoints = this.actor.system.combat.actionPoints;
    let petitDispo = null;
    let grandNum = null;
    
    // Chercher le premier petit point disponible
    for (let i = 1; i <= 3; i++) {
      const grand = actionPoints[`grand${i}`];
      if (grand.petit1) {
        petitDispo = `system.combat.actionPoints.grand${i}.petit1`;
        grandNum = i;
        break;
      } else if (grand.petit2) {
        petitDispo = `system.combat.actionPoints.grand${i}.petit2`;
        grandNum = i;
        break;
      }
    }
    
    if (!petitDispo) {
      ui.notifications.warn("⚠️ Plus de points d'action disponibles !");
      return;
    }
    
    // Consommer le petit point d'action
    await this.actor.update({ [petitDispo]: false });
    
    // Lancer l'attaque
    await this.actor.lancerAttaqueBase(posture);
  }

  /* ================================
     POSTURES : TOGGLE ACTIVATION
     ================================ */
  async _onTogglePosture(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    
    if (!item) return;
    
    const newActiveState = !item.system.active;
    await item.update({ 'system.active': newActiveState });
    
    ui.notifications.info(`${item.name} ${newActiveState ? 'activée' : 'désactivée'}`);
  }

  /* ================================
     POSTURES : ATTAQUE POSTURE
     ================================ */
  async _onAttaquePosture(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const posture = this.actor.items.get(itemId);
    
    if (!posture || !posture.system.active) {
      ui.notifications.warn("⚠️ Cette posture n'est pas active !");
      return;
    }
    
    // Vérifier qu'on a un petit point d'action disponible
    const actionPoints = this.actor.system.combat.actionPoints;
    let petitDispo = null;
    
    for (let i = 1; i <= 3; i++) {
      const grand = actionPoints[`grand${i}`];
      if (grand.petit1) {
        petitDispo = `system.combat.actionPoints.grand${i}.petit1`;
        break;
      } else if (grand.petit2) {
        petitDispo = `system.combat.actionPoints.grand${i}.petit2`;
        break;
      }
    }
    
    if (!petitDispo) {
      ui.notifications.warn("⚠️ Plus de points d'action disponibles !");
      return;
    }
    
    // Consommer le petit point d'action
    await this.actor.update({ [petitDispo]: false });
    
    // Lancer l'attaque de la posture
    await this.actor.lancerAttaquePosture(posture);
  }

  /* ================================
     POSTURES : UTILISER TECHNIQUE
     ================================ */
  async _onUseTechnique(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const postureId = event.currentTarget.dataset.postureId;
    
    const technique = this.actor.items.get(itemId);
    const posture = this.actor.items.get(postureId);
    
    if (!technique || !posture) return;
    
    if (!posture.system.active) {
      ui.notifications.warn("⚠️ Cette posture n'est pas active !");
      return;
    }
    
    // Vérifier PM
    const pmActuel = this.actor.system.aptitudes.pm.value;
    const coutPM = technique.system.coutPM || 0;
    
    if (pmActuel < coutPM) {
      ui.notifications.warn(`⚠️ PM insuffisants ! (${pmActuel}/${coutPM})`);
      return;
    }
    
    // Vérifier grand point d'action disponible
    const actionPoints = this.actor.system.combat.actionPoints;
    let grandDispo = null;
    
    for (let i = 1; i <= 3; i++) {
      const grand = actionPoints[`grand${i}`];
      if (grand.petit1 && grand.petit2) {
        grandDispo = i;
        break;
      }
    }
    
    if (!grandDispo) {
      ui.notifications.warn("⚠️ Plus de grands points d'action disponibles !");
      return;
    }
    
    // Consommer PM et grand point d'action
    await this.actor.update({ 
      'system.aptitudes.pm.value': pmActuel - coutPM,
      [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
      [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false
    });
    
    // Lancer la technique
    await this.actor.lancerTechnique(technique, posture);
  }

  /* ================================
     POSTURES : UTILISER TECHNIQUE EMBARQUÉE
     ================================ */
  async _onUseTechniqueEmbedded(event) {
    event.preventDefault();
    const postureId = event.currentTarget.dataset.postureId;
    const techIndex = parseInt(event.currentTarget.dataset.techIndex);
    
    const posture = this.actor.items.get(postureId);
    
    if (!posture || !posture.system.techniques || !posture.system.techniques[techIndex]) {
      ui.notifications.error("⚠️ Technique introuvable !");
      return;
    }
    
    const technique = posture.system.techniques[techIndex];
    
    if (!posture.system.active) {
      ui.notifications.warn("⚠️ Cette posture n'est pas active !");
      return;
    }
    
    // Vérifier PM
    const pmActuel = this.actor.system.aptitudes.pm.value;
    const coutPM = technique.coutPM || 0;
    
    if (pmActuel < coutPM) {
      ui.notifications.warn(`⚠️ PM insuffisants ! (${pmActuel}/${coutPM})`);
      return;
    }
    
    // Vérifier grand point d'action disponible
    const actionPoints = this.actor.system.combat.actionPoints;
    let grandDispo = null;
    
    for (let i = 1; i <= 3; i++) {
      const grand = actionPoints[`grand${i}`];
      if (grand.petit1 && grand.petit2) {
        grandDispo = i;
        break;
      }
    }
    
    if (!grandDispo) {
      ui.notifications.warn("⚠️ Plus de grands points d'action disponibles !");
      return;
    }
    
    // Consommer PM et grand point d'action
    await this.actor.update({ 
      'system.aptitudes.pm.value': pmActuel - coutPM,
      [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
      [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false
    });
    
    // Lancer la technique embarquée
    await this.actor.lancerTechniqueEmbedded(technique, posture);
  }

  /* ================================
     POSTURES : LANCER ULTIMATE
     ================================ */
  async _onUseUltimate(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    
    const posture = this.actor.items.get(itemId);
    
    if (!posture || !posture.system.active) {
      ui.notifications.warn("⚠️ Cette posture n'est pas active !");
      return;
    }
    
    // Vérifier Burste
    const burste = this.actor.system.combat.burste;
    if (burste < 100) {
      ui.notifications.warn(`⚠️ Burste insuffisante ! (${burste}/100)`);
      return;
    }
    
    // Vérifier grand point d'action disponible
    const actionPoints = this.actor.system.combat.actionPoints;
    let grandDispo = null;
    
    for (let i = 1; i <= 3; i++) {
      const grand = actionPoints[`grand${i}`];
      if (grand.petit1 && grand.petit2) {
        grandDispo = i;
        break;
      }
    }
    
    if (!grandDispo) {
      ui.notifications.warn("⚠️ Plus de grands points d'action disponibles !");
      return;
    }
    
    // Consommer grand point d'action et réinitialiser Burste
    await this.actor.update({ 
      [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
      [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false,
      'system.combat.burste': 0
    });
    
    // Lancer l'ultimate
    await this.actor.lancerUltimate(posture);
  }

  /* ================================
     COMBAT : INITIALISER LES ANNEAUX SVG (PV / PM)
     ================================ */
  _initOrbRings(html) {
    // PV
    const pvOrb = html.find('.combat-orb-pv');
    if (pvOrb.length) {
      const current = parseInt(pvOrb.data('pv-current')) || 0;
      const max    = parseInt(pvOrb.data('pv-max')) || 1;
      const ring   = pvOrb.find('.orb-ring-fill-pv');
      this._setRingProgress(ring, current, max);
    }

    // PM
    const pmOrb = html.find('.combat-orb-pm');
    if (pmOrb.length) {
      const current = parseInt(pmOrb.data('pm-current')) || 0;
      const max    = parseInt(pmOrb.data('pm-max')) || 1;
      const ring   = pmOrb.find('.orb-ring-fill-pm');
      this._setRingProgress(ring, current, max);
    }
  }

  _setRingProgress(ringEl, current, max) {
    if (!ringEl.length) return;
    const r = 52; // rayon du cercle SVG
    const circumference = 2 * Math.PI * r;
    const ratio = Math.max(0, Math.min(1, current / max));
    const offset = circumference * (1 - ratio);

    ringEl.css('stroke-dasharray', circumference);
    ringEl.css('stroke-dashoffset', offset);
  }

  /* ================================
     PRINCIPAL : BOUTON + COMPÉTENCE
     ================================ */
  async _onPlusCompetence(event) {
    event.preventDefault();
    event.stopPropagation(); // ne pas déclencher le jet de compétence

    const el = event.currentTarget;
    if (el.classList.contains('disabled')) return;

    const field = el.dataset.field; // ex: "system.physique.force.value"
    const currentVal = parseInt(el.closest('.competence-item').querySelector('.competence-value').textContent) || 0;

    // Vérifier qu'on a encore des points disponibles
    const system = this.actor.system;
    let totalDepense = 0;
    const categories = ['physique', 'dexterite', 'intelligence', 'charisme'];
    for (const cat of categories) {
      for (const [key, comp] of Object.entries(system[cat])) {
        totalDepense += parseInt(comp.value) || 0;
      }
    }
    const max = parseInt(system.pointsCompetences) || 0;

    if (totalDepense >= max) {
      ui.notifications.warn(`⚠️ Plus de points de compétences disponibles ! (${totalDepense}/${max})`);
      return;
    }

    await this.actor.update({ [field]: currentVal + 1 });
  }

  /* ================================
     PRINCIPAL : BOUTON + APTITUDE
     ================================ */
  async _onPlusAptitude(event) {
    event.preventDefault();
    event.stopPropagation();

    const el = event.currentTarget;
    if (el.classList.contains('disabled')) return;

    const field = el.dataset.field; // ex: "system.aptitudes.attaque.investissement"

    // Récupérer la valeur actuelle de l'investissement
    const parts = field.split('.');
    // parts = ["system", "aptitudes", "attaque", "investissement"]
    const aptName = parts[2];
    const currentVal = parseInt(this.actor.system.aptitudes[aptName]?.investissement) || 0;

    // Vérifier les points disponibles
    const system = this.actor.system;
    const totalDepense =
      (parseInt(system.aptitudes.attaque?.investissement) || 0) +
      (parseInt(system.aptitudes.puissanceMagique?.investissement) || 0) +
      (parseInt(system.aptitudes.pv?.investissement) || 0) +
      (parseInt(system.aptitudes.pm?.investissement) || 0);
    const max = parseInt(system.pointsAptitudesCumulees) || 0;

    if (totalDepense >= max) {
      ui.notifications.warn(`⚠️ Plus de points d'aptitudes disponibles ! (${totalDepense}/${max})`);
      return;
    }

    await this.actor.update({ [field]: currentVal + 1 });
  }

  /* ================================
     PRINCIPAL : CLIC SUR BASE D'APTITUDE (GM UNIQUEMENT)
     ================================ */
  async _onAptitudeBaseClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const el = event.currentTarget;
    const field = el.dataset.field; // ex: "system.aptitudes.attaque.base"
    const currentValue = parseInt(el.textContent) || 0;

    // Demander la nouvelle valeur
    const newValue = await Dialog.prompt({
      title: "Modifier la base",
      content: `<p>Valeur actuelle : ${currentValue}</p><input type="number" name="newBase" value="${currentValue}" autofocus />`,
      callback: (html) => {
        return parseInt(html.find('[name="newBase"]').val()) || 0;
      },
      rejectClose: false
    });

    if (newValue !== null && newValue !== currentValue) {
      await this.actor.update({ [field]: newValue });
    }
  }

  /* ================================
     DRAG & DROP POUR TABLEAUX INTERACTIFS
     ================================ */
  
  /**
   * Gestion du dragover pour permettre le drop
   */
  _onDragOverTableSlot(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
  }

  /**
   * Gestion du drop d'un objet dans une case du tableau
   */
  async _onDropTableSlot(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    console.log("📦 DROP: Début du drop");

    // Récupérer les données droppées
    let data;
    try {
      data = JSON.parse(event.originalEvent.dataTransfer.getData('text/plain'));
      console.log("📦 Data reçue:", data);
    } catch (err) {
      console.error("❌ Erreur parsing data:", err);
      return;
    }

    // Vérifier que c'est un Item
    if (data.type !== 'Item') {
      console.log("❌ Pas un Item, type =", data.type);
      return;
    }

    // Récupérer l'item
    const item = await fromUuid(data.uuid);
    if (!item) {
      console.error("❌ Item non trouvé pour uuid:", data.uuid);
      return;
    }
    
    console.log("✅ Item récupéré:", item.name, "ID:", item.id);

    // Récupérer les infos du slot
    const slot = event.currentTarget;
    const tableNum = slot.dataset.table;
    const slotNum = slot.dataset.slot;
    
    console.log(`📍 Slot: Tableau ${tableNum}, Case ${slotNum}`);

    // Vérifier si le slot est déjà occupé
    const currentItemId = slot.dataset.itemId;
    if (currentItemId) {
      console.log("⚠️ Slot déjà occupé avec item:", currentItemId);
      const confirm = await Dialog.confirm({
        title: "Remplacer l'objet ?",
        content: "<p>Cette case contient déjà un objet. Voulez-vous le remplacer ?</p>",
        yes: () => true,
        no: () => false
      });
      if (!confirm) {
        console.log("❌ Remplacement annulé");
        return;
      }
    }

    // Si l'item vient d'ailleurs (pas de cet acteur), il faut l'ajouter
    let itemId;
    const existingItem = this.actor.items.get(item.id);
    
    if (!existingItem) {
      console.log("➕ Item pas dans l'acteur, ajout en cours...");
      // Créer une copie de l'item dans l'acteur
      const itemData = item.toObject();
      const createdItems = await this.actor.createEmbeddedDocuments('Item', [itemData]);
      itemId = createdItems[0].id;
      console.log("✅ Item ajouté à l'acteur, nouvel ID:", itemId);
    } else {
      itemId = item.id;
      console.log("✅ Item déjà dans l'acteur, ID:", itemId);
    }

    // Stocker l'ID de l'item dans le slot
    const updateKey = `system.combat.tableau${tableNum}.slots.slot${slotNum}`;
    console.log("💾 Sauvegarde:", updateKey, "=", itemId);
    
    await this.actor.update({
      [updateKey]: itemId
    });

    console.log("✅ DROP TERMINÉ:", item.name, "ajouté au tableau", tableNum, "case", slotNum);
    ui.notifications.info(`${item.name} ajouté au tableau ${tableNum}, case ${slotNum}`);
  }

  /**
   * Gestion du clic sur une case du tableau (pour retirer l'objet)
   */
  /* ================================
     TABLEAUX : CLIC SUR SLOT POUR UTILISER L'OBJET
     ================================ */
  async _onClickTableSlot(event) {
    event.preventDefault();

    const slot = event.currentTarget;
    const tableNum = slot.dataset.table;
    const slotNum = slot.dataset.slot;
    const itemId = slot.dataset.itemId;

    // Vérifier si le tableau est actif
    const tableauActif = this.actor.system.combat?.[`tableau${tableNum}`]?.actif;
    if (!tableauActif) {
      ui.notifications.warn("⚠️ Ce tableau est désactivé !");
      return;
    }

    // Si la case est vide, ne rien faire
    if (!itemId) return;

    // Récupérer l'item
    const item = this.actor.items.get(itemId);
    if (!item) {
      ui.notifications.warn("L'objet n'existe plus!");
      return;
    }

    // Utiliser l'objet selon son type
    if (item.type === 'technique') {
      await this._useTableTechnique(item);
    } else if (item.type === 'attaque') {
      await this._useTableAttaque(item);
    } else if (item.type === 'ultimate') {
      await this._useTableUltimate(item);
    } else {
      ui.notifications.info(`${item.name} utilisé !`);
    }
  }

  /* ================================
     UTILISER UNE TECHNIQUE DEPUIS LE TABLEAU
     Version COMPLÈTE avec effets + ULTIM + Critiques
     ================================ */
  async _useTableTechnique(technique) {
    // Vérifier si les actions sont bloquées (tour terminé)
    const actionBlocked = this.actor.getFlag('ffdreame', 'actionBlocked');
    if (actionBlocked && !game.user.isGM) {
      ui.notifications.warn("🔒 Votre tour est terminé ! Vous ne pouvez plus utiliser vos techniques.");
      return;
    }
    
    // ===== VÉRIFICATION DE LA PORTÉE =====
    const style = technique.system.style;
    const portee = technique.system.portee || 1.5; // Portée par défaut : 1.5m
    
    // Les styles qui nécessitent une cible
    const stylesAvecCible = ['cac', 'mag', 'pui', 'atta', 'attm', 'ultim', 'aoe', 'ef', 'eha', 'ehm'];
    
    if (stylesAvecCible.includes(style)) {
      const targets = Array.from(game.user.targets);
      
      if (targets.length === 0) {
        ui.notifications.warn("⚠️ Vous devez cibler un ennemi !");
        return;
      }
      
      const target = targets[0];
      const token = this.actor.getActiveTokens()[0];
      
      if (!token) {
        ui.notifications.warn("⚠️ Token introuvable !");
        return;
      }
      
      // Calculer la distance en mètres
      const gridSize = canvas.grid.size;
      const gridDistance = canvas.scene.grid.distance || 1.5; // Distance par case (ex: 1.5m)
      
      const deltaX = (target.center.x - token.center.x) / gridSize;
      const deltaY = (target.center.y - token.center.y) / gridSize;
      const distanceCases = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const distanceMetres = distanceCases * gridDistance;
      
      console.log(`📏 Distance: ${distanceMetres.toFixed(2)}m / Portée max: ${portee}m`);
      
      if (distanceMetres > portee) {
        ui.notifications.warn(
          `⚠️ Cible trop loin !<br>` +
          `Distance: ${distanceMetres.toFixed(1)}m<br>` +
          `Portée de ${technique.name}: ${portee}m`
        );
        return;
      }
    }
    
    const rang = this.actor.system.rang;
    const rangModifier = this.actor._getRangModifier(rang);
    const seuilReussite = rangModifier.jetReussite;
    
    // ===== STYLE CHM : Dialogue de choix =====
    if (style === "chm") {
      await this._useTechniqueCHM(technique, seuilReussite);
      return;
    }
    
    // ===== STYLE AOER : Zone retardée =====
    if (style === "aoer") {
      await this._useTechniqueAOER(technique);
      return;
    }
    
    // ===== STYLE CUR : Soins automatiques (pas de jet) =====
    if (style === "cur") {
      await this._useTechniqueSoins(technique);
      return;
    }
    
    // ===== STYLE PARADE : Activation de la contre-attaque =====
    if (style === "parade") {
      await this._activerParade(technique);
      return;
    }
    
    // ===== STYLE TP : Téléportation avec jet de dés =====
    if (style === "tp") {
      await this._useTechniqueTeleportation(technique, seuilReussite, pmActuel, coutPM);
      return;
    }
    
    // STYLE ULTIM : Vérifier Burste = 100
    if (style === "ultim") {
      const bursteActuelle = this.actor.system.combat.burste || 0;
      if (bursteActuelle < 100) {
        ui.notifications.warn(`⚠️ ULTIMATE indisponible ! Burste : ${bursteActuelle}/100`);
        return;
      }
    }
    
    // Vérifier PM
    const pmActuel = this.actor.system.aptitudes.pm.value;
    const coutPM = technique.system.coutPM || 0;
    
    if (pmActuel < coutPM) {
      ui.notifications.warn(`⚠️ PM insuffisants ! (${pmActuel}/${coutPM})`);
      return;
    }
    
    // GESTION DES PA SELON LE STYLE
    const actionPoints = this.actor.system.combat.actionPoints;
    
    // Style ULTIM : Pas de consommation PA
    if (style === "ultim") {
      // Aucun PA consommé, on continue
    }
    // Styles ATTA et ATTM : 1 Petit PA obligatoire
    else if (style === "atta" || style === "attm") {
      let petitDispo = null;
      
      for (let i = 1; i <= 3; i++) {
        const grand = actionPoints[`grand${i}`];
        if (grand.petit1) {
          petitDispo = { grand: i, petit: 'petit1' };
          break;
        } else if (grand.petit2) {
          petitDispo = { grand: i, petit: 'petit2' };
          break;
        }
      }
      
      if (!petitDispo) {
        ui.notifications.warn("⚠️ Plus de petits points d'action disponibles !");
        return;
      }
      
      // Consommer Petit PA
      await this.actor.update({
        [`system.combat.actionPoints.grand${petitDispo.grand}.${petitDispo.petit}`]: false
      });
    }
    // Autres styles : PA selon coutPA
    else {
      const coutPA = technique.system.coutPA || "grand";
      
      if (coutPA === "grand") {
        // Vérifier grand point d'action disponible
        let grandDispo = null;
        
        for (let i = 1; i <= 3; i++) {
          const grand = actionPoints[`grand${i}`];
          if (grand.petit1 && grand.petit2) {
            grandDispo = i;
            break;
          }
        }
        
        if (!grandDispo) {
          ui.notifications.warn("⚠️ Plus de grands points d'action disponibles !");
          return;
        }
        
        // Consommer Grand PA
        await this.actor.update({
          [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
          [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false
        });
        
      } else if (coutPA === "petit") {
        // Chercher un Petit PA disponible
        let petitDispo = null;
        
        for (let i = 1; i <= 3; i++) {
          const grand = actionPoints[`grand${i}`];
          if (grand.petit1) {
            petitDispo = { grand: i, petit: 'petit1' };
            break;
          } else if (grand.petit2) {
            petitDispo = { grand: i, petit: 'petit2' };
            break;
          }
        }
        
        if (!petitDispo) {
          ui.notifications.warn("⚠️ Plus de petits points d'action disponibles !");
          return;
        }
        
        // Consommer Petit PA
        await this.actor.update({
          [`system.combat.actionPoints.grand${petitDispo.grand}.${petitDispo.petit}`]: false
        });
      }
    }
    
    // ===== STYLE MULTIS + surSoi + canalisation = Zone persistante autour du lanceur =====
    if (style === "multis" && technique.system.surSoi === true && technique.system.canalisation === true) {
      const tokenLanceur = canvas.tokens?.controlled?.[0]?.document
                        ?? this.actor.getActiveTokens()?.[0]?.document;
      if (!tokenLanceur) {
        ui.notifications.warn("⚠️ Aucun token sélectionné pour la canalisation.");
        return;
      }
      await FFdreameZonesCanalisation.toggleZone(this.actor, technique, tokenLanceur);
      return;
    }

    // Style MULTI = Zone d'effet avec prévisualisation
    if (style === "multi") {
      // IMPORTANT: On ne consomme RIEN avant de vérifier la distance
      // Le système multi gère tout en interne
      
      const result = await FFdreameMultiZone.useTechniqueMulti(this.actor, technique);
      
      // Si distance pas OK, on arrête sans consommer
      if (result && result.outOfRange) {
        console.log("❌ Distance non respectée, aucune consommation");
        return;
      }
      
      // Si annulé par l'utilisateur
      if (!result || (!result.success && !result.consumed)) {
        console.log("⏹️ Technique annulée");
        return;
      }
      
      // ===== CONSOMMATION PM + PA (seulement si distance OK) =====
      console.log("✅ Distance OK, consommation PM/PA");
      
      const pmActuel = this.actor.system.aptitudes.pm.value;
      await this.actor.update({
        'system.aptitudes.pm.value': pmActuel - coutPM
      });
      
      // ===== INCRÉMENTER COMPTEUR EFFET (si réussite) =====
      if (result.success) {
        await this._incrementerCompteurEffet();
      }
      
      return;
    }
    
    // Style AOE = 3 jets consécutifs
    if (style === "aoe") {
      await this._useTableTechniqueAOE(technique, seuilReussite, pmActuel, coutPM);
      return;
    }
    
    // Styles normaux (1 jet) avec ULTIM et critiques
    await this._useTableTechniqueNormal(technique, seuilReussite, pmActuel, coutPM);
  }

  /* ================================
     TECHNIQUE DE PARADE (contre-attaque)
     ================================ */
  async _activerParade(technique) {
    // Vérifier si actions bloquées
    const actionBlocked = this.actor.getFlag('ffdreame', 'actionBlocked');
    if (actionBlocked && !game.user.isGM) {
      ui.notifications.warn("🔒 Votre tour est terminé !");
      return;
    }
    
    // Vérifier PM
    const pmActuel = this.actor.system.aptitudes.pm.value;
    const coutPM = technique.system.coutPM || 0;
    if (pmActuel < coutPM) {
      ui.notifications.warn(`⚠️ PM insuffisants ! (${pmActuel}/${coutPM})`);
      return;
    }
    
    // Vérifier PA - Consomme 1 Grand PA
    const actionPoints = this.actor.system.combat?.actionPoints;
    let grandDispo = null;
    for (let g = 1; g <= 4; g++) {
      const grand = actionPoints?.[`grand${g}`];
      if (grand?.petit1 && grand?.petit2) {
        grandDispo = g;
        break;
      }
    }
    if (!grandDispo) {
      ui.notifications.warn("⚠️ Plus de Grand Point d'Action disponible !");
      return;
    }
    
    // Consommer PM + Grand PA
    await this.actor.update({
      'system.aptitudes.pm.value': pmActuel - coutPM,
      [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
      [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false
    });
    
    // Stocker la parade active via flag
    await this.actor.setFlag('ffdreame', 'paradeActive', {
      techniqueId: technique.id,
      nom: technique.name,
      baseDegats: technique.system.degats?.base || technique.system.baseDegats || 0,
      animation: technique.system.animation?.jb2a || null,
      animDuree: technique.system.animation?.duree || 3
    });
    
    // Message d'activation
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div style="background: rgba(0,180,255,0.15); border-left: 4px solid #00b4ff; padding: 10px; border-radius: 6px;">
          <h3 style="color:#00b4ff; margin:0 0 6px;">🛡️ PARADE ACTIVÉE</h3>
          <p><strong>${this.actor.name}</strong> prend position de parade !</p>
          <p style="color:#aaa; font-size:11px;">⚡ Si l'ennemi rate son attaque → contre-attaque automatique</p>
          <p style="color:#aaa; font-size:11px;">💫 Technique : <em>${technique.name}</em></p>
        </div>
      `
    });
    
    ui.notifications.info(`🛡️ Parade activée ! Attendez l'attaque ennemie.`);
  }

  /* ================================
     DÉCLENCHEMENT DE LA PARADE (côté défenseur)
     Appelé quand un ennemi rate son jet d'attaque
     ================================ */
  static async _declencherParade(acteurDefenseur, acteurAttaquant, jetAttaque, seuilAttaque) {
    const paradeData = acteurDefenseur.getFlag('ffdreame', 'paradeActive');
    if (!paradeData) return false;
    
    console.log(`🛡️ Parade déclenchée ! ${acteurDefenseur.name} contre ${acteurAttaquant?.name}`);
    
    // Récupérer les stats du défenseur pour la riposte
    const aptAtq = acteurDefenseur.system.combat?.attaque || 0;
    const rang = acteurDefenseur.system.rang || 1;
    const seuilRiposte = aptAtq + (rang * 5); // Seuil basé sur aptitude attaque
    
    // Jet de riposte du défenseur
    const jetRiposte = new Roll("1d100");
    await jetRiposte.evaluate();
    const resultatRiposte = jetRiposte.total;
    const riposteReussie = resultatRiposte <= seuilRiposte;
    
    // Calcul des dégâts si réussi
    const baseDegats = paradeData.baseDegats || 0;
    const degatsRiposte = riposteReussie ? baseDegats + aptAtq : 0;
    
    // Message du résultat
    const couleur = riposteReussie ? '#ffd700' : '#ff6b6b';
    const icone = riposteReussie ? '⚡' : '💨';
    
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: acteurDefenseur }),
      content: `
        <div style="background: rgba(255,215,0,0.15); border-left: 4px solid #ffd700; padding: 10px; border-radius: 6px;">
          <h3 style="color:#ffd700; margin:0 0 8px;">🛡️ PARADE → RIPOSTE !</h3>
          <p><strong>${acteurAttaquant?.name || 'L\'attaquant'}</strong> a raté son attaque (${jetAttaque} > ${seuilAttaque})</p>
          <hr style="border-color:#333; margin:6px 0;">
          <p>🎲 Jet de riposte : <strong>${resultatRiposte}</strong> / Seuil : <strong>${seuilRiposte}</strong></p>
          <p style="color:${couleur}; font-weight:bold;">${icone} ${riposteReussie 
            ? `RIPOSTE RÉUSSIE ! ${degatsRiposte} dégâts (${baseDegats} base + ${aptAtq} Attaque)` 
            : 'Riposte ratée...'
          }</p>
        </div>
      `
    });
    
    // Appliquer les dégâts à l'attaquant si réussi
    if (riposteReussie && acteurAttaquant) {
      const pvActuel = acteurAttaquant.system.aptitudes.pv.value;
      const nouveauPV = Math.max(0, pvActuel - degatsRiposte);
      await acteurAttaquant.update({ 'system.aptitudes.pv.value': nouveauPV });
      
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: acteurDefenseur }),
        content: `<div style="background:rgba(255,107,107,0.2); border-left:3px solid #ff6b6b; padding:8px; border-radius:4px;">
          💥 <strong>${acteurAttaquant.name}</strong> reçoit <strong>${degatsRiposte} dégâts</strong> de riposte !
          <br>PV : ${pvActuel} → ${nouveauPV}
        </div>`
      });
      
      if (nouveauPV === 0) {
        ui.notifications.warn(`💀 ${acteurAttaquant.name} est K.O. !`);
      }
    }
    
    // Désactiver la parade (usage unique)
    await acteurDefenseur.unsetFlag('ffdreame', 'paradeActive');
    
    // Jouer l'animation de riposte si réussie et animation configurée
    if (riposteReussie && paradeData.animation && game.modules.get('sequencer')?.active) {
      try {
        const tokenDef = canvas.tokens.placeables.find(t => t.actor?.id === acteurDefenseur.id);
        const tokenAtq = canvas.tokens.placeables.find(t => t.actor?.id === acteurAttaquant?.id);
        const dureeRaw = paradeData.animDuree || 3;
        const dureeMs = parseInt(dureeRaw) >= 999 ? 600000 : parseInt(dureeRaw) * 1000;
        
        if (tokenDef) {
          const seq = new Sequence().effect()
            .file(paradeData.animation)
            .atLocation(tokenDef)
            .duration(dureeMs);
          
          if (tokenAtq) seq.stretchTo(tokenAtq);
          
          await new Sequence().effect()
            .file(paradeData.animation)
            .atLocation(tokenDef)
            .stretchTo(tokenAtq || tokenDef)
            .duration(dureeMs)
            .play();
        }
      } catch(e) {
        console.log("Animation parade: erreur Sequencer", e);
      }
    }
    
    ui.notifications.info(`🛡️ Parade de ${acteurDefenseur.name} terminée !`);
    return true;
  }

  /* ================================
     TECHNIQUE DE SOINS (automatique)
     ================================ */
  async _useTechniqueSoins(technique) {
    // Vérifier si les actions sont bloquées
    const actionBlocked = this.actor.getFlag('ffdreame', 'actionBlocked');
    if (actionBlocked && !game.user.isGM) {
      ui.notifications.warn("🔒 Votre tour est terminé !");
      return;
    }
    
    // Vérifier PM
    const pmActuel = this.actor.system.aptitudes.pm.value;
    const coutPM = technique.system.coutPM || 0;
    
    if (pmActuel < coutPM) {
      ui.notifications.warn(`⚠️ PM insuffisants ! (${pmActuel}/${coutPM})`);
      return;
    }
    
    // Consommer PA
    const coutPA = technique.system.coutPA || "grand";
    const actionPoints = this.actor.system.combat.actionPoints;
    
    if (coutPA === "grand") {
      let grandDispo = null;
      for (let i = 1; i <= 3; i++) {
        const grand = actionPoints[`grand${i}`];
        if (grand.petit1 && grand.petit2) {
          grandDispo = i;
          break;
        }
      }
      
      if (!grandDispo) {
        ui.notifications.warn("⚠️ Plus de grands points d'action disponibles !");
        return;
      }
      
      await this.actor.update({
        [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
        [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false
      });
      
    } else if (coutPA === "petit") {
      let petitDispo = null;
      for (let i = 1; i <= 3; i++) {
        const grand = actionPoints[`grand${i}`];
        if (grand.petit1) {
          petitDispo = { grand: i, petit: 'petit1' };
          break;
        } else if (grand.petit2) {
          petitDispo = { grand: i, petit: 'petit2' };
          break;
        }
      }
      
      if (!petitDispo) {
        ui.notifications.warn("⚠️ Plus de petits points d'action disponibles !");
        return;
      }
      
      await this.actor.update({
        [`system.combat.actionPoints.grand${petitDispo.grand}.${petitDispo.petit}`]: false
      });
    }
    
    // Calculer les soins
    const soinsBase = technique.system.baseDegats || 0;
    const soins = soinsBase;
    
    // Déterminer la cible (cible sélectionnée ou soi-même)
    const targets = Array.from(game.user.targets);
    const cible = targets.length > 0 ? targets[0].actor : this.actor;
    
    const pvActuel = cible.system.aptitudes.pv.value;
    const pvMax = cible.system.aptitudes.pv.max;
    const nouveauPV = Math.min(pvMax, pvActuel + soins);
    
    // Appliquer les soins
    await cible.update({
      'system.aptitudes.pv.value': nouveauPV
    });
    
    // Consommer PM
    await this.actor.update({
      'system.aptitudes.pm.value': pmActuel - coutPM
    });
    
    // Message de soins
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h3>❤️ ${technique.name}</h3>
               <p>Style: CUR (Soins) | Coût: ${coutPM} PM</p>`,
      content: `<div style="background: rgba(76, 175, 80, 0.2); padding: 10px; border-left: 3px solid #4CAF50;">
                  <strong>❤️ ${cible.name}</strong> a reçu <strong>${soins} soins</strong> !
                  <br/>PV: ${pvActuel}/${pvMax} → ${nouveauPV}/${pvMax}
                </div>`
    });
    
    ui.notifications.info(`❤️ +${soins} PV pour ${cible.name}`);
    
    // Jouer l'animation si présente
    await this._jouerAnimationItem(technique);
    
    // Incrémenter compteur effet et Burste
    await this._incrementerCompteurEffet();
    const bursteCurrent = this.actor.system.combat.burste || 0;
    const newBurste = Math.min(100, bursteCurrent + 10);
    await this.actor.update({
      'system.combat.burste': newBurste
    });
    
    if (newBurste === 100) {
      ui.notifications.info("⚡ BURSTE À 100 ! ULTIMATE DISPONIBLE !");
    }
  }

  /* ================================
     TECHNIQUE DE TÉLÉPORTATION (automatique)
     ================================ */
  async _useTechniqueTeleportation(technique) {
    // Vérifier si les actions sont bloquées
    const actionBlocked = this.actor.getFlag('ffdreame', 'actionBlocked');
    if (actionBlocked && !game.user.isGM) {
      ui.notifications.warn("🔒 Votre tour est terminé !");
      return;
    }
    
    // Vérifier si le système de téléportation est disponible
    if (!window.FFdreameTeleportation?.isTeleportationEnabled(technique)) {
      ui.notifications.warn("⚠️ Téléportation non configurée pour cette technique !");
      return;
    }
    
    // Vérifier PM
    const pmActuel = this.actor.system.aptitudes.pm.value;
    const coutPM = technique.system.coutPM || 0;
    
    if (pmActuel < coutPM) {
      ui.notifications.warn(`⚠️ PM insuffisants ! (${pmActuel}/${coutPM})`);
      return;
    }
    
    // Consommer PA
    const coutPA = technique.system.coutPA || "grand";
    const actionPoints = this.actor.system.combat.actionPoints;
    
    if (coutPA === "grand") {
      let grandDispo = null;
      for (let i = 1; i <= 3; i++) {
        const grand = actionPoints[`grand${i}`];
        if (grand.petit1 && grand.petit2) {
          grandDispo = i;
          break;
        }
      }
      
      if (!grandDispo) {
        ui.notifications.warn("⚠️ Plus de grands points d'action disponibles !");
        return;
      }
      
      await this.actor.update({
        [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
        [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false
      });
      
    } else if (coutPA === "petit") {
      let petitDispo = null;
      for (let i = 1; i <= 3; i++) {
        const grand = actionPoints[`grand${i}`];
        if (grand.petit1) {
          petitDispo = { grand: i, petit: 'petit1' };
          break;
        } else if (grand.petit2) {
          petitDispo = { grand: i, petit: 'petit2' };
          break;
        }
      }
      
      if (!petitDispo) {
        ui.notifications.warn("⚠️ Plus de petits points d'action disponibles !");
        return;
      }
      
      await this.actor.update({
        [`system.combat.actionPoints.grand${petitDispo.grand}.${petitDispo.petit}`]: false
      });
    }
    
    // Obtenir la cible ou le point de téléportation
    const targets = Array.from(game.user.targets);
    const targetToken = targets.length > 0 ? targets[0] : null;
    
    // Récupérer la config de téléportation
    const teleportConfig = window.FFdreameTeleportation.getTeleportationConfig(technique);
    
    // Effectuer la téléportation
    const success = await window.FFdreameTeleportation.handleTeleportation(
      this.actor, 
      targetToken, 
      teleportConfig
    );
    
    if (!success) {
      // La téléportation a échoué (annulée ou hors portée)
      // Restituer les PA consommés
      ui.notifications.warn("⚠️ Téléportation annulée");
      
      if (coutPA === "grand") {
        let grandDispo = null;
        for (let i = 1; i <= 3; i++) {
          const grand = actionPoints[`grand${i}`];
          if (!grand.petit1 && !grand.petit2) {
            grandDispo = i;
            break;
          }
        }
        if (grandDispo) {
          await this.actor.update({
            [`system.combat.actionPoints.grand${grandDispo}.petit1`]: true,
            [`system.combat.actionPoints.grand${grandDispo}.petit2`]: true
          });
        }
      } else if (coutPA === "petit") {
        for (let i = 1; i <= 3; i++) {
          const grand = actionPoints[`grand${i}`];
          if (!grand.petit1) {
            await this.actor.update({
              [`system.combat.actionPoints.grand${i}.petit1`]: true
            });
            break;
          } else if (!grand.petit2) {
            await this.actor.update({
              [`system.combat.actionPoints.grand${i}.petit2`]: true
            });
            break;
          }
        }
      }
      return;
    }
    
    // Consommer PM
    await this.actor.update({
      'system.aptitudes.pm.value': pmActuel - coutPM
    });
    
    // Message de téléportation
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h3>🚀 ${technique.name}</h3>
               <p>Style: TP (Téléportation) | Coût: ${coutPM} PM</p>`,
      content: `<div style="background: rgba(0, 217, 255, 0.2); padding: 10px; border-left: 3px solid #00d9ff;">
                  <strong>🚀 ${this.actor.name}</strong> se téléporte !
                </div>`
    });
    
    ui.notifications.info(`🚀 Téléportation réussie !`);
    
    // Jouer l'animation si présente
    await this._jouerAnimationItem(technique);
    
    // Incrémenter compteur effet et Burste
    await this._incrementerCompteurEffet();
    const bursteCurrent = this.actor.system.combat.burste || 0;
    const newBurste = Math.min(100, bursteCurrent + 10);
    await this.actor.update({
      'system.combat.burste': newBurste
    });
    
    if (newBurste === 100) {
      ui.notifications.info("⚡ BURSTE À 100 ! ULTIMATE DISPONIBLE !");
    }
  }

  /* ================================
     TECHNIQUE DE TÉLÉPORTATION (avec jet)
     ================================ */
  async _useTechniqueTeleportation(technique, seuilReussite, pmActuel, coutPM) {
    console.log('🚀 Début technique de téléportation avec jet');
    
    // Vérifier si les actions sont bloquées
    const actionBlocked = this.actor.getFlag('ffdreame', 'actionBlocked');
    if (actionBlocked && !game.user.isGM) {
      ui.notifications.warn("🔒 Votre tour est terminé !");
      return;
    }
    
    // Vérifier si la téléportation est configurée
    if (!window.FFdreameTeleportation?.isTeleportationEnabled(technique)) {
      ui.notifications.warn("⚠️ Téléportation non configurée pour cette technique !");
      return;
    }
    
    // Vérifier PM
    if (pmActuel < coutPM) {
      ui.notifications.warn(`⚠️ PM insuffisants ! (${pmActuel}/${coutPM})`);
      return;
    }
    
    // Consommer PA
    const coutPA = technique.system.coutPA || "grand";
    const actionPoints = this.actor.system.combat.actionPoints;
    
    if (coutPA === "grand") {
      let grandDispo = null;
      for (let i = 1; i <= 3; i++) {
        const grand = actionPoints[`grand${i}`];
        if (grand.petit1 && grand.petit2) {
          grandDispo = i;
          break;
        }
      }
      
      if (!grandDispo) {
        ui.notifications.warn("⚠️ Plus de grands points d'action disponibles !");
        return;
      }
      
      await this.actor.update({
        [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
        [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false
      });
      
    } else if (coutPA === "petit") {
      let petitDispo = null;
      for (let i = 1; i <= 3; i++) {
        const grand = actionPoints[`grand${i}`];
        if (grand.petit1) {
          petitDispo = { grand: i, petit: 'petit1' };
          break;
        } else if (grand.petit2) {
          petitDispo = { grand: i, petit: 'petit2' };
          break;
        }
      }
      
      if (!petitDispo) {
        ui.notifications.warn("⚠️ Plus de petits points d'action disponibles !");
        return;
      }
      
      await this.actor.update({
        [`system.combat.actionPoints.grand${petitDispo.grand}.${petitDispo.petit}`]: false
      });
    }
    
    // ===== JET DE DÉS =====
    console.log('🎲 Jet de téléportation...');
    
    // Calculer les malus
    let fatigueMalus = this.actor._calculateFatigueMalus();
    let blessureMalus = this.actor._calculateBlessureMalus();
    let totalMalus = fatigueMalus + blessureMalus;
    
    // Formule de jet
    let formula = `1d100`;
    if (totalMalus > 0) {
      formula += ` + ${totalMalus}`;
    }
    
    const roll = new Roll(formula);
    await roll.evaluate();
    
    const total = roll.total;
    const success = total <= seuilReussite;
    
    console.log(`🎲 Résultat: ${total} (seuil: ${seuilReussite}) → ${success ? 'Réussite' : 'Échec'}`);
    
    // Message du jet
    let resultText = success ? '✓ Réussite' : '✗ Échec';
    
    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h3>🚀 ${technique.name}</h3>
               <p>Style: TP (Téléportation) | Coût: ${coutPM} PM</p>
               <p>Seuil de réussite : ≤ ${seuilReussite}</p>`,
      content: `
        <div class="dice-roll">
          <div class="dice-result">
            <div class="dice-formula">${formula}</div>
            <div class="dice-total ${success ? 'success' : 'failure'}">
              ${total} ${resultText}
            </div>
          </div>
        </div>
      `
    };
    
    await roll.toMessage(messageData);
    
    // Consommer PM
    await this.actor.update({
      'system.aptitudes.pm.value': pmActuel - coutPM
    });
    
    // ===== SI RÉUSSITE : TÉLÉPORTATION =====
    if (success) {
      console.log('✅ Jet réussi, téléportation en cours...');
      
      const targets = Array.from(game.user.targets);
      const targetToken = targets.length > 0 ? targets[0] : null;
      const teleportConfig = window.FFdreameTeleportation.getTeleportationConfig(technique);
      
      // Effectuer la téléportation (avec isTeleportation pour ignorer la limite)
      await window.FFdreameTeleportation.handleTeleportation(
        this.actor, 
        targetToken, 
        teleportConfig
      );
      
      // Jouer l'animation
      await this._jouerAnimationItem(technique);
      
      // Augmenter Burste
      const bursteCurrent = this.actor.system.combat.burste || 0;
      const newBurste = Math.min(100, bursteCurrent + 10);
      await this.actor.update({
        'system.combat.burste': newBurste
      });
      
      if (newBurste === 100) {
        ui.notifications.info("⚡ BURSTE À 100 ! ULTIMATE DISPONIBLE !");
      }
      
      // Incrémenter compteur effet
      await this._incrementerCompteurEffet();
      
    } else {
      console.log('❌ Jet raté, pas de téléportation');
      ui.notifications.warn("⚠️ Téléportation ratée !");
    }
  }

  /* ================================
     TECHNIQUE NORMALE (1 jet)
     ================================ */
  async _useTableTechniqueNormal(technique, seuilReussite, pmActuel, coutPM) {
    // Calculer les dégâts de base
    const degatsBase = this.actor._calculateTechniqueDegats(technique);
    
    // ===== APPLIQUER LES EFFETS DE TABLEAUX =====
    let { degats, bonus, effetApplique } = await this._appliquerEffetTableau(technique, degatsBase);
    
    // Calculer les malus
    let fatigueMalus = this.actor._calculateFatigueMalus();
    let blessureMalus = this.actor._calculateBlessureMalus();
    let totalMalus = fatigueMalus + blessureMalus;
    
    // Appliquer réduction de malus si effet actif
    const reductionMalus = this._getReductionMalusEffet();
    if (reductionMalus > 0) {
      totalMalus = Math.floor(totalMalus * (1 - reductionMalus / 100));
      console.log(`🛡️ Réduction malus: ${reductionMalus}% → Malus final: ${totalMalus}`);
    }
    
    // Appliquer bonus de réussite si effet actif
    const bonusReussite = this._getBonusReussiteEffet();
    
    // Appliquer malus Jet du Risque si présent
    const malusJetRisque = this.actor.getFlag('ffdreame', 'jetRisqueMalus');
    let malusReussite = 0;
    if (malusJetRisque && malusJetRisque.tours > 0) {
      malusReussite = malusJetRisque.valeur || 0;
      console.log(`⚠️ Malus Jet du Risque: -${malusReussite}% (${malusJetRisque.tours} tour restant)`);
    }
    
    const seuilReussiteAjuste = seuilReussite + bonusReussite - malusReussite;
    if (bonusReussite > 0) {
      console.log(`🎯 Bonus réussite: +${bonusReussite}% → Seuil: ${seuilReussiteAjuste}`);
    }
    if (malusReussite > 0) {
      console.log(`⚠️ Malus réussite: -${malusReussite}% → Seuil: ${seuilReussiteAjuste}`);
    }
    
    // Formule de jet
    let formula = `1d100`;
    if (totalMalus > 0) {
      formula += ` + ${totalMalus}`;
    }
    
    const roll = new Roll(formula);
    await roll.evaluate();
    
    const total = roll.total;
    const success = total <= seuilReussiteAjuste;
    
    // CRITIQUES
    const isCriticalSuccess = total <= 5;  // Succès Critique : 1-5
    const isCriticalFailure = total >= 95; // Échec Critique : 95-100
    
    // Messages
    let malusInfo = '';
    if (totalMalus > 0) {
      malusInfo = `<p style="color: #ff6b6b; font-size: 12px;">⚠️ Malus total : +${totalMalus}`;
      if (reductionMalus > 0) {
        malusInfo += ` (réduit de ${reductionMalus}%)`;
      }
      malusInfo += `</p>`;
    }
    
    let effetsAppliques = '';
    if (effetApplique) {
      effetsAppliques = `<p style="color: #4CAF50; font-size: 12px;">✨ ${effetApplique}</p>`;
    }
    if (bonusReussite > 0) {
      effetsAppliques += `<p style="color: #00d9ff; font-size: 12px;">🎯 Bonus Réussite: +${bonusReussite}%</p>`;
    }
    
    // Appliquer les effets si le jet réussit
    let degatsFinaux = degats;
    if (success) {
      const resultatEffets = await this._appliquerEffetsTechnique(technique, total, degats);
      effetsAppliques = resultatEffets.effetsText || effetsAppliques;
      degatsFinaux = resultatEffets.degatsFinaux || degats;
      
      // Utiliser les dégâts finaux pour les calculs suivants
      degats = degatsFinaux;
    }
    
    let resultText = success ? '✓ Réussite' : '✗ Échec';
    
    // Messages de critiques + Notifications stylées
    if (isCriticalSuccess && success) {
      resultText = '⭐ SUCCÈS CRITIQUE !';
      if (window.FFdreameNotifications) {
        window.FFdreameNotifications.showCritical("success", this.actor.name, total);
      }
    } else if (isCriticalFailure) {
      resultText = '💀 ÉCHEC CRITIQUE !';
      if (window.FFdreameNotifications) {
        window.FFdreameNotifications.showCritical("failure", this.actor.name, total);
      }
    }
    
    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h3>⚡ ${technique.name}</h3>
               <p>Style: ${technique.system.style?.toUpperCase() || 'CAC'} | Coût: ${coutPM} PM</p>
               <p>Seuil de réussite : ≤ ${seuilReussiteAjuste}${bonusReussite > 0 ? ` (+${bonusReussite}%)` : ''}</p>
               ${malusInfo}
               ${effetsAppliques}`,
      content: `
        <div class="dice-roll">
          <div class="dice-result">
            <div class="dice-formula">${formula}</div>
            <div class="dice-total ${isCriticalSuccess ? 'critical-success' : isCriticalFailure ? 'critical-failure' : success ? 'success' : 'failure'}">
              ${total} ${resultText}
            </div>
          </div>
          ${success ? `<div class="degats-info"><strong>💥 Dégâts : ${isCriticalSuccess ? degats * 2 : degats}</strong></div>` : ''}
          ${effetsAppliques}
        </div>
      `
    };
    
    await roll.toMessage(messageData);
    
    // Consommer PM
    const updateData = {
      'system.aptitudes.pm.value': pmActuel - coutPM
    };
    
    // GESTION DE LA BURSTE SELON LE STYLE
    const style = technique.system.style;
    
    if (style === "ultim") {
      // Style ULTIM : Consommer toute la Burste (100 → 0)
      updateData['system.combat.burste'] = 0;
      ui.notifications.info("⚡ ULTIMATE utilisé ! Burste consommée (100 → 0)");
      
    } else if (success && (style === "atta" || style === "attm")) {
      // Styles ATTA et ATTM : +10 Burste si réussite
      const bursteCurrent = this.actor.system.combat.burste || 0;
      const newBurste = Math.min(100, bursteCurrent + 10);
      updateData['system.combat.burste'] = newBurste;
      
      if (newBurste === 100) {
        ui.notifications.info("⚡ BURSTE À 100 ! ULTIMATE DISPONIBLE !");
      }
      
    } else if (success) {
      // Autres styles : +10 Burste si réussite
      const bursteCurrent = this.actor.system.combat.burste || 0;
      const newBurste = Math.min(100, bursteCurrent + 10);
      updateData['system.combat.burste'] = newBurste;
      
      if (newBurste === 100) {
        ui.notifications.info("⚡ BURSTE À 100 ! ULTIMATE DISPONIBLE !");
      }
    }
    
    await this.actor.update(updateData);
    
    // APPLIQUER LES DÉGÂTS OU SOINS À LA CIBLE si réussite
    if (success) {
      const targets = Array.from(game.user.targets);
      const target = targets[0];
      
      // Calculer les dégâts finaux (x2 si critique)
      const degatsFinaux = isCriticalSuccess ? degats * 2 : degats;
      
      // Style CUR = Soins (ajoute des PV)
      if (style === "cur") {
        // SOINS : Cibler quelqu'un ou soi-même
        const cible = target ? target.actor : this.actor;
        const pvActuel = cible.system.aptitudes.pv.value;
        const pvMax = cible.system.aptitudes.pv.max;
        const soins = degatsFinaux; // "degats" = montant des soins
        const nouveauPV = Math.min(pvMax, pvActuel + soins);
        
        await cible.update({
          'system.aptitudes.pv.value': nouveauPV
        });
        
        // Message de soins
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: `<div style="background: rgba(76, 175, 80, 0.2); padding: 10px; border-left: 3px solid #4CAF50;">
                      <strong>❤️ ${cible.name}</strong> a reçu <strong>${soins} soins</strong> !
                      <br/>PV: ${pvActuel}/${pvMax} → ${nouveauPV}/${pvMax}
                    </div>`
        });
        
        ui.notifications.info(`❤️ +${soins} PV pour ${cible.name}`);
        
      } else {
        // DÉGÂTS : Styles normaux (CAC, MAG, PUI, ATTA, ATTM, ULTIM, etc.)
        if (target && target.actor) {
          let degatsApresReaction = degatsFinaux;
          let messageReaction = "";
          
          // ===== VÉRIFIER LES RÉACTIONS DE LA CIBLE =====
          const reactions = target.actor.system.combat?.reactions;
          const esquiveActive = reactions?.esquive || false;
          const defenseActive = reactions?.defense || false;
          
          if (esquiveActive || defenseActive) {
            // Déterminer quelle réaction utiliser
            let reactionType = null;
            
            if (esquiveActive && defenseActive) {
              // Les deux actives → Demander au joueur
              reactionType = await new Promise((resolve) => {
                new Dialog({
                  title: `Réaction de ${target.actor.name}`,
                  content: `<p>${target.actor.name} a <strong>Esquive</strong> ET <strong>Défense</strong> actives !</p>
                            <p>Laquelle utiliser ?</p>`,
                  buttons: {
                    esquive: {
                      label: "🤸 Esquive",
                      callback: () => resolve('esquive')
                    },
                    defense: {
                      label: "🛡️ Défense",
                      callback: () => resolve('defense')
                    },
                    aucune: {
                      label: "❌ Aucune",
                      callback: () => resolve(null)
                    }
                  }
                }).render(true);
              });
            } else if (esquiveActive) {
              reactionType = 'esquive';
            } else if (defenseActive) {
              reactionType = 'defense';
            }
            
            if (reactionType) {
              // Récupérer la compétence appropriée
              let competenceValeur = 0;
              if (reactionType === 'esquive') {
                competenceValeur = target.actor.system.dexterite?.agilite?.value || 0;
              } else {
                competenceValeur = target.actor.system.physique?.endurance?.value || 0;
              }
              
              // SEUIL = Jet d'attaque + Compétence
              const seuilReaction = total + competenceValeur;
              
              // Jet de réaction du défenseur
              const jetReaction = new Roll("1d100");
              await jetReaction.evaluate();
              const resultatReaction = jetReaction.total;
              
              const reussite = resultatReaction <= seuilReaction;
              const marge = resultatReaction - seuilReaction;
              
              const reactionLabel = reactionType === 'esquive' ? '🤸 ESQUIVE' : '🛡️ DÉFENSE';
              const reactionIcon = reactionType === 'esquive' ? '🤸' : '🛡️';
              const competenceLabel = reactionType === 'esquive' ? 'Agilité' : 'Endurance';
              
              // Afficher le jet de réaction
              await jetReaction.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: target.actor }),
                flavor: `<h3>${reactionLabel}</h3>
                         <p>Jet de défense : <strong>${resultatReaction}</strong></p>
                         <p>Seuil requis : <strong>≤ ${seuilReaction}</strong> (Attaque ${total} + ${competenceLabel} ${competenceValeur})</p>
                         <p>${reussite ? '✅ <strong>RÉUSSI !</strong>' : '❌ <strong>RATÉ !</strong>'}</p>`
              });
              
              // Calcul de la réduction
              if (reussite) {
                let reduction = 0;
                
                if (marge <= -20 || resultatReaction <= 5) {
                  // Annulation complète
                  reduction = 1.0;
                  messageReaction = `${reactionIcon} <strong>RÉACTION PARFAITE !</strong> Dégâts annulés (Marge: ${marge})`;
                } else if (marge <= -15) {
                  // 50% de réduction
                  reduction = 0.5;
                  messageReaction = `${reactionIcon} <strong>Réaction réussie !</strong> Dégâts réduits de 50% (Marge: ${marge})`;
                } else {
                  // 20% de réduction
                  reduction = 0.2;
                  messageReaction = `${reactionIcon} <strong>Réaction partielle</strong> Dégâts réduits de 20% (Marge: ${marge})`;
                }
                
                degatsApresReaction = Math.floor(degatsFinaux * (1 - reduction));
              } else {
                messageReaction = `❌ ${reactionLabel} ratée ! Dégâts complets.`;
              }
              
              // Désactiver la réaction utilisée
              await target.actor.update({
                [`system.combat.reactions.${reactionType}`]: false
              });
            }
          }
          
          // Appliquer les dégâts (réduits ou non)
          const pvCibleActuel = target.actor.system.aptitudes.pv.value;
          const nouveauPVCible = Math.max(0, pvCibleActuel - degatsApresReaction);
          
          await target.actor.update({
            'system.aptitudes.pv.value': nouveauPVCible
          });
          
          // Message de dégâts avec info de réaction
          let messageContent = `<div style="background: rgba(255, 107, 107, 0.2); padding: 10px; border-left: 3px solid #ff6b6b;">
                      <strong>💥 ${target.actor.name}</strong> a reçu <strong>${degatsApresReaction} dégâts</strong>${isCriticalSuccess ? ' (CRITIQUE x2)' : ''} !`;
          
          if (messageReaction) {
            messageContent += `<br/><span style="color: #00d9ff;">${messageReaction}</span>`;
            if (degatsApresReaction < degatsFinaux) {
              messageContent += `<br/><small>Dégâts de base: ${degatsFinaux} → Après réaction: ${degatsApresReaction}</small>`;
            }
          }
          
          messageContent += `<br/>PV: ${pvCibleActuel} → ${nouveauPVCible}
                    </div>`;
          
          ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: messageContent
          });
          
          if (nouveauPVCible === 0) {
            if (window.FFdreameNotifications) {
              window.FFdreameNotifications.showKnockout(target.actor.name);
            } else {
              ui.notifications.warn(`💀 ${target.actor.name} est K.O. !`);
            }
          }
        }
      }
    }
    
    // ===== VÉRIFIER LA PARADE DE LA CIBLE SI ÉCHEC =====
    if (!success) {
      const targets = Array.from(game.user.targets);
      const target = targets[0];
      if (target && target.actor) {
        // La cible a-t-elle une parade active ?
        const paradeData = target.actor.getFlag('ffdreame', 'paradeActive');
        if (paradeData) {
          console.log(`🛡️ ${target.actor.name} a une parade active ! Déclenchement...`);
          await ActorSheetFFdreame._declencherParade(
            target.actor,
            this.actor,
            total,
            seuilReussiteAjuste
          );
        }
      }
    }
    
    // Jouer l'animation si présente et si réussite
    if (success) {
      await this._jouerAnimationItem(technique);
      
      // ===== GESTION DE LA TÉLÉPORTATION =====
      if (window.FFdreameTeleportation?.isTeleportationEnabled(technique)) {
        const targets = Array.from(game.user.targets);
        const targetToken = targets.length > 0 ? targets[0] : null;
        const teleportConfig = window.FFdreameTeleportation.getTeleportationConfig(technique);
        
        await window.FFdreameTeleportation.handleTeleportation(this.actor, targetToken, teleportConfig);
      }
      
      // ===== GESTION DES ZONES PERSISTANTES =====
      if (technique.system.animation?.persistante && window.FFdreamePersistentZones) {
        const targets = Array.from(game.user.targets);
        const targetToken = targets.length > 0 ? targets[0] : null;
        const token = this.actor.getActiveTokens()[0];
        
        const zoneConfig = {
          persistante: true,
          degatsParTour: technique.system.animation.degatsParTour || 0,
          dureeTours: technique.system.animation.dureeTours || 3,
          animation: technique.system.animation.jb2a
        };
        
        await window.FFdreamePersistentZones.createPersistentZone(
          this.actor,
          targetToken || (token ? { x: token.center.x, y: token.center.y } : null),
          zoneConfig,
          technique
        );
      }
      
      // ===== GESTION DES EFFETS DE TABLEAUX =====
      await this._incrementerCompteurEffet();
      
      // ===== DÉCRÉMENTER MALUS JET DU RISQUE =====
      await this._decrementerMalusJetRisque();
    }
  }

  /* ================================
     DÉCRÉMENTER MALUS JET DU RISQUE
     ================================ */
  async _decrementerMalusJetRisque() {
    const malus = this.actor.getFlag('ffdreame', 'jetRisqueMalus');
    if (!malus) return;
    
    const toursRestants = (malus.tours || 0) - 1;
    
    if (toursRestants <= 0) {
      // Supprimer le malus
      await this.actor.unsetFlag('ffdreame', 'jetRisqueMalus');
      ui.notifications.info(`✅ Malus Jet du Risque expiré`);
      console.log(`✅ Malus Jet du Risque supprimé`);
    } else {
      // Décrémenter
      await this.actor.setFlag('ffdreame', 'jetRisqueMalus', {
        valeur: malus.valeur,
        tours: toursRestants
      });
      console.log(`⏳ Malus Jet du Risque: ${toursRestants} tour(s) restant(s)`);
    }
  }

  /* ================================
     TECHNIQUE AOE (3 jets consécutifs)
     ================================ */
  async _useTableTechniqueAOE(technique, seuilReussite, pmActuel, coutPM) {
    const seuils = [60, 50, 40]; // Seuils décroissants
    let degatsTotal = 0;
    let jetsReussis = 0;
    let bursteTotalGagne = 0;
    
    const degatsBase = this.actor._calculateTechniqueDegats(technique);
    
    // Calculer les malus
    const fatigueMalus = this.actor._calculateFatigueMalus();
    const blessureMalus = this.actor._calculateBlessureMalus();
    const totalMalus = fatigueMalus + blessureMalus;
    
    let messageContent = `<div class="dice-roll aoe-multi-jets">`;
    messageContent += `<h3>🌀 ${technique.name} - AOE (3 JETS)</h3>`;
    messageContent += `<p>Style: AOE | Coût: ${coutPM} PM</p>`;
    messageContent += `<p>Seuils: 60 → 50 → 40</p>`;
    if (totalMalus > 0) {
      messageContent += `<p style="color: #ff6b6b;">⚠️ Malus total : +${totalMalus}</p>`;
    }
    
    // Sauvegarder les rolls pour la réaction
    const rolls = [];
    
    // Lancer les 3 jets
    for (let i = 0; i < 3; i++) {
      let formula = `1d100`;
      if (totalMalus > 0) {
        formula += ` + ${totalMalus}`;
      }
      
      const roll = new Roll(formula);
      await roll.evaluate();
      rolls.push(roll); // Sauvegarder le roll
      
      const total = roll.total;
      const seuil = seuils[i];
      const success = total <= seuil;
      
      messageContent += `<div class="jet-aoe jet-${i + 1} ${success ? 'success' : 'failure'}">`;
      messageContent += `<strong>Jet ${i + 1} :</strong> ${total} / ${seuil} `;
      
      if (success) {
        jetsReussis++;
        degatsTotal += degatsBase;
        bursteTotalGagne += 10;
        messageContent += `<span style="color: #00d9ff;">✓ Réussite → +${degatsBase} dégâts → +10 Burste</span>`;
        
        // ===== INCRÉMENTER COMPTEUR EFFET =====
        await this._incrementerCompteurEffet();
      } else {
        messageContent += `<span style="color: #ff6b6b;">✗ Échec → ARRÊT</span>`;
        break; // Arrêt immédiat si un jet rate
      }
      
      messageContent += `</div>`;
    }
    
    messageContent += `<div class="aoe-result">`;
    messageContent += `<p><strong>Jets réussis : ${jetsReussis} / 3</strong></p>`;
    if (degatsTotal > 0) {
      messageContent += `<p><strong>💥 Dégâts totaux : ${degatsTotal}</strong></p>`;
      messageContent += `<p><strong>⚡ Burste gagnée : +${bursteTotalGagne}</strong></p>`;
    }
    messageContent += `</div></div>`;
    
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: messageContent
    });
    
    // Consommer PM
    const updateData = {
      'system.aptitudes.pm.value': pmActuel - coutPM
    };
    
    // Ajouter Burste si au moins 1 jet réussi
    if (jetsReussis > 0) {
      const bursteCurrent = this.actor.system.combat.burste || 0;
      const newBurste = Math.min(100, bursteCurrent + bursteTotalGagne);
      updateData['system.combat.burste'] = newBurste;
      
      if (newBurste === 100) {
        ui.notifications.info("⚡ BURSTE À 100 ! ULTIMATE DISPONIBLE !");
      }
    }
    
    await this.actor.update(updateData);
    
    // APPLIQUER LES DÉGÂTS À LA CIBLE si au moins 1 jet réussi
    if (jetsReussis > 0) {
      const targets = Array.from(game.user.targets);
      const target = targets[0];
      
      if (target && target.actor) {
        let degatsApresReaction = degatsTotal;
        let messageReaction = "";
        
        // ===== VÉRIFIER LES RÉACTIONS DE LA CIBLE =====
        const reactions = target.actor.system.combat?.reactions;
        const esquiveActive = reactions?.esquive || false;
        const defenseActive = reactions?.defense || false;
        
        if (esquiveActive || defenseActive) {
          // Déterminer quelle réaction utiliser
          let reactionType = null;
          
          if (esquiveActive && defenseActive) {
            // Les deux actives → Demander au joueur
            reactionType = await new Promise((resolve) => {
              new Dialog({
                title: `Réaction de ${target.actor.name}`,
                content: `<p>${target.actor.name} a <strong>Esquive</strong> ET <strong>Défense</strong> actives !</p>
                          <p>Laquelle utiliser ?</p>`,
                buttons: {
                  esquive: {
                    label: "🤸 Esquive",
                    callback: () => resolve('esquive')
                  },
                  defense: {
                    label: "🛡️ Défense",
                    callback: () => resolve('defense')
                  },
                  aucune: {
                    label: "❌ Aucune",
                    callback: () => resolve(null)
                  }
                }
              }).render(true);
            });
          } else if (esquiveActive) {
            reactionType = 'esquive';
          } else if (defenseActive) {
            reactionType = 'defense';
          }
          
          if (reactionType) {
            // Récupérer la compétence appropriée
            let competenceValeur = 0;
            if (reactionType === 'esquive') {
              competenceValeur = target.actor.system.dexterite?.agilite?.value || 0;
            } else {
              competenceValeur = target.actor.system.physique?.endurance?.value || 0;
            }
            
            // Pour AOE, on utilise le jet le plus élevé des 3
            const jetMaxAOE = Math.max(...rolls.map(r => r.total));
            
            // SEUIL = Meilleur jet AOE + Compétence
            const seuilReaction = jetMaxAOE + competenceValeur;
            
            // Jet de réaction du défenseur
            const jetReaction = new Roll("1d100");
            await jetReaction.evaluate();
            const resultatReaction = jetReaction.total;
            
            const reussite = resultatReaction <= seuilReaction;
            const marge = resultatReaction - seuilReaction;
            
            const reactionLabel = reactionType === 'esquive' ? '🤸 ESQUIVE' : '🛡️ DÉFENSE';
            const reactionIcon = reactionType === 'esquive' ? '🤸' : '🛡️';
            const competenceLabel = reactionType === 'esquive' ? 'Agilité' : 'Endurance';
            
            // Afficher le jet de réaction
            await jetReaction.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: target.actor }),
              flavor: `<h3>${reactionLabel}</h3>
                       <p>Jet de défense : <strong>${resultatReaction}</strong></p>
                       <p>Seuil requis : <strong>≤ ${seuilReaction}</strong> (Meilleur jet AOE ${jetMaxAOE} + ${competenceLabel} ${competenceValeur})</p>
                       <p>${reussite ? '✅ <strong>RÉUSSI !</strong>' : '❌ <strong>RATÉ !</strong>'}</p>`
            });
            
            // Calcul de la réduction
            if (reussite) {
              let reduction = 0;
              
              if (marge <= -20 || resultatReaction <= 5) {
                // Annulation complète
                reduction = 1.0;
                messageReaction = `${reactionIcon} <strong>RÉACTION PARFAITE !</strong> Dégâts annulés (Marge: ${marge})`;
              } else if (marge <= -15) {
                // 50% de réduction
                reduction = 0.5;
                messageReaction = `${reactionIcon} <strong>Réaction réussie !</strong> Dégâts réduits de 50% (Marge: ${marge})`;
              } else {
                // 20% de réduction
                reduction = 0.2;
                messageReaction = `${reactionIcon} <strong>Réaction partielle</strong> Dégâts réduits de 20% (Marge: ${marge})`;
              }
              
              degatsApresReaction = Math.floor(degatsTotal * (1 - reduction));
            } else {
              messageReaction = `❌ ${reactionLabel} ratée ! Dégâts complets.`;
            }
            
            // Désactiver la réaction utilisée
            await target.actor.update({
              [`system.combat.reactions.${reactionType}`]: false
            });
          }
        }
        
        const pvCibleActuel = target.actor.system.aptitudes.pv.value;
        const nouveauPVCible = Math.max(0, pvCibleActuel - degatsApresReaction);
        
        await target.actor.update({
          'system.aptitudes.pv.value': nouveauPVCible
        });
        
        // Message de confirmation avec réaction
        let messageContent = `<div style="background: rgba(255, 107, 107, 0.2); padding: 10px; border-left: 3px solid #ff6b6b;">
                    <strong>💥 ${target.actor.name}</strong> a reçu <strong>${degatsApresReaction} dégâts</strong> (${jetsReussis} jets réussis) !`;
        
        if (messageReaction) {
          messageContent += `<br/><span style="color: #00d9ff;">${messageReaction}</span>`;
          if (degatsApresReaction < degatsTotal) {
            messageContent += `<br/><small>Dégâts de base: ${degatsTotal} → Après réaction: ${degatsApresReaction}</small>`;
          }
        }
        
        messageContent += `<br/>PV: ${pvCibleActuel} → ${nouveauPVCible}
                  </div>`;
        
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: this.actor }),
          content: messageContent
        });
        
        if (nouveauPVCible === 0) {
          ui.notifications.warn(`💀 ${target.actor.name} est K.O. !`);
        }
      }
    }
    
    // Jouer l'animation si au moins 1 jet réussi
    if (jetsReussis > 0) {
      await this._jouerAnimationItem(technique);
    }
  }

  /* ================================
     APPLIQUER LES EFFETS D'UNE TECHNIQUE
     ================================ */
  async _appliquerEffetsTechnique(technique, jetResult, degats) {
    let effetsText = '';
    let degatsFinaux = degats;
    let bonusDegatsJetRisque = 0;
    
    // Récupérer la cible (premier token ciblé)
    const targets = Array.from(game.user.targets);
    const target = targets[0];
    
    // EFFET 1
    if (technique.system.effet1 && technique.system.effet1.type !== "aucun") {
      const effet1 = technique.system.effet1;
      const condition = effet1.condition || 100;
      
      // Vérifier si la condition est remplie
      if (jetResult <= condition) {
        if (effet1.type === "jet_risque") {
          // Jet du Risque : peut modifier les dégâts
          const malusValeur = effet1.valeur || 20;
          const dureeMalus = effet1.duree || 1; // Durée par défaut : 1 tour
          const resultatRisque = await this._appliquerJetRisque(degats, malusValeur, dureeMalus);
          if (resultatRisque.success && resultatRisque.bonus) {
            bonusDegatsJetRisque += resultatRisque.bonus;
            degatsFinaux += resultatRisque.bonus;
            effetsText += `<p style="color: #FFD700;">🎲 Jet du Risque : RÉUSSI ! (+${resultatRisque.bonus} dégâts)</p>`;
          } else if (resultatRisque.malus) {
            effetsText += `<p style="color: #FF4444;">🎲 Jet du Risque : ÉCHEC ! (Malus -${resultatRisque.malus}% sur ${resultatRisque.tours} jet${resultatRisque.tours > 1 ? 's' : ''})</p>`;
          } else if (resultatRisque.refuse) {
            effetsText += `<p style="color: #999;">🎲 Jet du Risque : Refusé</p>`;
          }
        } else {
          const resultat = await this._appliquerEffet(effet1, target, degats);
          if (resultat) {
            effetsText += `<p style="color: #00d9ff;">✨ Effet 1 : ${resultat}</p>`;
          }
        }
      }
    }
    
    // EFFET 2
    if (technique.system.effet2 && technique.system.effet2.type !== "aucun") {
      const effet2 = technique.system.effet2;
      const condition = effet2.condition || 100;
      
      // Vérifier si la condition est remplie
      if (jetResult <= condition) {
        if (effet2.type === "jet_risque") {
          // Jet du Risque : peut modifier les dégâts
          const malusValeur = effet2.valeur || 20;
          const dureeMalus = effet2.duree || 1;
          const resultatRisque = await this._appliquerJetRisque(degats, malusValeur, dureeMalus);
          if (resultatRisque.success && resultatRisque.bonus) {
            bonusDegatsJetRisque += resultatRisque.bonus;
            degatsFinaux += resultatRisque.bonus;
            effetsText += `<p style="color: #FFD700;">🎲 Jet du Risque : RÉUSSI ! (+${resultatRisque.bonus} dégâts)</p>`;
          } else if (resultatRisque.malus) {
            effetsText += `<p style="color: #FF4444;">🎲 Jet du Risque : ÉCHEC ! (Malus -${resultatRisque.malus}% sur ${resultatRisque.tours} jet${resultatRisque.tours > 1 ? 's' : ''})</p>`;
          } else if (resultatRisque.refuse) {
            effetsText += `<p style="color: #999;">🎲 Jet du Risque : Refusé</p>`;
          }
        } else {
          const resultat = await this._appliquerEffet(effet2, target, degats);
          if (resultat) {
            effetsText += `<p style="color: #00d9ff;">✨ Effet 2 : ${resultat}</p>`;
          }
        }
      }
    }
    
    return { effetsText, degatsFinaux, bonusDegatsJetRisque };
  }

  /* ================================
     APPLIQUER UN EFFET SPÉCIFIQUE
     ================================ */
  async _appliquerEffet(effet, target, degatsAttaque) {
    const type = effet.type;
    const valeur = effet.valeur || 0;
    const unite = effet.unite || "pourcent";
    const duree = effet.duree || 3; // Durée par défaut : 3 tours
    
    switch (type) {
      case "soins":
        return await this._appliquerSoins(valeur, unite);
      
      case "bufa":
        return await this._appliquerBufA(valeur, unite, duree);
      
      case "bufj":
        return await this._appliquerBufJ(valeur, unite, duree);
      
      case "bufd":
        return await this._appliquerBufD(valeur, unite, duree);
      
      case "bufpa":
        return await this._appliquerBufPA(valeur, duree);
      
      case "malusjet":
        return await this._appliquerMalusJet(valeur, duree, target);
      
      case "reducdegats":
        return await this._appliquerReducDegats(valeur, duree, target);
      
      case "soisg":
        return await this._appliquerSoisG(valeur, unite);
      
      case "ponction":
        return await this._appliquerPonction(valeur, unite, target);
      
      case "ponctionm":
        return await this._appliquerPonctionM(valeur, unite, target);
      
      case "change_posture":
        return await this._appliquerChangePosture();
      
      case "jet_risque":
        return await this._appliquerJetRisque(degatsAttaque, valeur);
      
      default:
        return null;
    }
  }

  /* ================================
     SOINS - Restaure PV (sans dépasser max)
     ================================ */
  async _appliquerSoins(valeur, unite) {
    const pvActuel = this.actor.system.aptitudes.pv.value;
    const pvMax = this.actor.system.aptitudes.pv.max;
    
    let soins = 0;
    if (unite === "pourcent") {
      soins = Math.floor((pvMax * valeur) / 100);
    } else {
      soins = valeur;
    }
    
    const nouveauPV = Math.min(pvMax, pvActuel + soins);
    
    await this.actor.update({
      'system.aptitudes.pv.value': nouveauPV
    });
    
    return `Soins +${soins} PV (${pvActuel} → ${nouveauPV})`;
  }

  /* ================================
     PONCTION - Absorbe PV de la cible
     ================================ */
  async _appliquerPonction(valeur, unite, target) {
    if (!target || !target.actor) {
      return "Ponction PV (aucune cible)";
    }
    
    const ciblePVActuel = target.actor.system.aptitudes.pv.value;
    const ciblePVMax = target.actor.system.aptitudes.pv.max;
    
    let pvAbsorbes = 0;
    if (unite === "pourcent") {
      pvAbsorbes = Math.floor((ciblePVMax * valeur) / 100);
    } else {
      pvAbsorbes = valeur;
    }
    
    // Réduire PV de la cible
    const nouveauPVCible = Math.max(0, ciblePVActuel - pvAbsorbes);
    await target.actor.update({
      'system.aptitudes.pv.value': nouveauPVCible
    });
    
    // Ajouter PV à l'attaquant (sans dépasser max)
    const pvActuel = this.actor.system.aptitudes.pv.value;
    const pvMax = this.actor.system.aptitudes.pv.max;
    const nouveauPV = Math.min(pvMax, pvActuel + pvAbsorbes);
    
    await this.actor.update({
      'system.aptitudes.pv.value': nouveauPV
    });
    
    return `Ponction ${pvAbsorbes} PV de ${target.actor.name} (Vous: ${pvActuel} → ${nouveauPV})`;
  }

  /* ================================
     PONCTION PM - Absorbe PM de la cible
     ================================ */
  async _appliquerPonctionM(valeur, unite, target) {
    if (!target || !target.actor) {
      return "Ponction PM (aucune cible)";
    }
    
    const ciblePMActuel = target.actor.system.aptitudes.pm.value;
    const ciblePMMax = target.actor.system.aptitudes.pm.max;
    
    let pmAbsorbes = 0;
    if (unite === "pourcent") {
      pmAbsorbes = Math.floor((ciblePMMax * valeur) / 100);
    } else {
      pmAbsorbes = valeur;
    }
    
    // Réduire PM de la cible
    const nouveauPMCible = Math.max(0, ciblePMActuel - pmAbsorbes);
    await target.actor.update({
      'system.aptitudes.pm.value': nouveauPMCible
    });
    
    // Ajouter PM à l'attaquant (sans dépasser max)
    const pmActuel = this.actor.system.aptitudes.pm.value;
    const pmMax = this.actor.system.aptitudes.pm.max;
    const nouveauPM = Math.min(pmMax, pmActuel + pmAbsorbes);
    
    await this.actor.update({
      'system.aptitudes.pm.value': nouveauPM
    });
    
    return `Ponction ${pmAbsorbes} PM de ${target.actor.name} (Vous: ${pmActuel} → ${nouveauPM})`;
  }

  /* ================================
     CHANGE DE POSTURE - Switch tableau gratuitement
     ================================ */
  async _appliquerChangePosture() {
    const tableau1Actif = this.actor.system.combat.tableau1.actif;
    const tableau2Actif = this.actor.system.combat.tableau2.actif;
    
    if (tableau1Actif) {
      // Passer à T2
      await this.actor.update({
        'system.combat.tableau1.actif': false,
        'system.combat.tableau2.actif': true
      });
      
      if (window.FFdreameNotifications) {
        await window.FFdreameNotifications.showNotification({
          title: "🔄 CHANGE DE POSTURE",
          subtitle: "Tableau 2 activé",
          color: "#00D9FF",
          icon: "🔄",
          duration: 2500
        });
      } else {
        ui.notifications.info("🔄 Change de Posture ! Tableau 2 activé (gratuit)");
      }
      
      return "Change de Posture → Tableau 2";
    } else if (tableau2Actif) {
      // Passer à T1
      await this.actor.update({
        'system.combat.tableau1.actif': true,
        'system.combat.tableau2.actif': false
      });
      
      if (window.FFdreameNotifications) {
        await window.FFdreameNotifications.showNotification({
          title: "🔄 CHANGE DE POSTURE",
          subtitle: "Tableau 1 activé",
          color: "#00D9FF",
          icon: "🔄",
          duration: 2500
        });
      } else {
        ui.notifications.info("🔄 Change de Posture ! Tableau 1 activé (gratuit)");
      }
      
      return "Change de Posture → Tableau 1";
    }
    
    return "Change de Posture (aucun tableau actif)";
  }

  /* ================================
     JET DU RISQUE - 2ème jet pour +50% dégâts ou malus
     ================================ */
  async _appliquerJetRisque(degatsBase, malusValeur, dureeMalus = 1) {
    // Dialogue de confirmation
    const accepte = await Dialog.confirm({
      title: "🎲 Jet du Risque",
      content: `
        <div style="text-align: center; padding: 20px; background: rgba(255, 215, 0, 0.1); border-radius: 8px;">
          <h2 style="color: #FFD700; margin: 0 0 15px 0;">⚠️ JET DU RISQUE ⚠️</h2>
          <p style="font-size: 16px; margin: 10px 0;">
            Voulez-vous tenter le <strong style="color: #FFD700;">Jet du Risque</strong> ?
          </p>
          <div style="background: rgba(0, 0, 0, 0.3); padding: 15px; border-radius: 8px; margin: 15px 0;">
            <p style="color: #00FF00; margin: 5px 0;"><strong>✅ Réussite</strong> : Dégâts <strong>+50%</strong> (+${Math.floor(degatsBase * 0.5)})</p>
            <p style="color: #FF0000; margin: 5px 0;"><strong>❌ Échec</strong> : Malus <strong>-${malusValeur}%</strong> sur ${dureeMalus} jet${dureeMalus > 1 ? 's' : ''}</p>
          </div>
          <p style="font-size: 12px; color: #999; margin-top: 10px;">
            Le risque en vaut-il la chandelle ?
          </p>
        </div>
      `,
      yes: () => true,
      no: () => false,
      defaultYes: false
    });
    
    if (!accepte) {
      ui.notifications.info("🎲 Jet du Risque refusé");
      return { refuse: true };
    }
    
    // Lancer le jet du risque
    const rangModifier = this.actor.system.combat?.rangModifier || { jetReussite: 50 };
    const seuilReussite = rangModifier.jetReussite;
    
    const roll = new Roll("1d100");
    await roll.evaluate();
    const resultat = roll.total;
    
    const success = resultat <= seuilReussite;
    
    if (success) {
      // RÉUSSITE : +50% dégâts
      const bonus = Math.floor(degatsBase * 0.5);
      
      if (window.FFdreameNotifications) {
        await window.FFdreameNotifications.showCritical("success", this.actor.name, resultat);
      }
      
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `
          <div style="background: rgba(0, 255, 0, 0.2); padding: 15px; border-left: 4px solid #00FF00; border-radius: 8px;">
            <h3 style="margin: 0; color: #00FF00;">🎲 JET DU RISQUE : RÉUSSITE !</h3>
            <p>Jet : <strong>${resultat}</strong> / ${seuilReussite}</p>
            <p style="font-size: 18px; margin: 10px 0;">
              <strong>💥 Dégâts +50% ! (+${bonus})</strong>
            </p>
          </div>
        `
      });
      
      return { success: true, bonus: bonus };
    } else {
      // ÉCHEC : Malus sur X prochains jets
      if (window.FFdreameNotifications) {
        await window.FFdreameNotifications.showCritical("failure", this.actor.name, resultat);
      }
      
      // Stocker le malus avec la durée
      await this.actor.setFlag('ffdreame', 'jetRisqueMalus', {
        valeur: malusValeur,
        tours: dureeMalus
      });
      
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `
          <div style="background: rgba(255, 0, 0, 0.2); padding: 15px; border-left: 4px solid #FF0000; border-radius: 8px;">
            <h3 style="margin: 0; color: #FF0000;">🎲 JET DU RISQUE : ÉCHEC !</h3>
            <p>Jet : <strong>${resultat}</strong> / ${seuilReussite}</p>
            <p style="font-size: 18px; margin: 10px 0;">
              <strong>⚠️ Malus -${malusValeur}% sur ${dureeMalus} jet${dureeMalus > 1 ? 's' : ''} !</strong>
            </p>
          </div>
        `
      });
      
      return { success: false, malus: malusValeur, tours: dureeMalus };
    }
  }

  /* ================================
     BUFA - Augmente Attaque temporairement
     ================================ */
  async _appliquerBufA(valeur, unite, duree) {
    // Pour l'instant, on affiche juste le message
    // TODO: Stocker le buff et l'appliquer aux prochaines attaques
    return `Buff Attaque +${valeur}${unite === "pourcent" ? "%" : ""} (${duree} tour${duree > 1 ? 's' : ''})`;
  }

  /* ================================
     BUFJ - Réduit le résultat du jet
     ================================ */
  async _appliquerBufJ(valeur, unite, duree) {
    // Pour l'instant, on affiche juste le message
    // TODO: Stocker le buff et l'appliquer au prochain jet
    return `Buff Jet -${valeur}${unite === "pourcent" ? "%" : ""} (${duree} tour${duree > 1 ? 's' : ''})`;
  }

  /* ================================
     BUFD - Réduit les dégâts reçus
     ================================ */
  async _appliquerBufD(valeur, unite, duree) {
    // Pour l'instant, on affiche juste le message
    // TODO: Stocker le buff et l'appliquer quand on reçoit des dégâts
    return `Buff Défense -${valeur}${unite === "pourcent" ? "%" : ""} dégâts reçus (${duree} tour${duree > 1 ? 's' : ''})`;
  }

  /* ================================
     BUFPA - Donne des Points d'Action supplémentaires
     ================================ */
  async _appliquerBufPA(nbGrandsPA, duree) {
    // Ajouter des Grands PA (chaque Grand = 2 Petits)
    const actionPoints = this.actor.system.combat?.actionPoints;
    if (!actionPoints) {
      console.error("Structure actionPoints manquante !");
      return "Erreur : Points d'Action non disponibles";
    }
    
    // Créer un Grand PA temporaire (grand4)
    const updates = {};
    
    // On crée un grand4 avec ses 2 petits
    if (nbGrandsPA >= 1) {
      updates['system.combat.actionPoints.grand4'] = {
        petit1: true,
        petit2: true
      };
      
      // Stocker l'expiration (nombre de tours restants)
      updates['system.combat.bufPA'] = {
        actif: true,
        tours: duree || 3,
        nbPA: nbGrandsPA
      };
    }
    
    await this.actor.update(updates);
    
    return `Point d'Action Supplémentaire ! (4 PA total pendant ${duree} tour${duree > 1 ? 's' : ''})`;
  }

  /* ================================
     MALUS JET - Rend les jets ennemis plus difficiles
     ================================ */
  async _appliquerMalusJet(valeur, duree, target) {
    if (!target || !target.actor) {
      return "Malus Jet (aucune cible)";
    }
    
    // Stocker le malus sur la cible
    await target.actor.setFlag('ffdreame', 'malusJet', {
      valeur: valeur,
      tours: duree || 3
    });
    
    return `Malus Jet +${valeur}% appliqué à ${target.actor.name} (${duree} tour${duree > 1 ? 's' : ''})`;
  }

  /* ================================
     REDUC DEGATS - Réduit les dégâts d'attaque de l'ennemi
     ================================ */
  async _appliquerReducDegats(valeur, duree, target) {
    if (!target || !target.actor) {
      return "Réduit Dégâts (aucune cible)";
    }
    
    // Stocker la réduction sur la cible
    await target.actor.setFlag('ffdreame', 'reducDegats', {
      valeur: valeur,
      tours: duree || 3
    });
    
    return `Dégâts réduits de ${valeur}% pour ${target.actor.name} (${duree} tour${duree > 1 ? 's' : ''})`;
  }

  /* ================================
     SOISG - Soins de groupe
     ================================ */
  async _appliquerSoisG(valeur, unite) {
    // Récupérer tous les actors de type character ou cyberpunk
    const allies = game.actors.filter(a => 
      (a.type === "character" || a.type === "cyberpunk") && a.id !== this.actor.id
    );
    
    let soignesCount = 0;
    
    for (const ally of allies) {
      const pvActuel = ally.system.aptitudes.pv.value;
      const pvMax = ally.system.aptitudes.pv.max;
      
      let soins = 0;
      if (unite === "pourcent") {
        soins = Math.floor((pvMax * valeur) / 100);
      } else {
        soins = valeur;
      }
      
      const nouveauPV = Math.min(pvMax, pvActuel + soins);
      
      await ally.update({
        'system.aptitudes.pv.value': nouveauPV
      });
      
      soignesCount++;
    }
    
    return `Soins de groupe +${valeur}${unite === "pourcent" ? "%" : ""} PV (${soignesCount} alliés soignés)`;
  }

  /* ================================
     JOUER L'ANIMATION D'UN ITEM
     ================================ */
  async _jouerAnimationItem(item) {
    // Vérifier si Sequencer est disponible
    if (!game.modules.get("sequencer")?.active) {
      return; // Pas d'animation sans Sequencer
    }

    const token = this.actor.getActiveTokens()[0];
    if (!token) return;

    // Récupérer la cible (premier token ciblé)
    const targets = Array.from(game.user.targets);
    const target = targets[0];
    
    // Récupérer la durée d'animation
    const dureeRaw = item.system.animation?.duree;
    const dureeNum = parseInt(dureeRaw) || 3;
    // 999 = Continue (très longue durée = 10 min en ms)
    const dureeMs = dureeNum >= 999 ? 600000 : dureeNum * 1000;
    const boucle = dureeNum >= 999; // true = répéter en boucle

    // Animation JB2A
    if (item.system.animation?.jb2a) {
      try {
        const sequence = new Sequence();
        let effect = sequence.effect()
          .file(item.system.animation.jb2a)
          .duration(dureeMs);
        
        if (boucle) effect = effect.repeats(999, 0);
        
        if (target) {
          effect.atLocation(token).stretchTo(target);
        } else {
          effect.atLocation(token);
        }
        
        await sequence.play();
      } catch (error) {
        console.error("Erreur lors de l'animation JB2A:", error);
      }
    }

    // Animation Sequencer personnalisée
    if (item.system.animation?.sequencer) {
      try {
        const sequence = new Sequence();
        let effect = sequence.effect()
          .file(item.system.animation.sequencer)
          .duration(dureeMs);
        
        if (boucle) effect = effect.repeats(999, 0);
        
        if (target) {
          effect.atLocation(token).stretchTo(target);
        } else {
          effect.atLocation(token);
        }
        
        await sequence.play();
      } catch (error) {
        console.error("Erreur lors de l'animation Sequencer:", error);
      }
    }
  }

  /* ================================
     UTILISER UNE ATTAQUE DEPUIS LE TABLEAU
     ================================ */
  async _useTableAttaque(attaque) {
    const rang = this.actor.system.rang;
    const rangModifier = this.actor._getRangModifier(rang);
    const seuilReussite = rangModifier.jetReussite;
    
    const atq = this.actor.system.aptitudes.attaque.total || 0;
    const degats = atq + (attaque.system.degats || 0);
    
    // Calculer les malus
    const fatigueMalus = this.actor._calculateFatigueMalus();
    const blessureMalus = this.actor._calculateBlessureMalus();
    const totalMalus = fatigueMalus + blessureMalus;
    
    // Formule de jet
    let formula = `1d100`;
    if (totalMalus > 0) {
      formula += ` + ${totalMalus}`;
    }
    
    const roll = new Roll(formula);
    await roll.evaluate();
    
    const total = roll.total;
    const success = total <= seuilReussite;
    let resultText = success ? '✓ Réussite' : '✗ Échec';
    
    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h3>⚔️ ${attaque.name}</h3>
               <p>Seuil de réussite : ≤ ${seuilReussite}</p>`,
      content: `
        <div class="dice-roll">
          <div class="dice-result">
            <div class="dice-formula">${formula}</div>
            <div class="dice-total ${success ? 'success' : 'failure'}">
              ${total} ${resultText}
            </div>
          </div>
          ${success ? `<div class="degats-info"><strong>💥 Dégâts : ${degats}</strong></div>` : ''}
        </div>
      `
    };
    
    await roll.toMessage(messageData);
  }

  /* ================================
     UTILISER UN ULTIMATE DEPUIS LE TABLEAU
     ================================ */
  async _useTableUltimate(ultimate) {
    const rang = this.actor.system.rang;
    const rangModifier = this.actor._getRangModifier(rang);
    const seuilReussite = rangModifier.jetReussite;
    
    const degats = ultimate.system.degats || 0;
    
    // Calculer les malus
    const fatigueMalus = this.actor._calculateFatigueMalus();
    const blessureMalus = this.actor._calculateBlessureMalus();
    const totalMalus = fatigueMalus + blessureMalus;
    
    // Formule de jet
    let formula = `1d100`;
    if (totalMalus > 0) {
      formula += ` + ${totalMalus}`;
    }
    
    const roll = new Roll(formula);
    await roll.evaluate();
    
    const total = roll.total;
    const success = total <= seuilReussite;
    let resultText = success ? '✓ Réussite' : '✗ Échec';
    
    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `<h3>🔥 ULTIMATE : ${ultimate.name}</h3>
               <p>${ultimate.system.description || ''}</p>
               <p>Seuil de réussite : ≤ ${seuilReussite}</p>`,
      content: `
        <div class="dice-roll ultimate-roll">
          <div class="dice-result">
            <div class="dice-formula">${formula}</div>
            <div class="dice-total ${success ? 'success' : 'failure'}">
              ${total} ${resultText}
            </div>
          </div>
          ${success ? `<div class="degats-info"><strong>💥💥 DÉGÂTS ULTIMATE : ${degats} 💥💥</strong></div>` : ''}
        </div>
      `
    };
    
    await roll.toMessage(messageData);
  }

  /* ================================
     TABLEAUX : TOGGLE ACTIVATION/DÉSACTIVATION
     ================================ */
  /* ================================
     CONFIGURATION EFFET DE TABLEAU
     ================================ */
  async _onConfigureEffetTableau(event) {
    event.preventDefault();
    
    // RESTRICTION : Seulement le MJ peut configurer
    if (!game.user.isGM) {
      ui.notifications.warn("⛔ Seul le MJ peut configurer les effets de tableaux");
      return;
    }
    
    const tableNum = event.currentTarget.dataset.table;
    const tableauNom = this.actor.system.combat?.[`tableau${tableNum}`]?.nom || `Tableau ${tableNum}`;
    const effet = this.actor.system.combat?.[`tableau${tableNum}`]?.effet || {};
    
    // Créer le dialogue de configuration
    const content = await this._renderEffetConfigDialog(tableNum, tableauNom, effet);
    
    new Dialog({
      title: `⚙️ Configuration Effet - ${tableauNom}`,
      content: content,
      buttons: {
        save: {
          icon: '<i class="fas fa-check"></i>',
          label: "Sauvegarder",
          callback: html => this._saveEffetConfig(html, tableNum)
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Annuler"
        }
      },
      default: "save",
      render: html => this._setupEffetConfigListeners(html, tableNum),
      close: () => {}
    }, {
      width: 520,
      height: "auto"
    }).render(true);
  }
  
  /* ================================
     RENDU DU DIALOGUE DE CONFIGURATION
     ================================ */
  async _renderEffetConfigDialog(tableNum, tableauNom, effet) {
    const types = [
      { value: '', label: '-- Aucun effet --' },
      { value: 'bonus_degats', label: '💥 Bonus Dégâts (+X%)' },
      { value: 'recuperation_pa', label: '⚡ Récupération PA' },
      { value: 'initiative_first', label: '🏁 Initiative Assurée' },
      { value: 'bonus_reussite', label: '🎯 Bonus Réussite (+X%)' },
      { value: 'reduction_malus', label: '🛡️ Réduction Malus (-X%)' },
      { value: 'parade_gratuite', label: '🔰 Parade Gratuite' }
    ];
    
    const conditions = [
      { value: 'permanent', label: 'Permanent (tant que tableau actif)' },
      { value: 'reussites', label: 'Après X techniques réussies' },
      { value: 'debut_combat', label: 'Début de combat' }
    ];
    
    const tableaux = [
      { value: '', label: '-- Même tableau --' },
      { value: '1', label: 'Tableau 1' },
      { value: '2', label: 'Tableau 2' }
    ];
    
    return `
      <div class="effet-config-dialog" style="padding: 15px;">
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Type d'effet :</label>
          <select name="effet-type" class="effet-type-select" style="width: 100%; padding: 8px;">
            ${types.map(t => `<option value="${t.value}" ${effet.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Condition :</label>
          ${conditions.map(c => `
            <label style="display: block; margin: 5px 0;">
              <input type="radio" name="effet-condition" value="${c.value}" ${effet.condition === c.value ? 'checked' : ''} />
              ${c.label}
            </label>
          `).join('')}
        </div>
        
        <div class="form-group seuil-group" style="margin-bottom: 15px; ${effet.condition !== 'reussites' ? 'display: none;' : ''}">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Nombre de réussites :</label>
          <input type="number" name="effet-seuil" min="1" max="20" value="${effet.seuil || 5}" style="width: 100%; padding: 8px;" />
        </div>
        
        <div class="form-group valeur-group" style="margin-bottom: 15px; ${!effet.type || effet.type === 'initiative_first' || effet.type === 'parade_gratuite' ? 'display: none;' : ''}">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Valeur :</label>
          <div style="display: flex; gap: 10px;">
            <input type="number" name="effet-valeur" min="0" max="100" value="${effet.valeur || 5}" style="flex: 1; padding: 8px;" />
            <select name="effet-unite" style="width: auto; padding: 8px;">
              <option value="pourcent" ${effet.unite === 'pourcent' ? 'selected' : ''}>%</option>
              <option value="fixe" ${effet.unite === 'fixe' ? 'selected' : ''}>Points</option>
            </select>
          </div>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px; border: 2px solid #ffa500; padding: 10px; border-radius: 4px; background: rgba(255, 165, 0, 0.1);">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #ffa500;">🎯 Tableau où l'effet s'applique :</label>
          <select name="effet-tableau-applicatif" style="width: 100%; padding: 8px;">
            ${tableaux.map(t => `<option value="${t.value}" ${effet.tableauApplicatif === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
          <small style="display: block; margin-top: 5px; color: #666; font-style: italic;">
            Ex: Effet du Tableau 1 peut s'appliquer sur Tableau 2<br/>
            Laissez "Même tableau" pour appliquer sur le tableau actif
          </small>
        </div>
        
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Description :</label>
          <textarea name="effet-description" rows="3" readonly style="width: 100%; padding: 8px; background: #f0f0f0;">${effet.description || ''}</textarea>
        </div>
        
        <div style="background: #f9f9f9; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <strong>Compteur actuel :</strong>
            <span>${effet.compteur || 0}/${effet.seuil || 0}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 5px 0;">
            <strong>Effet prêt :</strong>
            <span style="padding: 2px 8px; border-radius: 10px; background: ${effet.actif ? '#4CAF50' : '#999'}; color: white;">
              ${effet.actif ? '✅ Prêt' : '❌ Inactif'}
            </span>
          </div>
        </div>
        
        <button type="button" class="btn-reset-compteur" style="padding: 8px 16px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
          🔄 Réinitialiser Compteur
        </button>
        
      </div>
    `;
  }
  
  /* ================================
     SETUP DES LISTENERS DANS LE DIALOGUE
     ================================ */
  _setupEffetConfigListeners(html, tableNum) {
    // Mise à jour dynamique de la description
    const updateDescription = () => {
      const type = html.find('[name="effet-type"]').val();
      const condition = html.find('[name="effet-condition"]:checked').val();
      const seuil = html.find('[name="effet-seuil"]').val();
      const valeur = html.find('[name="effet-valeur"]').val();
      const unite = html.find('[name="effet-unite"]').val();
      const tableauApplicatif = html.find('[name="effet-tableau-applicatif"]').val();
      
      let description = '';
      
      if (!type) {
        description = 'Aucun effet configuré';
      } else {
        const typeNames = {
          'bonus_degats': 'Bonus Dégâts',
          'recuperation_pa': 'Récup PA',
          'initiative_first': 'Initiative',
          'bonus_reussite': 'Bonus Réussite',
          'reduction_malus': 'Réduction Malus',
          'parade_gratuite': 'Parade Gratuite'
        };
        
        const typeName = typeNames[type] || type;
        
        // Ajouter info sur tableau applicatif
        let tableauInfo = '';
        if (tableauApplicatif === '1') {
          tableauInfo = ' [Sur Tableau 1]';
        } else if (tableauApplicatif === '2') {
          tableauInfo = ' [Sur Tableau 2]';
        }
        
        if (condition === 'permanent') {
          if (type === 'initiative_first') {
            description = `${typeName} : Joue toujours en premier${tableauInfo}`;
          } else if (type === 'parade_gratuite') {
            description = `${typeName} : Toujours disponible${tableauInfo}`;
          } else {
            const val = unite === 'pourcent' ? `${valeur}%` : `${valeur} pts`;
            description = `${typeName} : ${val} (permanent)${tableauInfo}`;
          }
        } else if (condition === 'debut_combat') {
          if (type === 'recuperation_pa') {
            description = `${typeName} : +1 PA au début du combat${tableauInfo}`;
          } else {
            description = `${typeName} : Actif au début du combat${tableauInfo}`;
          }
        } else {
          // Après X réussites
          if (type === 'parade_gratuite') {
            description = `Après ${seuil} réussites : 1 parade gratuite${tableauInfo}`;
          } else if (type === 'recuperation_pa') {
            description = `Après ${seuil} réussites : +1 PA${tableauInfo}`;
          } else {
            const val = unite === 'pourcent' ? `${valeur}%` : `${valeur} pts`;
            description = `Après ${seuil} réussites : ${val}${tableauInfo}`;
          }
        }
      }
      
      html.find('[name="effet-description"]').val(description);
    };
    
    // Afficher/masquer les champs selon le type et la condition
    const updateVisibility = () => {
      const type = html.find('[name="effet-type"]').val();
      const condition = html.find('[name="effet-condition"]:checked').val();
      
      // Seuil visible uniquement si condition = reussites
      if (condition === 'reussites') {
        html.find('.seuil-group').show();
      } else {
        html.find('.seuil-group').hide();
      }
      
      // Valeur masquée pour initiative et parade
      if (type === 'initiative_first' || type === 'parade_gratuite' || type === '') {
        html.find('.valeur-group').hide();
      } else {
        html.find('.valeur-group').show();
      }
    };
    
    // Listeners
    html.find('[name="effet-type"]').on('change', () => {
      updateVisibility();
      updateDescription();
    });
    
    html.find('[name="effet-condition"]').on('change', () => {
      updateVisibility();
      updateDescription();
    });
    
    html.find('[name="effet-seuil"], [name="effet-valeur"], [name="effet-unite"], [name="effet-tableau-applicatif"]').on('change input', updateDescription);
    
    // Bouton reset compteur
    html.find('.btn-reset-compteur').on('click', async () => {
      await this.actor.update({
        [`system.combat.tableau${tableNum}.effet.compteur`]: 0,
        [`system.combat.tableau${tableNum}.effet.actif`]: false
      });
      ui.notifications.info("🔄 Compteur réinitialisé !");
      // Recharger le dialogue
      html.closest('.dialog').find('.dialog-button.save').click();
      setTimeout(() => this._onConfigureEffetTableau({ preventDefault: () => {}, currentTarget: { dataset: { table: tableNum } } }), 100);
    });
    
    // Initialiser
    updateDescription();
    updateVisibility();
  }
  
  /* ================================
     SAUVEGARDE DE LA CONFIGURATION
     ================================ */
  async _saveEffetConfig(html, tableNum) {
    const type = html.find('[name="effet-type"]').val();
    const condition = html.find('[name="effet-condition"]:checked').val();
    const seuil = parseInt(html.find('[name="effet-seuil"]').val()) || 0;
    const valeur = parseInt(html.find('[name="effet-valeur"]').val()) || 0;
    const unite = html.find('[name="effet-unite"]').val();
    const tableauApplicatif = html.find('[name="effet-tableau-applicatif"]').val();
    const description = html.find('[name="effet-description"]').val();
    
    // Garder le compteur actuel
    const compteurActuel = this.actor.system.combat?.[`tableau${tableNum}`]?.effet?.compteur || 0;
    
    await this.actor.update({
      [`system.combat.tableau${tableNum}.effet`]: {
        type: type,
        condition: condition,
        seuil: seuil,
        compteur: compteurActuel,
        valeur: valeur,
        unite: unite,
        tableauApplicatif: tableauApplicatif,
        description: description,
        actif: false // Reset à false lors de la sauvegarde
      }
    });
    
    ui.notifications.info("✅ Effet configuré avec succès !");
  }

  /* ================================
     INCRÉMENTER COMPTEUR D'EFFET
     ================================ */
  async _incrementerCompteurEffet() {
    console.log("🎯 _incrementerCompteurEffet appelée");
    
    // Trouver le tableau actif
    const tableau1Actif = this.actor.system.combat.tableau1?.actif;
    const tableau2Actif = this.actor.system.combat.tableau2?.actif;
    
    console.log(`📊 Tableaux actifs: T1=${tableau1Actif}, T2=${tableau2Actif}`);
    
    let tableauActif = null;
    if (tableau1Actif) tableauActif = 'tableau1';
    else if (tableau2Actif) tableauActif = 'tableau2';
    
    if (!tableauActif) {
      console.log("❌ Aucun tableau actif");
      return;
    }
    
    console.log(`✅ Tableau actif: ${tableauActif}`);
    
    const effet = this.actor.system.combat[tableauActif]?.effet;
    if (!effet || !effet.type) {
      console.log("❌ Pas d'effet configuré sur ce tableau");
      return;
    }
    
    console.log(`📝 Effet configuré: ${effet.type}, condition: ${effet.condition}`);
    
    // Ne pas incrémenter si condition = permanent ou debut_combat
    if (effet.condition !== 'reussites') {
      console.log(`⏭️ Effet ${effet.condition}, pas d'incrémentation nécessaire`);
      return;
    }
    
    // Incrémenter le compteur
    const nouveauCompteur = (effet.compteur || 0) + 1;
    const updateData = {};
    
    updateData[`system.combat.${tableauActif}.effet.compteur`] = nouveauCompteur;
    
    console.log(`➕ Incrémentation: ${effet.compteur || 0} → ${nouveauCompteur} (seuil: ${effet.seuil})`);
    
    // Si seuil atteint, activer l'effet
    if (nouveauCompteur >= effet.seuil) {
      updateData[`system.combat.${tableauActif}.effet.actif`] = true;
      ui.notifications.info(`⚡ Effet "${effet.description}" prêt !`);
      console.log(`🎉 Effet activé !`);
    }
    
    await this.actor.update(updateData);
    
    console.log(`✅ Compteur mis à jour: ${nouveauCompteur}/${effet.seuil}`);
  }
  
  /* ================================
     APPLIQUER EFFET SUR TECHNIQUE
     ================================ */
  async _appliquerEffetTableau(technique, degatsBase) {
    // Trouver le tableau actif
    const tableau1Actif = this.actor.system.combat.tableau1?.actif;
    const tableau2Actif = this.actor.system.combat.tableau2?.actif;
    
    let tableauActif = tableau1Actif ? 'tableau1' : tableau2Actif ? 'tableau2' : null;
    if (!tableauActif) return { degats: degatsBase, bonus: 0, effetApplique: null };
    
    // Vérifier les deux tableaux pour leurs effets
    const effets = [];
    
    for (const tableauKey of ['tableau1', 'tableau2']) {
      const effet = this.actor.system.combat[tableauKey]?.effet;
      if (!effet || !effet.type) continue;
      
      // Vérifier si l'effet est actif
      let effetActif = false;
      
      if (effet.condition === 'permanent') {
        // Permanent : actif si c'est le tableau actif
        effetActif = (tableauKey === tableauActif);
      } else if (effet.condition === 'reussites') {
        // Après réussites : actif si le flag est true
        effetActif = effet.actif;
      } else if (effet.condition === 'debut_combat') {
        // Début combat : géré ailleurs
        effetActif = false;
      }
      
      if (!effetActif) continue;
      
      // Vérifier le tableau applicatif
      const tableauApplicatif = effet.tableauApplicatif || '';
      
      // Si tableau applicatif spécifié, vérifier qu'on est sur le bon tableau
      if (tableauApplicatif === '1' && tableauActif !== 'tableau1') continue;
      if (tableauApplicatif === '2' && tableauActif !== 'tableau2') continue;
      // Si vide, l'effet s'applique sur le même tableau que celui qui le contient
      if (tableauApplicatif === '' && tableauKey !== tableauActif) continue;
      
      effets.push({ effet, tableauKey });
    }
    
    if (effets.length === 0) {
      return { degats: degatsBase, bonus: 0, effetApplique: null };
    }
    
    // Appliquer le premier effet trouvé
    const { effet, tableauKey } = effets[0];
    let degatsFinaux = degatsBase;
    let bonusApplique = 0;
    let effetApplique = null;
    
    switch (effet.type) {
      case 'bonus_degats':
        if (effet.unite === 'pourcent') {
          bonusApplique = Math.floor(degatsBase * (effet.valeur / 100));
        } else {
          bonusApplique = effet.valeur;
        }
        degatsFinaux = degatsBase + bonusApplique;
        effetApplique = `Bonus Dégâts +${bonusApplique}`;
        
        // Désactiver l'effet après utilisation
        if (effet.condition === 'reussites') {
          await this.actor.update({
            [`system.combat.${tableauKey}.effet.actif`]: false,
            [`system.combat.${tableauKey}.effet.compteur`]: 0
          });
          ui.notifications.info(`💥 ${effet.description} appliqué ! Compteur réinitialisé.`);
        }
        break;
        
      case 'bonus_reussite':
        // Géré dans le calcul du jet de réussite
        effetApplique = `Bonus Réussite +${effet.valeur}%`;
        break;
        
      case 'reduction_malus':
        // Géré dans le calcul des malus
        effetApplique = `Réduction Malus -${effet.valeur}%`;
        break;
        
      case 'recuperation_pa':
        // Géré au début du tour
        effetApplique = `Récup PA`;
        break;
        
      case 'parade_gratuite':
        // Géré lors de la réception d'une attaque
        effetApplique = `Parade Gratuite disponible`;
        break;
        
      case 'initiative_first':
        // Géré lors du jet d'initiative
        effetApplique = `Initiative Assurée`;
        break;
    }
    
    return { degats: degatsFinaux, bonus: bonusApplique, effetApplique };
  }
  
  /* ================================
     OBTENIR BONUS DE RÉUSSITE
     ================================ */
  _getBonusReussiteEffet() {
    const tableau1Actif = this.actor.system.combat.tableau1?.actif;
    const tableau2Actif = this.actor.system.combat.tableau2?.actif;
    
    let tableauActif = tableau1Actif ? 'tableau1' : tableau2Actif ? 'tableau2' : null;
    if (!tableauActif) return 0;
    
    // Vérifier tous les tableaux
    for (const tableauKey of ['tableau1', 'tableau2']) {
      const effet = this.actor.system.combat[tableauKey]?.effet;
      if (!effet || effet.type !== 'bonus_reussite') continue;
      
      // Vérifier si actif
      let effetActif = false;
      if (effet.condition === 'permanent' && tableauKey === tableauActif) {
        effetActif = true;
      } else if (effet.condition === 'reussites' && effet.actif) {
        effetActif = true;
      }
      
      if (!effetActif) continue;
      
      // Vérifier tableau applicatif
      const tableauApplicatif = effet.tableauApplicatif || '';
      if (tableauApplicatif === '1' && tableauActif !== 'tableau1') continue;
      if (tableauApplicatif === '2' && tableauActif !== 'tableau2') continue;
      if (tableauApplicatif === '' && tableauKey !== tableauActif) continue;
      
      // Retourner le bonus
      return effet.valeur || 0;
    }
    
    return 0;
  }
  
  /* ================================
     OBTENIR RÉDUCTION MALUS
     ================================ */
  _getReductionMalusEffet() {
    const tableau1Actif = this.actor.system.combat.tableau1?.actif;
    const tableau2Actif = this.actor.system.combat.tableau2?.actif;
    
    let tableauActif = tableau1Actif ? 'tableau1' : tableau2Actif ? 'tableau2' : null;
    if (!tableauActif) return 0;
    
    // Vérifier tous les tableaux
    for (const tableauKey of ['tableau1', 'tableau2']) {
      const effet = this.actor.system.combat[tableauKey]?.effet;
      if (!effet || effet.type !== 'reduction_malus') continue;
      
      // Vérifier si actif (généralement permanent)
      if (effet.condition === 'permanent' && tableauKey === tableauActif) {
        return effet.valeur || 0;
      }
    }
    
    return 0;
  }
  /* ================================
     TECHNIQUE STYLE CHM (CHOIX MULTIPLE)
     ================================ */
  async _useTechniqueCHM(technique, seuilReussite) {
    const chm = technique.system.chm || {};
    
    // Récupérer les variantes configurées
    const variantes = [];
    for (let i = 1; i <= 5; i++) {
      const slot = chm[`slot${i}`];
      if (slot && slot.nom) {
        variantes.push({
          slot: i,
          nom: slot.nom,
          style: slot.style,
          baseDegats: slot.baseDegats,
          description: slot.description,
          icone: slot.icone || '⚡'
        });
      }
    }
    
    if (variantes.length === 0) {
      ui.notifications.warn("⚠️ Aucune variante configurée pour cette technique CHM !");
      return;
    }
    
    // Créer le contenu du dialogue
    let content = `
      <div style="padding: 15px;">
        <h2 style="text-align: center; color: #800080; margin-bottom: 20px;">
          🎯 ${technique.name} - Choix de la variante
        </h2>
        <div style="display: flex; flex-direction: column; gap: 10px;">
    `;
    
    for (const v of variantes) {
      content += `
        <button class="chm-choice-btn" data-slot="${v.slot}" style="
          padding: 15px;
          background: linear-gradient(135deg, rgba(128, 0, 128, 0.1), rgba(160, 32, 240, 0.1));
          border: 2px solid #800080;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: all 0.3s;
          font-size: 14px;
        " onmouseover="this.style.background='linear-gradient(135deg, rgba(128, 0, 128, 0.2), rgba(160, 32, 240, 0.2))'; this.style.borderColor='#A020F0';"
           onmouseout="this.style.background='linear-gradient(135deg, rgba(128, 0, 128, 0.1), rgba(160, 32, 240, 0.1))'; this.style.borderColor='#800080';">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
            <span style="font-size: 24px;">${v.icone}</span>
            <strong style="font-size: 18px; color: #800080;">${v.nom}</strong>
          </div>
          <div style="font-size: 12px; color: #666;">
            Style: ${v.style.toUpperCase()} | Dégâts: ${v.baseDegats}
          </div>
          ${v.description ? `<div style="font-size: 12px; color: #999; margin-top: 5px; font-style: italic;">${v.description}</div>` : ''}
        </button>
      `;
    }
    
    content += `
        </div>
      </div>
    `;
    
    // Afficher le dialogue
    return new Promise((resolve) => {
      new Dialog({
        title: `${technique.name} - Choix`,
        content: content,
        buttons: {
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Annuler",
            callback: () => resolve(null)
          }
        },
        default: "cancel",
        render: (html) => {
          // Listener sur les boutons de choix
          html.find('.chm-choice-btn').on('click', async (event) => {
            const slotNum = event.currentTarget.dataset.slot;
            const variante = chm[`slot${slotNum}`];
            
            // Fermer le dialogue
            html.closest('.dialog').find('.dialog-button.cancel').click();
            
            // Exécuter la variante sélectionnée
            await this._executeTechniqueCHMVariante(technique, variante, seuilReussite);
            
            resolve(variante);
          });
        },
        close: () => resolve(null)
      }, {
        width: 450,
        height: "auto"
      }).render(true);
    });
  }
  
  /* ================================
     EXÉCUTER UNE VARIANTE CHM
     ================================ */
  async _executeTechniqueCHMVariante(technique, variante, seuilReussite) {
    console.log(`🎯 Exécution variante CHM: ${variante.nom} (${variante.style})`);
    
    // Créer une technique temporaire avec les paramètres de la variante
    const techniqueTmp = foundry.utils.duplicate(technique);
    techniqueTmp.name = `${technique.name} - ${variante.nom}`;
    techniqueTmp.system.style = variante.style;
    techniqueTmp.system.degats = { base: variante.baseDegats || 0 };
    
    // IMPORTANT : Appliquer l'EFFET de la variante (pas celui de la technique de base)
    if (variante.effet && variante.effet.type !== "aucun") {
      techniqueTmp.system.effet1 = {
        type: variante.effet.type,
        valeur: variante.effet.valeur || 0,
        unite: "chiffre",
        duree: variante.effet.duree || 3,
        condition: 100 // Toujours actif
      };
    } else {
      techniqueTmp.system.effet1 = { type: "aucun" };
    }
    
    // Désactiver l'effet 2 (on n'utilise que l'effet de la variante)
    techniqueTmp.system.effet2 = { type: "aucun" };
    
    // ANIMATION : utiliser celle de la variante si définie, sinon effacer
    if (variante.animation) {
      const dureeRaw = variante.animDuree;
      // Convertir en nombre (le select HTML renvoie des strings)
      // 999 = Continue (on garde 999s comme durée max)
      const dureeNum = parseInt(dureeRaw) || 3;
      techniqueTmp.system.animation = {
        jb2a: variante.animation,
        duree: dureeNum
      };
    } else {
      // Pas d'animation sur cette variante → effacer celle de la technique parente
      techniqueTmp.system.animation = {};
    }
    
    // Exécuter la technique avec le style approprié
    const pmActuel = this.actor.system.aptitudes.pm.value;
    const coutPM = technique.system.coutPM || 0;
    
    // Vérifier PM
    if (pmActuel < coutPM) {
      ui.notifications.warn(`⚠️ PM insuffisants ! (${pmActuel}/${coutPM})`);
      return;
    }
    
    // Gestion des PA selon le style de la variante
    const actionPoints = this.actor.system.combat.actionPoints;
    const style = variante.style;
    
    if (style === "atta" || style === "attm") {
      // Consommer 1 Petit PA
      let petitDispo = null;
      for (let g = 1; g <= 3; g++) {
        for (let p = 1; p <= 2; p++) {
          if (actionPoints[`grand${g}`]?.[`petit${p}`]) {
            petitDispo = { grand: g, petit: p };
            break;
          }
        }
        if (petitDispo) break;
      }
      
      if (!petitDispo) {
        ui.notifications.warn("⚠️ Plus de petits points d'action disponibles !");
        return;
      }
      
      // Consommer Petit PA
      await this.actor.update({
        [`system.combat.actionPoints.grand${petitDispo.grand}.petit${petitDispo.petit}`]: false
      });
    } else {
      // Consommer 1 Grand PA (styles normaux)
      let grandDispo = null;
      for (let g = 1; g <= 3; g++) {
        if (actionPoints[`grand${g}`]?.petit1 && actionPoints[`grand${g}`]?.petit2) {
          grandDispo = g;
          break;
        }
      }
      
      if (!grandDispo) {
        ui.notifications.warn("⚠️ Plus de points d'action disponibles !");
        return;
      }
      
      // Consommer Grand PA
      await this.actor.update({
        [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
        [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false
      });
    }
    
    // Exécuter selon le style de la variante
    // Style PARADE dans CHM → stocker le flag directement (PA+PM déjà consommés)
    if (style === "parade") {
      await this.actor.setFlag('ffdreame', 'paradeActive', {
        techniqueId: techniqueTmp._id || null,
        nom: techniqueTmp.name,
        baseDegats: variante.baseDegats || 0,
        animation: variante.animation || null,
        animDuree: variante.animDuree || 3
      });
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content: `
          <div style="background:rgba(0,180,255,0.15);border-left:4px solid #00b4ff;padding:10px;border-radius:6px;">
            <h3 style="color:#00b4ff;margin:0 0 6px;">🛡️ PARADE ACTIVÉE</h3>
            <p><strong>${this.actor.name}</strong> est en position de parade (<em>${variante.nom}</em>)</p>
            <p style="color:#aaa;font-size:11px;">⚡ Si l'ennemi rate → riposte automatique puis parade s'arrête</p>
          </div>
        `
      });
      return;
    }
    
    // Tous les autres styles → attaque normale
    await this._useTableTechniqueNormal(techniqueTmp, seuilReussite, pmActuel, coutPM);
  }

  /* ================================
     UTILISER UNE TECHNIQUE AOER
     ================================ */
  async _useTechniqueAOER(technique) {
    console.log(`🔥 Utilisation technique AOER : ${technique.name}`);
    
    // Vérifier PM
    const pmActuel = this.actor.system.aptitudes.pm.value;
    const coutPM = technique.system.coutPM || 0;
    
    if (pmActuel < coutPM) {
      ui.notifications.warn(`⚠️ PM insuffisants ! (${pmActuel}/${coutPM})`);
      return;
    }
    
    // Vérifier PA (1 Grand PA requis)
    const actionPoints = this.actor.system.combat.actionPoints;
    let grandDispo = null;
    
    for (let g = 1; g <= 3; g++) {
      if (actionPoints[`grand${g}`]?.petit1 && actionPoints[`grand${g}`]?.petit2) {
        grandDispo = g;
        break;
      }
    }
    
    if (!grandDispo) {
      ui.notifications.warn("⚠️ Pas de Grand PA disponible !");
      return;
    }
    
    // Utiliser le système AOER
    const result = await window.FFdreameAOER.useTechniqueAOER(this.actor, technique);
    
    if (!result.success) {
      return; // Annulé
    }
    
    // Consommer PM et PA
    await this.actor.update({
      'system.aptitudes.pm.value': pmActuel - coutPM,
      [`system.combat.actionPoints.grand${grandDispo}.petit1`]: false,
      [`system.combat.actionPoints.grand${grandDispo}.petit2`]: false
    });
    
    console.log(`✅ Technique AOER placée, se déclenchera au round ${(game.combat?.round || 0) + 1}`);
  }
}

