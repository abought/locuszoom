'use strict';


/***************************
 *  "Bad neighbor" data layer: Implements a custom rendering for the T2D portal
 *    Designed to connect a set x axis (like the credible sets track) with the external frame of the plot
 *
 *  First draft is totally data independent (we can add automated bounds checking later)
 * @class
 * @augments LocusZoom.DataLayer
*/
LocusZoom.DataLayers.add('bad_neighbor', function(layout) {

    // Define a default layout for this DataLayer type and merge it with the passed argument
    this.DefaultLayout = {
        style: {
            'stroke': '#D3D3D3',
            'stroke-width': '3px',
            'stroke-dasharray': '10px 10px'
        },
        orientation: 'horizontal',
        x_axis: {
            axis: 1,
        },
        y_axis: {
            axis: 1,
        },
        offset: 0
    };
    layout = LocusZoom.Layouts.merge(layout, this.DefaultLayout);

    // Apply the arguments to set LocusZoom.DataLayer as the prototype
    LocusZoom.DataLayer.apply(this, arguments);

    // Custom axis extents: set to data range in view
    this.getAxisExtent = function (dimension) {
        return [this.state.start, this.state.end];
    };


    /**
     * Implement the main render function
     */
    this.render = function() {
        // Assumptions:
        // 1. Layer will be given a set of points, in order
        // 2. Each one will be drawn with one end placed on the x-axis (same data as other panels), and the other positioned in absolute terms based on full width of the plot
        //      (can this go outside a cliparea of the panel/layer?)

        // layout: {
        //      markers: [ {position: x} ],
        //  (configure some absolute ylimits?)
        //  }
        // TODO: Why is getAxisExtent never being called at all for this layer?
        this.data = this.layout.markers;
        var num_points = this.data.length;

        var panel = this.parent;
        var plot = this.parent_plot;
        var x_scale = panel.x_scale;

        // Join data to the line selection
        var selection = this.svg.group
            .selectAll('path.lz-data_layer-line')
            .data(this.data);

        // Create path element, apply class
        this.path = selection.enter()
            .append('line')
            .attr('class', 'lz-data_layer-line')
            .attr('stroke-width', 2)
            .attr('stroke', 'black')
            .attr('x1', function (d) {  // One end is based on range of the data
                console.log(d['position']);
                return x_scale(+d['position']);
            })
            .attr('y1', panel.layout.height)
            .attr('x2', function (d, i) { // Other end is based on external plot dimensions
                // FIXME: what if only one point specified?
                console.log((i + 0.5) / (num_points) * plot.layout.width);
                return (i + 0.5) / num_points * plot.layout.width;
            })
            .attr('y2', 0);

        // TODO: Handle animation as panel is dragged sideways

        // Remove old elements as needed
        // FIXME: Known issue with points not being removed when layer is resized/re-rendered
        // FIXME: Adjust how this layer uses clipping paths, to better connect with the frame of the plot
        selection.exit().remove();
    };

    return this;

});
