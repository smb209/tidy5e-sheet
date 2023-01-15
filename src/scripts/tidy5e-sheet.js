// import { tidy5eSettings } from "./app/settings.js";
import { Tidy5eUserSettings } from "./app/settings.js";

import { preloadTidy5eHandlebarsTemplates } from "./app/tidy5e-templates.js";
import { tidy5eListeners } from "./app/listeners.js";
import { tidy5eContextMenu } from "./app/context-menu.js";
import { tidy5eSearchFilter } from "./app/search-filter.js";
import { addFavorites } from "./app/tidy5e-favorites.js";
import { tidy5eClassicControls } from "./app/classic-controls.js";
import { tidy5eShowActorArt } from "./app/show-actor-art.js";
import { tidy5eItemCard } from "./app/itemcard.js";
import { tidy5eAmmoSwitch } from "./app/ammo-switch.js";
import { applyLazyMoney } from "./app/lazymoney.js";
import { applyLazyExp, applyLazyHp } from "./app/lazyExpAndHp.js";
import { applyLocksCharacterSheet } from "./app/lockers.js";
import { applySpellClassFilterActorSheet } from "./app/spellClassFilter.js";

let position = 0;

export class Tidy5eSheet extends dnd5e.applications.actor
  .ActorSheet5eCharacter {
  get template() {
    if (
      !game.user.isGM &&
      this.actor.limited &&
      !game.settings.get("tidy5e-sheet", "expandedSheetEnabled")
    )
      return "modules/tidy5e-sheet/templates/actors/tidy5e-sheet-ltd.html";
    return "modules/tidy5e-sheet/templates/actors/tidy5e-sheet.html";
  }

  static get defaultOptions() {
    let defaultTab = game.settings.get("tidy5e-sheet", "defaultActionsTab") != 'default'
      ? game.settings.get("tidy5e-sheet", "defaultActionsTab")
      : 'attributes' ;
		if (!game.modules.get('character-actions-list-5e')?.active &&
      game.settings.get("tidy5e-sheet", "defaultActionsTab") == 'actions') {
      defaultTab = 'attributes';
    }
    return mergeObject(super.defaultOptions, {
      classes: ["tidy5e", "sheet", "actor", "character"],
      blockFavTab: true,
      width: game.settings.get("tidy5e-sheet", "playerSheetWidth") ?? 740,
      height: 840,
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".sheet-body",
          initial: defaultTab,
        },
      ],
    });
  }

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  async getData() {
    const context = await super.getData();

    Object.keys(context.abilities).forEach((id) => {
      context.abilities[id].abbr = CONFIG.DND5E.abilityAbbreviations[id];
    });

    // Journal HTML enrichment
    context.journalHTML = await TextEditor.enrichHTML(context.actor.flags['tidy5e-sheet']?.details?.notes?.value, {
      secrets: this.actor.isOwner,
      rollData: context.rollData,
      async: true,
      relativeTo: this.actor
    });

    context.appId = this.appId;
    context.allowCantripToBePreparedOnContext = game.settings.get("tidy5e-sheet", "allowCantripToBePreparedOnContext");
    return context;
  }

  _createEditor(target, editorOptions, initialContent) {
    editorOptions.min_height = 200;
    super._createEditor(target, editorOptions, initialContent);
  }

  // save all simultaneously open editor field when one field is saved
  async _onEditorSave(target, element, content) {
    return this.submit();
  }

  activateListeners(html) {
    super.activateListeners(html);

    let actor = this.actor;

    tidy5eListeners(html, actor);
    tidy5eContextMenu(html);
    tidy5eSearchFilter(html, actor);
    tidy5eShowActorArt(html, actor);
    tidy5eItemCard(html, actor);
    tidy5eAmmoSwitch(html, actor);

    // store Scroll Pos
    const attributesTab = html.find(".tab.attributes");
    attributesTab.scroll(function () {
      position = this.scrollPos = { top: attributesTab.scrollTop() };
    });
    let tabNav = html.find('a.item:not([data-tab="attributes"])');
    tabNav.click(function () {
      this.scrollPos = { top: 0 };
      attributesTab.scrollTop(0);
    });

    // toggle inventory layout
    html.find(".toggle-layout.inventory-layout").click(async (event) => {
      event.preventDefault();

      if ($(event.currentTarget).hasClass("spellbook-layout")) {
        if (actor.getFlag("tidy5e-sheet", "spellbook-grid")) {
          await actor.unsetFlag("tidy5e-sheet", "spellbook-grid");
        } else {
          await actor.setFlag("tidy5e-sheet", "spellbook-grid", true);
        }
      } else {
        if (actor.getFlag("tidy5e-sheet", "inventory-grid")) {
          await actor.unsetFlag("tidy5e-sheet", "inventory-grid");
        } else {
          await actor.setFlag("tidy5e-sheet", "inventory-grid", true);
        }
      }
    });

    // toggle traits
    html.find(".traits-toggle").click(async (event) => {
      event.preventDefault();

      if (actor.getFlag("tidy5e-sheet", "traits-compressed")) {
        await actor.unsetFlag("tidy5e-sheet", "traits-compressed");
      } else {
        await actor.setFlag("tidy5e-sheet", "traits-compressed", true);
      }
    });

    // set exhaustion level with portrait icon
    html.find(".exhaust-level li").click(async (event) => {
      event.preventDefault();
      let target = event.currentTarget;
      let value = Number(target.dataset.elvl);
      await actor.update({ "system.attributes.exhaustion": value });
    });

    // changing item qty and charges values (removing if both value and max are 0)
    html.find(".item:not(.items-header) input").change((event) => {
      let value = event.target.value;
      let itemId = $(event.target).parents(".item")[0].dataset.itemId;
      let path = event.target.dataset.path;
      let data = {};
      data[path] = Number(event.target.value);
      actor.items.get(itemId).update(data);
    });

    // creating charges for the item
    html.find(".inventory-list .item .addCharges").click((event) => {
      let itemId = $(event.target).parents(".item")[0].dataset.itemId;
      let item = actor.items.get(itemId);

      item.system.uses = { value: 1, max: 1 };
      let data = {};
      data["system.uses.value"] = 1;
      data["system.uses.max"] = 1;

      actor.items.get(itemId).update(data);
    });

    // toggle empty traits visibility in the traits list
    html.find(".traits .toggle-traits").click(async (event) => {
      if (actor.getFlag("tidy5e-sheet", "traitsExpanded")) {
        await actor.unsetFlag("tidy5e-sheet", "traitsExpanded");
      } else {
        await actor.setFlag("tidy5e-sheet", "traitsExpanded", true);
      }
    });

    // update item attunement

    html.find(".item-control.item-attunement").click(async (event) => {
      event.preventDefault();
      let li = $(event.currentTarget).closest(".item"),
        item = actor.items.get(li.data("item-id")),
        count = actor.system.attributes.attunement.value;

      if (item.system.attunement == 2) {
        actor.items.get(li.data("item-id")).update({ "system.attunement": 1 });
      } else {
        if (count >= actor.system.attributes.attunement.max) {
          ui.notifications.warn(
            `${game.i18n.format("TIDY5E.AttunementWarning", { number: count })}`
          );
        } else {
          actor.items
            .get(li.data("item-id"))
            .update({ "system.attunement": 2 });
        }
      }
    });
  }

  // add actions module
  async _renderInner(...args) {
    const html = await super._renderInner(...args);
    const actionsListApi = game.modules.get("character-actions-list-5e")?.api;
    let injectCharacterSheet;
    if (game.modules.get("character-actions-list-5e")?.active)
      injectCharacterSheet = game.settings.get(
        "character-actions-list-5e",
        "inject-characters"
      );

    try {
      if (
        game.modules.get("character-actions-list-5e")?.active &&
        injectCharacterSheet
      ) {
        // Update the nav menu
        const actionsTabButton = $(
          '<a class="item" data-tab="actions">' +
            game.i18n.localize(`DND5E.ActionPl`) +
            "</a>"
        );
        const tabs = html.find('.tabs[data-group="primary"]');
        tabs.prepend(actionsTabButton);

        // Create the tab
        const sheetBody = html.find(".sheet-body");
        const actionsTab = $(
          `<div class="tab actions" data-group="primary" data-tab="actions"></div>`
        );
        const actionsLayout = $(`<div class="list-layout"></div>`);
        actionsTab.append(actionsLayout);
        sheetBody.prepend(actionsTab);

        // const actionsTab = html.find('.actions-target');

        const actionsTabHtml = $(
          await actionsListApi.renderActionsList(this.actor)
        );
        actionsLayout.html(actionsTabHtml);
      }
    } catch (e) {
      // log(true, e);
    }

    return html;
  }
}

