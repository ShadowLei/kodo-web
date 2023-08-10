import type { Stylesheet } from "cytoscape";

export namespace CytoscapeUtil {
    export function getDefaultStyle(): Stylesheet[] {
        let style: Stylesheet[] = [
            {
                selector: 'node',
                style: {
                    label: 'data(label)',
                    width: 18,
                    height: 18,
                }
            },
            {
                selector: 'node.property',
                style: {
                    label: 'data(label)',
                    width: 18,
                    height: 18,
                    'background-color': 'DarkKhaki',
                    'font-size': "0.7em",
                    'color': 'dimgray'
                }
            },
            {
                selector: 'node.property:selected',
                style: {
                    'background-color': 'DarkKhaki',
                    'border-width': 1,
                    'border-color': 'DarkOliveGreen',
                }
            },
            {
                selector: 'node.object',
                style: {
                    label: 'data(label)',
                    width: 60,
                    height: 60,
                    'background-color': 'Brown',
                    'color': 'bisque',
                    'text-justification': "center",
                    'text-halign': 'center',
                    'text-valign': 'center',
                    'font-size': "0.8em",
                }
            },
            {
                selector: 'node.object:selected',
                style: {
                    'background-color': 'Brown',
                    'border-width': 1,
                    'border-color': 'BlueViolet',
                }
            },
            {
                selector: 'node.parent',
                style: {
                    label: 'data(label)',
                    width: 60,
                    height: 60,
                    'background-color': 'lightyellow',
                    shape: "round-rectangle"
                }
            },

            {
                selector: 'edge.property',
                style: {
                    'width': 1,
                    'line-color': 'black'
                }
            },
            {
                "selector": "edge.link",
                "style": {
                    'width': 2,
                    "curve-style": "unbundled-bezier",
                    "control-point-distances": 120,
                    "control-point-weights": 0.1,
                    'line-color': 'darkgreen',
                    //'line-style': 'dotted',
                    'line-opacity': 0.8,
                    'line-cap': 'round',
                    'target-arrow-shape': 'triangle-backcurve',
                    'target-arrow-color': 'darkgreen',
                }
            }
        ];

        return style;
    }

    export function getDataStyle(): Stylesheet[] {
        let style: Stylesheet[] = [
            {
                selector: 'node',
                style: {
                    label: 'data(label)',
                    width: 18,
                    height: 18,
                }
            },
            {
                selector: 'node.property',
                style: {
                    label: 'data(label)',
                    width: 18,
                    height: 18,
                    'background-color': 'tan',
                    'font-size': "0.7em",
                    'color': 'dimgray'
                }
            },
            {
                selector: 'node.property:selected',
                style: {
                    'border-width': 1,
                    'border-color': 'sienna',
                }
            },
            {
                selector: 'node.object',
                style: {
                    label: 'data(label)',
                    width: 60,
                    height: 60,
                    'background-color': 'teal',
                    'color': 'lawngreen',
                    'text-justification': "center",
                    'text-halign': 'center',
                    'text-valign': 'center',
                    'font-size': "0.8em",
                }
            },
            {
                selector: 'node.object:selected',
                style: {
                    'border-width': 1,
                    'border-color': 'maroon',
                }
            },
            {
                selector: 'node.parent',
                style: {
                    label: 'data(label)',
                    width: 60,
                    height: 60,
                    'background-color': 'lightgray',
                    shape: "round-rectangle"
                }
            },
            {
                selector: 'node.start-object',
                style: {
                    label: 'data(label)',
                    width: 60,
                    height: 60,
                    'background-color': 'saddlebrown',
                    'color': 'plum',
                    'text-justification': "center",
                    'text-halign': 'center',
                    'text-valign': 'center',
                    'font-size': "0.8em",
                }
            },
            {
                selector: 'node.start-object:selected',
                style: {
                    'border-width': 1,
                    'border-color': 'purple',
                }
            },

            {
                selector: 'edge.property',
                style: {
                    'width': 1,
                    'line-color': 'black'
                }
            },
            {
                "selector": "edge.link",
                "style": {
                    'width': 2,
                    "curve-style": "unbundled-bezier",
                    "control-point-distances": 120,
                    "control-point-weights": 0.1,
                    'line-color': 'maroon',
                    //'line-style': 'dotted',
                    'line-opacity': 0.8,
                    'line-cap': 'round',
                    'target-arrow-shape': 'triangle-backcurve',
                    'target-arrow-color': 'maroon',
                }
            }
        ];

        return style;
    }
}