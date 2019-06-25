/**
 Custom code used to demonstrate interactive page widget features in the aggregation test visualization example
 */
'use strict';

/* global $, raremetal, Vue */
/* eslint-disable no-unused-vars */


var Observable = function () { // Allow UI elements to monitor changes in a variable
    // Very simplified observable: a() to get value, a(val) to set, a.subscribe(fn) to add handlers
    var _subscribers = [];
    var current_value;
    var handle_value = function (value) {
        if (value === undefined) {
            return current_value;
        }
        if (current_value !== value) {
            current_value = value;
            _subscribers.forEach(function (handler) {
                try {
                    handler(value);
                } catch (error) {
                    console.error(error);
                }
            });
        }
    };
    handle_value.subscribe = function (handler) {
        _subscribers.push(handler);
    };
    return handle_value;
};

// Make a custom layout object
function customizePlotLayout(layout) {
    // Customize an existing plot layout with the data for aggregation tests
    // Customize layout:
    // 1. The association panel must pull from aggregation tests in order to draw on that data
    // 2. Genes layer must pull from the aggregation source + the aggregation_genes connector if we want to color
    //  the gene track by aggregation test results

    var assocLayout = layout.panels[0].data_layers[2];
    assocLayout.fields.unshift('aggregation: all');

    var genesLayout = layout.panels[1].data_layers[0];
    genesLayout.namespace['aggregation'] = 'aggregation';
    genesLayout.namespace['aggregation_genes'] = 'aggregation_genes';
    genesLayout.fields.push('aggregation:all', 'aggregation_genes:all');
    var colorConfig = [
        {
            scale_function: 'if',
            field: 'aggregation_best_pvalue',
            parameters: {
                field_value: null,
                then: '#B8B8B8'
            }
        },
        {
            scale_function: 'numerical_bin',
            field: 'aggregation_best_pvalue',
            // This UI is for gene-based tests, hence Default significance threshold is based on 20k human protein coding genes
            parameters: {
                breaks: [0, 0.05 / 20000],
                values: ['#d43f3a', '#357ebd']
            }
        }
    ];
    genesLayout.color = colorConfig;
    genesLayout.stroke = colorConfig;

    // The demo does not have real covariance data, and therefore only works on a narrow plot region. Lock all panels
    //   to prevent scrolling  TODO Update here
    // layout.panels.forEach(function (panel_layout) {
    //     panel_layout.interaction = {
    //         drag_background_to_pan: false,
    //         drag_x_ticks_to_scale: false,
    //         drag_y1_ticks_to_scale: false,
    //         drag_y2_ticks_to_scale: false,
    //         scroll_to_zoom: false,
    //         x_linked: false
    //     };
    // });
    return layout;
}

function _formatSciNotation(cell, params) {
    // Tabulator cell formatter using sci notation
    var value = cell.getValue();
    return LocusZoom.TransformationFunctions.get('scinotation')(value);
}

function jumpToRegion(plot, input_selector, error_selector) {
    var input = document.getElementById(input_selector);
    var error = document.getElementById(error_selector);
    error.style.display = 'none';
    var target = input.value || input.placeholder || '';

    var match = target.match(/^([0-9XY]+):(\d+)-(\d+)/);
    if (!match) {
        error.style.display = '';
    } else {
        plot.applyState({
            chr: match[1],
            start: +match[2],
            end: +match[3]
        });
    }
}

// Controllers for page widgets
/**
 * Define shared functionality for all tables, providing helper methods to control the tabulator
 *  table library
 * @class
 */
var GenericTabulatorTableController = LocusZoom.subclass(function () {
}, {
    /**
     *
     * @param {string|Object} selector A selector string for the table container
     * @param {object} table_config An object specifying the tabulator layout for this table
     */
    constructor: function (selector, table_config) {
        if (typeof selector === 'string') {
            selector = $(selector);
        }
        this.selector = selector;
        this._table_config = table_config;

        this.selector.tabulator(this._table_config);
    },

    /**
     * Callback that takes in data and renders an HTML table to a hardcoded document location
     * @param {object} data
     */
    _tableUpdateData: function (data) {
        this.selector.tabulator('setData', data);
    },

    /**
     * Stub. Override this method to transform the data in ways specific to this table.
     * @param data
     * @returns {*}
     */
    prepareData: function (data) {
        return data;
    },

    renderData: function (data) {
        data = this.prepareData(data);
        this._tableUpdateData(data);
    },

    tableSetFilter: function (column, value) {
        this.selector.tabulator('setFilter', column, '=', value);
    },

    tableClearFilter: function (column, value) {
        if (typeof value !== 'undefined') {
            this.selector.tabulator('removeFilter', column, '=', value);
        } else {
            this.selector.tabulator('clearFilter');
        }

    },

    tableDownloadData: function (filename, format) {
        format = format || 'csv';
        this.selector.tabulator('download', format, filename);
    }
});

