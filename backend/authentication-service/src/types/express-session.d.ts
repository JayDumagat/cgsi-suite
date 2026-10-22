import "express-session";
import type {
  AuthTransaction,
  AuthenticatedUser,
} from "../modules/authentication/application/contracts.ts";

declare module "express-session" {
  interface SessionData {
    user?: AuthenticatedUser;
    authTransaction?: AuthTransaction;
  }
}
