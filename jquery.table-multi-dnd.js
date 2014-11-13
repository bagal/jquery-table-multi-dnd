/**
 *  * TableDnD plug-in for JQuery, allows you to drag and drop table rows
 *  * You can set up various options to control how the system will work
 *  * Copyright (c) Denis Howlett <denish@isocra.com>
 *  * Licensed like jQuery, see http://docs.jquery.com/License.
 *  
 *  * Forked to support multiple drag and drop.
 *  * Copyright (c) Istergul <istergul@gmail.com>
 *
 *  * Forked from: https://github.com/Istergul/jquery-table-multi-dnd
 *  * 1. Fix issues with dragging multiple items
 *  * 2. Group dragged items into a new block, irrelevant of their position when first dragged i.e. rows 1,3,5 would be become 1,2,3
 *  * 3. Maintain position of multiple rows in relation to the first row dragged
 *  * 4. Support jQuery throttle if it exists: http://benalman.com/projects/jquery-throttle-debounce-plugin/
*/
jQuery.tableDnD = {
    currentTable: null,        /** Keep hold of the current table being dragged */
    dragObject: null,           /** Keep hold of the current drag object if any */
    dragObjects: new Array(),
    mouseOffset: null,          /** The current mouse offset */
    oldY: 0,                    /** Remember the old value of Y so that we don't do too much processing */
    isRequestRunning: false,

    /** Actually build the structure */
    build: function (options) {
        /* Set up the defaults if any */
        this.each(function () {
            /* This is bound to each matching table, set up the defaults and override with user options */
            this.tableDnDConfig = jQuery.extend({
                onDragStyle: null,
                onDropStyle: null,
                onDragClass: null,                /* Add in the default class for whileDragging */
                onDrop: null,
                onDragStart: null,
                scrollAmount: 20,
                /*serializeRegexp: /[^\-]*$/,*/     /* The regular expression to use to trim row IDs */
                /*serializeParamName: null,  */     /* If you want to specify another parameter name instead of the table ID */
                dragHandle: null,                 /* If you give the name of a class here, then only Cells with this class will be draggable */
                checkableClass: null
            }, options || {});
            jQuery.tableDnD.makeDraggable(this);  /* Now make the rows draggable */
        });
        jQuery(document).bind('mousemove', jQuery.throttle ? jQuery.throttle(250, jQuery.tableDnD.mousemove) : jQuery.tableDnD.mousemove).bind('mouseup', jQuery.tableDnD.mouseup);
        return this;                              /* Don't break the chain */
    },

    /** This function makes all the rows on the table draggable apart from those marked as "NoDrag" */
    makeDraggable: function (table) {
        var config = table.tableDnDConfig;
        /* add event for only cells witch class dragHandle */
        if (table.tableDnDConfig.dragHandle) {
            var cells = jQuery("td." + table.tableDnDConfig.dragHandle, table);
            cells.each(function () {
                /* The cell is bound to "this" */
                jQuery(this).mousedown(function (ev) {
                    jQuery.tableDnD.dragObject = this.parentNode;
                    jQuery.tableDnD.currentTable = table;
                    jQuery.tableDnD.mouseOffset = jQuery.tableDnD.getMouseOffset(this, ev);
                    if (config.onDragStart) {
                        /* Call the onDrop method if there is one */
                        config.onDragStart(table, this, jQuery.tableDnD.dragObjects);
                    }
                    return false;
                }).css("cursor", "move");
            })
        } else {
            /* For backwards compatibility, we add the event to the whole row */
            var rows = jQuery("tr", table); /* get all the rows as a wrapped set */
            rows.each(function () {
                /* Iterate through each row, the row is bound to "this" */
                var row = jQuery(this);
                if (!row.hasClass("nodrag")) {
                    row.mousedown(function (ev) {
                        if (config.checkableClass) {
                            jQuery.tableDnD.dragObjects = jQuery("." + config.checkableClass + ":checked", table).closest('tr').each(function (i, x) {
                                x.dragIndex = i;
                            });
                        }
                        if (ev.target.tagName == "TD") {
                            jQuery.tableDnD.dragObject = this;
                            jQuery.tableDnD.masterIndex = jQuery.tableDnD.dragObject.dragIndex;
                            jQuery.tableDnD.currentTable = table;
                            jQuery.tableDnD.mouseOffset = jQuery.tableDnD.getMouseOffset(this, ev);
                            if (jQuery.tableDnD.dragObjects.length != 0) {
                                jQuery.tableDnD.dragObjects.each(function (i, row) {
                                    row.mouseOffset = jQuery.tableDnD.getMouseOffset(row, ev);
                                    if (row.mouseOffset < 0) {
                                        row.mouseOffset += row.offsetHeight || 30;
                                    }
                                });
                            }
                            if (config.onDragStart) {
                                /* Call the onDrop method if there is one */
                                config.onDragStart(table, this, jQuery.tableDnD.dragObjects);
                            }
                            return false;
                        }
                    }).css("cursor", "move"); /* Store the tableDnD object */
                }
            });
        }
    },

    updateTables: function () {
        this.each(function () {
            /* this is now bound to each matching table */
            if (this.tableDnDConfig) { jQuery.tableDnD.makeDraggable(this); }
        })
    },

    /** Get the mouse coordinates from the event (allowing for browser differences) */
    mouseCoords: function (ev) {
        if (ev.pageX || ev.pageY) { return { x: ev.pageX, y: ev.pageY }; }
        return {
            x: ev.clientX + document.body.scrollLeft - document.body.clientLeft,
            y: ev.clientY + document.body.scrollTop - document.body.clientTop
        };
    },

    /** Given a target element and a mouse event, get the mouse offset from that element. To do this we need the element's position and the mouse position */
    /* given the position of the element and mouse, the mouse get the offset of the element */
    getMouseOffset: function (target, ev) {
        ev = ev || window.event;
        var docPos = this.getPosition(target); /* element position */
        var mousePos = this.mouseCoords(ev);     /* mouse click position */
        return { x: mousePos.x - docPos.x, y: mousePos.y - docPos.y };
    },

    /** Get the position of an element by going up the DOM tree and adding up all the offsets */
    getPosition: function (e) {
        var left = 0; var top = 0;
        /** Safari fix -- thanks to Luis Chato for this! */
        if (e.offsetHeight == 0) {
            /** Safari 2 doesn't correctly grab the offsetTop of a table row
            this is detailed here:
            http://jacob.peargrove.com/blog/2006/technical/table-row-offsettop-bug-in-safari/
            the solution is likewise noted there, grab the offset of a table cell in the row - the firstChild.
            note that firefox will return a text node as a first child, so designing a more thorough
            solution may need to take that into account, for now this seems to work in firefox, safari, ie */
            e = e.firstChild; /* a table cell */
        }
        while (e.offsetParent) {
            left += e.offsetLeft;
            top += e.offsetTop;
            e = e.offsetParent;
        }
        left += e.offsetLeft;
        top += e.offsetTop;
        return { x: left, y: top };
    },

    mousemove: function (ev) {
        if (jQuery.tableDnD.dragObject == null || jQuery.tableDnD.isRequestRunning == true) { return; }
        var config = jQuery.tableDnD.currentTable.tableDnDConfig;
        var dragObj = jQuery.tableDnD.dragObject;
        var masterIndex = jQuery.tableDnD.masterIndex;
        var dragObjs = jQuery(jQuery.tableDnD.dragObjects);

        var mousePos = jQuery.tableDnD.mouseCoords(ev);
        var y = mousePos.y - jQuery.tableDnD.mouseOffset.y;     /* position of the upper boundary line */
        var yOffset = window.pageYOffset;
        if (document.all) {
            if (typeof document.compatMode != 'undefined' && document.compatMode != 'BackCompat') {
                yOffset = document.documentElement.scrollTop;
            } else if (typeof document.body != 'undefined') {
                yOffset = document.body.scrollTop;
            }
        }
        if (mousePos.y - yOffset < config.scrollAmount) {
            window.scrollBy(0, -config.scrollAmount);
        } else {
            var windowHeight = window.innerHeight ? window.innerHeight
                    : document.documentElement.clientHeight ? document.documentElement.clientHeight : document.body.clientHeight;
            if (windowHeight - (mousePos.y - yOffset) < config.scrollAmount) {
                window.scrollBy(0, config.scrollAmount);
            }
        }

        if (y != jQuery.tableDnD.oldY) {
            var movingDown = y > jQuery.tableDnD.oldY;          /* work out if we're going up or down... */
            jQuery.tableDnD.oldY = y;                           /* update the old value */
            /* update the style to show we're dragging */
            if (dragObjs.length != 0) {
                config.onDragClass ? dragObjs.addClass(config.onDragClass) : dragObjs.css(config.onDragStyle);
            } else {
                config.onDragClass ? jQuery(dragObj).addClass(config.onDragClass) : jQuery(dragObj).css(config.onDragStyle);
            }
            var currentRow = null;
            var moveRow = function (y, movingDown, dragObj, row) {
                if (row == undefined) { row = dragObj; }
                /* If we're over a row then move the dragged row to there so that the user sees the effect dynamically */
                currentRow = jQuery.tableDnD.findDropTargetRow(row, y);
                if (currentRow) {
                    /* TODO worry about what happens when there are multiple TBODIES */
                    if (movingDown && dragObj != currentRow) {
                        try { row.parentNode.insertBefore(row, currentRow.nextSibling); } catch (e) { }
                    } else if (!movingDown && dragObj != currentRow) {
                        try { row.parentNode.insertBefore(row, currentRow); } catch (e) { }
                    }
                }
            }

            // update the position of the master row we're dragging
            moveRow(y, movingDown, dragObj);

            // then update the position of other selected rows
            if (dragObjs.length > 0 && currentRow) {
                var insertTarget = dragObj;
                for (var i = -1; ++i < dragObjs.length;) {
                    if (dragObjs[i] !== dragObj) {
                        // Update row position relative to where it was in relation to the row when we started dragging
                        if (dragObjs[i].dragIndex < masterIndex) {
                            jQuery(dragObjs[i]).insertBefore(dragObj);
                        } else {
                            jQuery(dragObjs[i]).insertAfter(insertTarget);
                            insertTarget = dragObjs[i];
                        }
                    }
                }
            }
        }
        return false;
    },

    /** We're only worried about the y position really, because we can only move rows up and down */
    findDropTargetRow: function (draggedRow, y) {
        var rows = jQuery.tableDnD.currentTable.rows;
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var rowY = this.getPosition(row).y;
            var rowHeight = parseInt(row.offsetHeight) / 2;
            if (row.offsetHeight == 0) {
                rowY = this.getPosition(row.firstChild).y;
                rowHeight = parseInt(row.firstChild.offsetHeight) / 2;
            }
            /* Because we always have to insert before, we need to offset the height a bit */
            if ((y > rowY - rowHeight) && (y < (rowY + rowHeight))) {
                /* that's the row we're over */
                /* If it's the same as the current row, ignore it */
                if (row == draggedRow) { return null; }
                var config = jQuery.tableDnD.currentTable.tableDnDConfig;
                if (config.onAllowDrop) {
                    if (config.onAllowDrop(draggedRow, row)) { return row; } else { return null; }
                } else {
                    /* If a row has nodrop class, then don't allow dropping (inspired by John Tarr and Famic) */
                    var nodrop = jQuery(row).hasClass("nodrop");
                    if (!nodrop) { return row; } else { return null; }
                }
                return row;
            }
        }
        return null;
    },

    mouseup: function (e) {
        if (jQuery.tableDnD.currentTable && jQuery.tableDnD.dragObject) {
            var droppedRow = jQuery.tableDnD.dragObject;
            var dragObjs = jQuery.tableDnD.dragObjects;
            var config = jQuery.tableDnD.currentTable.tableDnDConfig;
            /* If we have a dragObject, then we need to release it, The row will already have been moved to the right place so we just reset stuff */
            if (dragObjs.length != 0) {
                config.onDragClass ? dragObjs.removeClass(config.onDragClass) : dragObjs.css(config.onDropStyle);
            } else {
                config.onDragClass ? jQuery(droppedRow).removeClass(config.onDragClass) : jQuery(droppedRow).css(config.onDropStyle);
            }
            jQuery.tableDnD.dragObject = null;
            jQuery.tableDnD.dragObjects = new Array;
            if (config.onDrop) {
                jQuery.tableDnD.isRequestRunning = true;
                /* Call the onDrop method if there is one */
                config.onDrop(jQuery.tableDnD.currentTable, droppedRow, dragObjs);
                jQuery.tableDnD.isRequestRunning = false;
            }
            jQuery.tableDnD.currentTable = null; /* let go of the table too */
        }
    },

    /*
    serialize: function() {
        if (jQuery.tableDnD.currentTable) {
            return jQuery.tableDnD.serializeTable(jQuery.tableDnD.currentTable);
        } else {
            return "Error: No Table id set, you need to set an id on your table and every row";
        }
    },

    serializeTable: function(table) {
        var result = "";
        var tableId = table.id;
        var rows = table.rows;
        for (var ir = 0; ir < rows.length; ir++) {
            if (rows[ir].className.search(/nodrag/) == -1) {
                if (result.length > 0) result += "&";
                var rowId = rows[ir].id;
                if (rowId && rowId && table.tableDnDConfig && table.tableDnDConfig.serializeRegexp) {
                    rowId = rowId.match(table.tableDnDConfig.serializeRegexp)[0];
                }
                result += tableId + '[]=' + rowId;
            }
        }
        return result;
    },

	serializeTables: function() {
        var result = "";
        this.each(function() {
            result += jQuery.tableDnD.serializeTable(this);
        });
        return result;
    }*/

}

jQuery.fn.extend({
    tableDnD: jQuery.tableDnD.build,
    tableDnDUpdate: jQuery.tableDnD.updateTables,
    /*tableDnDSerialize: jQuery.tableDnD.serializeTables*/
});