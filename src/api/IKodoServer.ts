import type {
  DataModelDTO,
  LookupRequestDTO,
  LookupResponseDTO,
  NetworkDTO,
  NetworkSummaryDTO,
} from "./contracts";

/**
 * The single contract the UI consumes to talk to "the server".
 *
 * The current implementation (`MockKodoServer`) is an in-memory simulation of
 * the web tier. To move to a real HTTP server, provide another implementation
 * of this interface (e.g. `HttpKodoServer`) that performs `fetch` calls against
 * the same DTO shapes — no UI code needs to change.
 */
export interface IKodoServer {
  /** List all relationship networks (one per left-menu item). */
  listNetworks(): Promise<NetworkSummaryDTO[]>;

  /** Fetch a single network (its LinkNode list + data models). */
  getNetwork(id: string): Promise<NetworkDTO>;

  /** Fetch the dynamic data model for a namespace within a network. */
  getDataModel(networkId: string, ns: string): Promise<DataModelDTO>;

  /** Run a kodo lookup (explore) and return the resulting data-node network. */
  lookup(req: LookupRequestDTO): Promise<LookupResponseDTO>;
}
