/**
 * zones-canalisation.js
 * Système de zones de canalisation pour Foundry VTT v13 - System "ffdreame"
 *
 * Gère les zones AOE persistantes qui restent actives autour du lanceur
 * jusqu'à ce qu'il reclique sur le bouton de la technique (toggle).
 *
 * Auteur : système ffdreame
 */

// ============================================================
//  Constantes
// ============================================================

/** Identifiant du système, utilisé pour les flags Foundry */
const SYSTEM_ID = "ffdreame";

/** Clé de flag racine pour les zones actives sur un acteur lanceur */
const FLAG_ZONE_ACTIVE = "zoneActive";

/** Préfixe pour les flags d'effets stockés sur les acteurs cibles */
const FLAG_ZONE_PREFIX = "zone_";

// ============================================================
//  Classe principale
// ============================================================

/**
 * FFdreameZonesCanalisation
 *
 * Gère la création, le maintien et la suppression des zones de canalisation.
 * Une zone est liée à un acteur lanceur ; une seule zone peut être active
 * par acteur à la fois.
 *
 * Toutes les méthodes publiques sont statiques afin de ne pas nécessiter
 * d'instanciation.
 */
export class FFdreameZonesCanalisation {

  // ----------------------------------------------------------
  //  Registre en mémoire des zones actives
  //  Structure : Map<acteurId, ZoneData>
  //
  //  ZoneData = {
  //    acteurId       : string,
  //    techniqueId    : string,
  //    tokenLanceurId : string,
  //    sceneId        : string,
  //    rayonMetres    : number,     // rayon en mètres
  //    rayonCases     : number,     // rayon en cases
  //    rayonPixels    : number,     // rayon en pixels
  //    canalisationPM : number,     // coût PM par round
  //    effet1         : EffetData | null,
  //    effet2         : EffetData | null,
  //    tokensAffectes : Set<string>, // tokenId des tokens dans la zone
  //    sequencerName  : string,     // nom unique pour Sequencer
  //    creeAt         : number,     // timestamp
  //  }
  //
  //  EffetData = {
  //    type   : string,
  //    valeur : number | string,
  //    unite  : string,
  //  }
  // ----------------------------------------------------------

  /** @type {Map<string, object>} */
  static #zonesActives = new Map();

  // ============================================================
  //  INITIALISATION
  // ============================================================