// count inventory items
async function countInventoryItems(app, html, data) {
  if (game.user.isGM) {
    html.find(".attuned-items-counter").addClass("isGM");
  }
  html.find(".tab.inventory .item-list").each(function () {
    let itemlist = this;
    let items = $(itemlist).find("li");
    let itemCount = items.length - 1;
    $(itemlist)
      .prev(".items-header")
      .find(".item-name")
      .append(" (" + itemCount + ")");
  });
}

// count attuned items
async function countAttunedItems(app, html, data) {
  const actor = app.actor;
  const count = actor.system.attributes.attunement.value;
  if (
    actor.system.attributes.attunement.value >
    actor.system.attributes.attunement.max
  ) {
    html.find(".attuned-items-counter").addClass("overattuned");
    ui.notifications.warn(
      `${game.i18n.format("TIDY5E.AttunementWarning", { number: count })}`
    );
  }
}

// handle traits list display
async function toggleTraitsList(app, html, data) {
  html
    .find(".traits:not(.always-visible):not(.expanded) .form-group.inactive")
    .remove();
}

// Check Death Save Status
async function checkDeathSaveStatus(app, html, data) {
  if (data.editable) {
    // var actor = game.actors.entities.find(a => a.data._id === data.actor._id);
    let actor = app.actor;
    var currentHealth = actor.system.attributes.hp.value;
    var deathSaveSuccess = actor.system.attributes.death.success;
    var deathSaveFailure = actor.system.attributes.death.failure;

    // console.log(`current HP: ${currentHealth}, success: ${deathSaveSuccess}, failure: ${deathSaveFailure}`);
    if (currentHealth <= 0) {
      html.find(".tidy5e-sheet .profile").addClass("dead");
    }

    if (
      (currentHealth > 0 && deathSaveSuccess != 0) ||
      (currentHealth > 0 && deathSaveFailure != 0)
    ) {
      await actor.update({ "system.attributes.death.success": 0 });
      await actor.update({ "system.attributes.death.failure": 0 });
    }
  }
}

