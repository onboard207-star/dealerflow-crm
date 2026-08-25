# White-Label Architecture

DealerFlow uses one codebase for many organizations. Tenant identity, branding, features, and display terminology are configuration; they are not forks or authorization boundaries.

## Tenant boundary

An organization is the primary tenant. Every operational record that requires isolation must carry an immutable organization ID and, when applicable, a location ID. Display names, slugs, domains, logos, and colors may change and must never be used as authorization boundaries.

The current tenant configuration contract lives in `lib/platform/tenant`. It validates unknown configuration before use and resolves explicit defaults for:

- organization and product names;
- brand colors and assets;
- custom domain and support metadata;
- enabled modules;
- vertical-specific terminology.

This contract does not authorize access. Authentication establishes an actor, organization membership establishes tenant access, and server-side permission checks authorize capabilities.

## Vertical terminology

The core platform uses stable concepts and IDs. Display terminology may vary:

| Core concept | Automotive | Marine | Powersports |
| --- | --- | --- | --- |
| Catalog item | Vehicle | Boat | Unit |
| Identifier | VIN | Hull ID | VIN |
| Sales location | Dealership | Dealer or Marina | Dealer |

Automotive catalog logic remains an automotive module. Terminology overrides do not convert automotive data into another vertical's data model.

## Branding

Brand configuration feeds semantic design tokens. Components consume semantic roles such as primary, accent, surface, border, and foreground; they must not scatter tenant colors through component code.

Authenticated organization routes resolve configuration server-side under tenant database context. Authorized administrators can update product identity, support metadata, terminology, module flags, and three semantic brand colors with optimistic concurrency and audit evidence. Every successful change creates an immutable tenant-scoped snapshot; restoring a snapshot creates a new rollback version rather than rewriting history. The saved product name and colors are applied consistently to desktop and mobile shells. Colors accept only validated six-digit hexadecimal values, convert to controlled HSL variables, and receive an automatically selected WCAG AA foreground. Arbitrary CSS, asset hosting, and custom-domain activation remain unavailable until managed asset storage and DNS/host ownership verification exist.

## Feature configuration

Features control organization navigation composition alongside capabilities. CRM, Inventory, Finance, and Reporting flags also remove their capability grants during server-side actor resolution, causing existing route and service checks to fail closed. The AI application service separately rejects generation and review when its module is disabled. Hiding a navigation item is never treated as security.

Tenant administrators may configure light-theme logos, optional dark-theme logos, and favicons through credential-free HTTPS asset URLs. The platform validates these values before versioned persistence, renders the appropriate shell mark by theme, and applies tenant identity to organization-page metadata. Asset hosting remains tenant/operator managed; DealerFlow does not proxy untrusted files or accept arbitrary embedded data.

## Required next steps

1. Add managed asset upload and validation for logos and favicons.
2. Verify DNS ownership and host routing before activating custom domains.
3. Test cross-tenant denial, cache partitioning, and domain resolution against provisioned infrastructure.
