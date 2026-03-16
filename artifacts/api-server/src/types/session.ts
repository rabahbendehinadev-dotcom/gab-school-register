import "express-session";

declare module "express-session" {
  interface SessionData {
    staffId: number;
    role: string;
    fullName: string;
  }
}
