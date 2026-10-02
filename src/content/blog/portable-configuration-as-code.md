---
title: "v1.6.0 Maintainer Notes: Portable Configuration as Code"
description: "How CairnCMS gives teams a reviewable deployment contract for database-backed configuration, including declared extension settings."
pubDate: 2026-10-02
category: News
author: CairnCMS
---

CairnCMS v1.6.0 expands configuration as code from roles and permissions to folders, project settings, extension settings, and custom translations. These six resource kinds can travel between environments as readable, version-controlled files, with a shared engine handling validation, planning, and apply. The database is the source of truth for CairnCMS's live configuration, and the files capture a point-in-time representation of the desired database configuration. This post explains why we chose that architecture and how it supports self-hosted development teams. Command reference and file formats are available in the [configuration as code documentation](https://cairncms.dev/docs/manage/config-as-code/).

## Motivation

As a headless layer in front of a database, CairnCMS provides an API through which websites, applications, automated services, and many other consumers access data. Configuration that defines roles, public access permissions, the filters that restrict users to their tenant's records, extension settings, etc. shape application behavior and security boundaries, so they deserve the same review and deployment discipline as application code.

Moving between environments needs to preserve those decisions. Configuration as code captures the desired database state in reviewable files and applies it through a consistent process, giving projects of different sizes a repeatable way to deploy their configuration.

## Database-backed authoring, file-based deployment

CairnCMS's database-first architecture gives the database and the configuration files distinct responsibilities. The baseline is a database configuration that has been tested and accepted, and a snapshot records that state at a point in time for review and deployment, if needed. Applying the snapshot reproduces its desired configuration in the target database, keeping the database authoritative for the configuration CairnCMS uses in its admin app and when serving connected applications.

The command sequence reflects those responsibilities. Snapshot runs against the instance where changes were authored, while dry-run and apply run against the intended target. The preview shows the proposed database changes before the operator proceeds, and the apply performs the validated changes. This keeps the everyday workflow short while placing the detailed correctness work in the engine:

```sh
cairncms config snapshot ./config
cairncms config apply --dry-run ./config
cairncms config apply ./config
```

## Choosing portable identity

A portable configuration needs an identity that survives the move between databases. A same-named role created in development and one created in production have different UUIDs, even when they serve the same purpose. Copying permissions between them requires resolving which local role each permission should reference. We wanted that answer to be expressed in the configuration itself, so reviewers and deployment automation would use the same definition of identity.

Cross-instance identity can be expressed through a shared identifier or through a source-to-target ID map. A shared synchronization ID gives corresponding resources the same portable identity, even when their local UUIDs differ. A source-to-target map records that one instance's row corresponds to another instance's row, sometimes establishing that relationship by comparing names or parent relationships. The architectural choice is where that correspondence is recorded and how each target can resolve it.

Establishing a source-to-target mapping from mutable fields introduces uncertainty about which resources correspond. A role name, for example, can change independently on either instance. If independently created roles have different IDs and no saved mapping, renaming Editor to Content Editor on one instance can make the role look like a new resource. An additive transfer can then leave two logical copies, while a replacement transfer can propose deleting the unmatched role. Duplicate names create ambiguous matches that need a human decision and can hold up dependent permissions. We declined this approach because our users need repeatable deployments to development databases, staging, and fresh instances without resolving identity from mutable fields or maintaining pairwise mappings.

For roles and folders, we chose human-readable portable keys built into the resources themselves. These keys serve as shared identities across environments, with uniqueness and immutability enforced by the platform. The role key `editor` identifies the same managed resource regardless of its local UUID or display name, so differing values become planned updates. On the first apply to a target, CairnCMS uses the declared keys to find existing resources and creates missing ones with those keys and local UUIDs. The same lookup works on subsequent applies, so deployment needs no preliminary name matching or separate source-to-target ledger.

Folders illustrate why portable identity is separate from a resource's name or location. Renaming a folder or moving it under a different parent leaves its stable key unchanged. A reference such as `parent: documents` identifies the parent by its portable key. During apply, CairnCMS resolves that key to a local UUID using the target's own folder rows. Teams can therefore reorganize folders without changing their portable references or requiring matching database UUIDs across environments.

Other configuration kinds use identities already defined by their domains. A translation is identified by language and key, and a permission by role key, collection, and action. Extension settings use the extension subject, setting key, and scope, including the collection for collection-scoped values. Project settings describe one project record. Together, these identities let the target resolve the declaration directly from its own database, without a separate synchronization ledger.

A configuration snapshot can be deployed independently of the instance that produced it. A team can capture the tested database configuration, review the files, and transfer the approved revision into the destination environment. For internal tools on restricted networks or air-gapped installations, deployment can follow the organization's approved file-transfer process without opening a connection back to development or staging. CairnCMS resolves the portable identities against the target's own database, so applying the configuration needs neither access to the original instance nor its continued existence.

## A shared database configuration for development teams

