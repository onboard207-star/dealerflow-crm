import type { Capability } from "@/lib/platform/auth";

export type LearningAudience = "dealer" | "internal";
export type LearningContentStatus = "draft" | "review" | "published" | "retired";
export type TrainingProgressStatus = "not-started" | "in-progress" | "completed" | "overdue" | "waived";
export type TrainingAssignmentSource = "role" | "tenant" | "pilot" | "manager" | "implementation-project" | "feature-launch";
export type KnowledgeCategory = "getting-started" | "sales" | "bdc" | "management" | "inventory" | "finance" | "recon" | "service" | "ai" | "mobile" | "integrations" | "billing" | "admin" | "troubleshooting" | "security";

export interface TrainingModule {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly feature: string;
  readonly estimatedMinutes?: number;
  readonly completionRule: "explicit-confirmation" | "evidence-event" | "manager-verification";
  readonly acknowledgmentRequired: boolean;
  readonly contentReferences: readonly string[];
}

export interface TrainingCourse {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly roleKeys: readonly string[];
  readonly audience: LearningAudience;
  readonly required: boolean;
  readonly prerequisites: readonly string[];
  readonly version: number;
  readonly status: LearningContentStatus;
  readonly modules: readonly TrainingModule[];
}

export interface KnowledgeArticle {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly category: KnowledgeCategory;
  readonly roleKeys: readonly string[];
  readonly requiredCapabilities: readonly Capability[];
  readonly workspace: string;
  readonly feature: string;
  readonly audience: LearningAudience;
  readonly scope: "global" | "tenant";
  readonly organizationId?: string;
  readonly locale: string;
  readonly version: number;
  readonly status: LearningContentStatus;
  readonly owner: string;
  readonly lastUpdated: string;
  readonly lastReviewed: string;
  readonly nextReview: string;
}

export interface LearningViewer {
  readonly organizationId: string;
  readonly roleKeys: readonly string[];
  readonly capabilities: readonly Capability[];
  readonly audience: LearningAudience;
}

export interface TrainingAssignment {
  readonly id: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly courseId: string;
  readonly courseVersion: number;
  readonly source: TrainingAssignmentSource;
  readonly sourceId: string;
  readonly required: boolean;
  readonly dueAt?: string;
}

export interface CompletionEvidence {
  readonly moduleId: string;
  readonly kind: "explicit-confirmation" | "evidence-event" | "manager-verification" | "waiver";
  readonly occurredAt: string;
  readonly actorId: string;
  readonly contentVersion: number;
}

export interface ReleaseEducation {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly kind: "new-feature" | "improvement" | "required-action" | "deprecated";
  readonly release: string;
  readonly roleKeys: readonly string[];
  readonly requiredCapabilities: readonly Capability[];
  readonly tenantIds: readonly string[];
  readonly status: LearningContentStatus;
  readonly articleId: string;
}

export interface HelpContext {
  readonly workspace: string;
  readonly title: string;
  readonly purpose: string;
  readonly commonActions: readonly string[];
  readonly articleIds: readonly string[];
  readonly trainingCourseIds: readonly string[];
  readonly safeSupportContext: readonly ("tenant" | "user" | "role" | "workspace" | "route" | "release")[];
}

export class LearningContentError extends Error {
  constructor(readonly code: "invalid-content" | "unauthorized" | "invalid-evidence", message: string) {
    super(message);
    this.name = "LearningContentError";
  }
}

const lessonModule = (id: string, title: string, feature: string, description = `Learn the current DealerFlow ${title.toLowerCase()} workflow.`): TrainingModule => ({
  id,
  title,
  description,
  feature,
  completionRule: "explicit-confirmation",
  acknowledgmentRequired: false,
  contentReferences: [],
});

