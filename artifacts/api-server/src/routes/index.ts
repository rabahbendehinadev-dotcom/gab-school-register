import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import studentsRouter from "./students";
import groupsRouter from "./groups";
import staffRouter from "./staff";
import activityRouter from "./activity";
import galleryRouter from "./gallery";
import settingsRouter from "./settings";
import openDayRouter from "./open-day";
import storageRouter from "./storage";
import coursesRouter from "./courses";
import paymentsRouter from "./payments";
import tasksRouter from "./tasks";
import notificationsRouter from "./notifications";
import studentExtrasRouter from "./student-extras";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(studentsRouter);
router.use(groupsRouter);
router.use(staffRouter);
router.use(activityRouter);
router.use(galleryRouter);
router.use(settingsRouter);
router.use(openDayRouter);
router.use(storageRouter);
router.use(coursesRouter);
router.use(paymentsRouter);
router.use(tasksRouter);
router.use(notificationsRouter);
router.use(studentExtrasRouter);

export default router;