Declared identity makes parallel development easier to review because different environments speak about the same resources. Two developers can start from the same captured database configuration and change different aspects of the `editor` role on separate branches. Their snapshots refer to the same key and file, so the review concerns the changed behavior and any conflicting edits. A fresh preview instance can then apply the merged declaration and create its own local rows with those keys. The repository records the intended database configuration and its portable identities throughout that workflow.

Drift is easier to account for when each managed scope has a reviewed desired state. If changes are promoted from several live instances in separate batches, a target can accumulate a mixture of settings taken at different times. Successful transfers establish that those batches were applied, but reconstructing the intended whole requires tracking their combined scope, omissions, and subsequent edits. An ID map answers which rows correspond, while the team must still decide which values belong in the release. CairnCMS makes that intended state explicit in the configuration under review.

The manifest lets teams select the resource kinds that belong to that state. A deployment can manage roles and permissions, translations alone, or any supported combination, and snapshots preserve the scope already selected in the manifest. Within managed roles, permissions, folders, and translations, the files describe the complete desired set, including deletions represented by absence. Scope is therefore a version-controlled decision that reviewers can inspect alongside the values, rather than an interpretation assembled from a sequence of promotion commands.

The plan turns differences between the live target and the captured desired database configuration into specific operations. A target-only role appears as a proposed deletion, an altered permission appears as an update, and a removed language produces deletions for its stored translations. Deletions require explicit destructive authorization, while ordinary updates reconcile changed values. This gives the team a concrete account of drift within its selected scope and a consistent way to reproduce the reviewed state.

## Files that carry intent

The file layout makes configuration changes readable in ordinary code review. Roles and folders have files named after their keys, permissions are grouped by role, and custom translations are grouped by language. Project settings occupy one file, while each extension subject has its own settings document. Stable ordering and a defined set of portable fields keep installation metadata out of the diff, so reviewers can concentrate on behavior:

```text
config/
  cairncms-config.yaml
  roles/editor.yaml
  permissions/editor.yaml
  folders/documents.yaml
  folders/reports.yaml
  settings/project.yaml
  extension-settings/cairncms-extension-chat-notify-11fe5f91.yaml
  translations/fr-FR.yaml
```

Large snapshots need stable output to make their diffs useful. The writer sorts YAML mapping keys, orders records by their defined identities, and uses consistent formatting without automatic line wrapping. Translations are grouped into language files and ordered by a fixed string comparison rather than the database's row-return order. Re-exporting unchanged configuration produces the same text, so editing one string among thousands does not reshuffle the surrounding entries. Review effort follows the actual changes instead of fluctuations in export order.

The exported format is a deliberate interface between environments. Folder references use keys, translation files carry literal strings, and each kind defines which fields are portable and how they are validated. Adding a database column therefore requires a separate decision before it becomes part of the configuration format. This keeps the deployment contract focused on supported configuration rather than the incidental shape of system tables.

## Extension settings as portable application configuration

