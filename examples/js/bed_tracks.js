/* global Promise, tabix */

/**
 * Demonstrate the use of tabixed BED files to draw a new interval annotation track in LocusZoom
 */

var TabixSource = LocusZoom.subclass(LocusZoom.Data.Source, {
    parseInit: function (init) {
        // this.params = init.params; // Used to create a parser
        this.parser = init.parser_func;
        this.url_data = init.url_data;
        this.url_tbi = init.url_tbi || this.url_data + '.tbi';

        // Assuming that the `tabix-reader` library has been loaded via a CDN, this will create the reader
        // Since fetching the index is a remote operation, all reader usages will be via an async interface.
        this._reader_promise = tabix.urlReader(this.url_data, this.url_tbi).catch(function(e) {
            throw new Error('Failed to create a tabix reader from the provided URL');
        });
    },
    getCacheKey: function (state, chain, fields) {
        // In generic form, Tabix queries are based on chr, start, and end
        return [state.chr, state.start, state.end].join('_');
    },
    fetchRequest: function (state, chain, fields) {
        var self = this;
        return new Promise(function (resolve, reject) {
            // Ensure that the reader is fully created (and index available), then make a query
            self._reader_promise.then(function (reader) {
                reader.fetch(state.chr, state.start, state.end, function (data, err) {
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