// Edit Protection - Hide empty Inventory Sections, Effects aswell as add and delete-buttons
async function editProtection(app, html, data) {
  let actor = app.actor;
  if (
    game.user.isGM &&
    game.settings.get("tidy5e-sheet", "editGmAlwaysEnabled")
  ) {
    html.find(".classic-controls").addClass("gmEdit");
  } else if (!actor.getFlag("tidy5e-sheet", "allow-edit")) {
    /* MOVED TO LOCKERS.JS
    if (game.settings.get("tidy5e-sheet", "editTotalLockEnabled")) {
      html.find(".skill input").prop("disabled", true);
      html.find(".skill .config-button").remove();
      // html.find(".skill .proficiency-toggle").remove();
      html.find(".skill .proficiency-toggle").removeClass("proficiency-toggle");
      html.find(".ability-score").prop("disabled", true);
      html.find(".ac-display input").prop("disabled", true);
      html.find(".initiative input").prop("disabled", true);
      html.find(".hp-max").prop("disabled", true);
      html.find(".resource-name input").prop("disabled", true);
      html.find(".res-max").prop("disabled", true);
      html.find(".res-options").remove();
      html.find(".ability-modifiers .proficiency-toggle").remove();
      html.find(".ability .config-button").remove();
      html
        .find(
          ".traits .config-button,.traits .trait-selector,.traits .proficiency-selector"
        )
        .remove();
      html.find("[contenteditable]").prop("contenteditable", false);
      html.find(".spellbook .slot-max-override").remove();
      html.find(".spellcasting-attribute select").prop("disabled", true);
      const spellbook = html.find(
        ".spellbook .inventory-list .item-list"
      ).length;
      if (spellbook == 0) html.find(".item[data-tab='spellbook']").remove();
    }
    */

    let resourcesUsed = 0;
    html.find('.resources input[type="text"]').each(function () {
      if ($(this).val() != "") {
        resourcesUsed++;
      }
    });
    if (resourcesUsed == 0) html.find(".resources").hide();

    let itemContainer = html.find(
      ".inventory-list.items-list, .effects-list.items-list"
    );
    html
      .find(
        ".inventory-list .items-header:not(.spellbook-header), .effects-list .items-header"
      )
      .each(function () {
        if (
          $(this).next(".item-list").find("li").length -
            $(this).next(".item-list").find("li.items-footer").length ==
          0
        ) {
          $(this).next(".item-list").addClass("hidden").hide();
          $(this).addClass("hidden").hide();
        }
      });

    html.find(".inventory-list .items-footer").addClass("hidden").hide();
    html.find(".inventory-list .item-control.item-delete").remove();

    if (
      game.settings.get("tidy5e-sheet", "editEffectsGmOnlyEnabled") &&
      !game.user.isGM
    ) {
      html
        .find(".effects-list .items-footer, .effects-list .effect-controls")
        .remove();
    } else {
      html
        .find(
          ".effects-list .items-footer, .effects-list .effect-control.effect-delete"
        )
        .remove();
    }

    itemContainer.each(function () {
      let hiddenSections = $(this).find("> .hidden").length;
      let totalSections = $(this).children().not(".notice").length;
      // console.log('hidden: '+ hiddenSections + '/ total: '+totalSections);
      if (hiddenSections >= totalSections) {
        if (
          $(this).hasClass("effects-list") &&
          !game.user.isGM &&
          game.settings.get("tidy5e-sheet", "editEffectsGmOnlyEnabled")
        ) {
          $(this).prepend(
            `<span class="notice">${game.i18n.localize(
              "TIDY5E.GmOnlyEdit"
            )}</span>`
          );
        } else {
          $(this).append(
            `<span class="notice">${game.i18n.localize(
              "TIDY5E.EmptySection"
            )}</span>`
          );
        }
      }
    });
  } else if (
    !game.user.isGM &&
    actor.getFlag("tidy5e-sheet", "allow-edit") &&
    game.settings.get("tidy5e-sheet", "editEffectsGmOnlyEnabled")
  ) {
    let itemContainer = html.find(".effects-list.items-list");

    itemContainer.prepend(
      `<span class="notice">${game.i18n.localize("TIDY5E.GmOnlyEdit")}</span>`
    );
    html
      .find(".effects-list .items-footer, .effects-list .effect-controls")
      .remove();

    html.find(".effects-list .items-header").each(function () {
      if ($(this).next(".item-list").find("li").length < 1) {
        $(this).next(".item-list").addClass("hidden").hide();
        $(this).addClass("hidden").hide();
      }
    });
  }
}

