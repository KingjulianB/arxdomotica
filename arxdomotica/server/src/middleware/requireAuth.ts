import { NextFunction, Request, Response } from "express";
import "express-session";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.username) {
    res.status(401).json({ error: "Authentification requise." });
    return;
  }
  next();
}
