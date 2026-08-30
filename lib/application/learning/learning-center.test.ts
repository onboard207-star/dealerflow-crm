import { describe, expect, it } from "vitest";
import {
  buildKnowledgeGrounding,
  canViewArticle,
  createTrainingAssignment,
  deduplicateAssignments,
  evaluateCourseProgress,
  knowledgeArticles,
  requireVisibleArticle,
  resolveFirstLoginOrientation,
  resolveHelpContext,
  resolveReleaseEducation,
  resolveRoleTraining,
  searchKnowledge,
  trainingCourses,
  validateKnowledgeArticle,
  type LearningViewer,
} from "./learning-center";

const salesperson: LearningViewer = { organizationId: "org_one", roleKeys: ["salesperson"], capabilities: ["customer.read", "lead.read", "appointment.read", "task.read"], audience: "dealer" };
const finance: LearningViewer = { organizationId: "org_one", roleKeys: ["finance-manager"], capabilities: ["customer.read", "deal.read"], audience: "dealer" };
const internal: LearningViewer = { organizationId: "org_platform", roleKeys: ["platform-administrator"], capabilities: [], audience: "internal" };

describe("learning center authority", () => {
  it("assigns materially different published tracks by role", () => {
    expect(resolveRoleTraining(salesperson).map((item) => item.id)).toEqual(["course-salesperson-v1"]);
    expect(resolveRoleTraining(finance).map((item) => item.id)).toEqual(["course-finance-v1"]);
    expect(resolveRoleTraining({ ...salesperson, roleKeys: ["service-advisor"] })).toEqual([]);
  });

  it("keeps internal DealerFlow content away from dealer viewers", () => {
    const article = knowledgeArticles.find((item) => item.id === "article-internal-support")!;
    expect(canViewArticle(article, salesperson)).toBe(false);
    expect(canViewArticle(article, internal)).toBe(true);
    expect(() => requireVisibleArticle(article, salesperson)).toThrow("not available for the current role");
  });

  it("does not reveal finance procedures without both role and capability", () => {
    const article = knowledgeArticles.find((item) => item.id === "article-document-workflow")!;
    expect(canViewArticle(article, salesperson)).toBe(false);
    expect(canViewArticle(article, finance)).toBe(true);
  });

  it("ranks current visible knowledge and filters hidden results", () => {
    expect(searchKnowledge({ query: "customer timeline", viewer: salesperson })[0]?.id).toBe("article-customer-workspace");
    expect(searchKnowledge({ query: "tenant incident", viewer: salesperson })).toEqual([]);
    expect(searchKnowledge({ query: "tenant incident", viewer: internal })[0]?.id).toBe("article-internal-support");
  });

  it("grounds product help only in current published visible articles", () => {
    const grounding = buildKnowledgeGrounding({ query: "schedule appointment", viewer: salesperson });
    expect(grounding.every((item) => item.articleId && item.version === 1 && item.excerpt.length > 0)).toBe(true);
    expect(grounding.map((item) => item.articleId)).not.toContain("article-internal-support");
  });

  it("creates deterministic assignments and removes repeated login duplicates", () => {
    const assignment = createTrainingAssignment({ organizationId: "org_one", userId: "usr_one", courseId: "course-salesperson-v1", courseVersion: 1, source: "role", sourceId: "salesperson", required: true });
    expect(assignment.id).toContain("org_one:usr_one:course-salesperson-v1:1");
    expect(deduplicateAssignments([assignment, { ...assignment, id: "duplicate", source: "manager", sourceId: "usr_manager" }])).toEqual([assignment]);
  });

  it("requires completion evidence for every module", () => {
    const course = trainingCourses.find((item) => item.id === "course-reception-v1")!;
    expect(evaluateCourseProgress(course, [])).toMatchObject({ status: "not-started", completed: 0 });
    expect(evaluateCourseProgress(course, [{ moduleId: course.modules[0]!.id, kind: "explicit-confirmation", occurredAt: new Date().toISOString(), actorId: "usr_one", contentVersion: 1 }])).toMatchObject({ status: "in-progress", completed: 1 });
    expect(evaluateCourseProgress(course, course.modules.map((item) => ({ moduleId: item.id, kind: "explicit-confirmation" as const, occurredAt: new Date().toISOString(), actorId: "usr_one", contentVersion: 1 })))).toMatchObject({ status: "completed", completed: course.modules.length });
  });

  it("does not trap first-login users in training", () => {
    expect(resolveFirstLoginOrientation(salesperson)).toMatchObject({ landingPath: "/organizations/org_one/workspace", mayContinue: true });
    expect(resolveFirstLoginOrientation({ ...salesperson, roleKeys: ["inventory-manager"] }).landingPath).toBe("/organizations/org_one/inventory");
  });

  it("resolves workspace-specific help rather than a generic destination", () => {
    const customerHelp = resolveHelpContext("customer", salesperson);
    expect(customerHelp?.context.title).toBe("Customer Workspace Help");
    expect(customerHelp?.articles.map((item) => item.id)).toContain("article-customer-workspace");
    expect(resolveHelpContext("inventory", salesperson)?.articles).toEqual([]);
  });

  it("targets What's New by role and capability", () => {
    expect(resolveReleaseEducation(salesperson)).toEqual([]);
    expect(resolveReleaseEducation(finance).map((item) => item.id)).toEqual(["release-document-foundation"]);
  });

  it("rejects executable content and invalid tenant ownership", () => {
    const base = knowledgeArticles[0]!;
    expect(validateKnowledgeArticle({ ...base, body: '<script src="bad"></script>' })).toContain("Executable article content is not allowed.");
    expect(validateKnowledgeArticle({ ...base, scope: "tenant", organizationId: undefined })).toContain("Tenant articles require an organization.");
  });
});
