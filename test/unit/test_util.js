/**
 Test utility helpers
 */
'use strict';

describe('Coordinate coalescing', function () {
    beforeEach(function () {
        // Sample data intended to coalesce into ~6 points total
        this.sample_data = [ // Below are some notes for xgap = 3, ygap N/A. Other tests may vary.
            { x: 0, y: 0.5 }, // These points coalesce (using x cutoffs)
            { x: 1, y: 0.9 }, //     '
            { x: 2, y: 0.999 }, //  '
            { x: 3, y: 7.4 }, // Significant hit
            { x: 4, y: 0.001 }, // These points coalesce
            { x: 5, y: 0.05 }, //   '
            { x: 6, y: 128.0 }, // Significant hit
            { x: 7, y: 0.001 }, // These points coalesce
            { x: 8, y: 0.999 }, //   '
            { x: 9, y: 350 },  // Significant hit
        ];
    });
    describe('coalesce_points', function () {
        function _numeric_to_fixed(item) {
            Object.keys(item).forEach(function (key) {
                item[key] = item[key].toFixed ? item[key].toFixed(5) : item[key];
            });
            return item;
        }

        it('collapses insignificant points together (x gap = 3, any y in cutoff)', function () {
            var actual = LocusZoom.Util.coalesce_points(
                this.sample_data,
                'x',
                'y',
                3, -Infinity, Infinity,
                Infinity, 0, 1
            );
            assert.equal(actual.length, 6);

            actual = actual.map(_numeric_to_fixed);
            var expected = [
                { x: '1.00000', y: '0.79967', lz_weight: '3.00000' },
                { x: '3.00000', y: '7.40000' },
                { x: '4.50000', y: '0.02550', lz_weight: '2.00000' },
                { x: '6.00000', y: '128.00000' },
                { x: '7.50000', y: '0.50000', lz_weight: '2.00000' },
                { x: '9.00000', y: '350.00000' }
            ];
            assert.deepStrictEqual(actual, expected, 'Specified items are present');
        });

        it.skip('collapses insignificant points together (x gap = 1, any y in cutoff)', function () {
            var combined = LocusZoom.Util.coalesce_points(
                this.sample_data,
                'x',
                'y',
                1, -Infinity, Infinity,
                Infinity, 0, 1
            );
            assert.equal(combined.length, 6);
            assert.equal(combined.map(_numeric_to_fixed), [], 'Specified items are present');
        });

        it.skip('collapses insignificant points together (x and y gap specified)', function () {
            var combined = LocusZoom.Util.coalesce_points(
                this.sample_data,
                'x',
                'y',
                3, -Infinity, Infinity,
                0.5, 0, 1.0
            );
            assert.equal(combined.length, 7);
            assert.equal(combined.map(_numeric_to_fixed), [], 'Specified items are present');
        });
    });
});