const track = (id: string, title: string, roleKeys: readonly string[], moduleTitles: readonly string[], status: LearningContentStatus = "published"): TrainingCourse => ({
  id,
  title,
  description: `Role-specific operating guidance for ${title.toLowerCase()}.`,
  roleKeys,
  audience: roleKeys.includes("platform-administrator") ? "internal" : "dealer",
  required: true,
  prerequisites: [],
  version: 1,
  status,
  modules: moduleTitles.map((titleValue, index) => lessonModule(`${id}-m${index + 1}`, titleValue, titleValue.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"))),
});

export const trainingCourses: readonly TrainingCourse[] = [
  track("course-salesperson-v1", "Salesperson Quick Start", ["salesperson"], ["DealerFlow Overview", "My Day", "Lead Handling", "Customer Workspace", "Communication", "Tasks", "Appointments", "Inventory", "Vehicle Workspace", "Deals", "DealerFlow AI", "Mobile Workflow", "Getting Help"]),
  track("course-bdc-v1", "BDC Quick Start", ["bdc"], ["Lead Queue", "New Lead Response", "Customer Workspace", "Communication", "Appointment Setting", "Confirmations", "No-Show Follow-Up", "Escalation", "DealerFlow AI", "Mobile", "Manager Handoff"]),
  track("course-sales-manager-v1", "Sales Manager Operations", ["sales-manager"], ["Manager Workspace", "Lead Exceptions", "Assignments", "Appointments", "Pipeline", "Deal Attention", "Team Performance", "Approvals", "AI Manager Brief", "Reporting", "Coaching and Follow-Up"]),
  track("course-gsm-v1", "GSM Operations", ["gsm"], ["Sales Operations", "Pipeline Health", "Desk and Deal Oversight", "Manager Exceptions", "Appointments", "Team Performance", "Inventory Opportunities", "Executive Reporting", "AI GSM Brief"]),
  track("course-executive-v1", "GM and Owner Overview", ["general-manager", "owner"], ["Executive Workspace", "Store Health", "Sales Funnel", "Inventory", "Customer Issues", "AI Executive Brief", "Reports"]),
  track("course-finance-v1", "Finance Workflow", ["finance-manager", "controller"], ["Finance Workspace", "Deal Handoff", "Documents", "Workflow Readiness", "Permissions", "Sensitive Data", "Document Generation", "Compliance Workflow", "AI Finance Assistance"]),
  track("course-inventory-v1", "Inventory Operations", ["inventory-manager"], ["Inventory Workspace", "Physical Unit and Catalog Configuration", "Media", "Reference and CGI Rules", "Pricing", "Aging", "Missing Data", "Vehicle Workspace", "Trades", "Reporting"]),
  track("course-reception-v1", "Reception Quick Start", ["receptionist"], ["DealerFlow Overview", "Customer Lookup", "Appointments", "Customer Handoff", "Getting Help"]),
  track("course-dealer-admin-v1", "Dealer Administration", ["dealer-administrator", "owner", "general-manager"], ["Organization", "Locations", "Users", "Roles", "Branding", "Integrations", "Notifications", "Training", "Security Basics", "Offboarding and User Removal"]),
  track("course-recon-v1", "Recon Operations", ["recon"], ["Incoming Units", "Inspection", "Recon Status", "Detail", "Photos", "Frontline Ready", "Bottlenecks", "Inventory Handoff"], "draft"),
  track("course-service-advisor-v1", "Service Advisor", ["service-advisor"], ["Customer and Vehicle Lookup", "Service Appointment", "Customer Communication", "Status Workflow", "Follow-Up"], "draft"),
  track("course-service-manager-v1", "Service Management", ["service-manager"], ["Service Operations", "Appointments", "Advisor Work", "Customer Communication", "Reporting"], "draft"),
  track("course-platform-admin-v1", "DealerFlow Platform Operations", ["platform-administrator"], ["Tenant Administration", "Implementation", "Provider Health", "Billing", "Integrations", "Feature Flags", "Support", "Incidents", "Security", "Audit", "Customer Success", "Release Management"]),
];

export const knowledgeArticles: readonly KnowledgeArticle[] = [
  article("article-getting-started", "getting-started", "Start with your role workspace", "Learn how DealerFlow chooses your starting workspace and what to review first.", "Open your assigned workspace. Review the verified priorities and queues available to your role. Use linked records to continue the workflow. DealerFlow does not expand your permissions when you change views.", "getting-started", [], [], "workspace", "navigation"),
  article("article-customer-workspace", "customer-workspace", "Use the Customer Workspace", "Review customer context, next action guidance, related records, and history in one place.", "Confirm the customer identity and selected buying cycle. Review the timeline before contacting the customer. Recommendations are guidance and must be checked against current records. Use only actions that are enabled and authorized.", "sales", ["salesperson", "bdc", "sales-manager"], ["customer.read"], "customer", "crm"),
  article("article-inventory-media", "inventory-media", "Add verified inventory media", "Understand actual, reference, CGI, and OEM media evidence.", "Use actual vehicle photos for exact-unit evidence. Reference, CGI, and OEM media must retain their source label and must not be represented as photos of the physical unit. Upload controls appear only when governed storage is configured.", "inventory", ["inventory-manager", "sales-manager"], ["inventory.read"], "inventory", "inventory-media"),
  article("article-ai-safety", "ai-safety", "Use DealerFlow AI responsibly", "Understand evidence, recommendations, protected actions, and human review.", "DealerFlow AI can summarize and recommend from available evidence, but it may be wrong. Verify important facts. AI does not approve credit, lending, pricing, or protected actions and must not be used to bypass policy or authorization.", "ai", [], [], "ai", "ai"),
  article("article-document-workflow", "document-workflow", "Understand generated document status", "Know what preview, missing information, approval, signature, and finalization mean.", "A generated preview is not legal completion. Missing information must be resolved from canonical records. Approval, verified delivery, signature, and finalization are separate governed states. DealerFlow does not currently claim a configured electronic-signature provider.", "finance", ["finance-manager", "controller", "owner", "general-manager"], ["deal.read"], "deals", "documents"),
  article("article-tenant-security", "tenant-security", "Administer access safely", "Use roles, locations, offboarding, and security contacts without exposing hidden policy.", "Assign the least privilege needed for the employee's work. Keep rooftop access explicit. Remove access promptly during offboarding. Contact the designated security owner for suspected unauthorized access.", "security", ["dealer-administrator", "owner", "general-manager"], ["organization.configure"], "administration", "security"),
  article("article-internal-support", "internal-support", "Handle a tenant incident", "Internal severity, isolation, provider failure, and escalation guidance.", "Confirm tenant scope before inspecting records. Separate provider degradation from application failure. Preserve correlation evidence, avoid customer data in routine escalation, and follow the incident authority before taking recovery action.", "troubleshooting", ["platform-administrator"], [], "platform-operations", "support", "internal"),
];

function article(id: string, slug: string, title: string, summary: string, body: string, category: KnowledgeCategory, roleKeys: readonly string[], requiredCapabilities: readonly Capability[], workspace: string, feature: string, audience: LearningAudience = "dealer"): KnowledgeArticle {
  return { id, slug, title, summary, body, category, roleKeys, requiredCapabilities, workspace, feature, audience, scope: "global", locale: "en-US", version: 1, status: "published", owner: "DealerFlow Product", lastUpdated: "2026-08-30", lastReviewed: "2026-08-30", nextReview: "2026-11-30" };
}

export const helpContexts: readonly HelpContext[] = [
  { workspace: "customer", title: "Customer Workspace Help", purpose: "Understand the selected customer and buying cycle before acting.", commonActions: ["Review timeline", "Check next appointment", "Create an authorized follow-up"], articleIds: ["article-customer-workspace", "article-ai-safety"], trainingCourseIds: ["course-salesperson-v1", "course-bdc-v1"], safeSupportContext: ["tenant", "user", "role", "workspace", "route", "release"] },
  { workspace: "inventory", title: "Inventory Help", purpose: "Manage exact physical units and verified media evidence.", commonActions: ["Find a stock unit", "Review missing data", "Open the Vehicle Workspace"], articleIds: ["article-inventory-media"], trainingCourseIds: ["course-inventory-v1"], safeSupportContext: ["tenant", "user", "role", "workspace", "route", "release"] },
  { workspace: "ai", title: "DealerFlow AI Help", purpose: "Use evidence-grounded guidance with human review.", commonActions: ["Review cited evidence", "Verify important facts", "Open the supporting record"], articleIds: ["article-ai-safety"], trainingCourseIds: ["course-salesperson-v1", "course-sales-manager-v1"], safeSupportContext: ["tenant", "user", "role", "workspace", "route", "release"] },
  { workspace: "deals", title: "Deal and Document Help", purpose: "Understand Deal, quote, approval, and document readiness states.", commonActions: ["Review the selected Deal", "Resolve missing information", "Confirm approval authority"], articleIds: ["article-document-workflow"], trainingCourseIds: ["course-finance-v1"], safeSupportContext: ["tenant", "user", "role", "workspace", "route", "release"] },
];

export const releaseEducation: readonly ReleaseEducation[] = [
  { id: "release-document-foundation", title: "Document workflow foundation", summary: "Preview and lifecycle terminology is now standardized; durable PDF delivery and electronic signature remain unavailable.", kind: "improvement", release: "7d89d82", roleKeys: ["finance-manager", "controller", "owner", "general-manager"], requiredCapabilities: ["deal.read"], tenantIds: [], status: "published", articleId: "article-document-workflow" },
  { id: "release-inventory-media", title: "Governed inventory media", summary: "Exact-unit media retains source evidence and primary-image continuity.", kind: "new-feature", release: "ed4e1d3", roleKeys: ["inventory-manager", "sales-manager"], requiredCapabilities: ["inventory.read"], tenantIds: [], status: "published", articleId: "article-inventory-media" },
];

export function validateKnowledgeArticle(value: KnowledgeArticle): readonly string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug)) errors.push("Article slug must use lowercase words and hyphens.");
  if (!value.title.trim() || !value.summary.trim() || !value.body.trim()) errors.push("Article title, summary, and body are required.");
  if (value.scope === "tenant" && value.organizationId === undefined) errors.push("Tenant articles require an organization.");
  if (value.scope === "global" && value.organizationId !== undefined) errors.push("Global articles cannot carry an organization.");
  if (/<\s*script\b|javascript\s*:|\son[a-z]+\s*=/i.test(value.body)) errors.push("Executable article content is not allowed.");
  if (!Number.isInteger(value.version) || value.version < 1) errors.push("Article version must be a positive integer.");
  return errors;
}

