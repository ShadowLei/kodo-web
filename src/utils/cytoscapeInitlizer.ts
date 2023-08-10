import { DataNode, Kodo, LinkNode, MemoryProvider, NodeTranslator } from "kodo-core";
import type { Core, EdgeDataDefinition, ElementDefinition, NodeDataDefinition } from "cytoscape";
import type { IKodoObject } from "@/_modules";
import cytoscape from "cytoscape";
import { CytoscapeUtil } from "./cytoscapeUtil";

export type CytoscapeStyleType = "default" | "data";

export class CytoscapeInitlizer {
    public eles: ElementDefinition[];

    constructor(public containerId: string) {
        this.eles = [];
    }

    private tryAddCNode(nodes: NodeDataDefinition[], ele: NodeDataDefinition): NodeDataDefinition {
        let found = nodes.find(m => m.id === ele.id);
        if (found) { return found; }

        nodes.push(ele);
        return ele;
    }

    initWithKodoObjects(objs: IKodoObject[]): void {
        let cNodes: NodeDataDefinition[] = [];
        let cEdges: EdgeDataDefinition[] = [];

        objs.forEach(cls => {
            //pnode
            let pParentId = `$c.${cls.name}`;
            let eleParent: NodeDataDefinition = {
                id: pParentId,
                $source: null,
                $type: "parent",
                $ns: cls.name,
                $name: cls.name,
                label: "",
            };
            eleParent = this.tryAddCNode(cNodes, eleParent);

            //node
            let eleId = cls.name;
            let ele: NodeDataDefinition = {
                id: eleId,
                parent: pParentId,
                $source: null,
                $type: "object",
                $ns: cls.name,
                $name: cls.name,
                label: cls.name,
            };
            ele = this.tryAddCNode(cNodes, ele);

            cls.properties.forEach(m => {
                //property
                let key = m.name;
                let propId = `${eleId}.${key}`;
                let prop: NodeDataDefinition = {
                    id: propId,
                    parent: pParentId,
                    $type: "property",
                    $ns: cls.name,
                    $name: key,
                    label: key,
                }
                prop = this.tryAddCNode(cNodes, prop);

                //edge: object-property
                let edgeFromProp: EdgeDataDefinition = {
                    id: `${eleId}-${propId}`,
                    source: eleId,
                    target: propId,
                    $type: "property",
                    $ns: cls.name,
                    $name: key,
                };
                cEdges.push(edgeFromProp);
            });
        })

        cNodes.forEach(m => {
            this.eles.push({ data: m, classes: m.$type });
        });
        cEdges.forEach(m => {
            this.eles.push({ data: m, classes: m.$type });
        });
    }

    initWithLinkNodes(lnList: LinkNode<any, any>[]): void {
        //let ele: NodeDataDefinition | EdgeDataDefinition = {};
        let cNodes: NodeDataDefinition[] = [];
        let cEdges: EdgeDataDefinition[] = [];

        lnList.forEach(m => {
            /*
            //pnode
            let pFromParentId = `$c.${m.$fromNS}`;
            let eleFromParent: NodeDataDefinition = {
                id: pFromParentId,
                $source: null,
                $type: "parent",
                $ns: m.$ns,
                $name: m.$ns,
                label: "",
            };
            eleFromParent = this.tryAddCNode(cNodes, eleFromParent);

            let pToParentId = `$c.${m.$toNS}`;
            let eleToParent: NodeDataDefinition = {
                id: pToParentId,
                $source: null,
                $type: "parent",
                $ns: m.$ns,
                $name: m.$ns,
                label: "",
            };
            eleToParent = this.tryAddCNode(cNodes, eleToParent);

            //node
            let eleFromId = m.$fromNS;
            let eleFrom: NodeDataDefinition = {
                id: eleFromId,
                parent: pFromParentId,
                $source: null,
                $type: "object",
                $ns: m.$ns,
                $name: m.$ns,
                label: m.$fromNS,
            };
            eleFrom = this.tryAddCNode(cNodes, eleFrom);

            let eleToId = m.$toNS;
            let eleTo: NodeDataDefinition = {
                id: eleToId,
                parent: pToParentId,
                $source: null,
                $type: "object",
                $ns: m.$ns,
                $name: m.$ns,
                label: m.$toNS,
            };
            eleTo = this.tryAddCNode(cNodes, eleTo);

            //property
            let fromName = (m.expression.$from || "").toString();
            let fromId = `${m.$fromNS}.${fromName}`;
            let propFrom: NodeDataDefinition = {
                id: fromId,
                parent: pFromParentId,
                $type: "property",
                $ns: m.$ns,
                $name: fromName,
                label: fromId,
            }
            propFrom = this.tryAddCNode(cNodes, propFrom);

            let toName = (m.expression.$to || "").toString();
            let toId = `${m.$toNS}.${toName}`;
            let propTo: NodeDataDefinition = {
                id: toId,
                parent: pToParentId,
                $type: "property",
                $ns: m.$ns,
                $name: toName,
                label: toId
            }
            propTo = this.tryAddCNode(cNodes, propTo);

            //edge: object-property
            let edgeFromProp: EdgeDataDefinition = {
                id: `${eleFromId}-${fromId}`,
                source: eleFromId,
                target: fromId,
                $type: "property",
                $ns: m.$ns,
                $name: `${eleFromId}-${fromId}`,
            };
            cEdges.push(edgeFromProp);

            let edgeToProp: EdgeDataDefinition = {
                id: `${eleToId}-${toId}`,
                source: eleToId,
                target: toId,
                $type: "property",
                $ns: m.$ns,
                $name: `${eleToId}-${toId}`,
            };
            cEdges.push(edgeToProp);
            */

            let fromId = `${m.$fromNS}.${m.expression.$from?.toString()}`;
            //let toName = (m.expression.$to || "").toString();
            let toId = `${m.$toNS}.${m.expression.$to?.toString()}`;

            //edge: link
            let id = `${fromId}-${toId}`;
            let edge: EdgeDataDefinition = {
                id: id,
                source: fromId,
                target: toId,
                $type: "link",
                $ns: m.$ns,
                $name: id
            };
            cEdges.push(edge);
        });

        cNodes.forEach(m => {
            this.eles.push({ data: m, classes: m.$type });
        });
        cEdges.forEach(m => {
            this.eles.push({ data: m, classes: m.$type });
        });
    }

