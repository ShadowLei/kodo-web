import type { IQueryOnData } from '@/_modules';
import { Order, initKodoExample, initKodoExampleWithData } from '../example';
import cytoscape, { type Core } from 'cytoscape';
import fcose from 'cytoscape-fcose';
import type { DataNode, Kodo, QueryNode, ROperator_Atom } from 'kodo-core';

cytoscape.use(fcose);

export class KodoCytoscape {
    public core?: Core;
    public kodo?: Kodo;

    //TODO here: load data
    constructor () {
    }

    init(_core: Core, _kodo: Kodo) {
        this.core = _core;
        this.kodo = _kodo;
    }

    resize() {
        let c = this.core?.container();
        if (!c) { return; }
    
        let windowHeight = window.innerHeight || 765;
        let headerHeight = document.getElementById('kodo-header')?.clientHeight || 0;
    
        //margin-top: 16, 3 * 16 = 48
        c.style.height = `${windowHeight - headerHeight - 48}px`;
    }

    center() {
        this.core?.center();
    }

    zoom() {
        this.core?.zoom({
            level: 1,
            renderedPosition: { x: 100, y: 100 }
        });
    }

    refresh() {
        let options = {
            name: "fcose",

            // 'draft', 'default' or 'proof' 
            // - "draft" only applies spectral layout 
            // - "default" improves the quality with incremental layout (fast cooling rate)
            // - "proof" improves the quality with incremental layout (slow cooling rate) 
            quality: "default",
            // Use random node positions at beginning of layout
            // if this is set to false, then quality option must be "proof"
            randomize: true, 
            // Whether or not to animate the layout
            animate: true, 
            // Duration of animation in ms, if enabled
            animationDuration: 1000, 
            // Easing of animation, if enabled
            animationEasing: undefined, 
            // Fit the viewport to the repositioned nodes
            fit: true, 
            // Padding around layout
            padding: 30,
            // Whether to include labels in node dimensions. Valid in "proof" quality
            nodeDimensionsIncludeLabels: false,
            // Whether or not simple nodes (non-compound nodes) are of uniform dimensions
            uniformNodeDimensions: false,
            // Whether to pack disconnected components - cytoscape-layout-utilities extension should be registered and initialized
            packComponents: true,
            // Layout step - all, transformed, enforced, cose - for debug purpose only
            step: "all",
            
            /* spectral layout options */
            
            // False for random, true for greedy sampling
            samplingType: true,
            // Sample size to construct distance matrix
            sampleSize: 25,
            // Separation amount between nodes
            nodeSeparation: 75,
            // Power iteration tolerance
            piTol: 0.0000001,
            
            /* incremental layout options */
            
            // Node repulsion (non overlapping) multiplier
            nodeRepulsion: (node: any) => 4500,
            // Ideal edge (non nested) length
            idealEdgeLength: (edge: any) => 50,
            // Divisor to compute edge forces
            edgeElasticity: (edge: any) => 0.45,
            // Nesting factor (multiplier) to compute ideal edge length for nested edges
            nestingFactor: 0.1,
            // Maximum number of iterations to perform - this is a suggested value and might be adjusted by the algorithm as required
            numIter: 2500,
            // For enabling tiling
            tile: true,
            // The comparison function to be used while sorting nodes during tiling operation.
            // Takes the ids of 2 nodes that will be compared as a parameter and the default tiling operation is performed when this option is not set.
            // It works similar to ``compareFunction`` parameter of ``Array.prototype.sort()``
            // If node1 is less then node2 by some ordering criterion ``tilingCompareBy(nodeId1, nodeId2)`` must return a negative value
            // If node1 is greater then node2 by some ordering criterion ``tilingCompareBy(nodeId1, nodeId2)`` must return a positive value
            // If node1 is equal to node2 by some ordering criterion ``tilingCompareBy(nodeId1, nodeId2)`` must return 0
            tilingCompareBy: undefined, 
            // Represents the amount of the vertical space to put between the zero degree members during the tiling operation(can also be a function)
            tilingPaddingVertical: 10,
            // Represents the amount of the horizontal space to put between the zero degree members during the tiling operation(can also be a function)
            tilingPaddingHorizontal: 10,
            // Gravity force (constant)
            gravity: 0.25,
            // Gravity range (constant) for compounds
            gravityRangeCompound: 1.5,
            // Gravity force (constant) for compounds
            gravityCompound: 1.0,
            // Gravity range (constant)
            gravityRange: 3.8, 
            // Initial cooling factor for incremental layout  
            initialEnergyOnIncremental: 0.3,
          
            /* constraint options */
          
            // Fix desired nodes to predefined positions
            // [{nodeId: 'n1', position: {x: 100, y: 200}}, {...}]
            fixedNodeConstraint: undefined,
            // Align desired nodes in vertical/horizontal direction
            // {vertical: [['n1', 'n2'], [...]], horizontal: [['n2', 'n4'], [...]]}
            alignmentConstraint: undefined,
            // Place two nodes relatively in vertical/horizontal direction
            // [{top: 'n1', bottom: 'n2', gap: 100}, {left: 'n3', right: 'n4', gap: 75}, {...}]
            relativePlacementConstraint: undefined,
          
            /* layout event callbacks */
            ready: () => {}, // on layoutready
            stop: () => {} // on layoutstop
          };

        let layout = this.core?.layout(options);
        layout?.run();
    }

    query(val: IQueryOnData): DataNode<any>[] {
        let queryNode: QueryNode<any> = {
            $ns: val.data.$ns,
            expression: {}
        };
        queryNode.expression[val.data.$name] = {
            $op: val.op,
            $val: val.val
        };

        //console.log(`q node: ${JSON.stringify(queryNode)}`);
        let dataNodes = this.kodo?.explore<any>(queryNode) || [];

        //console.log(`d node: ${JSON.stringify(dataNodes)}`);
        //console.log(dataNodes);

        return dataNodes;
    }

}
