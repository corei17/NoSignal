import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { string } from "zod";
const JWT_SECRET = process.env.JWT_SECRET;

declare global {
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

export const useMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "You are not logged in",
    });
  }
  const token = authHeader.split(" ")[1];

  if (!token || !JWT_SECRET) {
    return res.status(401).json({
      message: "invalid token",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof decoded === "string" || typeof decoded.id !== "string") {
      return res.status(401).json({
        message: "invalid token",
      });
    }
    req.userId = decoded.id;

    next();
  } catch (err) {
    return res.status(401).json({
      message: "invalid or expired token",
    });
  }
};
