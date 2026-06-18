---
title: "v1.2.0 Maintainer Notes: Building a Better Sandbox"
description: "An opt-in sandbox for CairnCMS server extensions: the runtime evaluation, the v1.2.0 capability surface, and current limitations."
pubDate: 2026-06-18
category: News
author: CairnCMS
cover: ./extensions-ui.png
coverAlt: The CairnCMS Extensions UI showing sandbox status and applied hardening layers
---

CairnCMS v1.2.0 introduces a number of fixes and features, including a confined runtime for server extensions. This is an opt-in mechanism for running extension server code outside the API process, inside a supervised JavaScript sandbox that reaches the host only through a brokered capability API. A confined extension declares the capabilities it needs, is admitted only after passing a load gate, runs in a separate child process under a hard wall-clock deadline, and is denied raw process authority by default.

Note that the confined runtime does not replace full-authority extensions, which remain supported and remain the default. It adds a second server-side execution model for code that can operate within stricter boundaries.

This post serves as record for the reasoning behind the chosen model, including the runtime candidates that were evaluated, the prototype that shaped the final design, and the limits that remain in the production implementation (at the time of this post).

Readers who only need to use the feature should begin with the [extension documentation](https://cairncms.dev/docs/develop/extensions/).

## Motivation

By default, a server extension executes with the full authority of the API process. It can read environment variables, open files, make network requests, import arbitrary packages, and call internal services. That level of authority is appropriate for code the operator wrote or has otherwise fully vetted. It is excessive for the broader extension ecosystem CairnCMS intends to support, in which an extension that needs to make one outbound request or read one collection should not, by virtue of that need alone, receive the entire process.

The confined runtime addresses this by making a server extension's authority explicit and bounded. An extension states the capabilities it requires, and the runtime grants nothing beyond them. The objective is to make a wide class of server extensions possible to run, review, and observe without extending raw host authority to each one.

As stated, the confined lane is additive. Full-authority extensions continue to load and run as before, and some extensions will always require that lane because they need deep integration or host-level access. The confined lane exists for the subset of server code, in particular, third-party code, whose required effects can be expressed as a small set of declared capabilities.

## Selecting a runtime

Before writing product code, sandbox candidates were evaluated against two requirements. The runtime had to execute representative JavaScript while denying the guest raw access to the host, and it had to do so across the range of environments into which CairnCMS is deployed, without imposing build toolchain constraints on the operator. Three options were tested.

`isolated-vm` was the fastest of the three and offered strong in-engine resource controls. It was disqualified on deployment portability. `isolated-vm` is a native Node addon compiled against specific Node and V8 ABI versions, so the deployment environment must either supply a matching prebuilt binary or carry a full native build toolchain, and the dependency must be rebuilt whenever the underlying Node version changes. CairnCMS cannot make assumptions about operators' environments. Its operators deploy into environments the project does not control, where the addon may become a recurring source of build failures and a limit on which targets are viable at all. The environments most often affected are common ones, including musl-based images such as Alpine, ARM hosts, and air-gapped or network-restricted deployments, where a missing prebuilt binary forces a native build the environment may not be able to perform. For a project whose premise is portable self-hosting, that was the disqualifying factor.

SES (Secure EcmaScript) offered the cleanest authoring model, because extension code stays in JavaScript compartments rather than a separate engine. However, it did not meet the basic requirements. It provides no resource control on its own, rejects language patterns that appear in ordinary bundled dependencies, and hardens the shared realm in ways that are difficult to reconcile with a long-running API process.

QuickJS compiled to WebAssembly was the better choice, primarily because of the operational advantages it offers. It ships as portable WebAssembly rather than a native addon, so it is not coupled to the Node or V8 ABI and requires no build toolchain in the deployment environment. The same artifact runs wherever CairnCMS runs, including the targets that make `isolated-vm` impractical. It also exposes no host imports by default and retains enough compatibility to run ordinary bundled code. It is not the fastest of the three, and no JavaScript engine on its own contains every runaway execution, but the latter fact produced the central runtime decision: the engine runs in a child process supervised by the parent, with a hard wall-clock deadline enforced around every invocation. The resulting design is layered, with QuickJS establishing the language boundary, WebAssembly bounding the engine's memory, and the parent process supervising the child and terminating it when the deadline elapses.

## Prototype findings

An initial prototype validated the execution shape. A confined flow operation ran inside a QuickJS child process and called back into the parent through a broker; the parent validated each call, performed the privileged effect, and returned a structured result. That round trip is the core mechanism the shipped runtime still uses.

## Extension loader foundation

The first part of production-grade construction was not the sandbox itself, rather it was the extension foundation beneath it. A sandbox is only as useful as the authoring loop around it, and that loop did not yet exist in a stable form.

Local full-authority extensions now load by presence, and operators can see what loaded and what failed. The SDK gained commands to scaffold, build, and link extensions, and the authoring loop gained hot reload, sourcemaps, and TypeScript output. Additionally, it was verified that package-local native dependencies function correctly when installed as ordinary packages.

## The confined runtime in v1.2.0

A server extension opts into confinement through its manifest, with `runtime: confined-server`, and declares the capabilities it requires. Operations, endpoints, hooks, and the server entries inside bundles can all run this way. Browser app entries continue to run in the browser, where this mechanism does not apply.

At load time, the confined declaration is treated as a hard contract. The loader scans the declared source, checks that the extension is contained within its package, and probes the built artifact. It fails closed if the extension imports raw Node APIs, uses dynamic code evaluation, escapes its package root, or crashes during the gate. An extension that fails the gate is refused outright.

At invocation time, the API supervisor starts a child host. The child loads the QuickJS WebAssembly engine, evaluates the self-contained extension artifact, runs the handler, and returns the result over a framed transport. The guest has no Node imports, no filesystem API, no raw network access, and no direct reference to CairnCMS internals. Its only exported path to the outside is the brokered `host.*` surface.

That surface is mediated entirely by the parent. Each `host.*` call is checked against the extension's declared capabilities and the accountability of the current invocation. The v1.2.0 surface provides logging, bounded outbound requests to declared origins, read-only item access, and Liquid template rendering. The settings capability ships inert in this release, in that readable settings return `null` until a later release adds the declaration and storage layer behind them.

### Secret references for flow operations

For flow operations, a sensitive option can be supplied as an opaque reference rather than a value. The guest receives a handle, not the secret itself. When the guest passes that handle to a brokered request as an authentication credential, the parent substitutes the real secret at the network boundary, outside the guest's view. Both the handle and the resolved value are scrubbed from logs and revision data. This path is currently implemented for operations only; endpoints and hooks do not yet have it.

### Bundles

A confined bundle exposes one shared server artifact and several entries. Each server entry receives entry-scoped registration metadata. The gate applies to the shared artifact. If it fails, the entire server side of the bundle fails as a unit. If the artifact passes but a single entry collides at registration, the bundle reports a partial status while the remaining entries continue to load.

## Defense in depth: operating-system hardening

The engine boundary is present in every confined invocation. On hosts that support it, CairnCMS applies operating-system hardening around the child process in addition to that boundary.

Three mechanisms are involved. A network namespace removes the child's direct network access. The Node permission model scopes the set of files the child process can read. A cgroup memory cap is applied where the host exposes a usable cgroup mechanism. The default mode, `auto`, applies whatever the host supports and reports the result. The `required` mode refuses to run confined extensions unless the escape-containment core is present, meaning the network namespace and the Node permission model. The cgroup cap remains best-effort, because many ordinary hosts do not delegate cgroup control to the application process.

This posture is reported in diagnostics and in the Extensions UI, including whether the runtime is available, which hardening layers were applied, which were absent, and which extensions are running sandboxed.

## Browser-side egress controls

Server confinement covers only the server half of an extension. App extensions run in the user's browser and cannot be isolated by the same mechanism, so v1.2.0 tightens the default Content Security Policy for `connect-src` on the browser side instead.

The default policy permits same-origin API calls and the fixed map origins that CairnCMS ships, and no longer permits arbitrary external browser fetches. An app extension that needs external data is expected to call a same-origin CairnCMS endpoint, which then performs a declared brokered request server-side. This keeps browser egress bounded while still supporting external integrations, and it is the model that portable app-plus-server bundles are built around.

## Validation through porting

Several existing Directus extensions were ported into CairnCMS before finalizing the documentation. Since code that was not written for the confined model exercises the runtime against assumptions it does not control, this is where portability design gaps were most likely to surface.

The exercise exposed some opportunities for improvement, which were completed, including updating the Vue baseline to improve portability. Importantly, it proved that porting an upstream extension is straightforward, keeping in mind the current limits of the CairnCMS confined model. Confined endpoints cannot yet hold a secret option, sensitive settings are not yet available, and item access is read-only. These are deliberate boundaries for the initial v1.2.0 feature addition.

## Limitations and planned work

Three tasks follow directly from the v1.2.0 sandbox feature addition. Sensitive settings need a declaration and storage path, so that an operator can provide a secret once and a confined extension can receive only an opaque reference to it. Option delivery needs parity across entry types, as the secret-reference path exists only for operations today and should extend to endpoints and hooks. And `host.items` needs write verbs.

Beyond these, the confined runtime is the technical precondition for Quarry, the CairnCMS extension community. Extensions that meet the confined criteria will be eligible to install directly into a running instance, while extensions that require full authority will remain deploy-install only. The confined criteria are what determine which of those two categories an extension falls into.

## Acknowledgements

The confined runtime builds on [`@sebastianwessel/quickjs`](https://github.com/sebastianwessel/quickjs), an MIT-licensed TypeScript wrapper around QuickJS in WebAssembly. CairnCMS adds the supervisor, framed transport, capability broker, load gate, diagnostics, and operating-system hardening around that engine.