  /**
   * Enregistre tous les hooks Foundry nécessaires au fonctionnement des zones.
   * À appeler une seule fois lors du hook "ready".
   */
  static init() {
    // Détection des tokens qui entrent / sortent de la zone lors d'un déplacement
    Hooks.on("updateToken", FFdreameZonesCanalisation.#onUpdateToken.bind(FFdreameZonesCanalisation));

    // Nettoyage lorsqu'un token est supprimé de la scène
    Hooks.on("deleteToken", FFdreameZonesCanalisation.#onDeleteToken.bind(FFdreameZonesCanalisation));

    // Consommation PM et effets répétés à chaque nouveau round de combat
    Hooks.on("combatRound", FFdreameZonesCanalisation.#onCombatRound.bind(FFdreameZonesCanalisation));

    console.log(`[${SYSTEM_ID}] ZonesCanalisation | Hooks enregistrés.`);
  }

  // ============================================================
  //  MÉTHODES PUBLIQUES PRINCIPALES
  // ============================================================

  /**
   * Crée une nouvelle zone de canalisation autour du lanceur.
   *
   * @param {Actor}       acteur        - L'acteur qui lance la technique
   * @param {Item}        technique     - L'item technique de type MULTIS
   * @param {TokenDocument} tokenLanceur - Le token du lanceur sur la scène
   * @returns {Promise<string|null>}    Identifiant de la zone créée, ou null en cas d'erreur
   */
  static async creerZone(acteur, technique, tokenLanceur) {
    if (!acteur || !technique || !tokenLanceur) {
      console.warn(`[${SYSTEM_ID}] ZonesCanalisation | creerZone : paramètres manquants.`);
      return null;
    }

    // Une seule zone active par acteur
    if (FFdreameZonesCanalisation.#zonesActives.has(acteur.id)) {
      console.warn(`[${SYSTEM_ID}] ZonesCanalisation | Une zone est déjà active pour ${acteur.name}.`);
      return null;
    }

    // ---- Calcul du rayon ----
    const sys = technique.system ?? {};
    const rayonMetresBrut = sys.multi?.largeur ?? sys.portee ?? 1.5;
    const rayonMetres = Number(rayonMetresBrut) || 1.5;

    // Taille d'une case en pixels et distance en mètres par case
    const gridSize    = canvas.grid?.size ?? 100;
    const gridDist    = canvas.scene?.grid?.distance ?? 1.5;   // mètres / case
    const rayonCases  = rayonMetres / gridDist;
    const rayonPixels = rayonCases * gridSize;

    // ---- Récupération des effets ----
    const effet1 = FFdreameZonesCanalisation.#normaliserEffet(sys.effet1);
    const effet2 = FFdreameZonesCanalisation.#normaliserEffet(sys.effet2);

    // ---- Construction de la ZoneData ----
    const zoneId = `zone_${acteur.id}_${Date.now()}`;
    const sequencerName = `${SYSTEM_ID}_canalisation_${zoneId}`;

    /** @type {object} */
    const zoneData = {
      acteurId        : acteur.id,
      techniqueId     : technique.id,
      tokenLanceurId  : tokenLanceur.id,
      sceneId         : canvas.scene?.id ?? null,
      rayonMetres,
      rayonCases,
      rayonPixels,
      canalisationPM  : Number(sys.canalisationPM) || 0,
      effet1,
      effet2,
      tokensAffectes  : new Set(),
      sequencerName,
      creeAt          : Date.now(),
    };

    FFdreameZonesCanalisation.#zonesActives.set(acteur.id, zoneData);

    // Stocker la référence sur l'acteur (flag persistant en base) pour survie au rechargement
    await acteur.setFlag(SYSTEM_ID, FLAG_ZONE_ACTIVE, {
      zoneId,
      techniqueId    : technique.id,
      tokenLanceurId : tokenLanceur.id,
    });

    // ---- Lancement de l'animation Sequencer ----
    FFdreameZonesCanalisation.#lancerAnimation(zoneData, tokenLanceur);

    // ---- Scan initial : tokens déjà dans la zone ----
    await FFdreameZonesCanalisation.#scannerZone(acteur.id);

    console.log(`[${SYSTEM_ID}] ZonesCanalisation | Zone créée pour ${acteur.name} (rayon ${rayonMetres}m).`);
    return zoneId;
  }

  /**
   * Arrête la zone de canalisation active pour un acteur.
   * Retire tous les effets appliqués aux tokens présents dans la zone.
   *
   * @param {Actor} acteur - L'acteur lanceur
   * @returns {Promise<void>}
   */
  static async arreterZone(acteur) {
    if (!acteur) return;

    const zoneData = FFdreameZonesCanalisation.#zonesActives.get(acteur.id);
    if (!zoneData) {
      // Pas de zone en mémoire, mais on nettoie quand même le flag
      await acteur.unsetFlag(SYSTEM_ID, FLAG_ZONE_ACTIVE);
      return;
    }

    // ---- Retrait des effets sur tous les tokens encore dans la zone ----
    const tokensAffectes = [...zoneData.tokensAffectes];
    for (const tokenId of tokensAffectes) {
      const token = FFdreameZonesCanalisation.#getToken(tokenId, zoneData.sceneId);
      if (token?.actor) {
        await FFdreameZonesCanalisation.#retirerEffetsToken(token.actor, acteur.id, zoneData);
      }
    }

    // ---- Arrêt de l'animation Sequencer ----
    FFdreameZonesCanalisation.#arreterAnimation(zoneData.sequencerName);

    // ---- Nettoyage du registre en mémoire ----
    FFdreameZonesCanalisation.#zonesActives.delete(acteur.id);

    // ---- Nettoyage du flag persistant ----
    await acteur.unsetFlag(SYSTEM_ID, FLAG_ZONE_ACTIVE);

    console.log(`[${SYSTEM_ID}] ZonesCanalisation | Zone arrêtée pour ${acteur.name}.`);
  }

  /**
   * Active ou désactive la zone de canalisation (toggle).
   * Si une zone est déjà active, l'arrête ; sinon la crée.
   *
   * @param {Actor}         acteur        - L'acteur lanceur
   * @param {Item}          technique     - L'item technique
   * @param {TokenDocument} tokenLanceur  - Le token du lanceur
   * @returns {Promise<void>}
   */
  static async toggleZone(acteur, technique, tokenLanceur) {
    if (FFdreameZonesCanalisation.zoneActiveFor(acteur)) {
      await FFdreameZonesCanalisation.arreterZone(acteur);
    } else {
      await FFdreameZonesCanalisation.creerZone(acteur, technique, tokenLanceur);
    }
  }

  /**
   * Indique si une zone est actuellement active pour cet acteur.
   *
   * @param {Actor} acteur
   * @returns {boolean}
   */
  static zoneActiveFor(acteur) {
    if (!acteur) return false;
    return FFdreameZonesCanalisation.#zonesActives.has(acteur.id);
  }

  /**
   * Retourne le tableau de toutes les zones actives (usage debug GM).
   *
   * @returns {object[]}
   */
  static getZonesActives() {
    return [...FFdreameZonesCanalisation.#zonesActives.values()].map(z => ({
      ...z,
      tokensAffectes: [...z.tokensAffectes],
    }));
  }

  // ============================================================
  //  LECTEURS DE FLAGS (intégration actor-sheet)
  // ============================================================

  /**
   * Retourne la valeur du flag bufd (réduction de dégâts reçus) ou null.
   * @param {Actor} acteur
   * @returns {number|null}
   */
  static getBufD(acteur) {
    return FFdreameZonesCanalisation.#lireFlagEffet(acteur, "bufd");
  }

  /**
   * Retourne la valeur du flag bufa (bonus attaque) ou null.
   * @param {Actor} acteur
   * @returns {number|null}
   */
  static getBufA(acteur) {
    return FFdreameZonesCanalisation.#lireFlagEffet(acteur, "bufa");
  }

  /**
   * Retourne la valeur du flag bufj (réduction résultat jet) ou null.
   * @param {Actor} acteur
   * @returns {number|null}
   */
  static getBufJ(acteur) {
    return FFdreameZonesCanalisation.#lireFlagEffet(acteur, "bufj");
  }

  /**
   * Retourne la valeur du flag malusjet (malus jet ennemi) ou null.
   * @param {Actor} acteur
   * @returns {number|null}
   */
  static getMalusJet(acteur) {
    return FFdreameZonesCanalisation.#lireFlagEffet(acteur, "malusjet");
  }

  /**
   * Retourne la valeur du flag dot (dégâts par round) ou null.
   * @param {Actor} acteur
   * @returns {number|null}
   */
  static getDot(acteur) {
    return FFdreameZonesCanalisation.#lireFlagEffet(acteur, "dot");
  }

  /**
   * Indique si l'acteur est étourdi par une zone de canalisation.
   * @param {Actor} acteur
   * @returns {boolean}
   */
  static isStunParZone(acteur) {
    if (!acteur) return false;
    const flags = acteur.flags?.[SYSTEM_ID] ?? {};
    return Object.keys(flags).some(k => k.includes("_stun"));
  }

  // ============================================================
  //  APPLICATEURS (intégration actor-sheet)
  // ============================================================

  /**
   * Applique la réduction de dégâts liée au flag bufd.
   * Retourne le montant de dégâts après réduction.
   *
   * @param {number} degatsRecus - Montant brut de dégâts reçus
   * @param {Actor}  acteur      - L'acteur qui reçoit les dégâts
   * @returns {number}           Montant réduit
   */
  static appliquerBufD(degatsRecus, acteur) {
    const reduction = FFdreameZonesCanalisation.getBufD(acteur);
    if (reduction === null || reduction === undefined) return degatsRecus;
    const reduit = Math.max(0, degatsRecus - Number(reduction));
    return reduit;
  }

  /**
   * Applique la réduction du résultat de jet liée au flag bufj.
   * Retourne le résultat de jet après réduction.
   *
   * @param {number} resultatJet - Résultat brut du jet de dés
   * @param {Actor}  acteur      - L'acteur qui effectue le jet
   * @returns {number}           Résultat réduit
   */
  static appliquerBufJ(resultatJet, acteur) {
    const reduction = FFdreameZonesCanalisation.getBufJ(acteur);
    if (reduction === null || reduction === undefined) return resultatJet;
    const reduit = Math.max(0, resultatJet - Number(reduction));
    return reduit;
  }

  // ============================================================
  //  HOOKS INTERNES
  // ============================================================

  /**
   * Hook updateToken : détecte les entrées/sorties de zone lors d'un déplacement.
   *
   * @param {TokenDocument} tokenDoc   - Le token mis à jour
   * @param {object}        changement - Les changements appliqués
   * @param {object}        _options   - Options Foundry
   * @param {string}        _userId    - ID de l'utilisateur
   */
  static async #onUpdateToken(tokenDoc, changement, _options, _userId) {
    // On ne traite que les déplacements (x, y, ou élévation)
    const aBouge = "x" in changement || "y" in changement || "elevation" in changement;
    if (!aBouge) return;

    // Relancer le scan pour toutes les zones actives sur la scène courante
    for (const [acteurId, zoneData] of FFdreameZonesCanalisation.#zonesActives) {
      if (zoneData.sceneId !== canvas.scene?.id) continue;

      // Si c'est le lanceur lui-même qui a bougé, rescanner tous les tokens
      if (tokenDoc.id === zoneData.tokenLanceurId) {
        await FFdreameZonesCanalisation.#scannerZone(acteurId);
      } else {
        // C'est un autre token : vérifier seulement celui-ci
        await FFdreameZonesCanalisation.#verifierTokenDansZone(acteurId, tokenDoc);
      }
    }
  }

