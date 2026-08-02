import { Injectable } from '@nestjs/common';
import {
  safeFetchFeed,
  type SafeFetchOptions,
  type SafeFetchResult,
} from './safe-http.util';

/**
 * Injectable wrapper around `safeFetchFeed`.
 *
 * The logic lives in the util - this class adds nothing but a seam. It exists
 * because the fetch is the one step in the sync pipeline that cannot run in a
 * test: the SSRF guard refuses loopback and private addresses (correctly), so a
 * local fixture server is unreachable by our own defences, and an external URL
 * would make the suite depend on someone else's uptime.
 *
 * Making it a provider lets an integration test replace THIS and leave every
 * other layer real. Module-mocking the util instead is what the first attempt
 * did, and under jest's ESM loader a factory that imports the module it is
 * mocking recurses until the heap dies.
 */
@Injectable()
export class FeedFetcherService {
  fetch(url: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
    return safeFetchFeed(url, options);
  }
}