var AggregationTableController = LocusZoom.subclass(GenericTabulatorTableController, {
    prepareData: function (data) {
        return data.groups.data; // Render function only needs a part of the "computed results" JSON it is given
    }
});

var VariantsTableController = LocusZoom.subclass(GenericTabulatorTableController, {});

/**
 * Creates the plot and tables. This function contains references to specific DOM elements on one HTML page.
 * @param {Observable|function} label_store Observable used to label the selected group
 * @param {Object} [context=window] A reference to the widgets will be added here, allowing them to be accessed
 *  outside the function later (eg for debugging purposes)
 */
function createDisplayWidgets(label_store, context) {
    context = context || window;

    // Determine if we're online, based on browser state or presence of an optional query parameter
    var online = !(typeof navigator !== 'undefined' && !navigator.onLine);
    if (window.location.search.indexOf('offline') !== -1) {
        online = false;
    }

    // Specify the data sources to use, then build the plot
    var apiBase = '//portaldev.sph.umich.edu/api/v1/';
    var data_sources = new LocusZoom.DataSources()
        .add('aggregation', ['AggregationTestSourceLZ', { url: 'https://portaldev.sph.umich.edu/raremetal/v1/aggregation/covariance' }])
        .add('assoc', ['AssocFromAggregationLZ', {  // Use a special source that restructures already-fetched data
            from: 'aggregation',
            params: { id_field: 'variant' }
        }])
        .add('ld', ['LDLZ2', {
            url: 'https://portaldev.sph.umich.edu/ld/',
            params: { source: '1000G', build: 'GRCh37', population: 'ALL' }
        }])
        .add('gene', ['GeneLZ', { url: apiBase + 'annotation/genes/', params: { build: 'GRCh37' } }])
        .add('aggregation_genes', ['GeneAggregationConnectorLZ', {
            sources: {
                aggregation_ns: 'aggregation',
                gene_ns: 'gene'
            }
        }])
        .add('recomb', ['RecombLZ', { url: apiBase + 'annotation/recomb/results/', params: { build: 'GRCh37' } }])
        .add('constraint', ['GeneConstraintLZ', { url: 'http://exac.broadinstitute.org/api/constraint' }]);  // FIXME: use https when exac fixed

    var stateUrlMapping = {chr: 'chrom', start: 'start', end: 'end'};
    var initialState = LocusZoom.ext.DynamicUrls.paramsFromUrl(stateUrlMapping);
    if (!Object.keys(initialState).length) {
        initialState = { chr: '19', start: 45312079, end: 45512079 };
    }

    var layout = LocusZoom.Layouts.get('plot', 'standard_association', { state: initialState });
    layout = customizePlotLayout(layout);

    var plot = LocusZoom.populate('#lz-plot', data_sources, layout);
    // Add a basic loader to each panel (one that shows when data is requested and hides when one rendering)
    plot.layout.panels.forEach(function(panel) {
        plot.panels[panel.id].addBasicLoader();
    });

    // Changes in the plot can be reflected in the URL, and vice versa (eg browser back button can go back to
    //   a previously viewed region)
    LocusZoom.ext.DynamicUrls.plotUpdatesUrl(plot, stateUrlMapping);
    LocusZoom.ext.DynamicUrls.plotWatchesUrl(plot, stateUrlMapping);

    var TABLE_SELECTOR_AGGREGATION = '#results-table-aggregation';
    var TABLE_SELECTOR_VARIANTS = '#results-table-variants';

    var aggregationTable = new AggregationTableController(TABLE_SELECTOR_AGGREGATION, {
        index: 'id',
        height: 300,
        layout: 'fitColumns',
        layoutColumnsOnNewData: true,
        rowSelected: function (row) {
            label_store(row.row.data); // Tabulator doesn't allow changing options after creation
        },
        rowDeselected: function () {
            label_store(null);
        },
        columns: [
            {
                title: 'Gene', field: 'group', formatter: 'link', widthGrow: 3,
                // TODO: exac gives timeouts if we use https
                formatterParams: { urlPrefix: 'http://exac.broadinstitute.org/gene/', labelField: 'group_display_name' }
            },
            { title: 'Mask', field: 'mask_name', headerFilter: true, widthGrow: 8 },
            { title: '# Variants', field: 'variant_count', widthGrow: 2 },
            { title: 'Test type', field: 'test', headerFilter: true, widthGrow: 2 },
            { title: 'p-value', field: 'pvalue', formatter: _formatSciNotation, sorter: 'number', widthGrow: 2 },
            { title: 'Statistic', field: 'stat', formatter: _formatSciNotation, sorter: 'number', visible: false, widthGrow: 2 }
        ],
        placeholder: 'No Data Available',
        initialSort: [
            { column: 'pvalue', dir: 'asc' }
        ],
        selectable: 1,
        selectablePersistence: false
    });

    var variantsTable = new VariantsTableController(TABLE_SELECTOR_VARIANTS, {
        height: 300,
        layout: 'fitColumns',
        layoutColumnsOnNewData: true,
        index: 'id',
        columns: [
            { title: 'Variant', field: 'variant' },
            { title: 'p-value', field: 'pvalue', formatter: _formatSciNotation, sorter: 'number' },
            { title: 'Alt allele frequency', field: 'altFreq', formatter: _formatSciNotation, sorter: 'number' }
        ],
        placeholder: 'No Data Available',
        initialSort: [
            { column: 'variant', dir: 'asc' }
        ]
    });

    ////////////////////////////////
    // Make certain symbols available later in outer scope, eg for debugging
    context.data_sources = data_sources;
    context.plot = plot;

    context.aggregationTable = aggregationTable;
    context.variantsTable = variantsTable;
}