  /**
   * Hook deleteToken : retire les effets si le token était dans une zone.
   *
   * @param {TokenDocument} tokenDoc - Le token supprimé
   */
  static async #onDeleteToken(tokenDoc) {
    for (const [acteurId, zoneData] of FFdreameZonesCanalisation.#zonesActives) {
      // Si le lanceur est supprimé, on arrête la zone
      if (tokenDoc.id === zoneData.tokenLanceurId) {
        const acteur = game.actors?.get(acteurId);
        if (acteur) {
          await FFdreameZonesCanalisation.arreterZone(acteur);
        }
        continue;
      }

      // Si un token affecté est supprimé, on retire ses effets et on le sort du set
      if (zoneData.tokensAffectes.has(tokenDoc.id)) {
        if (tokenDoc.actor) {
          await FFdreameZonesCanalisation.#retirerEffetsToken(tokenDoc.actor, acteurId, zoneData);
        }
        zoneData.tokensAffectes.delete(tokenDoc.id);
      }
    }
  }

  /**
   * Hook combatRound : consomme les PM du lanceur et applique les effets périodiques.
   *
   * @param {Combat}  combat      - L'instance de combat
   * @param {object}  _updateData - Données de mise à jour
   * @param {object}  _options    - Options
   */
  static async #onCombatRound(combat, _updateData, _options) {
    for (const [acteurId, zoneData] of FFdreameZonesCanalisation.#zonesActives) {
      const acteur = game.actors?.get(acteurId);
      if (!acteur) continue;

      // Vérifier que le combat se passe sur la bonne scène
      if (zoneData.sceneId !== canvas.scene?.id) continue;

      // ---- Consommation PM par round ----
      if (zoneData.canalisationPM > 0) {
        const pmActuel = acteur.system?.aptitudes?.pm?.value ?? 0;
        const pmNouveau = Math.max(0, pmActuel - zoneData.canalisationPM);
        await acteur.update({ "system.aptitudes.pm.value": pmNouveau });

        // Si plus de PM, on arrête la zone
        if (pmNouveau <= 0 && pmActuel > 0) {
          ui.notifications?.warn(`[Canalisation] ${acteur.name} n'a plus de PM — la zone se dissipe.`);
          await FFdreameZonesCanalisation.arreterZone(acteur);
          continue;
        }
      }

      // ---- Effets périodiques sur les tokens dans la zone ----
      for (const tokenId of zoneData.tokensAffectes) {
        const token = FFdreameZonesCanalisation.#getToken(tokenId, zoneData.sceneId);
        if (!token?.actor) continue;

        await FFdreameZonesCanalisation.#appliquerEffetPeriodique(
          token.actor, acteur, zoneData.effet1, acteurId
        );
        await FFdreameZonesCanalisation.#appliquerEffetPeriodique(
          token.actor, acteur, zoneData.effet2, acteurId
        );
      }
    }
  }

  // ============================================================
  //  GESTION DE LA ZONE (scan, entrée, sortie)
  // ============================================================

  /**
   * Scanne tous les tokens de la scène et met à jour leur état dans la zone.
   *
   * @param {string} acteurId - ID de l'acteur lanceur
   */
  static async #scannerZone(acteurId) {
    const zoneData = FFdreameZonesCanalisation.#zonesActives.get(acteurId);
    if (!zoneData) return;

    const scene = game.scenes?.get(zoneData.sceneId);
    if (!scene) return;

    const tokenLanceur = scene.tokens?.get(zoneData.tokenLanceurId);
    if (!tokenLanceur) return;

    for (const tokenDoc of scene.tokens) {
      // On ignore le token du lanceur lui-même
      if (tokenDoc.id === zoneData.tokenLanceurId) continue;
      await FFdreameZonesCanalisation.#verifierTokenDansZone(acteurId, tokenDoc);
    }
  }

  /**
   * Vérifie si un token donné est dans la zone, et applique ou retire les effets
   * selon son état précédent.
   *
   * @param {string}        acteurId - ID de l'acteur lanceur
   * @param {TokenDocument} tokenDoc - Le token à vérifier
   */
  static async #verifierTokenDansZone(acteurId, tokenDoc) {
    const zoneData = FFdreameZonesCanalisation.#zonesActives.get(acteurId);
    if (!zoneData) return;

    const scene = game.scenes?.get(zoneData.sceneId);
    if (!scene) return;

    const tokenLanceur = scene.tokens?.get(zoneData.tokenLanceurId);
    if (!tokenLanceur) return;

    const estDedans = FFdreameZonesCanalisation.#tokenEstDansZone(tokenDoc, tokenLanceur, zoneData.rayonPixels);
    const etaitDedans = zoneData.tokensAffectes.has(tokenDoc.id);

    if (estDedans && !etaitDedans) {
      // Token entre dans la zone
      zoneData.tokensAffectes.add(tokenDoc.id);
      const acteur = game.actors?.get(acteurId);
      if (tokenDoc.actor && acteur) {
        await FFdreameZonesCanalisation.#appliquerEffetsEntree(tokenDoc.actor, acteur, zoneData);
      }
    } else if (!estDedans && etaitDedans) {
      // Token sort de la zone
      zoneData.tokensAffectes.delete(tokenDoc.id);
      const acteur = game.actors?.get(acteurId);
      if (tokenDoc.actor && acteur) {
        await FFdreameZonesCanalisation.#retirerEffetsToken(tokenDoc.actor, acteurId, zoneData);
      }
    }
  }

  /**
   * Détermine si un token se trouve dans le rayon de la zone.
   *
   * @param {TokenDocument} token        - Le token cible
   * @param {TokenDocument} tokenLanceur - Le token lanceur (centre de la zone)
   * @param {number}        rayonPixels  - Rayon de la zone en pixels
   * @returns {boolean}
   */
  static #tokenEstDansZone(token, tokenLanceur, rayonPixels) {
    const gridSize = canvas.grid?.size ?? 100;

    // Position centrale de chaque token (en pixels)
    const cx1 = tokenLanceur.x + (tokenLanceur.width  * gridSize) / 2;
    const cy1 = tokenLanceur.y + (tokenLanceur.height * gridSize) / 2;
    const cx2 = token.x        + (token.width         * gridSize) / 2;
    const cy2 = token.y        + (token.height        * gridSize) / 2;

    const distance = Math.hypot(cx2 - cx1, cy2 - cy1);
    return distance <= rayonPixels;
  }

  // ============================================================
  //  APPLICATION ET RETRAIT DES EFFETS
  // ============================================================

  /**
   * Applique les effets au moment où un token entre dans la zone.
   *
   * @param {Actor} acteurCible  - L'acteur du token qui entre
   * @param {Actor} acteurSource - L'acteur lanceur de la zone
   * @param {object} zoneData    - Données de la zone
   */
  static async #appliquerEffetsEntree(acteurCible, acteurSource, zoneData) {
    await FFdreameZonesCanalisation.#appliquerUnEffetEntree(acteurCible, acteurSource, zoneData.effet1, acteurSource.id);
    await FFdreameZonesCanalisation.#appliquerUnEffetEntree(acteurCible, acteurSource, zoneData.effet2, acteurSource.id);
  }

  /**
   * Applique un seul effet au moment de l'entrée dans la zone.
   *
   * @param {Actor}       acteurCible  - L'acteur cible
   * @param {Actor}       acteurSource - L'acteur lanceur
   * @param {object|null} effet        - Données de l'effet
   * @param {string}      acteurId     - ID du lanceur (pour les flags)
   */
  static async #appliquerUnEffetEntree(acteurCible, acteurSource, effet, acteurId) {
    if (!effet || !effet.type) return;

    const type   = effet.type;
    const valeur = Number(effet.valeur) || 0;
    const unite  = effet.unite ?? "";

    switch (type) {

      // ---- Soins : PV (fixe ou %) ----
      case "soins": {
        const pvMax = acteurCible.system?.aptitudes?.pv?.max ?? 0;
        const pvActuel = acteurCible.system?.aptitudes?.pv?.value ?? 0;
        let soin = valeur;
        if (unite === "%") soin = Math.floor(pvMax * valeur / 100);
        const pvNouveau = Math.min(pvMax, pvActuel + soin);
        await acteurCible.update({ "system.aptitudes.pv.value": pvNouveau });
        break;
      }

      // ---- Soin de groupe : appliqué à tous les tokens dans la zone ----
      case "soisg": {
        const pvMax    = acteurCible.system?.aptitudes?.pv?.max ?? 0;
        const pvActuel = acteurCible.system?.aptitudes?.pv?.value ?? 0;
        let soin = valeur;
        if (unite === "%") soin = Math.floor(pvMax * valeur / 100);
        const pvNouveau = Math.min(pvMax, pvActuel + soin);
        await acteurCible.update({ "system.aptitudes.pv.value": pvNouveau });
        break;
      }

      // ---- Bonus attaque : stocke la valeur originale et modifie ----
      case "bufa": {
        const attaqOriginal = acteurCible.system?.aptitudes?.attaque?.total ?? 0;
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_bufa`;
        // Stocker la valeur originale avant modification
        await acteurCible.setFlag(SYSTEM_ID, `${flagKey}_original`, attaqOriginal);
        // Stocker le bonus pour lecture dans actor-sheet
        await acteurCible.setFlag(SYSTEM_ID, flagKey, valeur);
        // Modifier la stat directement
        const nouvelleAttaque = attaqOriginal + valeur;
        await acteurCible.update({ "system.aptitudes.attaque.total": nouvelleAttaque });
        break;
      }

      // ---- Bufj : réduction du résultat de jet (flag, lu par actor-sheet) ----
      case "bufj": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_bufj`;
        await acteurCible.setFlag(SYSTEM_ID, flagKey, valeur);
        break;
      }

      // ---- Bufd : réduction des dégâts reçus (flag, lu par actor-sheet) ----
      case "bufd": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_bufd`;
        await acteurCible.setFlag(SYSTEM_ID, flagKey, valeur);
        break;
      }

      // ---- Bufpa : ajout d'un point d'action grand4 ----
      case "bufpa": {
        const grand4 = acteurCible.system?.combat?.actionPoints?.grand4 ?? {};
        // Cherche le premier slot disponible
        let slotLibre = null;
        for (const petit of ["petit1", "petit2"]) {
          if (!grand4[petit]?.disponible) { slotLibre = petit; break; }
        }
        if (slotLibre) {
          const updatePath = `system.combat.actionPoints.grand4.${slotLibre}.disponible`;
          await acteurCible.update({ [updatePath]: true });
          const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_bufpa`;
          await acteurCible.setFlag(SYSTEM_ID, flagKey, slotLibre);
        }
        break;
      }

      // ---- Malusjet : malus aux jets ennemis (flag) ----
      case "malusjet": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_malusjet`;
        await acteurCible.setFlag(SYSTEM_ID, flagKey, valeur);
        break;
      }

      // ---- Réduction des dégâts infligés (flag) ----
      case "reducdegats": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_reducdegats`;
        await acteurCible.setFlag(SYSTEM_ID, flagKey, valeur);
        break;
      }

      // ---- SC : augmentation du seuil de critique (flag) ----
      case "sc": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_sc`;
        await acteurCible.setFlag(SYSTEM_ID, flagKey, valeur);
        break;
      }

      // ---- EC : réduction du seuil de fumble (flag) ----
      case "ec": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_ec`;
        await acteurCible.setFlag(SYSTEM_ID, flagKey, valeur);
        break;
      }

      // ---- Stun : blocage des actions ----
      case "stun": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_stun`;
        const wasBlocked = acteurCible.system?.combat?.actionBlocked ?? false;
        await acteurCible.setFlag(SYSTEM_ID, flagKey, { wasBlocked });
        await acteurCible.update({ "system.combat.actionBlocked": true });
        break;
      }

      // ---- Btemp : bouclier PV temporaire ----
      case "btemp": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_btemp`;
        const pvActuel = acteurCible.system?.aptitudes?.pv?.value ?? 0;
        await acteurCible.setFlag(SYSTEM_ID, flagKey, { pvAvant: pvActuel, bonus: valeur });
        await acteurCible.update({ "system.aptitudes.pv.value": pvActuel + valeur });
        break;
      }

      // ---- RestaurePA : restaure les points d'action grand ----
      case "restaurePA": {
        // Restaure toutes les grand actions (grand1 à grand4)
        const updateData = {};
        for (const grandKey of ["grand1", "grand2", "grand3", "grand4"]) {
          const grand = acteurCible.system?.combat?.actionPoints?.[grandKey] ?? {};
          for (const petit of ["petit1", "petit2"]) {
            if (grand[petit] !== undefined) {
              updateData[`system.combat.actionPoints.${grandKey}.${petit}.disponible`] = true;
            }
          }
        }
        if (Object.keys(updateData).length > 0) {
          await acteurCible.update(updateData);
        }
        break;
      }

      // ---- Opportuniste : flag contre-attaque ----
      case "opportuniste": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_opportuniste`;
        await acteurCible.setFlag(SYSTEM_ID, flagKey, true);
        break;
      }

      // ---- Change posture : bascule tableau1/tableau2 ----
      case "change_posture": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_change_posture`;
        const posActuelle = acteurCible.system?.combat?.posture ?? "tableau1";
        const nouvellePosture = posActuelle === "tableau1" ? "tableau2" : "tableau1";
        await acteurCible.setFlag(SYSTEM_ID, flagKey, { postureOriginale: posActuelle });
        await acteurCible.update({ "system.combat.posture": nouvellePosture });
        break;
      }

      // ---- DOT et Ponction : effets périodiques uniquement, pas à l'entrée ----
      case "dot":
      case "ponction":
      case "ponctionm":
        // Ces effets ne s'appliquent pas à l'entrée, seulement par round
        break;

      default:
        console.warn(`[${SYSTEM_ID}] ZonesCanalisation | Type d'effet inconnu : ${type}`);
    }
  }

  /**
   * Retire tous les effets d'une zone sur un acteur cible.
   *
   * @param {Actor}  acteurCible - L'acteur sur lequel retirer les effets
   * @param {string} acteurId    - ID de l'acteur lanceur
   * @param {object} zoneData    - Données de la zone
   */
  static async #retirerEffetsToken(acteurCible, acteurId, zoneData) {
    await FFdreameZonesCanalisation.#retirerUnEffet(acteurCible, zoneData.effet1, acteurId);
    await FFdreameZonesCanalisation.#retirerUnEffet(acteurCible, zoneData.effet2, acteurId);
  }

  /**
   * Retire un effet spécifique sur un acteur cible.
   *
   * @param {Actor}       acteurCible - L'acteur cible
   * @param {object|null} effet       - Données de l'effet
   * @param {string}      acteurId    - ID du lanceur (pour retrouver les flags)
   */
  static async #retirerUnEffet(acteurCible, effet, acteurId) {
    if (!effet || !effet.type) return;

    const type   = effet.type;
    const valeur = Number(effet.valeur) || 0;

    switch (type) {

      case "bufa": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_bufa`;
        const original = acteurCible.getFlag(SYSTEM_ID, `${flagKey}_original`);
        if (original !== undefined && original !== null) {
          await acteurCible.update({ "system.aptitudes.attaque.total": original });
        }
        await acteurCible.unsetFlag(SYSTEM_ID, `${flagKey}_original`);
        await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        break;
      }

      case "bufj": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_bufj`;
        await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        break;
      }

      case "bufd": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_bufd`;
        await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        break;
      }

      case "bufpa": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_bufpa`;
        const slot = acteurCible.getFlag(SYSTEM_ID, flagKey);
        if (slot) {
          const updatePath = `system.combat.actionPoints.grand4.${slot}.disponible`;
          await acteurCible.update({ [updatePath]: false });
          await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        }
        break;
      }

      case "malusjet": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_malusjet`;
        await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        break;
      }

      case "reducdegats": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_reducdegats`;
        await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        break;
      }

      case "sc": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_sc`;
        await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        break;
      }

      case "ec": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_ec`;
        await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        break;
      }

      case "stun": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_stun`;
        const flagData = acteurCible.getFlag(SYSTEM_ID, flagKey);
        if (flagData !== undefined && flagData !== null) {
          const wasBlocked = flagData?.wasBlocked ?? false;
          await acteurCible.update({ "system.combat.actionBlocked": wasBlocked });
          await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        }
        break;
      }

      case "btemp": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_btemp`;
        const flagData = acteurCible.getFlag(SYSTEM_ID, flagKey);
        if (flagData) {
          const { pvAvant, bonus } = flagData;
          const pvActuel = acteurCible.system?.aptitudes?.pv?.value ?? 0;
          // On retire le bonus en veillant à ne pas dépasser ce qu'il restait
          const pvSansBonus = Math.max(pvAvant, pvActuel - bonus);
          await acteurCible.update({ "system.aptitudes.pv.value": pvSansBonus });
          await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        }
        break;
      }

      case "opportuniste": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_opportuniste`;
        await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        break;
      }

      case "change_posture": {
        const flagKey = `${FLAG_ZONE_PREFIX}${acteurId}_change_posture`;
        const flagData = acteurCible.getFlag(SYSTEM_ID, flagKey);
        if (flagData?.postureOriginale) {
          await acteurCible.update({ "system.combat.posture": flagData.postureOriginale });
          await acteurCible.unsetFlag(SYSTEM_ID, flagKey);
        }
        break;
      }

      // Effets qui ne laissent pas de trace permanente (soins ponctuels, bufpa, restaurePA)
      case "soins":
      case "soisg":
      case "restaurePA":
      case "dot":
      case "ponction":
      case "ponctionm":
        break;

      default:
        console.warn(`[${SYSTEM_ID}] ZonesCanalisation | Retrait d'effet inconnu : ${type}`);
    }
  }

  /**
   * Applique un effet périodique (par round de combat) à un acteur.
   * Seuls dot, ponction et ponctionm sont des effets périodiques.
   *
   * @param {Actor}       acteurCible  - L'acteur qui subit l'effet
   * @param {Actor}       acteurSource - Le lanceur (peut recevoir des PV/PM volés)
   * @param {object|null} effet        - Données de l'effet
   * @param {string}      acteurId     - ID du lanceur
   */
  static async #appliquerEffetPeriodique(acteurCible, acteurSource, effet, acteurId) {
    if (!effet || !effet.type) return;

    const type   = effet.type;
    const valeur = Number(effet.valeur) || 0;
    const unite  = effet.unite ?? "";

    switch (type) {

      // ---- DOT : dégâts par round ----
      case "dot": {
        const pvActuel = acteurCible.system?.aptitudes?.pv?.value ?? 0;
        let degats = valeur;
        if (unite === "%") {
          const pvMax = acteurCible.system?.aptitudes?.pv?.max ?? 0;
          degats = Math.floor(pvMax * valeur / 100);
        }
        const pvNouveau = Math.max(0, pvActuel - degats);
        await acteurCible.update({ "system.aptitudes.pv.value": pvNouveau });
        break;
      }

      // ---- Ponction : vol de PV ----
      case "ponction": {
        const pvCible  = acteurCible.system?.aptitudes?.pv?.value ?? 0;
        const pvSource = acteurSource.system?.aptitudes?.pv?.value ?? 0;
        const pvMaxSrc = acteurSource.system?.aptitudes?.pv?.max ?? 0;

        let vol = valeur;
        if (unite === "%") {
          const pvMaxCib = acteurCible.system?.aptitudes?.pv?.max ?? 0;
          vol = Math.floor(pvMaxCib * valeur / 100);
        }
        vol = Math.min(vol, pvCible); // on ne peut pas voler plus que ce que la cible a

        await acteurCible.update({ "system.aptitudes.pv.value": Math.max(0, pvCible - vol) });
        await acteurSource.update({ "system.aptitudes.pv.value": Math.min(pvMaxSrc, pvSource + vol) });
        break;
      }

      // ---- Ponctionm : vol de PM ----
      case "ponctionm": {
        const pmCible  = acteurCible.system?.aptitudes?.pm?.value ?? 0;
        const pmSource = acteurSource.system?.aptitudes?.pm?.value ?? 0;
        const pmMaxSrc = acteurSource.system?.aptitudes?.pm?.max ?? 0;

        let vol = valeur;
        if (unite === "%") {
          const pmMaxCib = acteurCible.system?.aptitudes?.pm?.max ?? 0;
          vol = Math.floor(pmMaxCib * valeur / 100);
        }
        vol = Math.min(vol, pmCible);

        await acteurCible.update({ "system.aptitudes.pm.value": Math.max(0, pmCible - vol) });
        await acteurSource.update({ "system.aptitudes.pm.value": Math.min(pmMaxSrc, pmSource + vol) });
        break;
      }

      // Les autres effets ne sont pas périodiques
      default:
        break;
    }
  }

  // ============================================================
  //  ANIMATION SEQUENCER
  // ============================================================

  /**
   * Lance l'animation de zone via Sequencer.
   * L'animation suit le lanceur (.attachTo), est persistante (.persist),
   * et est visible par tous les joueurs.
   *
   * @param {object}        zoneData     - Données de la zone
   * @param {TokenDocument} tokenLanceur - Token sur lequel attacher l'animation
   */
  static #lancerAnimation(zoneData, tokenLanceur) {
    // Vérification de la disponibilité du module Sequencer
    if (typeof Sequencer === "undefined" || !Sequencer?.Presets) {
      console.warn(`[${SYSTEM_ID}] ZonesCanalisation | Sequencer non disponible. Pas d'animation.`);
      return;
    }

    try {
      const gridSize   = canvas.grid?.size ?? 100;
      const rayonCases = zoneData.rayonCases ?? 1;

      // Séquence Sequencer
      new Sequence()
        .effect()
          // Fichier de particule / aura de zone (chemin par défaut customisable)
          .file("modules/jb2a_patreon/Library/Generic/Auras/Aura_01_Regular_Blue_300x300.webm")
          // Attacher au token lanceur pour suivre ses déplacements
          .attachTo(tokenLanceur)
          // Persister jusqu'à suppression manuelle
          .persist(true)
          // Nom unique pour pouvoir retrouver et supprimer l'effet
          .name(zoneData.sequencerName)
          // Échelle : diamètre de la zone = 2 × rayon, en cases de grid
          // La taille de base de l'animation est supposée couvrir 1 case (gridSize px)
          .scaleToFit(rayonCases * 2, rayonCases * 2)
          // Visible par tous les utilisateurs connectés
          .forUsers(game.users?.map(u => u.id) ?? [])
          // Boucle indéfiniment
          .repeats(9999, 0)
        .play();
    } catch (err) {
      console.error(`[${SYSTEM_ID}] ZonesCanalisation | Erreur Sequencer :`, err);
    }
  }

  /**
   * Arrête et supprime l'animation Sequencer liée à la zone.
   *
   * @param {string} sequencerName - Nom de l'effet Sequencer à supprimer
   */
  static #arreterAnimation(sequencerName) {
    if (typeof Sequencer === "undefined") return;

    try {
      Sequencer.EffectManager.endEffects({ name: sequencerName });
    } catch (err) {
      console.error(`[${SYSTEM_ID}] ZonesCanalisation | Erreur arrêt Sequencer :`, err);
    }
  }

  // ============================================================
  //  UTILITAIRES PRIVÉS
  // ============================================================

  /**
   * Normalise les données d'un effet (évite les undefined).
   *
   * @param {object|null|undefined} effetBrut
   * @returns {object|null}
   */
  static #normaliserEffet(effetBrut) {
    if (!effetBrut || !effetBrut.type) return null;
    return {
      type   : effetBrut.type   ?? "",
      valeur : effetBrut.valeur ?? 0,
      unite  : effetBrut.unite  ?? "",
    };
  }

  /**
   * Récupère un TokenDocument à partir de son ID et d'un sceneId.
   *
   * @param {string} tokenId - ID du token
   * @param {string} sceneId - ID de la scène
   * @returns {TokenDocument|null}
   */
  static #getToken(tokenId, sceneId) {
    const scene = game.scenes?.get(sceneId);
    return scene?.tokens?.get(tokenId) ?? null;
  }

  /**
   * Lit un flag d'effet stocké sur un acteur.
   * Cherche parmi tous les flags de l'acteur ceux contenant le type d'effet.
   *
   * @param {Actor}  acteur     - L'acteur cible
   * @param {string} typeEffet  - Le type d'effet (ex: "bufd", "bufj")
   * @returns {number|null}
   */
  static #lireFlagEffet(acteur, typeEffet) {
    if (!acteur) return null;
    const tousFlags = acteur.flags?.[SYSTEM_ID] ?? {};
    for (const [cle, valeur] of Object.entries(tousFlags)) {
      // La clé ressemble à : zone_<acteurId>_<typeEffet>
      if (cle.startsWith(FLAG_ZONE_PREFIX) && cle.endsWith(`_${typeEffet}`)) {
        return Number(valeur) || null;
      }
    }
    return null;
  }
}