export function canViewArticle(articleValue: KnowledgeArticle, viewer: LearningViewer): boolean {
  if (articleValue.status !== "published") return false;
  if (articleValue.audience !== viewer.audience) return false;
  if (articleValue.scope === "tenant" && articleValue.organizationId !== viewer.organizationId) return false;
  if (articleValue.roleKeys.length > 0 && !articleValue.roleKeys.some((role) => viewer.roleKeys.includes(role))) return false;
  return articleValue.requiredCapabilities.every((capability) => viewer.capabilities.includes(capability));
}

export function requireVisibleArticle(articleValue: KnowledgeArticle, viewer: LearningViewer): KnowledgeArticle {
  if (!canViewArticle(articleValue, viewer)) throw new LearningContentError("unauthorized", "This help content is not available for the current role.");
  return articleValue;
}

export function searchKnowledge(input: { readonly query: string; readonly viewer: LearningViewer; readonly category?: KnowledgeCategory; readonly workspace?: string; readonly feature?: string }): readonly KnowledgeArticle[] {
  const terms = input.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return knowledgeArticles
    .filter((item) => canViewArticle(item, input.viewer))
    .filter((item) => !input.category || item.category === input.category)
    .filter((item) => !input.workspace || item.workspace === input.workspace)
    .filter((item) => !input.feature || item.feature === input.feature)
    .map((item) => ({ item, score: scoreArticle(item, terms) }))
    .filter(({ score }) => terms.length === 0 || score > 0)
    .sort((left, right) => right.score - left.score || right.item.version - left.item.version || left.item.title.localeCompare(right.item.title))
    .map(({ item }) => item);
}