/**
 * Connect a very specific set of widgets together to drive the user experience for this page.
 *
 * Because many things are clickable, this consists of several small pieces. The key concepts are:
 * 1. Allow the plot to tell us when aggregation test results are available.
 * 2. Take that data and update a table
 * 3. If something important gets clicked, update parts of the view that depend on it
 * 4. Have a well-defined way to coordinate many widgets that depend on a common value
 * @param plot
 * @param aggregationTable
 * @param variantsTable
 * @param {Observable} resultStorage Observable that holds calculation results
 * @param {Observable} labelStorage Observable used to label the selected group
 */
function setupWidgetListeners(plot, aggregationTable, variantsTable, resultStorage, labelStorage) {
    plot.on('element_selection', function (eventData) {
        // Trigger the aggregation test table to filter (or unfilter) if a specific gene on the genes panel is clicked
        if (eventData['sourceID'] !== 'lz-plot.genes') {
            return;
        }

        var gene_column_name = 'group';
        var selected_gene = eventData['data']['element']['gene_name'];

        if (eventData['data']['active']) {
            aggregationTable.tableSetFilter(gene_column_name, selected_gene);
            $('#label-no-group-selected').hide();
            $('#label-current-group-selected').show().text(selected_gene);
        } else {
            $('#label-no-group-selected').show();
            $('#label-current-group-selected').hide();
            aggregationTable.tableClearFilter(gene_column_name, selected_gene);
        }
    }.bind(this));

    plot.subscribeToData(
        ['aggregation:all', 'gene:all'],
        function (data) {
            // chain.discrete provides distinct data from each source
            var gene_source_data = data.gene;
            var agg_source_data = data.aggregation;

            var results = agg_source_data.results;

            // Aggregation calcs return very complex data. Parse it here, once, into reusable helper objects.
            var parsed = raremetal.helpers.parsePortalJSON(agg_source_data);
            var groups = parsed[0];
            var variants = parsed[1];

            /////////
            // Post-process this data with any annotations required by data tables on this page

            // The aggregation results use the unique ENSEMBL ID for a gene. The gene source tells us how to connect
            //  that to a human-friendly gene name (as displayed in the LZ plot)
            var _genes_lookup = {};
            gene_source_data.forEach(function (gene) {
                var gene_id = gene.gene_id.split('.')[0]; // Ignore ensembl version on gene ids
                _genes_lookup[gene_id] = gene.gene_name;
            });
            groups.data.forEach(function (one_result) {
                var this_group = groups.getOne(one_result.mask, one_result.group);
                // Add synthetic fields that are not part of the raw calculation results
                one_result.group_display_name = _genes_lookup[one_result.group] || one_result.group;
                one_result.variant_count = this_group.variants.length;
            });

            // When new data has been received (and post-processed), pass it on to any UI elements that use that data
            resultStorage({
                groups: groups,
                variants: variants
            });
        },
        { discrete: true }
    );

    // When results are updated, make sure we are not "drilling down" into a calculation that no longer exists
    resultStorage.subscribe(aggregationTable.renderData.bind(aggregationTable));
    resultStorage.subscribe(labelStorage.bind(null, null)); // just wipe the labels
    plot.on('element_selection', labelStorage.bind(null, null));

    // The UI is based on "drilling down" to explore results. If a user selects a group, display stuff
    labelStorage.subscribe(function (data) {  // User-friendly label
        var text = '';
        if (data) {
            text = data.mask_name + ' / ' + data.group_display_name;
        }
        $('#label-mask-selected').text(text);
    });
    labelStorage.subscribe(function (data) { // Update the "show me what variants are in a selected group" table
        var calcs = resultStorage();
        if (!data || !calcs) { // If no analysis is selected, no analysis should be shown
            variantsTable.renderData([]);
            return;
        }
        // When a group is selected, draw a variants table with information about that group.
        var one_group = calcs.groups.getOne(data.mask, data.group);
        var variant_data = calcs.variants.getGroupVariants(one_group.variants);
        variantsTable.renderData(variant_data);
    });

    //////////////////////////////////////////////////////////////
    // Generic UI controls: what to do when buttons are clicked
    $('#download-aggregation').on('click', function () {
        aggregationTable.tableDownloadData('aggregation-data.csv', 'csv');
    });

    $('#download-variants').on('click', function () {
        variantsTable.tableDownloadData('variants-data.csv', 'csv');
    });
}