// Add Character Class List
async function addClassList(app, html, data) {
  if (data.editable) {
    if (!game.settings.get("tidy5e-sheet", "classListDisabled")) {
      // let actor = game.actors.entities.find(a => a.data._id === data.actor._id);
      let actor = app.actor;
      let classList = [];
      let items = data.actor.items;
      for (let item of items) {
        if (item.type === "class") {
          let levels = item.system.levels
            ? `<span class="levels-info">${item.system.levels}</span>`
            : ``;
          classList.push(item.name + levels);
        }
        if (item.type === "subclass") {
          classList.push(item.name);
        }
      }
      classList =
        "<ul class='class-list'><li class='class-item'>" +
        classList.join("</li><li class='class-item'>") +
        "</li></ul>";
      mergeObject(actor, { "flags.tidy5e-sheet.classlist": classList });
      let classListTarget = html.find(".bonus-information");
      classListTarget.append(classList);
    }
  }
}

// Calculate Spell Attack modifier

async function spellAttackMod(app, html, data) {
  let actor = app.actor,
    prof = actor.system.attributes.prof,
    spellAbility = html
      .find(".spellcasting-attribute select option:selected")
      .val(),
    abilityMod =
      spellAbility != "" ? actor.system.abilities[spellAbility].mod : 0,
    spellBonus = 0;
  // console.log('Prof: '+prof+ '/ Spell Ability: '+spellAbility+ '/ ability Mod: '+abilityMod+'/ Spell Attack Mod:'+spellAttackMod);

  const rollData = actor.getRollData();
  let formula = Roll.replaceFormulaData(
    actor.system.bonuses.rsak.attack,
    rollData,
    { missing: 0, warn: false }
  );
  if (formula === "") formula = "0";
  try {
    // Roll parser no longer accepts some expressions it used to so we will try and avoid using it
    spellBonus = Roll.safeEval(formula);
  } catch (err) {
    // safeEval failed try a roll
    try {
      spellBonus = new Roll(formula).evaluate({ async: false }).total;
    } catch (err) {
      console.warn("spell bonus calculation failed");
      console.warn(err);
    }
  }

  let spellAttackMod = prof + abilityMod + spellBonus,
    text = spellAttackMod > 0 ? "+" + spellAttackMod : spellAttackMod;
  html.find(".spell-mod .spell-attack-mod").html(text);
  html
    .find(".spell-mod .spell-attack-mod")
    .attr(
      "title",
      `${prof} (prof.)+${abilityMod} (${spellAbility})+${formula} (bonus)`
    );
}

