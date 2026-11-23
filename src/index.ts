import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import jwt from "jsonwebtoken";
import cors from "cors";
import "dotenv/config";
import { connectDB, UserModel, ContentModel, LinkModel } from "./db.js";
import { useMiddleware } from "./middleware.js";

const app = express();
app.use(express.json());
app.use(cors());

app.post("/api/v1/signup", async (req, res) => {
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
  const signinSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(1),
  });
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
      message: "Signed in successfully",
      token: token,
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
});

app.post("/api/v1/content", useMiddleware, async (req, res) => {
  const ContentSchema = z.object({
    link: z.url(),
    type: z.string().min(1, "Type is required"),
    title: z.string().min(1, "Title is required"),
  });

  const result = ContentSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "invalid input",
      errors: z.treeifyError(result.error).properties,
    });
  }
  const { link, type, title } = result.data;

  try {
    await ContentModel.create({
      link,
      type,
      title,
      userId: req.userId,
      tags: [],
    });
    return res.status(201).json({
      message: "Content added successfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

app.get("/api/v1/content", useMiddleware, async (req, res) => {
  try {
    const content = ContentModel.find({
      userId: req.userId,
    });

    return res.status(200).json({
      message: "Content fetched successfully",
      content,
    });
  } catch (err) {
    return res.status(500).json({
      message: "internal server error",
    });
  }
});

app.delete("/api/v1/content", useMiddleware, async (req, res) => {
  const contentId = req.body.contentId;

  if (!mongoose.Types.ObjectId.isValid(contentId)) {
    return res.status(400).json({
      message: "invalid content ID",
    });
  }
  try {
    const deleteContent = await ContentModel.findOneAndDelete({
      _id: contentId,
      userId: req.userId,
    });

    if (!deleteContent) {
      return res.status(404).json({
        message: "Content not found",
      });
    }
    return res.status(200).json({
      message: "content deleted succesfully",
    });
  } catch (err) {
    return res.status(500).json({
      message: "internal server error",
    });
  }
});

app.post("/api/v1/brain/share", useMiddleware, async (req, res) => {
  const shareSchema = z.object({
    share: z.boolean(),
  });

  const result = shareSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      message: "invalid input",
    });
  }

  const share = result.data.share;

  try {
    if (share) {
      const existingLink = await LinkModel.findOne({
        userId: req.userId,
      });
      if (existingLink) {
        return res.json({
          message: "share link already exists",
          shareLink: existingLink.hash,
        });
      }
      const hash = randomBytes(10).toString("hex");

      await LinkModel.create({
        hash,
        userId: req.userId,
      });
      return res.status(201).json({
        message: "Share link created",
        shareLink: hash,
      });

      await LinkModel.deleteOne({
        userId: req.userId,
      });

      return res.json({
        message: "Share link disabled",
      });
    }
  } catch (err) {
    return res.status(500).json({
      message: "internal server error",
    });
  }
});

app.get("/api/v1/brain/:shareLink", async (req, res) => {
  const { shareLink } = req.params;

  try {
    const link = await LinkModel.findOne({
      hash: shareLink,
    });
    if (!link) {
      return res.status(404).json({
        message: "Share link not found",
      });
    }

    const content = await ContentModel.find({
      userId: link.userId,
    });
    const user = await UserModel.findById(link.userId);

    if (!user) {
      return res.status(404).json({
        message: "user not found ",
      });
    }

    return res.status(200).json({
      message: "Shared brain fetched successfully",
      username: user.username,
      content,
    });
  } catch (err) {}
});

const PORT = 3000;
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
  });
});