Portable extension settings build on the declaration and storage model introduced in [CairnCMS v1.3.0](https://cairncms.dev/blog/extension-settings-and-item-views/). An extension declares its settings, types, scopes, and secret sources in its manifest, and CairnCMS supplies validation, management screens, storage, and runtime access. Values live in a dedicated internal table, with global and per-collection settings represented explicitly. That foundation gives configuration as code a supported contract for extension behavior as well as core behavior.

Standardized storage removes a separate deployment problem for extension authors. When each extension invents its own settings store or adds fields to an unrelated system table, deployment tooling must learn where those values live and what they mean. The storage layout alone does not describe which values are secrets, which belong to a collection, or which keys the installed extension accepts. CairnCMS already has that information in the declaration, so configuration apply can validate and transport the values through the existing extension service. Authors using declared settings gain portability without building an exporter or migration script for their own configuration.

Extension settings are part of reproducing the application's working behavior. A deployment may depend on an extension for an item view in the admin app, a notification workflow, or an external integration, and installing its code alone does not reproduce the configuration tested in staging. A notification extension, for example, may need both a global sender name and a channel for each collection. CairnCMS snapshots those declared choices and checks them against the target's installed declaration and collections before apply. This includes third-party extensions using declared settings, so teams can deploy the configuration their workflows depend on without owning or modifying the extension's source.

Extension ownership is scoped to the subject files included in the configuration. A present file describes the desired declared stored values for that extension, with omitted values shown as planned deletions that require explicit destructive authorization to apply. An absent subject file leaves that extension untouched, and stored values belonging to removed extensions or declarations are preserved inertly. This accommodates environments with different installed extensions while keeping each managed extension's intended configuration explicit.

## Environment-specific values and credentials

Environment-specific values fit into the declaration through a bounded substitution mechanism. Selected ordinary string fields accept a whole-value placeholder such as `{{CAIRNCMS_CONFIG_PROJECT_URL}}`, which the CLI runner resolves before apply. The HTTP API accepts resolved values, and custom translation strings are treated literally. This lets one reviewed configuration express deployment variation without embedding a scripting language in the files.

Repeated snapshots preserve the deployment choices already declared in the working tree. For example, a team can commit `project_url: "{{CAIRNCMS_CONFIG_PROJECT_URL}}"`, apply a staging URL from its deployment environment, and later change the project description through the admin app. Snapshotting back into that same tree captures the description change and keeps the URL placeholder instead of replacing it with the stored staging address, even if the variable is unset during export. A fresh directory or an HTTP snapshot exports the stored ordinary value because the database does not retain that placeholder declaration. Keeping the existing tree in the export workflow lets operators capture new database changes without repeatedly reconstructing their environment-specific declarations.

Extension secrets use markers and references so their configuration entries survive the same review-and-deploy cycle without copying credentials. A stored inline API token snapshots as `$secret: preserve`, and applying that marker keeps the target's existing token while other settings change. Subsequent snapshots emit the marker again, keeping the setting represented in the file without exposing its value. On a fresh instance, the marker leaves an absent secret unset and the operator supplies it through the admin app or API. Config-sourced secrets are exported as `{{CAIRNCMS_EXT_*}}` references on each snapshot and resolve from the target's deployment environment, allowing the same extension configuration to use different credentials in staging and production.

## An auditable deployment record

Readable identities and files give code review a direct view of security-sensitive configuration. A pull request can expose a proposed removal of the filter restricting invoice reads through the API to the signed-in user's tenant, making the potential cross-tenant access visible before deployment. Reviewers can examine the before-and-after rule, its justification, and access-control tests alongside the manifest's selected scope. An approved revision then records the database configuration intended for staging and production, making tenant-isolation policy part of the team's normal release record.

The apply workflow adds target-specific evidence to that record. Dry-run produces a plan against the live target in readable or machine-readable form, and the apply result records the operation's outcome. A deployment pipeline can retain the Git revision, review approval, target environment, plan, and result together, linking the reason for a change to its execution. This supports an audit trail that explains both the intended configuration and what the deployment attempted to change.

Machine-readable plans also let automation choose its next action from the proposed changes. Running `cairncms config apply --dry-run --format json ./config` emits a versioned JSON document containing resource identities, operations, before-and-after updates, warnings, and protections. A pipeline can skip an unchanged deployment, route public-access or tenant-filter changes for security review, or request explicit approval for deletions. Documented exit codes distinguish an empty plan, planned changes, invalid or refused operations, and operational failures, while standard output carries the JSON separately from logs. These interfaces let teams build deployment policies around structured results instead of parsing terminal prose.

CairnCMS also records supported mutations through its own services. Roles, permissions, folders, project settings, and translations use activity and revision tracking. HTTP applies are attributed to the authenticated administrator, while local CLI applies are attributed to the system, with no user and an origin of `config-cli`. Extension settings use operation-level run logging in keeping with their internal store, and structured run logs report the managed scope, change counts, and outcome. Collecting those logs alongside deployment records lets operators connect the reviewed change with its target environment, recorded caller, and reported outcome.

## Applying the reviewed state

All three consumption paths use one configuration engine. The local CLI invokes it directly, the remote CLI calls the server, and automation can use the administrator-only HTTP API. Validation, planning, destructive authorization, and database mutation follow the same contract in each case. Safety therefore lives with the operation itself and does not depend on the caller using a particular terminal interface.

The engine establishes a complete plan before writing and treats failures to read the managed state as errors. Duplicate identities, invalid references, and incompatible declared settings stop the operation, while a plan containing deletions requires `--destructive` before any of its changes proceed. The separate `--yes` option skips the interactive prompt, and platform protections continue to guard administrator access. These checks distinguish a valid requested change from an incomplete read or an unauthorized destructive operation.

A mutating apply binds its changes to the database state used to plan them. The engine reads the relevant state again inside the transaction and refuses if it has changed, with database isolation protecting the subsequent read-and-write interval. The configuration mutations commit together, and action notifications and cache invalidation run after commit. Each invocation plans afresh against its target, giving deployments a current-state check even when other administrators or API replicas are active.

Direct experiments and failure tests shaped these boundaries. Concurrent administrator changes exposed the need for transaction isolation, and service lifecycle tests established that action notifications must wait for the outer transaction to commit. End-to-end tests exercise export, validation, apply, secret preservation, destructive refusals, and rollback after earlier writes have occurred. The implementation puts those findings behind the ordinary snapshot and apply commands so that operators get the same safeguards throughout the workflow.

## A deployment contract for the whole team

Version 1.6.0 gives CairnCMS teams a common way to manage the six supported configuration kinds across development, staging, and production. Schema changes continue through the separate schema workflow, and content, accounts, and uploaded files use their own migration or backup processes. Configuration occupies a defined place in that deployment sequence, with portable identities, reviewable scope, and a transactional apply. This separation lets each operation carry the guarantees appropriate to the state it manages.

This architecture supports the range of projects people build with CairnCMS, from a hobby project or a frontend website's CMS to an internal tool, SaaS product, or multi-tenant application. A solo developer can move tested settings into production, while a team can incorporate configuration review into its release process. The admin app and API provide familiar ways to author those settings, snapshots capture them for review, and apply reproduces the accepted configuration in the target database. Each project gains a repeatable path from authoring to deployment, with the database authoritative for CairnCMS's live configuration.