// Abbreviate Currency
async function abbreviateCurrency(app, html, data) {
  html.find(".currency .currency-item label").each(function () {
    let currency = $(this).data("denom").toUpperCase();
    // console.log('Currency Abbr: '+CONFIG.DND5E.currencies[currency].abbreviation);
    // let abbr = CONFIG.DND5E.currencies[currency].abbreviation;
    // if(abbr == CONFIG.DND5E.currencies[currency].abbreviation){
    // 	abbr = currency;
    // }
    let abbr = game.i18n.localize(`DND5E.CurrencyAbbr${currency}`);
    if (abbr == `DND5E.CurrencyAbbr${currency}`) {
      abbr = currency;
    }

    $(this).html(abbr);
  });
}

// transform DAE formulas for maxPreparesSpells
async function tidyCustomEffect(actor, change) {
  if (change.key !== "system.details.maxPreparedSpells") {
    return;
  }
  if (change.value?.length > 0) {
    let oldValue = getProperty(actor.system, change.key) || 0;
    let changeText = change.value.trim();
    let op = "none";
    if (["+", "-", "/", "*", "="].includes(changeText[0])) {
      op = changeText[0];
      changeText = changeText.slice(1);
    }
    const rollData = actor.getRollData();
    Object.keys(rollData.abilities).forEach((abl) => {
      rollData.abilities[abl].mod = Math.floor(
        (rollData.abilities[abl].value - 10) / 2
      );
    });
    // const value = new Roll(changeText, rollData).roll().total;
    const roll_value = await new Roll(changeText, rollData).roll();
    const value = roll_value.total;
    oldValue = Number.isNumeric(oldValue) ? parseInt(oldValue) : 0;
    switch (op) {
      case "+":
        return setProperty(actor.system, change.key, oldValue + value);
      case "-":
        return setProperty(actor.system, change.key, oldValue - value);
      case "*":
        return setProperty(actor.system, change.key, oldValue * value);
      case "/":
        return setProperty(actor.system, change.key, oldValue / value);
      case "=":
        return setProperty(actor.system, change.key, value);
      default:
        return setProperty(actor.system, change.key, value);
    }
  }
}

// add active effects marker
function markActiveEffects(app, html, data) {
  if (game.settings.get("tidy5e-sheet", "activeEffectsMarker")) {
    let actor = app.actor;
    let items = data.actor.items;
    let marker = `<span class="ae-marker" title="Item has active effects">Æ</span>`;
    for (let item of items) {
      // console.log(item);
      if (item.effects.length > 0) {
        // console.log(item);
        let id = item._id;
        // console.log(id);
        html.find(`.item[data-item-id="${id}"] .item-name h4`).append(marker);
      }
    }
  }
}

// Add Spell Slot Marker
function spellSlotMarker(app, html, data) {
  if(game.settings.get("tidy5e-sheet", "hideSpellSlotMarker")){
    return;
  }
  let actor = app.actor;
  let items = data.actor.items;
  let options = [
    "pact",
    "spell1",
    "spell2",
    "spell3",
    "spell4",
    "spell5",
    "spell6",
    "spell7",
    "spell8",
    "spell9",
  ];
  for (let o of options) {
    let max = html.find(`.spell-max[data-level=${o}]`);
    let name = max.closest(".spell-slots");
    let spellData = actor.system.spells[o];
    if (spellData.max === 0) {
      continue;
    }
    let contents = ``;
    for (let i = 1; i <= spellData.max; i++) {
      if (i <= spellData.value) {
        contents += `<span class="dot"></span>`;
      } else {
        contents += `<span class="dot empty"></span>`;
      }
    }
    name.before(`<div class="spellSlotMarker">${contents}</div>`);
  }

  html.find(".spellSlotMarker .dot").mouseenter((ev) => {
    const parentEl = ev.currentTarget.parentElement;
    const index = [...parentEl.children].indexOf(ev.currentTarget);
    const dots = parentEl.querySelectorAll(".dot");

    if (ev.currentTarget.classList.contains("empty")) {
      for (let i = 0; i < dots.length; i++) {
        if (i <= index) {
          dots[i].classList.contains("empty")
            ? dots[i].classList.add("change")
            : "";
        }
      }
    } else {
      for (let i = 0; i < dots.length; i++) {
        if (i >= index) {
          dots[i].classList.contains("empty")
            ? ""
            : dots[i].classList.add("change");
        }
      }
    }
  });

  html.find(".spellSlotMarker .dot").mouseleave((ev) => {
    const parentEl = ev.currentTarget.parentElement;
    $(parentEl).find(".dot").removeClass("change");
  });

  html.find(".spellSlotMarker .dot").click(async (ev) => {
    const index = [...ev.currentTarget.parentElement.children].indexOf(
      ev.currentTarget
    );
    const slots = $(ev.currentTarget).parents(".spell-level-slots");
    const spellLevel = slots.find(".spell-max").data("level");
    // console.log(spellLevel, index);
    if (spellLevel) {
      let path = `data.spells.${spellLevel}.value`;
      if (ev.currentTarget.classList.contains("empty")) {
        await actor.update({
          [path]: index + 1,
        });
      } else {
        await actor.update({
          [path]: index,
        });
      }
    }
  });
}

