/**
 * Miscellaneous small utility methods that do not belong in the global namespace
 * TODO: Move to DataLayer.js after unit tests added
 */

/* global LocusZoom */
'use strict';

// Coalesce a large array of points based on available screen space
// Rules:
//  - Only coalesce points for which the (x|y) values are BOTH inside the specified bounds
//      AND when the distance between the (x|y) min/max coordinates is <= the specified gap
//  - Always add leaf nodes as is
//  - Otherwise, don't coalesce (just continue traversing until a child is found)
function coalesce_points(coords, x_field, y_field, xgap, xmin, xmax, ygap, ymin, ymax) {
    function _should_coalesce(c1, c2, min, max, gap) {
        return Math.abs(c2 - c1) <= gap && c1 >= min && c2 <= max;
    }

    var new_coords = [];
    coords.forEach(function(item) {
        var last_item = new_coords.length ? new_coords[new_coords.length - 1] : null;
        if (!last_item) {
            new_coords.push(item);
            return;
        }
        // Compare current item and prev item. Should they be merged?
        var current_x = item[x_field];
        var last_x = last_item[x_field];
        var current_y = item[y_field];
        var last_y = last_item[y_field];
        if (_should_coalesce(last_x, current_x, xmin, xmax, xgap)
            && _should_coalesce(last_y, current_y, ymin, ymax, ygap)) {
            // merge points, possibly adding other fields as required later
            new_coords.pop();
            item = {};
            item[x_field] = (current_x - last_x) / 2;
            item[y_field] = (current_y - last_y) / 2;
            item.lz_weight = (last_item.lz_weight || 0) + 1; // Track number of points coalesced
        }
        new_coords.push(item);
    });
    return new_coords;
}

LocusZoom.Util = {
    coalesce_points: coalesce_points
};
