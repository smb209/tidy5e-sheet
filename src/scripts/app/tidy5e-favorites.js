/*
 * This file and its functions are
 * adapted for the Tidy5eSheet from
 * FavTab Module version 0.5.4
 * by Felix M�ller aka syl3r96
 * (Felix#6196 on Discord).
 *
 * It is licensed under a
 * Creative Commons Attribution 4.0 International License
 * and can be found at https://github.com/syl3r86/favtab.
 */

import { tidy5eContextMenu } from "./context-menu.js";

export const addFavorites = async function (app, html, data, position) {
  // creating the favourite tab and loading favourited items
  let favMarker = $('<i class="fas fa-bookmark"></i>');

  let favItems = [];
  let favFeats = [];
  let favSpellsPrepMode = {
    atwill: {
      isAtWill: true,
      spells: [],
    },
    innate: {
      isInnate: true,
      spells: [],
    },
    pact: {
      isPact: true,
      spells: [],
      value: data.actor.system.spells.pact.value,
      max: data.actor.system.spells.pact.max,
    },
  };
  let favSpells = {
    0: {
      isCantrip: true,
      spells: [],
    },
    1: {
      spells: [],
      value: data.actor.system.spells.spell1.value,
      max: data.actor.system.spells.spell1.max,
    },
    2: {
      spells: [],
      value: data.actor.system.spells.spell2.value,
      max: data.actor.system.spells.spell2.max,
    },
    3: {
      spells: [],
      value: data.actor.system.spells.spell3.value,
      max: data.actor.system.spells.spell3.max,
    },
    4: {
      spells: [],
      value: data.actor.system.spells.spell4.value,
      max: data.actor.system.spells.spell4.max,
    },
    5: {
      spells: [],
      value: data.actor.system.spells.spell5.value,
      max: data.actor.system.spells.spell5.max,
    },
    6: {
      spells: [],
      value: data.actor.system.spells.spell6.value,
      max: data.actor.system.spells.spell6.max,
    },
    7: {
      spells: [],
      value: data.actor.system.spells.spell7.value,
      max: data.actor.system.spells.spell7.max,
    },
    8: {
      spells: [],
      value: data.actor.system.spells.spell8.value,
      max: data.actor.system.spells.spell8.max,
    },
    9: {
      spells: [],
      value: data.actor.system.spells.spell9.value,
      max: data.actor.system.spells.spell9.max,
    },
  };

  let spellCount = 0;
  let spellPrepModeCount = 0;
  let items = data.items;

  let renderFavTab = false;

  // processing all items and put them in their respective lists if they're favorited
  for (let item of items) {
    item.owner = app.actor.isOwner;

    // do not add the fav button for class items
    if (item.type == "class") continue;

    item.notFeat = true;
    if (item.type == "feat") {
      item.notFeat = false;
    }

    // making sure the flag to set favorites exists
    if (
      item.flags.favtab === undefined ||
      item.flags.favtab.isFavorite === undefined
    ) {
      item.flags.favtab = { isFavorite: false };
      // DO NOT SAVE AT THIS POINT! saving for each and every item creates unneeded data and hogs the system
      //app.actor.updateOwnedItem(item, true);
    }
    let isFav = item.flags.favtab.isFavorite;

    // add button to toggle favorite of the item in their native tab
    if (app.options.editable) {
      let favBtn = $(
        `<a class="item-control item-fav ${isFav ? "active" : ""}" title="${
          isFav
            ? game.i18n.localize("TIDY5E.RemoveFav")
            : game.i18n.localize("TIDY5E.AddFav")
        }" data-fav="${isFav}"><i class="${
          isFav ? "fas fa-bookmark" : "fas fa-bookmark inactive"
        }"></i> <span class="control-label">${
          isFav
            ? game.i18n.localize("TIDY5E.RemoveFav")
            : game.i18n.localize("TIDY5E.AddFav")
        }</span></a>`
      );
      favBtn.click((ev) => {
        app.actor.items
          .get(item._id)
          .update({ "flags.favtab.isFavorite": !item.flags.favtab.isFavorite });
      });
      html
        .find(`.item[data-item-id="${item._id}"]`)
        .find(".item-controls .item-edit")
        .before(favBtn);
      if (item.flags.favtab.isFavorite) {
        html.find(`.item[data-item-id="${item._id}"]`).addClass("isFav");
      }
    }

    if (isFav) {
      renderFavTab = true;

      // creating specific labels to be displayed
      let labels = {};
      let translation = {
        none: game.i18n.localize("DND5E.None"),
        action: game.i18n.localize("DND5E.Action"),
        crew: game.i18n.localize("DND5E.VehicleCrewAction"),
        bonus: game.i18n.localize("DND5E.BonusAction"),
        reaction: game.i18n.localize("DND5E.Reaction"),
        legendary: game.i18n.localize("DND5E.LegAct"),
        lair: game.i18n.localize("DND5E.LairAct"),
        special: game.i18n.localize("DND5E.Special"),
        day: game.i18n.localize("DND5E.TimeDay"),
        hour: game.i18n.localize("DND5E.TimeHour"),
        minute: game.i18n.localize("DND5E.TimeMinute"),
        reactiondamage: game.i18n.localize("midi-qol.reactionDamaged"),
        reactionmanual: game.i18n.localize("midi-qol.reactionManual"),
      };

      function translateLabels(key) {
        let string = String(key);
        return translation[string];
      }
      if (item.system.activation && item.system.activation.type) {
        let key = item.system.activation.type;
        // item.system.activation.type.capitalize()
        labels.activation = `${
          item.system.activation.cost ? item.system.activation.cost + " " : ""
        }${translateLabels(key)}`;
      }

      // is item chargeable and on Cooldown
      item.isOnCooldown = false;
      if (
        item.system.recharge &&
        item.system.recharge.value &&
        item.system.recharge.charged === false
      ) {
        item.isOnCooldown = true;
        item.labels = {
          recharge:
            game.i18n.localize("DND5E.FeatureRechargeOn") +
            " [" +
            item.system.recharge.value +
            "+]",
          rechargeValue: "[" + item.system.recharge.value + "+]",
        };
      }

      // adding info if item has quantity more than one
      item.isStack = false;
      if (item.system.quantity && item.system.quantity > 1) {
        item.isStack = true;
      }

      // adding attunement info
      item.canAttune = false;

      if (item.system.attunement) {
        if (item.system.attunement == 1 || item.system.attunement == 2) {
          item.canAttune = true;
        }
      }

      // check magic item
      item.isMagic = false;
      if (
        (item.flags.magicitems && item.flags.magicitems.enabled) ||
        (item.system.properties && item.system.properties.mgc)
      ) {
        item.isMagic = true;
      }

      let attr = item.type === "spell" ? "preparation.prepared" : "equipped";
      let isActive = getProperty(item.system, attr);
      item.toggleClass = isActive ? "active" : "";
      if (item.type === "spell") {
        if (item.system.preparation.mode == "always") {
          item.toggleTitle = game.i18n.localize("DND5E.SpellPrepAlways");
        } else {
          item.toggleTitle = game.i18n.localize(
            isActive ? "DND5E.SpellPrepared" : "DND5E.SpellUnprepared"
          );
        }
      } else {
        item.toggleTitle = game.i18n.localize(
          isActive ? "DND5E.Equipped" : "DND5E.Unequipped"
        );
      }

      item.spellComps = "";
      if (item.type === "spell" && item.system.components) {
        let comps = item.system.components;
        let v = comps.vocal ? "V" : "";
        let s = comps.somatic ? "S" : "";
        let m = comps.material ? "M" : "";
        let c = comps.concentration ? true : false;
        let r = comps.ritual ? true : false;
        item.spellComps = `${v}${s}${m}`;
        item.spellCon = c;
        item.spellRit = r;
      }

      item.favLabels = labels;

      item.editable = app.options.editable;
      switch (item.type) {
        case "feat":
          if (item.flags.favtab.sort === undefined) {
            item.flags.favtab.sort = (favFeats.count + 1) * 100000; // initial sort key if not present
          }
          item.isFeat = true;
          favFeats.push(item);
          break;
        case "spell":
          if (
            item.system.preparation.mode &&
            item.system.preparation.mode !== "prepared"
          ) {
            if (item.system.preparation.mode == "always") {
              // favSpellsPrepMode['always'].spells.push(item);
              item.canPrep = true;
              item.alwaysPrep = true;
            } else if (item.system.preparation.mode == "atwill") {
              favSpellsPrepMode["atwill"].spells.push(item);
            } else if (item.system.preparation.mode == "innate") {
              favSpellsPrepMode["innate"].spells.push(item);
            } else if (item.system.preparation.mode == "pact") {
              favSpellsPrepMode["pact"].spells.push(item);
            }
            spellPrepModeCount++;
          } else {
            item.canPrep = true;
          }
          if (item.canPrep && item.system.level) {
            favSpells[item.system.level].spells.push(item);
          } else if (item.canPrep) {
            favSpells[0].spells.push(item);
          }
          spellCount++;
          break;
        default:
          if (item.flags.favtab.sort === undefined) {
            item.flags.favtab.sort = (favItems.count + 1) * 100000; // initial sort key if not present
          }
          item.isItem = true;
          favItems.push(item);
          break;
      }
      if(item.canPrep) {
        item.canPrepare = item.system.level >= 1;
      }
    }
  }

  // sorting favSpells alphabetically
  /*
      const favSpellsArray = Object.keys(favSpells);
      for (let key of favSpellsArray){
        favSpells[key].spells.sort(function(a, b){
         var nameA=a.name.toLowerCase(), nameB=b.name.toLowerCase();
         if (nameA < nameB) //sort string ascending
          return -1;
         if (nameA > nameB)
          return 1;
         return 0; //default return value (no sorting)
        });
      }
      */

  // sorting favSpellsPrepMode alphabetically
  /*
      const favSpellsPrepModeArray = Object.keys(favSpellsPrepMode);
      for (let key of favSpellsPrepModeArray){
        favSpellsPrepMode[key].spells.sort(function(a, b){
         var nameA=a.name.toLowerCase(), nameB=b.name.toLowerCase();
         if (nameA < nameB) //sort string ascending
          return -1;
         if (nameA > nameB)
          return 1;
         return 0; //default return value (no sorting)
        });
      }
      */

  let attributesTab = html.find('.item[data-tab="attributes"]');
  let favContainer = html.find(".favorites-wrap");
  let favContent = html.find(".favorites-target");
  let favoritesTab = html.find(".tab.attributes");
  if (renderFavTab) {
    // rendering of the favtab
    let data = {};
    data.favItems =
      favItems.length > 0
        ? favItems.sort((a, b) => a.flags.favtab.sort - b.flags.favtab.sort)
        : false;
    data.favFeats =
      favFeats.length > 0
        ? favFeats.sort((a, b) => a.flags.favtab.sort - b.flags.favtab.sort)
        : false;
    data.favSpellsPrepMode = spellPrepModeCount > 0 ? favSpellsPrepMode : false;
    data.favSpells = spellCount > 0 ? favSpells : false;
    data.editable = app.options.editable;
    data.allowCantripToBePreparedOnContext = game.settings.get("tidy5e-sheet", "allowCantripToBePreparedOnContext");

    await loadTemplates(["modules/tidy5e-sheet/templates/favorites/item.hbs"]);
    let favHtml = $(
      await renderTemplate(
        "modules/tidy5e-sheet/templates/favorites/template.hbs",
        data
      )
    );

    // Activating favorite-list events

    // showing item summary
    favHtml.find(".item-name h4").click((event) => app._onItemSummary(event));

    tidy5eContextMenu(favHtml);

    // the rest is only needed if the sheet is editable
    if (app.options.editable) {
      // rolling the item
      favHtml.find(".item-image").click((ev) => app._onItemUse(ev));

      // Item Dragging
      let handler = async (ev) => app._onDragStart(ev);
      favHtml.find(".item").each((i, li) => {
        if (li.classList.contains("items-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });

      // editing the item
      favHtml.find(".item-control.item-edit").click((ev) => {
        let itemId = $(ev.target).parents(".item")[0].dataset.itemId;
        app.actor.items.get(itemId).sheet.render(true);
      });

      // toggle item icon
      favHtml.find(".item-control.item-toggle").click((ev) => {
        ev.preventDefault();
        let itemId = ev.currentTarget.closest(".item").dataset.itemId;
        let item = app.actor.items.get(itemId);
        let attr =
          item.type === "spell"
            ? "system.preparation.prepared"
            : "system.equipped";
        return item.update({ [attr]: !getProperty(item, attr) });
      });

      // update item attunement
      favHtml.find(".item-control.item-attunement").click(async (ev) => {
        ev.preventDefault();
        let itemId = ev.currentTarget.closest(".item").dataset.itemId;
        let item = app.actor.items.get(itemId);

        if (item.system.attunement == 2) {
          app.actor.items.get(itemId).update({ "system.attunement": 1 });
        } else {
          if (
            app.actor.system.details.attunedItemsCount >=
            app.actor.system.details.attunedItemsMax
          ) {
            let count = actor.system.details.attunedItemsCount;
            ui.notifications.warn(
              `${game.i18n.format("TIDY5E.AttunementWarning", {
                number: count,
              })}`
            );
          } else {
            app.actor.items.get(itemId).update({ "system.attunement": 2 });
          }
        }
      });

      // removing item from favorite list
      favHtml.find(".item-fav").click((ev) => {
        let itemId = $(ev.target).parents(".item")[0].dataset.itemId;
        let val = !app.actor.items.get(itemId).flags.favtab.isFavorite;
        app.actor.items.get(itemId).update({ "flags.favtab.isFavorite": val });
      });

      // changing the charges values (removing if both value and max are 0)
      favHtml.find(".item input").change((ev) => {
        let itemId = $(ev.target).parents(".item")[0].dataset.itemId;
        let path = ev.target.dataset.path;
        let data = {};
        data[path] = Number(ev.target.value);
        app.actor.items.get(itemId).update(data);
        // app.activateFavs = true;
      });

      // changing the spell slot values and overrides
      favHtml.find(".spell-slots input").change((ev) => {
        let path = ev.target.dataset.target;
        let data = Number(ev.target.value);
        app.actor.update({ [path]: data });
      });

      // creating charges for the item
      favHtml.find(".addCharges").click((ev) => {
        let itemId = $(ev.target).parents(".item")[0].dataset.itemId;
        let item = app.actor.items.get(itemId);

        item.system.uses = { value: 1, max: 1 };
        let data = {};
        data["system.uses.value"] = 1;
        data["system.uses.max"] = 1;

        app.actor.items.get(itemId).update(data);
      });

      // charging features
      favHtml.find(".item-recharge").click((ev) => {
        ev.preventDefault();
        let itemId = $(ev.target).parents(".item")[0].dataset.itemId;
        let item = app.actor.items.get(itemId);
        return item.rollRecharge();
      });

      // custom sorting
      favHtml.find(".item").on("drop", (ev) => {
        ev.preventDefault();
        // ev.stopPropagation();

        let dropData = JSON.parse(
          ev.originalEvent.dataTransfer.getData("text/plain")
        );

        if (dropData.actorId !== app.actor.id) {
          // only do sorting if the item is from the same actor (not dropped from outside)
          return;
        }

        let list = null;
        if (dropData.type === "feat") {
          list = favFeats;
        } else if (dropData.type === "spell") {
          list = favSpells[dropData.system.level].spells;
        } else {
          list = favItems;
        }

        let dragSource = list.find((i) => i._id === dropData._id);
        let siblings = list.filter((i) => i._id !== dropData._id);
        let targetId = ev.target.closest(".item").dataset.itemId;
        let dragTarget = siblings.find((s) => s._id === targetId);

        // console.log(`dragSource: ${dragSource} // siblings: ${siblings} // targetID: ${targetId} // dragTarget: ${dragTarget}`)

        if (dragTarget === undefined) {
          // catch trying to drag from one list to the other, which is not supported
          // console.log("folder not supported")
          return;
        }

        // Perform the sort
        const sortUpdates = SortingHelpers.performIntegerSort(dragSource, {
          target: dragTarget,
          siblings: siblings,
          sortKey: "flags.favtab.sort",
        });
        const updateData = sortUpdates.map((u) => {
          const update = u.update;
          update._id = u.target._id;
          return update;
        });

        app.actor.updateEmbeddedDocuments("Item", updateData);
      });
    }

    // better rolls support
    // TODO TO REMOVE...IN THE FUTURE
    if (window.BetterRolls) {
      BetterRolls.addItemContent(
        app.object,
        favHtml,
        ".item .item-name h4",
        ".item-properties",
        ".item-image"
      );
    }

    // adding the html to the appropiate containers
    favContainer.addClass("hasFavs");
    favContent.append(favHtml);
    // attributesTab.prepend(favMarker);
    html.find(".tab.attributes").scrollTop(position.top);
    if (game.settings.get("tidy5e-sheet", "rightClickDisabled")) {
      favContent.find(".items-list").addClass("alt-context");
    }
  }

  // Hooks.callAll("renderedTidy5eSheet", app, html, data);
};
