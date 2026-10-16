import { Router } from "express";
import { AuthenticationController } from "./controller.js";

export function createAuthenticationRoutes(controller: AuthenticationController): Router {
  const router = Router();
  router.get("/login", controller.login);
  router.get("/callback", controller.callback);
  router.get("/session", controller.session);
  router.post("/logout", controller.logout);
  return router;
}
