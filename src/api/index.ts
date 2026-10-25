export * from "./contracts";
export * from "./IKodoServer";
export * from "./mockKodoServer";

import type { IKodoServer } from "./IKodoServer";
import { MockKodoServer } from "./mockKodoServer";

/**
 * Single access point for the UI.
 *
 * Currently returns the in-memory simulation. When a real HTTP web server is
 * available, replace this body with e.g. `new HttpKodoServer(baseUrl)` — the
 * rest of the app is already written against the `IKodoServer` contract.
 */
export function createKodoServer(): IKodoServer {
  return new MockKodoServer();
}