// Hide Standard Encumbrance Bar
function hideStandardEncumbranceBar(app, html, data) {
  if(!game.settings.get("tidy5e-sheet", "hideStandardEncumbranceBar")){
    return;
  }
  const elements = html.find(".encumbrance");
  if (elements && elements.length > 0) {
    for(const elem of elements) {
      elem.style.display = "none";
    }
  }
}

// Manage Sheet Options
async function setSheetClasses(app, html, data) {
  // let actor = game.actors.entities.find(a => a.data._id === data.actor._id);
  let actor = app.actor;
  if (!game.settings.get("tidy5e-sheet", "playerNameEnabled")) {
    html.find(".tidy5e-sheet #playerName").remove();
  }
  if (game.settings.get("tidy5e-sheet", "journalTabDisabled")) {
    html
      .find('.tidy5e-sheet .tidy5e-navigation a[data-tab="journal"]')
      .remove();
  }
  if (game.settings.get("tidy5e-sheet", "rightClickDisabled")) {
    if (game.settings.get("tidy5e-sheet", "classicControlsEnabled")) {
      html
        .find(".tidy5e-sheet .grid-layout .items-list")
        .addClass("alt-context");
    } else {
      html.find(".tidy5e-sheet .items-list").addClass("alt-context");
    }
  }
  if (game.settings.get("tidy5e-sheet", "classicControlsEnabled")) {
    tidy5eClassicControls(html);
  }
  if (
    game.settings.get("tidy5e-sheet", "portraitStyle") == "pc" ||
    game.settings.get("tidy5e-sheet", "portraitStyle") == "all"
  ) {
    html.find(".tidy5e-sheet .profile").addClass("roundPortrait");
  }
  if (game.settings.get("tidy5e-sheet", "hpOverlayDisabled")) {
    html.find(".tidy5e-sheet .profile").addClass("disable-hp-overlay");
  }
  if (game.settings.get("tidy5e-sheet", "hpBarDisabled")) {
    html.find(".tidy5e-sheet .profile").addClass("disable-hp-bar");
  }
  if (game.settings.get("tidy5e-sheet", "inspirationDisabled")) {
    html.find(".tidy5e-sheet .profile .inspiration").remove();
  }
  if (game.settings.get("tidy5e-sheet", "inspirationAnimationDisabled")) {
    html
      .find(".tidy5e-sheet .profile .inspiration label i")
      .addClass("disable-animation");
  }
  if (game.settings.get("tidy5e-sheet", "hpOverlayBorder") > 0) {
    $(".system-dnd5e")
      .get(0)
      .style.setProperty(
        "--pc-border",
        game.settings.get("tidy5e-sheet", "hpOverlayBorder") + "px"
      );
  } else {
    $(".system-dnd5e").get(0).style.removeProperty("--pc-border");
  }
  if (game.settings.get("tidy5e-sheet", "hideIfZero")) {
    html.find(".tidy5e-sheet .profile").addClass("autohide");
  }
  if (game.settings.get("tidy5e-sheet", "exhaustionDisabled")) {
    html.find(".tidy5e-sheet .profile .exhaustion-container").remove();
  }
  if (game.settings.get("tidy5e-sheet", "exhaustionOnHover")) {
    html.find(".tidy5e-sheet .profile").addClass("exhaustionOnHover");
  }

  if (game.settings.get("tidy5e-sheet", "inspirationOnHover")) {
    html.find(".tidy5e-sheet .profile").addClass("inspirationOnHover");
  }
  if (game.settings.get("tidy5e-sheet", "traitsMovedBelowResource")) {
    let altPos = html.find(".alt-trait-pos");
    let traits = html.find(".traits");
    altPos.append(traits);
  }
  if (!game.settings.get("tidy5e-sheet", "traitsTogglePc")) {
    html.find(".tidy5e-sheet .traits").addClass("always-visible");
  }
  if (game.settings.get("tidy5e-sheet", "traitLabelsEnabled")) {
    html.find(".tidy5e-sheet .traits").addClass("show-labels");
  }
  if (game.user.isGM) {
    html.find(".tidy5e-sheet").addClass("isGM");
  }
  if (
    game.settings.get("tidy5e-sheet", "hiddenDeathSavesEnabled") &&
    !game.user.isGM
  ) {
    html.find(".tidy5e-sheet .death-saves").addClass("gmOnly");
  }
  if (game.settings.get("tidy5e-sheet", "quantityAlwaysShownEnabled")) {
    html.find(".item").addClass("quantityAlwaysShownEnabled");
  }
  $(".info-card-hint .key").html(
    game.settings.get("tidy5e-sheet", "itemCardsFixKey")
  );
}

