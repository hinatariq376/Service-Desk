import type { Request, Response, NextFunction } from "express";
import { registerUser, loginUser, refreshUserTokens } from "../services/authService.js";
import { User } from "../models/User.js";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, tokens } = await registerUser(req.body);
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
        tokens,
      },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { user, tokens } = await loginUser(req.body);
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
        tokens,
      },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const tokens = await refreshUserTokens(refreshToken);
    res.status(200).json({
      success: true,
      data: { tokens },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response) {
  res.status(200).json({
    success: true,
    data: { message: "Successfully logged out" },
    requestId: req.id,
  });
}

export async function getProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    }
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } });
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
        },
      },
      requestId: req.id,
    });
  } catch (err) {
    next(err);
  }
}
