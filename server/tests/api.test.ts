import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

const app = createApp();

describe("REST API Integration Suite (/api/v1)", () => {
  it("GET /health returns healthy status code 200 with uptime", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("healthy");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("Returns standardized 404 error for nonexistent routes", async () => {
    const res = await request(app).get("/api/v1/nonexistent-endpoint");
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("POST /api/v1/auth/login validates request body via Zod", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("Protected routes return 401 UNAUTHORIZED when Authorization header is missing", async () => {
    const res = await request(app).get("/api/v1/tickets");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Protected routes return 401 INVALID_TOKEN when JWT is malformed", async () => {
    const res = await request(app)
      .get("/api/v1/tickets")
      .set("Authorization", "Bearer invalid.jwt.token");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_TOKEN");
  });
});
