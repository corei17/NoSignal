import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import "dotenv/config";
import { connectDB, UserModel, ContentModel, LinkModel } from "./db.js";

const app = express();
app.use(express.json());
app.use(cors());

const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username should be at least 3 characters")
    .max(30, "Username cannot exceed 30 Characters"),

  password: z
    .string()
    .min(8, "Password must be 8 character atleast")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character",
    ),
});

const signinSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(1),
});

app.post("/api/v1/signup", async (req, res) => {
  const validationResult = signupSchema.safeParse(req.body);

  if (!validationResult.success) {
    return res.status(400).json({
      message: "validation failed",
      errors: z.treeifyError(validationResult.error).properties,
    });
  }

  const { username, password } = validationResult.data;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await UserModel.create({
      username: username,
      password: hashedPassword,
    });

    res.json({
      message: "User singed up",
    });
  } catch (err) {
    res.status(411).json({
      message: "Username already exists ",
    });
  }
});

app.post("/api/v1/signin", async (req, res) => {
  const checkResult = signinSchema.safeParse(req.body);

  if (!checkResult.success) {
    return res.status(400).json({
      message: "invalid input",
      errors: z.treeifyError(checkResult.error).properties,
    });
  }

  const { username, password } = checkResult.data;

  try {
    const user = await UserModel.findOne({ username });
    if (!user || !user.password) {
      return res.status(403).json({
        message: "Invalid username or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(403).json({
        message: "Invalid username or password",
      });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, {
      expiresIn: "24h",
    });
    return res.json({
      message: "Signedin successfully",
      token: token,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

app.post("/api/v1/content", (req, res) => {});

app.get("/api/v1/content", (req, res) => {});

app.delete("/api/v1/content", (req, res) => {});

app.post("/api/v1/brain/share", (req, res) => {});

app.post("/api/v1/brain/:shareLink", (req, res) => {});

const PORT = 3000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
  });
});
