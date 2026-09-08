import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { User, type IUser, type UserRole } from "../models/User.js";

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function generateTokens(user: IUser): AuthTokens {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
  };

  const accessToken = jwt.sign(payload, config.jwtAccessSecret, {
    expiresIn: "15m",
  });

  const refreshToken = jwt.sign(payload, config.jwtRefreshSecret, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtAccessSecret) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtRefreshSecret) as TokenPayload;
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<{ user: IUser; tokens: AuthTokens }> {
  const existing = await User.findOne({ email: data.email.toLowerCase() });
  if (existing) {
    const error = new Error("Email already in use");
    (error as any).statusCode = 409;
    (error as any).code = "EMAIL_ALREADY_EXISTS";
    throw error;
  }

  const user = new User({
    name: data.name,
    email: data.email.toLowerCase(),
    password: data.password,
    role: data.role,
  });

  await user.save();
  const tokens = generateTokens(user);

  return { user, tokens };
}

export async function loginUser(credentials: {
  email: string;
  password: string;
}): Promise<{ user: IUser; tokens: AuthTokens }> {
  const user = await User.findOne({ email: credentials.email.toLowerCase() }).select("+password");
  if (!user) {
    const error = new Error("Invalid email or password");
    (error as any).statusCode = 401;
    (error as any).code = "INVALID_CREDENTIALS";
    throw error;
  }

  const isMatch = await user.comparePassword(credentials.password);
  if (!isMatch) {
    const error = new Error("Invalid email or password");
    (error as any).statusCode = 401;
    (error as any).code = "INVALID_CREDENTIALS";
    throw error;
  }

  const tokens = generateTokens(user);
  return { user, tokens };
}

export async function refreshUserTokens(refreshToken: string): Promise<AuthTokens> {
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.userId);
    if (!user) {
      const error = new Error("User no longer exists");
      (error as any).statusCode = 401;
      (error as any).code = "USER_NOT_FOUND";
      throw error;
    }

    return generateTokens(user);
  } catch (err: any) {
    const error = new Error("Invalid or expired refresh token");
    (error as any).statusCode = 401;
    (error as any).code = "INVALID_REFRESH_TOKEN";
    throw error;
  }
}