// For the UI, reformat the list of available tests as [id, Label] entries
var TEST_LABELS = Object.keys(raremetal.helpers.AGGREGATION_TESTS).map(function (id) {
    return [id, raremetal.helpers.AGGREGATION_TESTS[id].label];
});

function makeUI(selector, geno_id, build, masks, phenotypes) {
    // The UI is written in Vue.js. Although modern tooling can be nice, this example can be reused via plain JS.
    return new Vue({
        el: selector,
        data: function () {
            return {
                // options passed in at creation
                masks: masks,
                phenotypes: phenotypes,  // { categoryID: {description: str, phenotypes: [str]} }
                calc_names: TEST_LABELS,
                // Tracking internal state
                status_css: { color: 'red' },
                status_message: null,

                // Track information that will be required to run the calculation
                genoset_id: geno_id,
                genome_build: build,

                // API supports one pheno/multiple masks/ multiple tests
                selected_phenotype: null,
                selected_masks: [],
                selected_tests: [],
            };
        },
        methods: {
            setStatus: function (message, success) {
                this.status_message = message;
                this.status_css.color = success ? 'green' : 'red';
            },
            isValid: function () {
                return this.selected_phenotype && this.selected_masks.length && this.selected_tests.length;
            },
            runTests: function () {
                var status = this.isValid();
                this.setStatus(status ? '' : 'Please select at least one option from each category', status);
                var by_cat = this.phenotypes;
                var selected = this.selected_phenotype;

                if (status) {
                    // Slightly inelegant demo UI : assumes phenonames are globally unique and we find the first match
                    var phenosetId;
                    for (var pId in by_cat) {
                        if (!by_cat.hasOwnProperty(pId)) {
                            continue;
                        }
                        var pheno_list = this.phenotypes[pId].phenotypes;
                        if (pheno_list.find(function (element) {
                            return element.name === selected;
                        })) {
                            phenosetId = pId;
                            break;
                        }
                    }
                    this.$emit('run', {
                        genoset_id: this.genoset_id,
                        genoset_build: this.genome_build,
                        phenoset_id: +phenosetId,
                        pheno: selected,
                        calcs: this.selected_tests.slice(),
                        masks: this.selected_masks.slice(),
                    });
                }
            }
        },
    });
}
