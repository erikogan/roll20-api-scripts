/* Wild-Shape Token Resizer
 *
 * A script to automatically resize a Rollable Table Token when a different
 * side is chosen. It does this by repurposing the “weight” attribute of the
 * Items in the Rollable Table. It was written with D&D Druid Wild Shape
 * tokens in mind, but would work for any square rollable table tokens from
 * which players will choose different sides.
 *
 * The script listens to token:change events, looks for a table with the
 * same name as the token, and updates the token size when the side changes,
 * so no other configuration should be required.
 *
 * By: Erik Ogan
 * Version: 0.0.1
 */

var WildShapeResizer =
  WildShapeResizer ||
  (() => {
    "use strict";

    var version = "0.0.1";

    var checkTokenSize = (token) => {
      var name = token.get("name");
      if (!name) return;

      var tableItems = itemsForToken(token);
      if (!tableItems || tableItems.length < 1) return;

      var page = getObj("page", token.get("_pageid"));
      var gridSize = 70;

      if (page) {
        gridSize = page.get("snapping_increment") * gridSize;
      }

      var side = tableItems[token.get("currentSide")];
      if (side.get("avatar") !== token.get("imgsrc")) {
        // Rollable Table sides are copied into the token when it is created. If you change the table
        log("WildShapeResizer ERROR: token image does not match table image");
        sendChat(
          "WildShapeResizer",
          "/direct <strong>ERROR:</strong> token image does not match table image." +
            " This token likely needs to be recreated."
        );
        return;
      }

      var weight = side.get("weight");
      var dimension = gridSize * weight;
      doResize(token, dimension);
    };

    var doResize = (token, dimension) => {
      var name = token.get("name");

      var currentW = token.get("width");
      var currentH = token.get("height");

      // TODO: get the locations of the other tokens on the board and try to keep from overlapping them
      var currentL = token.get("left");
      var currentT = token.get("top");

      if (
        currentW &&
        currentH &&
        (currentW !== dimension || currentH !== dimension)
      ) {
        log(`WildShapeResizer: resizing ${name} to ${dimension}`);
        token.set("width", dimension);
        token.set("height", dimension);
        // TODO: Figure out why this is not working
        // Reset top & left so it does not center on the old size
        token.set("top", currentT);
        token.set("left", currentL);
        // Maybe with a timeout after we’ve finished our changes?
        setTimeout(() => {
          token.set("top", currentT);
          token.set("left", currentL);
        }, 10);
      } else {
        log(`WildShapeResizer: ${name} is already correctly sized.`);
      }
    };

    var fixToken = (token) => {
      var name = token.get("name");
      var items = itemsForToken(token);
      var existing = token.get("sides");
      log(`SIDES BEFORE: ${existing}`);
      existing = existing
        ? fromEntries(_.map(existing.split("|"), (s) => [decodeSide(s), true]))
        : {};

      var sides = [];
      var added = [];
      var found = undefined;

      _.each(items, (item, i) => {
        var avatar = item.get("avatar");
        if (existing[avatar]) {
          log(`FOUND: ${item.get("name")}`);
          delete existing[avatar];
        } else {
          log(`NOT FOUND: ${item.get("name")}`);
          added.push(item.get("name"));
        }

        if (avatar === token.get("imgsrc")) found = i;
      });

      token.set("sides", _.map(sides, encodeSide).join("|"));
      log(`SIDES AFTER: ${token.get("sides")}`);
      var currentSide = found;

      if (!currentSide) {
        log(`current MISSING!`);
        token.set("imgsrc", items[0].get("avatar"));
        currentSide = 0;
      }

      token.set("currentSide", currentSide + 1);

      log(`GOT HERE: ${name}`);

      var msg;

      if (found && _.isEmpty(existing) && _.isEmpty(added)) {
        msg = "<em>Nothing to do!</em>";
      } else {
        var msgs = [];
        if (!_.isEmpty(added)) {
          msgs.push(`<strong>Added:</strong> ${added.join(", ")}`);
        }
        var size = _.size(existing);
        if (size) msgs.push(`<strong>Removed:</strong> ${existing} items`);
        if (found) {
          msgs.push("<em>Existing token was missing, reset to #1</em>");
        }

        msg = msgs.join("\n");
      }

      sendChat("WildShapeResizer", `/direct ${msg}`);
    };

    // I don’t really know why / is not encoded, but this gets the same value
    var encodeSide = (side) => encodeURIComponent(side).replace("%3F", "/");
    var decodeSide = (side) => decodeURIComponent(side);
    // Roll20’s version of V8 doesn’t implement Object.fromEntries.
    var fromEntries = (iterable) =>
      [...iterable].reduce((obj, [key, val]) => {
        obj[key] = val;
        return obj;
      }, {});

    var processCommand = (msg) => {
      if (msg.type !== "api") return;
      if (msg.content !== "!wildFix") return;

      //   msg.selected = [{ _type: <typename> ,_id: <id> }, …]
      _.chain(msg.selected)
        .map((o) => getObj(o._type, o._id))
        .compact()
        .filter((o) => {
          var type = o.get("_type");
          if (type !== "graphic") {
            var name = o.get("name") || o._id;
            log(
              `WildShapeResizer ERROR: selected item ${name} is not a token.`
            );
            return false;
          }
          return true;
        })
        .each((o) => fixToken(o));
    };

    var itemsForToken = (token) => {
      var name = token.get("name");
      if (!name) undefined;

      var table = findObjs({ _type: "rollabletable", name: name })[0];
      if (!table) undefined;

      return findObjs({
        _type: "tableitem",
        _rollabletableid: table.id,
      });
    };

    var registerHandlers = () => {
      on("chat:message", processCommand);
      on("change:token", checkTokenSize);
    };

    var notifyStart = () => {
      log(`.oO WildShapeResizer ${version} Oo.`);
    };

    return {
      notifyStart: notifyStart,
      registerHandlers: registerHandlers,
    };
  })();

on("ready", () => {
  "use strict";
  WildShapeResizer.notifyStart();
  WildShapeResizer.registerHandlers();
});
