/**
 Test utility helpers
 */
'use strict';

describe('Coordinate coalescing', function () {
    beforeEach(function() {
        // Sample data intended to coalesce into ~6 points total
        this.sample_data = [
            { x: 0, y: 0.5 }, // These points coalesce
            { x: 1, y: 0.9 }, //     '
            { x: 2, y: 0.999 }, //  '
            { x: 3, y: 7.4 }, // Significant hit
            { x: 4, y: 0.001 }, // These points coalesce
            { x: 5, y: 0.05 }, //   '
            { x: 6, y: 128.0 }, // Significant hit
            { x: 7, y: 0.001 }, // These points coalesce
            { x: 8, y: 0.999 }, //   '
            { x: 9, y: 350},  // Significant hit
        ];
    });
    describe('count child nodes', function () {
        it('only counts leaf nodes, not internal members', function () {
            var qt = LocusZoom.Util.make_quadtree(this.sample_data, 'x', 'y');
            var count = qt.nodes.reduce(function(acc, node) { return LocusZoom.Util.count_children(node) + acc; }, 0);
            assert.equal(count, this.sample_data.length);
        });
    });
    describe('coalesce_qt', function () {
        it('collapses insignificant points together', function () {
            var qt = LocusZoom.Util.make_quadtree(this.sample_data, 'x', 'y');
            var combined = LocusZoom.Util.coalesce_points(
                qt,
                3, -Infinity, Infinity,
                Infinity, 0, 1
            );
            assert.equal(combined.length, 6);
        });
    });
});
