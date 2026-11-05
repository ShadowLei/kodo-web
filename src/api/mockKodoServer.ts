import {
  DataNode as KodoDataNode,
  Kodo,
  MemoryProvider,
  NodeTranslator,
  type DataNode,
  type LinkNode,
  type NotificationRule,
  type QueryNode,
  type QueryExpression,
} from "kodo-core";

import type { IKodoServer } from "./IKodoServer";
import type {
  CheckRulesRequestDTO,
  CheckRulesResponseDTO,
  DataModelDTO,
  DataNodeDTO,
  DataNodeRefDTO,
  LinkNodeDTO,
  LookupRequestDTO,
  LookupResponseDTO,
  NetworkDTO,
  NetworkSummaryDTO,
  NotificationRuleDTO,
  WebConsoleBatchDTO,
} from "./contracts";
import { WebConsoleNotifier } from "./WebConsoleNotifier";

/* ------------------------------------------------------------------ *
 * Simulated web tier.
 *
 * This class plays the role a real HTTP server would play: it owns the
 * kodo-core instances (Kodo + NodeTranslator + MemoryProvider), exposes a
 * network catalog + data models, and executes `kodo.lookup()` / `explore()`.
 *
 * Swap this for an HTTP-backed implementation of `IKodoServer` when a real
 * web server exists.
 * ------------------------------------------------------------------ */

interface SeedRow {
  ns: string;
  data: Record<string, unknown>;
}

interface LinkDef {
  $from: string;
  $to: string;
  $fromField: string;
  $op: string;
  $toField: string;
}

interface NetworkDef {
  id: string;
  name: string;
  dataModels: DataModelDTO[];
  rows: SeedRow[];
  links: LinkDef[];
}

/**
 * Normalize `DataNode.$fromQN` across kodo-core versions.
 *
 * 0.1.7 stored a single `QueryNode`; 0.1.8 changed it to `QueryNode[]`.
 * Accepting both keeps a stale install (new code, old dependency) from
 * throwing `TypeError: object is not iterable` at runtime.
 */
function recordedQueryNodes(dn: DataNode<unknown>): QueryNode<unknown>[] {
  const qn = dn.$fromQN as unknown as
    | QueryNode<unknown>
    | QueryNode<unknown>[]
    | null
    | undefined;
  if (!qn) return [];
  return Array.isArray(qn) ? qn : [qn];
}

export class MockKodoServer implements IKodoServer {
  private readonly networkDefs = new Map<string, NetworkDef>();
  private readonly kodos = new Map<string, Kodo>();
  /** One WebConsole sink per Kodo instance, registered by default. */
  private readonly webConsoles = new Map<string, WebConsoleNotifier>();
  private consoleSeq = 0;

  constructor() {
    this.registerNetworks();
  }

  /* ------------------------------ catalog ------------------------------ */

  async listNetworks(): Promise<NetworkSummaryDTO[]> {
    return Array.from(this.networkDefs.values()).map((d) => ({
      id: d.id,
      name: d.name,
    }));
  }

  async getNetwork(id: string): Promise<NetworkDTO> {
    const def = this.requireNetwork(id);
    return {
      id: def.id,
      name: def.name,
      linkNodes: def.links.map((l) => this.toLinkNodeDTO(l)),
      dataModels: def.dataModels,
    };
  }

  async getDataModel(networkId: string, ns: string): Promise<DataModelDTO> {
    const def = this.requireNetwork(networkId);
    const dm = def.dataModels.find((m) => m.name === ns);
    if (!dm) {
      throw new Error(`Data model not found: ${ns}`);
    }
    return dm;
  }

  /* ------------------------------ lookup ------------------------------ */

  async lookup(req: LookupRequestDTO): Promise<LookupResponseDTO> {
    const kodo = this.kodos.get(req.networkId);
    if (!kodo) {
      throw new Error(`Network not found: ${req.networkId}`);
    }

    // Apply the KodoOption (tierLimit / limit / recursion / cache) from the UI.
    kodo.setOption({
      tierLimit: req.options.tierLimit ?? 0,
      limit: req.options.limit ?? 10,
      recursion: req.options.recursion ?? true,
      cache: req.options.cache ?? false,
    });

    const queryNode: QueryNode<unknown> = {
      $ns: req.ns,
      expression: req.expression as QueryExpression<unknown>,
    };

    const dataNodes = await kodo.explore(queryNode);
    const consoleBatch = await this.runRuleChecks(
      req.networkId,
      req.ns,
      req.rules ?? [],
      dataNodes,
      "query",
    );

    return {
      nodes: dataNodes.map((dn) => this.toDataNodeDTO(dn)),
      console: consoleBatch,
    };
  }