// Preload tidy5e Handlebars Templates
Hooks.once("init", () => {
  preloadTidy5eHandlebarsTemplates();
  Hooks.on("applyActiveEffect", tidyCustomEffect);

  // init user settings menu
  Tidy5eUserSettings.init();
});

// Register Tidy5e Sheet and make default character sheet
Actors.registerSheet("dnd5e", Tidy5eSheet, {
  types: ["character"],
  makeDefault: true,
});

Hooks.on("renderTidy5eSheet", (app, html, data) => {
  setSheetClasses(app, html, data);
  editProtection(app, html, data);
  addClassList(app, html, data);
  toggleTraitsList(app, html, data);
  checkDeathSaveStatus(app, html, data);
  abbreviateCurrency(app, html, data);
  spellAttackMod(app, html, data);
  addFavorites(app, html, data, position);
  countAttunedItems(app, html, data);
  countInventoryItems(app, html, data);
  markActiveEffects(app, html, data);
  spellSlotMarker(app, html, data);
  hideStandardEncumbranceBar(app, html, data);
  applyLazyMoney(app, html, data);
  applyLazyExp(app, html, data);
  applyLazyHp(app, html, data);
  applySpellClassFilterActorSheet(app, html, data);
  // console.log(data.actor);
  // console.log("Tidy5e Sheet rendered!");

  // NOTE LOCKS ARE THE LAST THING TO SET
  applyLocksCharacterSheet(app, html, data);
});

Hooks.once("ready", (app, html, data) => {
  // console.log("Tidy5e Sheet is ready!");
});

