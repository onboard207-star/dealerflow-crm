# Working Dealership Template

> This template is synthetic-only and may be applied only to an organization whose database `data_class` is `demo`. See [Synthetic Pilot Harness](../operations/SYNTHETIC_PILOT_HARNESS.md).

## Purpose

The DealerFlow working dealership template creates a coherent, populated tenant for onboarding, product review, training, and sales demonstrations. It uses the same relationships and permission model as a live dealership. It is not a separate demo application.

## Included Operating History

- 24 rolling months of customers and leads.
- 60 leads and 18 delivered sales per historical month.
- 1,440 historical leads and 432 completed sales in total.
- A 30% average lead-to-sale closing rate.
- Delivered revenue, completed appointments, communications, sold inventory, and delivery records connected to each completed buying cycle.
- 48 current inventory units across representative makes, models, trims, and price points.
- 36 active opportunities with assigned staff, vehicle interests, communications, appointments, and follow-up tasks.

These figures create stable averages for reports while remaining illustrative rather than predictive. They do not represent a specific dealership or OEM benchmark.

## Staffing and Permissions

The template includes a complete 26-person operating roster: Dealer Principal, General Manager, sales leadership, eight Sales Consultants, BDC, Finance, Inventory, Service, Controller, and Reception. Each fictional employee has an active organization membership and a least-privilege system role.

Template staff email addresses use the reserved `example.invalid` domain. They have no authentication account, password, invitation, or verified email and cannot sign in. Real users must always be invited through DealerFlow.

## Applying the Template

Run migrations and provision the tenant before applying the template:

```text
pnpm tenant:seed-template -- --organization-id org_example
```

`DATABASE_URL` must point to the intended environment. The operation is transactional and records a versioned audit marker. Re-running the same template version safely returns `alreadySeeded: true` and does not duplicate records.

## Lifecycle Integrity

Historical sales connect Customer → Lead → Vehicle Interest → Vehicle → Inventory Unit → Deal → Delivery. Communications and showroom appointments reference the same customer and lead. Sales ownership references a staffed Sales Consultant. This structure supports future returning purchases and communication history without copying customer truth.

## Template Governance

- Keep all template-only records in the seed fixture, never production UI components.
- Add new roles to `config/system-roles.json` and map positions in `config/dealership-template.json`.
- Increment the template version only when a deliberate new seed release is required.
- Never attach login credentials or send invitations to fictional staff.
- Validate relationship counts and permission mappings before deployment.
