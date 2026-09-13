ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind";
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind" CHECK("kind" IN('task-assigned','deal-approval','team-message'));
