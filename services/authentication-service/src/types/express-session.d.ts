import "express-session";
import type {
  AuthTransaction,
  AuthenticatedUser,
} from "../modules/authentication/application/contracts.js";

declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
    authTransaction?: AuthTransaction;
  }
}