  /** Re-check rules against result nodes the UI already holds. */
  async checkRules(req: CheckRulesRequestDTO): Promise<CheckRulesResponseDTO> {
    const kodo = this.kodos.get(req.networkId);
    if (!kodo) {
      throw new Error(`Network not found: ${req.networkId}`);
    }

    const nodes = req.nodes.map((node) => this.toKodoDataNode(node));
    const consoleBatch = await this.runRuleChecks(
      req.networkId,
      req.ns,
      req.rules,
      nodes,
      "check",
    );
    return { console: consoleBatch };
  }

  /* ------------------------------ helpers ------------------------------ */

  /**
   * Run kodo-core's notification engine and collect the `web-console`
   * channel's output into one batch.
   *
   * kodo-core only invokes notifiers for violations, so a rule that passed is
   * reported to the notifier explicitly here. That keeps the success line
   * (`"<id> Exec Succeed"`) in the same batch as the failures.
   */
  private async runRuleChecks(
    networkId: string,
    ns: string,
    rules: NotificationRuleDTO[],
    nodes: KodoDataNode<any>[],
    kind: "query" | "check",
  ): Promise<WebConsoleBatchDTO | undefined> {
    const kodo = this.kodos.get(networkId);
    const webConsole = this.webConsoles.get(networkId);
    if (!kodo || !webConsole) {
      throw new Error(`Notifiers are not registered for network: ${networkId}`);
    }

    webConsole.reset();
    if (rules.length === 0) return undefined;

    const activeRules = rules.filter((rule) => rule.active !== false);
    const violations = await kodo.checkRules(activeRules as NotificationRule[], nodes);
    const violatedRules = new Set(violations.map((violation) => violation.rule));

    for (const rule of activeRules) {
      if (violatedRules.has(rule)) continue;
      if (!rule.notify?.channels?.includes(webConsole.name)) continue;
      await webConsole.notify(rule as NotificationRule, []);
    }

    const messages = webConsole.drain();
    if (messages.length === 0) return undefined;

    return {
      id: `console-${++this.consoleSeq}`,
      at: new Date().toISOString(),
      title:
        kind === "query"
          ? `Query ${ns} · ${nodes.length} node(s)`
          : `Rules check · ${ns} · ${nodes.length} node(s)`,
      messages,
    };
  }

  private toKodoDataNode(node: DataNodeDTO): KodoDataNode<any> {
    const kodoNode = new KodoDataNode<any>();
    kodoNode.$ns = node.$ns;
    kodoNode.$id = node.$id;
    kodoNode.data = node.data;
    return kodoNode;
  }

  private requireNetwork(id: string): NetworkDef {
    const def = this.networkDefs.get(id);
    if (!def) {
      throw new Error(`Network not found: ${id}`);
    }
    return def;
  }

  private toLinkNodeDTO(l: LinkDef): LinkNodeDTO {
    return {
      $id: `ln-${l.$from}-${l.$to}`,
      $from: l.$from,
      $to: l.$to,
      expression: {
        $from: l.$fromField,
        $op: l.$op,
        $to: l.$toField,
        $where: [],
      },
    };
  }

