/* global Promise, tabix */

/**
 * Demonstrate the use of tabixed BED files to draw a new interval annotation track in LocusZoom
 */

// eslint-disable-next-line no-unused-vars
var TabixUrlSource = LocusZoom.subclass(LocusZoom.Data.Source, {
    constructor: function (init) {
        this.parseInit(init);
    },

    /**
     * @param {Object} init
     * @param {function} init.parser_func A function that parses a single line of text and returns (usually) a
     *  structured object of data fields
     * @param {string} init.url_data The URL for the bgzipped and tabix-indexed file
     * @param {string} [init.url_tbi] The URL for the tabix index. Defaults to `url_data` + '.tbi'
     * @param {Object} [init.params]
     * @param {number} [init.params.overfetch = 0] Optionally fetch more data than is required to satisfy the region query.
     *  Useful for sources where interesting features might lie near the edges of the plot.
     */
    parseInit: function (init) {
        // this.params = init.params; // Used to create a parser
        this.parser = init.parser_func;
        this.url_data = init.url_data;
        this.url_tbi = init.url_tbi || this.url_data + '.tbi';

        // In tabix mode, sometimes we want to fetch a slightly larger region than is displayed, in case a
        //    feature is on the edge of what the tabix query would return. Specify overfetch in units of bp.
        var params = init.params || {};
        this._overfetch = params.overfetch || 0;

        // Assuming that the `tabix-reader` library has been loaded via a CDN, this will create the reader
        // Since fetching the index is a remote operation, all reader usages will be via an async interface.
        this._reader_promise = tabix.urlReader(this.url_data, this.url_tbi).catch(function() {
            throw new Error('Failed to create a tabix reader from the provided URL');
        });
    },
    getCacheKey: function (state /*, chain, fields*/) {
        // In generic form, Tabix queries are based on chr, start, and end
        return [state.chr, state.start, state.end].join('_');
    },
    fetchRequest: function (state /*, chain, fields */) {
        var self = this;
        return new Promise(function (resolve, reject) {
            // Ensure that the reader is fully created (and index available), then make a query
            var start = state.start - self._overfetch;
            var end = state.end + self._overfetch;
            self._reader_promise.then(function (reader) {
                reader.fetch(state.chr, start, end, function (data, err) {
                    if (err) {
                        reject(new Error('Could not read requested region. This may indicate an error with the .tbi index.'));
                    }
                    resolve(data);
                });
            });
        });
    },
    normalizeResponse: function (data) {
        // Parse the data
        return data.map(this.parser);
    }
});
