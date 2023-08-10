import { DataNode, Kodo, LinkNode, MemoryProvider, NodeTranslator } from "kodo-core";
import { Order, Payment, PaymentDetail, OrderOwner } from "./_modules";
import type { Core } from "cytoscape";
import { CytoscapeInitlizer } from "../utils";
import type { IKodoObject } from "@/_modules";

function initTestKodo(): Kodo {
    let kodo = new Kodo("my-test-net", {
        cache: false
    });

    //0. prepare test data in memory
    let mp = new MemoryProvider();

    //4 orders
    mp.add<Order>("Order", {
        id: "o1",
        logid: "111",
    });
    mp.add<Order>("Order", {
        id: "o2",
        logid: "shadow"
    });
    mp.add<Order>("Order", {
        id: "o3",
        logid: "P12345",    //target test order
        operator: "Shadow"
    });
    mp.add<Order>("Order", {
        id: "o4",
        logid: "P12345",
        operator: "Allen"
    });

    //6 payments
    mp.add<Payment>("Payment", {
        id: "p1-1",
        orderid: "o1",
        amount: 500
    });
    mp.add<Payment>("Payment", {
        id: "p3-1",
        orderid: "o3",
        amount: 1300
    });
    mp.add<Payment>("Payment", {
        id: "p3-2",
        orderid: "o3",
        amount: 2500
    });
    mp.add<Payment>("Payment", {
        id: "p4-1",
        orderid: "o4",
        amount: 1100
    });
    mp.add<Payment>("Payment", {
        id: "px-1",
        orderid: "xxx",
        amount: 5600
    });
    mp.add<Payment>("Payment", {
        id: "px-2",
        orderid: "xxx",
        amount: 9000
    });

    //owner
    mp.add<OrderOwner>("OrderOwner", {
        id: "oo3-1",
        orderid: "o3",
        name: "LPSV0001"
    });

    //2 details
    mp.add<PaymentDetail>("PaymentDetail", {
        id: "pd3-1",
        paymentid: "p3-1",
        amount: 2400,
        desc: "shaodw - payment on 2023"
    });

    mp.add<PaymentDetail>("PaymentDetail", {
        id: "pd3-2",
        paymentid: "p3-2",
        amount: 2800,
        desc: "shaodw - payment on 2024"
    });

    let translator = new NodeTranslator();
    let ln1: LinkNode<Order, Payment> = {
        $ns: "order-payment",
        $fromNS: "Order",
        $toNS: "Payment",
        expression: {
            $from: "id",
            $op: "==",
            $to: "orderid",
            $where: []
        }
    };
    translator.link(ln1);

    let ln2: LinkNode<Order, OrderOwner> = {
        $ns: "order-orderowner",
        $fromNS: "Order",
        $toNS: "OrderOwner",
        expression: {
            $from: "id",
            $op: "==",
            $to: "orderid",
            $where: []
        }
    };
    translator.link(ln2);

    let ln3: LinkNode<Payment, PaymentDetail> = {
        $ns: "payment-detail",
        $fromNS: "Payment",
        $toNS: "PaymentDetail",
        expression: {
            $from: "id",
            $op: "==",
            $to: "paymentid",
            $where: []
        }
    };
    translator.link(ln3);

    kodo.registerTranslator(translator);
    kodo.registerProvider(mp);

    return kodo;
}

function initKodoObjects(): IKodoObject[] {
    let rtn: IKodoObject[] = [];
    let order: IKodoObject<Order> = {
        name: "Order",
        properties: [
            { name: "id" },
            { name: "items" },
            { name: "logid" },
            { name: "operator" },
            { name: "price" },
            { name: "createDate" },
            { name: "updateDate" },
        ]
    };
    rtn.push(order);

    let payment: IKodoObject<Payment> = {
        name: "Payment",
        properties: [
            { name: "id" },
            { name: "orderid" },
            { name: "operator" },
            { name: "amount" },
            { name: "createDate" },
            { name: "updateDate" },
        ]
    };
    rtn.push(payment);

    let pd: IKodoObject<PaymentDetail> = {
        name: "PaymentDetail",
        properties: [
            { name: "id" },
            { name: "paymentid" },
            { name: "desc" },
            { name: "amount" },
            { name: "createDate" },
            { name: "updateDate" },
        ]
    };
    rtn.push(pd);

    let oo: IKodoObject<OrderOwner> = {
        name: "OrderOwner",
        properties: [
            { name: "id" },
            { name: "orderid" },
            { name: "name" },
            { name: "createDate" },
            { name: "updateDate" },
        ]
    };
    rtn.push(oo);

    return rtn;
}

export function initKodoExample(containerId: string): {
    core: Core,
    kodo: Kodo
 } {
    let kodoObjs = initKodoObjects();
    let kodo = initTestKodo();

    let lnList: LinkNode<any, any>[] = [];
    kodo.translators.forEach(m => {
        lnList.push(...m.all());
    });

    let initlizer = new CytoscapeInitlizer(containerId);
    initlizer.initWithKodoObjects(kodoObjs);
    initlizer.initWithLinkNodes(lnList);

    let core = initlizer.init();
    
    return {
        core: core,
        kodo: kodo
    };
}


export function initKodoExampleWithData(containerId: string, dnList: DataNode<any>[]): {
    core: Core,
    kodo: Kodo
 } {
    let kodo = initTestKodo();

    let lnList: LinkNode<any, any>[] = [];
    kodo.translators.forEach(m => {
        lnList.push(...m.all());
    });

    let initlizer = new CytoscapeInitlizer(containerId);
    initlizer.initWithDataNodes(dnList);
    let core = initlizer.init("data");
    
    return {
        core: core,
        kodo: kodo
    };
}