  private toDataNodeDTO(dn: DataNode<unknown>): DataNodeDTO {
    // kodo-core >= 0.1.8 keeps every query path that reached this node, so a
    // node can have several parents. A query node without `$fromDN` is the
    // startup query: it contributes no data-node parent, but marks the node
    // as a direct query result.
    const seen = new Set<string>();
    const from: DataNodeRefDTO[] = [];
    let fromQuery = false;
    for (const qn of recordedQueryNodes(dn)) {
      const parent = qn?.$fromDN;
      if (!parent) {
        fromQuery = true;
        continue;
      }
      const key = `${parent.$ns}.${String(parent.$id)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      from.push({ $ns: parent.$ns, $id: parent.$id });
    }
    return {
      $ns: dn.$ns,
      $id: dn.$id,
      data: (dn.data ?? {}) as Record<string, unknown>,
      $from: from,
      $fromQuery: fromQuery,
    };
  }

  private registerNetwork(def: NetworkDef): void {
    this.networkDefs.set(def.id, def);

    const kodo = new Kodo(def.name, { cache: false });

    const provider = new MemoryProvider();
    def.rows.forEach((r) => provider.add(r.ns, r.data));

    const translator = new NodeTranslator();
    def.links.forEach((l) => {
      translator.link({
        $from: l.$from,
        $to: l.$to,
        expression: {
          $from: l.$fromField,
          $op: l.$op,
          $to: l.$toField,
          $where: [],
        },
      } as LinkNode<any, any>);
    });

    kodo.registerTranslator(translator);
    kodo.registerProvider("*", provider);

    const webConsole = new WebConsoleNotifier();
    kodo.registerNotifier(webConsole);
    this.webConsoles.set(def.id, webConsole);

    this.kodos.set(def.id, kodo);
  }

  private registerNetworks(): void {
    this.registerNetwork(orderNetwork());
    this.registerNetwork(bookNetwork());
  }
}

/* ---------------------------- sample networks ---------------------------- */

function orderNetwork(): NetworkDef {
  return {
    id: "order-net",
    name: "Order / Payment",
    dataModels: [
      {
        name: "Order",
        fields: [
          { name: "id", type: "string" },
          { name: "logid", type: "string" },
          { name: "operator", type: "string" },
        ],
      },
      {
        name: "Payment",
        fields: [
          { name: "id", type: "string" },
          { name: "orderid", type: "string" },
          { name: "amount", type: "number" },
          { name: "operator", type: "string" },
        ],
      },
      {
        name: "PaymentDetail",
        fields: [
          { name: "id", type: "string" },
          { name: "paymentid", type: "string" },
          { name: "amount", type: "number" },
          { name: "desc", type: "string" },
        ],
      },
      {
        name: "OrderOwner",
        fields: [
          { name: "id", type: "string" },
          { name: "orderid", type: "string" },
          { name: "name", type: "string" },
        ],
      },
    ],
    rows: [
      { ns: "Order", data: { id: "o1", logid: "111" } },
      { ns: "Order", data: { id: "o2", logid: "shadow" } },
      { ns: "Order", data: { id: "o3", logid: "P12345", operator: "Shadow" } },
      { ns: "Order", data: { id: "o4", logid: "P12345", operator: "Allen" } },

      { ns: "Payment", data: { id: "p1-1", orderid: "o1", amount: 500 } },
      { ns: "Payment", data: { id: "p3-1", orderid: "o3", amount: 1300 } },
      { ns: "Payment", data: { id: "p3-2", orderid: "o3", amount: 2500 } },
      { ns: "Payment", data: { id: "p4-1", orderid: "o4", amount: 1100 } },
      { ns: "Payment", data: { id: "px-1", orderid: "xxx", amount: 5600 } },
      { ns: "Payment", data: { id: "px-2", orderid: "xxx", amount: 9000 } },

      { ns: "OrderOwner", data: { id: "oo3-1", orderid: "o3", name: "LPSV0001" } },

      { ns: "PaymentDetail", data: { id: "pd3-1", paymentid: "p3-1", amount: 2400, desc: "payment on 2023" } },
      { ns: "PaymentDetail", data: { id: "pd3-2", paymentid: "p3-2", amount: 2800, desc: "payment on 2024" } },
    ],
    links: [
      { $from: "Order", $to: "Payment", $fromField: "id", $op: "==", $toField: "orderid" },
      { $from: "Order", $to: "OrderOwner", $fromField: "id", $op: "==", $toField: "orderid" },
      { $from: "Payment", $to: "PaymentDetail", $fromField: "id", $op: "==", $toField: "paymentid" },
    ],
  };
}

function bookNetwork(): NetworkDef {
  return {
    id: "book-net",
    name: "Book / Author",
    dataModels: [
      {
        name: "Book",
        fields: [
          { name: "id", type: "string" },
          { name: "title", type: "string" },
          { name: "authorId", type: "string" },
          { name: "publisherId", type: "string" },
          { name: "price", type: "number" },
        ],
      },
      {
        name: "Author",
        fields: [
          { name: "id", type: "string" },
          { name: "name", type: "string" },
        ],
      },
      {
        name: "Publisher",
        fields: [
          { name: "id", type: "string" },
          { name: "name", type: "string" },
        ],
      },
    ],
    rows: [
      { ns: "Book", data: { id: "b1", title: "Kodo In Action", authorId: "a1", publisherId: "p1", price: 39.9 } },
      { ns: "Book", data: { id: "b2", title: "Graph Theory", authorId: "a2", publisherId: "p1", price: 59.0 } },
      { ns: "Book", data: { id: "b3", title: "Data Networks", authorId: "a1", publisherId: "p2", price: 45.5 } },

      { ns: "Author", data: { id: "a1", name: "Shadow Lei" } },
      { ns: "Author", data: { id: "a2", name: "Alan Turing" } },

      { ns: "Publisher", data: { id: "p1", name: "O'Reilly" } },
      { ns: "Publisher", data: { id: "p2", name: "MIT Press" } },
    ],
    links: [
      { $from: "Book", $to: "Author", $fromField: "authorId", $op: "==", $toField: "id" },
      { $from: "Book", $to: "Publisher", $fromField: "publisherId", $op: "==", $toField: "id" },
    ],
  };
}

