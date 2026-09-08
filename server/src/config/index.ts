import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "5000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/servicedesk",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "servicedesk_jwt_access_secret_2026_secure_key",
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || "servicedesk_jwt_refresh_secret_2026_secure_key",
  jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || "15m",
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  slaPolicies: {
    CRITICAL: { responseMinutes: 15, resolutionHours: 4 },
    HIGH: { responseMinutes: 60, resolutionHours: 8 },
    MEDIUM: { responseMinutes: 240, resolutionHours: 24 },
    LOW: { responseMinutes: 480, resolutionHours: 72 },
  },
};