Hooks.on('renderAbilityUseDialog', (application, html, context) => {

  if (application?.item?.type != 'spell') {
    return; // Nevermind if this isn't a spell
  }
  if (html.find('[name="consumeSpellSlot"]').length == 0) {
    return;
  }

  // TODO Integration checkbox upcast (ty to mxzf on discord )
  /*
  // Add a new checkbox and insert it at the end of the list
  let new_checkbox = $('<div class="form-group"><label class="checkbox"><input type="checkbox" name="freeUpcast"="">Level Bump</label></div>')
  new_checkbox.insertAfter(html.find('.form-group').last())
  // Bind a change handler to the new checkbox to increment/decrement the options in the dropdown
  // This is so that dnd5e will scale the spell up under the hood as-if it's upcast
  new_checkbox.change(ev => {
    if (ev.target.checked) {
      Object.values(html.find('[name="consumeSpellLevel"] option')).map(o => {
        if (o.value === 'pact') o.value = String(application.item.actor.system.spells.pact.level+1)
        else o.value = String(parseInt(o.value)+1)

      })
    } else {
      Object.values(html.find('[name="consumeSpellLevel"] option')).map(o => {
          if (o.text.includes('Pact')) o.value = 'pact'
          else o.value = String(parseInt(o.value)-1)
      })
    }
  })
  application.setPosition({height:'auto'}) // Reset the height of the window to match the new content
})
  Hooks.on('dnd5e.preItemUsageConsumption', (item,config,options) => {
    // If the checkbox is checked, drop the spell level used to calculate the slot cost by 1
    if (config?.freeUpcast) {
      if (item.system.preparation.mode === 'pact') config.consumeSpellLevel = 'pact'
      else config.consumeSpellLevel = String(parseInt(config.consumeSpellLevel)-1)
    }
  });
  */
  if(game.settings.get("tidy5e-sheet", "enableSpellLevelButtons") &&
    // The module already do the job so for avoid redundance...
    !game.modules.get('spell-level-buttons-for-dnd5e')?.active) {

    const options = application;

    if($('.dnd5e.dialog #ability-use-form select[name="consumeSpellLevel"]').length > 0) { // If the dialog box has a option to select a spell level

        // Resize the window to fit the contents
        let originalWindowHeight = parseInt($(options._element[0]).css('height'));
        let heightOffset = 42;

        $(options._element[0]).height(originalWindowHeight + heightOffset);

        // Find the label that says "Cast at level", and select it's parent parent (There's no specific class or ID for this wrapper)
        let levelSelectWrapper = $(options._element[0]).find(`.form-group label:contains("${game.i18n.localize(`DND5E.SpellCastUpcast`)}")`).parent();
        let selectedLevel = levelSelectWrapper.find('select').val();

        let appId = options.appId;

        // Hide the default level select menu
        levelSelectWrapper.css('display', 'none');

        // Append a container for the buttons
        levelSelectWrapper.after(`
            <div class="form-group spell-lvl-btn">
                <label>${game.i18n.localize(`DND5E.SpellCastUpcast`)}</label>
                <div class="form-fields"></div>
            </div>
        `);

        // Append a button for each spell level that the user can cast
        $(options._element[0]).find(`select[name="consumeSpellLevel"] option`).each(function() {

            let availableTextSlotsFounded = $(this).text().match(/\(\d+\s\w+\)/);
            if(!availableTextSlotsFounded){
              availableTextSlotsFounded = $(this).text().match(/\d+/g);
              const lastMatch = availableTextSlotsFounded[availableTextSlotsFounded.length-1];
              if(lastMatch) {
                availableTextSlotsFounded = lastMatch;
              }
            }

            if(!availableTextSlotsFounded){
              console.warn(`Cannot find the spell slots on text '${$(this).text()}' with ${/\(\d+\s\w+\)/}`);
            }
            let availableSlotsFounded =  availableTextSlotsFounded ?  availableTextSlotsFounded[0].match(/\d+/) : undefined;
            if(!availableSlotsFounded){
              console.warn(`Cannot find the spell slots on text '${$(this).text()}' with ${/\d+/}`);
            }
            let availableSlots = availableSlotsFounded ? availableSlotsFounded[0] : 0;
            let availableSlotsBadge = '';
            let value = $(this).val();
            let i;

            if(value == "pact") {
              // i = "p" + $(this).text().match(/\d/)[0]; // Get the pact slot level
              let availablePactSlotsFounded = $(this).text().match(/\d/);
              if(!availablePactSlotsFounded){
                console.warn(`Cannot find the pact slots on text '${$(this).text()}' with ${/\d/}`);
              }
              if(availablePactSlotsFounded) {
                i = "p" + availablePactSlotsFounded[0]; // Get the pact slot level
              } else {
                i = "p" + 0;
              }
            } else {
              i = value;
            }

            if(availableSlots > 0) {
                availableSlotsBadge = `<span class="available-slots">${availableSlots}</span>`;
            }

            $(options._element[0]).find('.spell-lvl-btn .form-fields').append(`
                <label title="${$(this).text()}" class="spell-lvl-btn__label" for="${appId}lvl-btn-${i}">
                    <input type="radio" id="${appId}lvl-btn-${i}" name="lvl-btn" value="${value}">
                    <div class="spell-lvl-btn__btn">${i}</div>
                    ${availableSlotsBadge}
                </label>
            `);
        });

        // Click on the button corresponding to the default value on the cast level dropdown menu
        $(options._element[0]).find(`#${appId}lvl-btn-${selectedLevel}`).trigger('click');

        // Change the dropdown menu value when user clicks on a button
        $(options._element[0]).find('.spell-lvl-btn__label').on('click', function() {
            levelSelectWrapper.find('select').val( $(this).find('input').val() );
        });

    }
  }
});
