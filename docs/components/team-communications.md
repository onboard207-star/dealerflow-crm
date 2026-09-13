# DealerFlow Communications

## Purpose

DealerFlow Communications is the dealership's internal coordination surface. It supports direct, group, department, and record-linked conversations without moving authoritative customer, vehicle, Deal, Quote, appointment, or document data into a separate chat system.

## Initial production boundary

- Tenant-scoped conversations and immutable messages.
- Explicit participants drawn from active organization memberships.
- Optional Location scope enforced for every participant.
- Direct, group, department, and record-oriented conversation types.
- Per-user read position and unread counts.
- Governed DealerFlow record references using canonical IDs and internal routes.
- Responsive, keyboard-accessible conversation navigation and composition.

The initial release uses request/refresh delivery. Real-time sockets, presence, typing indicators, reactions, edits, message deletion, and mobile push are future capabilities.

## Authority and privacy

DealerFlow remains authoritative. A message may reference a record but cannot copy or mutate its protected business facts. Opening a reference re-enters the canonical workspace, where normal capability, tenant, and Location authorization applies.

Only active conversation participants may read messages. Only active participants with `team_chat.write` may send. Messages and record references are immutable in the first release. Cross-tenant participants and external URLs are rejected.

## Files, images, and documents

Binary attachments are not enabled until the governed storage boundary supports malware scanning, content-type and size validation, tenant/Location authorization, retention, audit evidence, and safe download headers. The interface states this limitation rather than presenting a nonfunctional upload control.

Quotes and Deal document requirements are shared through an authorized picker backed by canonical DealerFlow records. The message stores a secure internal reference to the immutable Quote version or document requirement; it does not copy commercial terms or replace the canonical Deal document authority. Binary attachment support remains a separate future storage capability.

## Appointments and workflow actions

The conversation workspace links to DealerFlow's canonical Calendar. Its structured appointment composer calls the existing appointment service and posts the resulting canonical appointment reference back into the conversation. Chat never creates a parallel appointment record or bypasses customer, Lead, Location, or permission validation.

## Accessibility and responsive behavior

Conversation navigation precedes messages in semantic and keyboard order. Desktop uses a split view; narrower layouts retain the same reading order. Messages identify the sender and time without relying on color. Status feedback uses live regions, controls retain visible focus, and touch targets meet the design-system minimum.

## Acceptance criteria

- Authorized staff can create direct and group conversations with active colleagues.
- Non-participants and wrong-tenant users cannot discover or read a conversation.
- Send and create operations are idempotent.
- Messages and record references remain immutable.
- Unread state is recipient-specific.
- Internal record links cannot escape the current organization.
- Empty, read-only, loading, and failure states are understandable.
- Desktop, tablet, mobile, keyboard, and 200% zoom remain usable.
