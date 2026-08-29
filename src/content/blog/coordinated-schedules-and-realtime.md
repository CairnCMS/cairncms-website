---
title: "v1.5.0 Maintainer Notes: Coordinated Schedules and Realtime"
description: "How CairnCMS coordinates scheduled work across replicas and delivers permission-aware realtime updates."
pubDate: 2026-08-29
category: News
author: CairnCMS
---

CairnCMS v1.5.0 introduces two connected additions for multi-instance deployments: coordinated schedules and realtime WebSockets. Schedule coordination prevents every API replica from running the same scheduled flow or extension hook, while realtime gives applications permission-aware change notifications through an item protocol, GraphQL subscriptions, and the JavaScript SDK. Although these features address different application needs, both depend on a consistent understanding of which API processes belong to one deployment. CairnCMS uses its existing messenger topology for that purpose, with Redis carrying coordination claims and realtime notifications between replicas.

This post explains the design choices behind both features. Readers who only need to configure the features should begin with the [schedule coordination documentation](https://cairncms.dev/docs/manage/configuration/#schedule-coordination) and the [realtime documentation](https://cairncms.dev/docs/api/realtime/).

## Motivation

Horizontal scaling changes the ownership assumptions that are implicit in a single API process. A local scheduler has one obvious place to run a callback, and an in-memory event bus can reach every client connected to that process. Once several replicas serve the same deployment, each replica can observe the same scheduled occurrence, while a mutation handled by one replica may need to reach a WebSocket connected to another.

These cases require different forms of distributed coordination. Scheduled work needs one replica to acquire the right to begin a particular occurrence, and every other replica must decline it. Realtime needs each replica to publish mutations into a shared delivery path without weakening authorization or requiring the client to be connected to the process that handled the write. Both features must also define what happens when a replica or Redis becomes unavailable, because availability without an ownership rule can produce duplicate work or an incomplete view of state.

CairnCMS already groups replicas through `MESSENGER_STORE` and `MESSENGER_NAMESPACE`, so v1.5.0 uses that same boundary instead of introducing a second cluster configuration. The local messenger preserves single-process behavior, while `MESSENGER_STORE=redis` connects the replicas that share a Redis service and namespace. Independent deployments that use the same Redis service must use different namespaces so that one deployment cannot suppress another deployment's schedules or receive its realtime notifications.

## Coordinating scheduled work

Every CairnCMS process continues to register scheduled flows and full-authority extension schedule hooks locally. When an occurrence arrives, each replica presents the same schedule identity and occurrence time to Redis, where one replica advances the shared claim and enters the callback. The remaining replicas skip that occurrence, and no leader election is required because winning one claim gives a process no authority over the next one.

### Claiming an occurrence

The coordinator stores one member per schedule identity in a Redis sorted set, using the latest claimed occurrence as its score. The `ZADD GT CH` operation advances that score only when the proposed occurrence is newer, so the first replica to present an occurrence changes the value and receives admission. Equal and older occurrences leave the score unchanged and are refused.

The identity must remain stable when a schedule is edited or reloaded. Flow schedules use the flow UUID, while extension hooks use the extension or bundle entry together with the registration order of its schedule handlers. The cron expression is excluded because including it would give an edited rule a second identity and could allow the old and new definitions to claim the same wall-clock transition during a reload.

Claims also remain in place after a callback finishes, an extension reloads, or a process shuts down. Releasing a claim would allow a slower replica to admit an occurrence that another process had already started, which could repeat an external side effect after a partial failure. Keeping the monotonic claim preserves the admission decision even after the process that won it is no longer available.

The coordinator deliberately provides at-most-once admission while coordination is healthy. CairnCMS remains an application layer over the operator's database, which is authoritative, so it does not add a durable job ledger or decide when application side effects should be retried. Operators who need persisted retries can pair scheduled callbacks with idempotent application logic and durable job infrastructure suited to their workload. Under this policy, a callback failure is not transferred to another replica, occurrences missed while every replica is offline are not replayed, and a long callback can overlap its next occurrence. This separation prevents the coordination layer from repeating partially completed work without the application-specific knowledge needed to do so safely.

### Failure and recovery

When Redis is unavailable, CairnCMS keeps the API online but suppresses coordinated schedules because running without a claim would restore the duplicate behavior the feature is designed to prevent. The coordinator does not queue claims for later (see preceding paragraph), and each Redis command has a deadline so that later occurrences do not accumulate behind a stalled connection. The client continues reconnecting and checking command support, after which scheduling resumes with the next occurrence.

This recovery behavior is visible through `/server/health`, which reports the messenger and schedule coordinator separately. Redis error events are contained without printing raw dependency stacks throughout a reconnect storm, and messenger subscriptions are restored after recovery without implying that messages sent during the outage were replayed. The result is a fail-closed scheduling path that does not take the rest of the API offline.

### Cron behavior in v1.5.0

The release moves scheduling to `node-cron` 4.6.0 and uses its parser and runtime directly, rather than maintaining a second cron grammar or rewriting stored expressions. This corrects behavior inherited from node-cron 3 for some stepped day and month ranges, weekday ranges involving `7`, reversed ranges, and modifiers such as `L`, `W`, and `#`.

Because the parser now evaluates these expressions correctly, it's possible that some schedules can run at different times after the upgrade. CairnCMS exposes this as an upgrade concern instead of adding a compatibility layer around incorrect behavior. Operators should review scheduled flows and extension hooks before starting v1.5.0, using the [flow trigger reference](https://cairncms.dev/docs/guides/flows/triggers/) as the supported dialect.

## Realtime as a subsystem

Realtime in v1.5.0 spans the server, messenger, extension system, and JavaScript SDK. The operator-facing surface includes:

- the item protocol on `/websocket`, with snapshots, item operations, and collection subscriptions
- GraphQL subscriptions on `/graphql` through `graphql-transport-ws`
- `public`, `handshake`, and `strict` authentication modes per transport
- the `realtime()` composable in `@cairncms/sdk`
- lifecycle hooks and a `WebSocketService` for full-authority extensions
- Redis fan-out for clients connected across API replicas

Realtime is disabled by default, and operators choose which transports to expose along with their paths, authentication modes, timeouts, and connection limits. Regardless of that configuration, a WebSocket must preserve the same authorization boundary as an ordinary CairnCMS request. Create and update payloads therefore contain only the state a client could read at delivery time, even when its connection has remained open while permissions or user status changed.

### Permission-aware delivery

A source mutation places only the collection, action, and affected keys on the messenger, rather than publishing an item payload for direct delivery. For each recipient, CairnCMS refreshes the connection's permissions and reads the affected item through the normal service path. The subscription's item target, query, selected fields, row permissions, and applicable read hooks all shape that recipient-specific result.

As a result, two subscribers can receive different results from the same mutation. Tenant-filtered roles see only rows in their tenant, permissions that use `$CURRENT_USER` follow the connected user, and rows begin appearing when an update moves them into scope. When an update moves a row out of scope, delivery stops without sending a synthetic removal that could disclose data the recipient can no longer read.

GraphQL subscriptions use the same authorization path. CairnCMS refreshes permissions before constructing the role-scoped subscription schema and again when reading an event for delivery, while the normal token limit, introspection setting, validation, variables, fragments, aliases, and selection shaping continue to apply. GraphQL therefore adds a different subscription syntax without creating a separate permission model.

Static user tokens require a database check because they have no expiry timer. CairnCMS reloads the user before each application command and delivery read, so deleting or suspending the user, or replacing the token, invalidates the connection's identity on the next unit of work. Changes to the user's role, administrator access, and application access are adopted without reopening the socket, and the raw token is not retained to perform this check.

### Delete notifications

Delete notifications need a narrower authorization rule because the row is gone before delivery can read it. Without the row, CairnCMS cannot evaluate a row-level filter or apply a read hook, so ordinary permission-aware payload delivery is unavailable.

The delete feed therefore requires an explicit `event: delete` subscription with no row query and unconditional read access to the collection and its primary key. Its messages carry keys rather than deleted item data, and CairnCMS checks eligibility both when the subscription is created and when a deletion is delivered. If that authority is later narrowed, the delete subscription is removed because an error at that point could disclose subsequent activity in a collection the client may no longer observe.

### Disclosure-safe errors

Authorization also determines what a rejected subscription may reveal. An unknown collection, an internal table, and an existing collection the caller cannot read all produce the same item-protocol `FORBIDDEN` response, preventing the endpoint from becoming a collection-existence oracle.

GraphQL setup errors follow the expected-error model already used by HTTP, which preserves useful validation details where they are safe and suppresses field-name suggestions when introspection is disabled. Unexpected execution failures remain in server diagnostics rather than becoming protocol detail. Together, these responses preserve CairnCMS's existing disclosure model across both realtime transports.

## Managing long-lived work

WebSockets retain work beyond the lifetime of an individual request, including authentication attempts, queued commands, subscriptions, source events, database reads, outbound frames, and timers. The implementation gives each retained unit a defined owner, a resource bound, and a terminal path so that a failed upgrade, closed connection, or replaced operation cannot leave work behind.

That lifecycle begins during the HTTP upgrade. Routing assigns the request to one controller, while an unmatched path receives `404` before the raw socket is destroyed. CairnCMS reserves admission before the upgrade completes, transfers the reservation from the client IP to the authenticated user when appropriate, and releases it even when the WebSocket library rejects a malformed handshake without invoking its completion callback.

After connection setup, commands execute serially behind a finite waiting queue, and GraphQL operation sequencing participates in the same bound. When a client reuses an operation identifier, the replacement waits for its predecessor to finish handing off while later frames remain subject to the connection's normal overload policy. This keeps GraphQL ordering work inside the resource accounting shared by both transports.

Subscription capacity is reserved atomically, and dispatch preserves accepted order within each subscription while limiting concurrent delivery work. A failure for one recipient is contained so that later recipients and events can continue. If the process-wide source queue reaches its bound, CairnCMS closes subscribed connections on that process with `1013` and refuses further event work until the queue recovers, making the resulting delivery gap visible to clients.

Outbound work is bounded in the same way. An oversized frame closes with `1009`, while a slow consumer that fills its outbound queue closes with `1013`. These controls protect the API process from unbounded retained work, although operators remain responsible for sizing compute and database capacity for their subscription volume and query cost.

## Rebuilding SDK message handling

The initial inherited SDK implementation included a polling design in which a callback waited for the next WebSocket message and each async iterator requested another callback when `next()` was called. Because no callback owned a frame that arrived between pulls, the frame could be lost. The same division of responsibility complicated authentication acknowledgements, reconnect behavior, iterator cleanup, and subscription identifier reuse.

The refactored SDK replaces that polling loop with one continuously attached message router that parses each frame once and routes targeted frames into per-subscription channels. A channel hands a frame directly to a waiting iterator or retains it until the consumer pulls, while retained frames share a client-wide budget of 1,000 frames or 8 MiB measured from the original received data. If that budget is exceeded, the SDK fails active iterators, clears replay ownership, and closes the socket without starting an automatic reconnect loop.

Connection setup now has one owner and one deadline across socket open, token retrieval, authentication, and acknowledgement, with concurrent callers joining the same attempt. A socket becomes eligible for recovery only after setup has fully succeeded, preventing an open but unauthenticated socket from starting a background reconnect cycle. This distinction also gives manual connection attempts and automatic recovery a consistent view of the current socket.

During a recoverable close, the reconnect loop retains active subscriptions and replays each one once after the replacement connection succeeds. The replay set is captured when recovery begins, which excludes subscriptions created on the replacement socket and prevents duplicate registration. Subscription identifiers are reserved before waiting for a connection, and cleanup verifies object ownership so that an older iterator cannot remove a same-identifier successor.

Authentication retry follows the same ownership model. `TOKEN_EXPIRED` can trigger at most one automatic resend for each token returned by the authentication composable, and refresh work remains bound to the socket that requested it so that a delayed token lookup cannot authenticate a replacement. Manual disconnect completes iterators normally without starting recovery, whereas a terminal connection failure rejects them and allows consumers to distinguish an intentional stop from a broken stream.

The public subscription workflow remains straightforward, but its behavior no longer depends on a consumer waiting at the right moment or a connection closing in a particular order. Frames remain available between iterator pulls, recoverable connections replay their existing registrations once, and terminal failures reach the consumer through the iterator.

## Realtime delivery and reconciliation

CairnCMS treats the database as the authoritative state and realtime notifications as prompts to refresh that state. The local messenger and Redis Pub/Sub distribute current events without retaining an event history, so a client disconnected during a mutation will not receive it later. A Redis interruption can also drop a cross-instance notification without necessarily closing the client socket.

The SDK reconnects and replays active subscription registrations, but registration replay does not recover notifications missed during the interruption. Applications should reread the state they depend on after reconnecting, and applications with tighter freshness requirements can also reconcile on their own schedule. This keeps realtime focused on responsive interfaces and event-driven refresh while leaving durable consumption to systems with persisted offsets, replay storage, retention policy, and consumer ownership.

## Establishing the architecture

The implementation began with precedent research and direct testing rather than assuming defaults. For schedule coordination, we verified the behavior of Redis and node-cron against CairnCMS's failure policy. That work led to a monotonic claim with a stable schedule identity, conservative deadlines, and recovery that keeps scheduling closed until coordination is healthy.

Realtime required a broader study because persistent connections introduce resource and lifecycle decisions that ordinary HTTP requests do not. We compared several established realtime systems, then measured CairnCMS with real API processes, PostgreSQL, Redis, representative payloads, and sustained traffic. This gave us evidence for the finite bounds that shipped in v1.5.0 and helped us reject restrictions or concurrency changes that offered no demonstrated benefit.

Across both features, the research produced the same architectural principle: long-lived work needs explicit ownership. Connections, commands, subscriptions, deliveries, iterators, and retries each have a defined owner, resource bound, and terminal outcome. That precision lets CairnCMS coordinate replicas and deliver responsive updates while preserving the database as the authoritative state.
