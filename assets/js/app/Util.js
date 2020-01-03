/**
 * Miscellaneous small utility methods that do not belong in the global namespace
 * TODO: Move to DataLayer.js after unit tests added
 */

/* global LocusZoom, d3 */
'use strict';

// Count number leaf nodes (datapoints) under a specific part of the quadtree. This is useful for describing the number
//   of points that have been coalesced under a single node (
// TODO: Pre-order traversal *does not* guarantee that x-value sort order is preserved. Will this affect plotting?

function count_children(node) {
    if (!node) {
        // Sometimes d3.quadtree creates odd structures like [l, undefined, r]
        return 0;
    }
    if (node.leaf) {
        return 1;
    }
    return (node.nodes || []).reduce(function(acc, this_node) { // Add left and right subtrees
        return acc + count_children(this_node);
    }, 0);
}

// Coalesce a large array of points based on available screen space
// Rules:
//  - Only coalesce points for which the (x|y) values are BOTH inside the specified bounds
//      AND when the distance between the (x|y) min/max coordinates is <= the specified gap
//  - Always add leaf nodes as is
//  - Otherwise, don't coalesce (just continue traversing until a child is found)
function coalesce_points(qt, xgap, xmin, xmax, ygap, ymin, ymax, make_node) {
    // TODO: provide a means to convert gap from pixels to values
    // TODO: This function fails because of the "square bounds" limitation
    function _should_coalesce(c1, c2, min, max, gap) {
        return Math.abs(c2 - c1) <= gap && c1 >= min && c2 <= max;
    }

    function _make_node(node, x1, y1, x2, y2) { // Make a synthetic new node; user may provide their own function
        return {
            x: (x2 - x1) / 2,
            y: (y2 - y1) / 2,
            weight: count_children(node)
        };
    }

    make_node = make_node || _make_node;

    var nodes = [];
    qt.visit(function(node, x1, y1, x2, y2) {
        if (node.leaf) {
            // Always push leaf nodes (if we didn't coalesce by now, this is a point worth tracking "as is")
            nodes.push(node);
            console.log('found leaf node', node);
            return true;
        }
        if (_should_coalesce(x1, x2, xmin, xmax, xgap) && _should_coalesce(y1, y2, ymin, ymax, ygap)) {
            // In certain cases, a node falls within the bounds that define "uninteresting regions"
            //  (eg "really insignificant -log10 pvalues" = 0..1)
            // When that happens, coalesce all children into a single new point at the center of this bounding box
            console.log('coalescing synthetic node', arguments);
            nodes.push(make_node(node, x1, y1, x2, y2));
            // If we have decided to coalesce these points, then don't visit children
            return true;
        }
        return false;
    });
    return nodes;
}

function make_quadtree(coords_list, x_field, y_field, x_extent, y_extent) {
    // FIXME: Can't handle points with value "Infinity"; must be filtered out before this point
    // TODO: Make sure this works with real data (LZ fields arrays), and copies over extra fields. How to handle
    //      non-coordinate fields when coalescing?
    var x_get = function(d) { return d[x_field]; };
    var y_get = function(d) { return d[y_field]; };

    // TODO: what happens if we add a point outside the max extents? (eg plot is zoomed in and not showing all data)
    x_extent = x_extent || d3.extent(coords_list, x_get);
    y_extent = y_extent || d3.extent(coords_list, y_get);

    var factory = d3.geom.quadtree()
        .x(x_get)
        .y(y_get)
        .extent([
            [x_extent[0], y_extent[0]],
            [x_extent[1], y_extent[1]]
        ]);
    return factory(coords_list);
}

LocusZoom.Util = {
    count_children: count_children,
    make_quadtree: make_quadtree,
    coalesce_points: coalesce_points
};