// ============================================================
//  EXPORT
// ============================================================

export default FFdreameZonesCanalisation;

/* ============================================================
   INTÉGRATION - À faire dans votre actor-sheet.js
   ============================================================

   1. IMPORT
   ---------
   Au tout début de votre fichier actor-sheet.js, ajoutez :

     import { FFdreameZonesCanalisation } from "./zones-canalisation.js";


   2. INITIALISATION (hook "ready")
   ---------------------------------
   Dans votre fichier principal (ffdreame.js ou system.js), dans le hook "ready" :

     Hooks.once("ready", () => {
       FFdreameZonesCanalisation.init();
     });

   N'appelez init() qu'une seule fois, pas dans chaque feuille d'acteur.


   3. TOGGLE DE ZONE (gestionnaire d'utilisation de technique)
   ------------------------------------------------------------
   Dans votre gestionnaire d'événement qui utilise une technique
   (typiquement dans activateListeners ou _onClickTechnique), après avoir
   vérifié que la technique est bien de type MULTIS avec canalisation=true
   ET surSoi=true :

     async _onClickTechnique(event) {
       const techniqueId = event.currentTarget.dataset.techniqueId;
       const technique   = this.actor.items.get(techniqueId);

       if (!technique) return;

       const sys = technique.system ?? {};

       // Vérification canalisation surSoi
       if (sys.style === "MULTIS" && sys.canalisation === true && sys.surSoi === true) {
         // Récupère le token du lanceur sur la scène courante
         const tokenLanceur = canvas.tokens?.controlled?.[0]?.document
                           ?? this.actor.getActiveTokens()?.[0]?.document;

         if (!tokenLanceur) {
           ui.notifications.warn("Aucun token sélectionné pour la canalisation.");
           return;
         }

         await FFdreameZonesCanalisation.toggleZone(this.actor, technique, tokenLanceur);
         return; // Ne pas continuer avec l'utilisation normale
       }

       // ... reste du gestionnaire pour les techniques normales
     }


   4. APPLIQUER LA RÉDUCTION DE DÉGÂTS (appliquerBufD)
   -----------------------------------------------------
   Quand vous appliquez des dégâts à un acteur (ex: _appliquerDegats),
   avant de mettre à jour les PV :

     async _appliquerDegats(acteur, degats) {
       // Réduction éventuelle via zone de canalisation
       const degatsFinaux = FFdreameZonesCanalisation.appliquerBufD(degats, acteur);

       const pvActuel = acteur.system.aptitudes.pv.value;
       const pvNouveau = Math.max(0, pvActuel - degatsFinaux);
       await acteur.update({ "system.aptitudes.pv.value": pvNouveau });
     }


   5. APPLIQUER LA RÉDUCTION DE JET (appliquerBufJ)
   --------------------------------------------------
   Quand vous effectuez un jet de dés pour un acteur, après avoir obtenu le
   résultat brut :

     async _effectuerJet(acteur, formuleDes) {
       const roll = await new Roll(formuleDes).evaluate();
       let resultat = roll.total;

       // Réduction éventuelle via zone de canalisation (bufj)
       resultat = FFdreameZonesCanalisation.appliquerBufJ(resultat, acteur);

       // ... utiliser resultat pour la suite
     }


   6. PASSER isZoneActive AU TEMPLATE (getData)
   ---------------------------------------------
   Dans la méthode getData() de votre ActorSheet, ajoutez :

     async getData(options = {}) {
       const data = await super.getData(options);

       // Zone de canalisation active ?
       data.isZoneActive = FFdreameZonesCanalisation.zoneActiveFor(this.actor);

       return data;
     }

   Puis dans votre template Handlebars (ex: actor-sheet.hbs), vous pouvez
   afficher un indicateur sur le bouton de la technique canalisation :

     {{#if isZoneActive}}
       <span class="zone-active-indicator">Zone active</span>
     {{/if}}

   Ou conditionner l'apparence du bouton :

     <button class="technique-btn {{#if isZoneActive}}active{{/if}}"
             data-technique-id="{{id}}">
       {{name}}
     </button>

   ============================================================ */