    initWithDataNodes(dnList: DataNode<any>[]): void {
        //let ele: NodeDataDefinition | EdgeDataDefinition = {};
        let cNodes: NodeDataDefinition[] = [];
        let cEdges: EdgeDataDefinition[] = [];

        dnList.forEach(m => {

            //startup node
            let nodeType = "object";
            if (!m.$fromQN?.$fromDN) {
                nodeType = "start-object";
            }

            //pnode
            let pParentId = `$c.${m.$ns}.${m.$id}`;
            let eleFromParent: NodeDataDefinition = {
                id: pParentId,
                $source: null,
                $type: "parent",
                $ns: m.$ns,
                $name: m.$ns,
                label: "",
            };
            //eleFromParent = this.tryAddCNode(cNodes, eleFromParent);
            cNodes.push(eleFromParent);

            //node
            let eleId = `${m.$ns}.${m.$id}`;
            let eleFrom: NodeDataDefinition = {
                id: eleId,
                parent: pParentId,
                $source: null,
                $type: nodeType,
                $data: m.data,
                $ns: m.$ns,
                $name: m.$ns,
                label: m.$ns,
            };
            cNodes.push(eleFrom);

            for (let key in m.data) {
                let val = m.data[key];

                //property
                let propId = `${eleId}.${key}`;
                let prop: NodeDataDefinition = {
                    id: propId,
                    parent: pParentId,
                    $type: "property",
                    $ns: m.$ns,
                    $name: key,
                    $val: val,
                    label: key,
                };
                cNodes.push(prop);

                //edge: object-property
                let edgeProp: EdgeDataDefinition = {
                    id: `${eleId}-${propId}`,
                    source: eleId,
                    target: propId,
                    $type: "property",
                    $ns: m.$ns,
                    $name: `${eleId}-${propId}`,
                };
                cEdges.push(edgeProp);
            }
        });

        //links:
        dnList.forEach((m, idx) => {
            //edge-link:
            let from = m.$fromQN?.$fromDN;
            if (!from) { return; }

            /*
            //TODO: remove & draw the startup this later
            let fromLN = m.$fromQN?.$fromLN;
            if (!fromLN) { return; }
            */

            let fromId = `${from.$ns}.${from.$id}`;
            let toId = `${m.$ns}.${m.$id}`;

            console.log(`draw link: ${fromId} | ${toId}`);

            //edge: link
            let edge: EdgeDataDefinition = {
                id: `${fromId}-${toId}`,
                source: fromId,
                target: toId,
                $type: "link",
                $ns: m.$ns,
                $name: (m.$id || "").toString(),
            };
            cEdges.push(edge);
        });

        cNodes.forEach(m => {
            this.eles.push({ data: m, classes: m.$type });
        });
        cEdges.forEach(m => {
            this.eles.push({ data: m, classes: m.$type });
        });
    }

    init(styleType: CytoscapeStyleType = "default"): Core {
        
        let style = (styleType === "default" ? CytoscapeUtil.getDefaultStyle() : CytoscapeUtil.getDataStyle());
        return cytoscape({
            container: document.getElementById(this.containerId),
            elements: this.eles,

            layout: {
                name: 'preset'
            },

            // so we can see the ids
            style: style
        });
    }
}