function scoreArticle(item: KnowledgeArticle, terms: readonly string[]): number {
  const title = item.title.toLowerCase();
  const summary = item.summary.toLowerCase();
  const body = item.body.toLowerCase();
  return terms.reduce((score, term) => score + (title.includes(term) ? 8 : 0) + (summary.includes(term) ? 4 : 0) + (body.includes(term) ? 1 : 0), 0);
}

export function resolveRoleTraining(viewer: LearningViewer): readonly TrainingCourse[] {
  return trainingCourses.filter((course) => course.status === "published" && course.audience === viewer.audience && course.roleKeys.some((role) => viewer.roleKeys.includes(role)));
}

export function createTrainingAssignment(input: Omit<TrainingAssignment, "id">): TrainingAssignment {
  const canonical = `${input.organizationId}:${input.userId}:${input.courseId}:${input.courseVersion}:${input.source}:${input.sourceId}`;
  return { ...input, id: `assignment:${canonical}` };
}

export function deduplicateAssignments(assignments: readonly TrainingAssignment[]): readonly TrainingAssignment[] {
  const seen = new Set<string>();
  return assignments.filter((assignment) => {
    const key = `${assignment.organizationId}:${assignment.userId}:${assignment.courseId}:${assignment.courseVersion}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function evaluateCourseProgress(course: TrainingCourse, evidence: readonly CompletionEvidence[], now = new Date(), dueAt?: string): { readonly status: TrainingProgressStatus; readonly completed: number; readonly total: number } {
  const moduleIds = new Set(course.modules.map((item) => item.id));
  const valid = new Set(evidence.filter((item) => item.contentVersion === course.version && moduleIds.has(item.moduleId) && item.kind !== "waiver").map((item) => item.moduleId));
  const waived = evidence.some((item) => item.kind === "waiver" && item.contentVersion === course.version);
  if (waived) return { status: "waived", completed: 0, total: course.modules.length };
  if (valid.size === course.modules.length && course.modules.length > 0) return { status: "completed", completed: valid.size, total: course.modules.length };
  if (dueAt && Date.parse(dueAt) < now.getTime()) return { status: "overdue", completed: valid.size, total: course.modules.length };
  return { status: valid.size > 0 ? "in-progress" : "not-started", completed: valid.size, total: course.modules.length };
}

export function resolveFirstLoginOrientation(viewer: LearningViewer): { readonly landingPath: string; readonly courses: readonly TrainingCourse[]; readonly mayContinue: true } {
  const role = viewer.roleKeys[0];
  const landingPath = role === "inventory-manager" ? "inventory" : role === "finance-manager" || role === "controller" ? "deals" : "workspace";
  return { landingPath: `/organizations/${viewer.organizationId}/${landingPath}`, courses: resolveRoleTraining(viewer), mayContinue: true };
}

export function resolveHelpContext(workspace: string, viewer: LearningViewer): { readonly context: HelpContext; readonly articles: readonly KnowledgeArticle[] } | undefined {
  const context = helpContexts.find((item) => item.workspace === workspace);
  if (!context) return undefined;
  return { context, articles: context.articleIds.map((id) => knowledgeArticles.find((item) => item.id === id)).filter((item): item is KnowledgeArticle => Boolean(item) && canViewArticle(item!, viewer)) };
}

export function resolveReleaseEducation(viewer: LearningViewer): readonly ReleaseEducation[] {
  return releaseEducation.filter((item) => item.status === "published" && (item.tenantIds.length === 0 || item.tenantIds.includes(viewer.organizationId)) && item.roleKeys.some((role) => viewer.roleKeys.includes(role)) && item.requiredCapabilities.every((capability) => viewer.capabilities.includes(capability)));
}

export function buildKnowledgeGrounding(input: { readonly query: string; readonly viewer: LearningViewer }): { readonly articleId: string; readonly title: string; readonly version: number; readonly excerpt: string }[] {
  return searchKnowledge(input).slice(0, 5).map((item) => ({ articleId: item.id, title: item.title, version: item.version, excerpt: item.body.slice(0, 500) }));
}
