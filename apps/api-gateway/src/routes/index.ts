import Router from "@koa/router";
import { secretsRouter } from "./secrets.js";
import { healthRouter } from "./health.js";
import { usersRouter } from "./users.js";
import { workspacesRouter } from "./workspaces.js";
import { feedbackRouter } from "./feedback.js";
import { dmsRouter } from "./dms.js";
import { notificationsRouter } from "./notifications.js";

export const router = new Router({ prefix: "/v1" });

router.use(healthRouter.routes());
router.use(secretsRouter.routes());
router.use(usersRouter.routes());
router.use(workspacesRouter.routes());
router.use(feedbackRouter.routes());
router.use(dmsRouter.routes());
router.use(notificationsRouter.routes());
