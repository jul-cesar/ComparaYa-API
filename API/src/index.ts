import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Variables } from "./types/HonoVariables.js";
import { Auth } from "./routes/auth/auth.js";
import { logger } from "hono/logger";
import { PrismaClient } from "@prisma/client";
import { jwt } from "hono/jwt";
import { ProductsRoutes } from "./routes/products/products.js";
import { CategoriesRoutes } from "./routes/categories/categories.js";

const prisma = new PrismaClient();
const app = new Hono<{ Variables: Variables }>().basePath("/api");

const rutasPublicas = ["/api/auth/register", "/api/auth/login"];
const JWT_SECRET = process.env.JWT_SECRET || "";

app.use("*", async (c, next) => {
  c.set("prisma", prisma);
  await next();
});

app.use("*", async (c, next) => {
  if (rutasPublicas.includes(c.req.path)) {
    await next();
  } else {
    return jwt({ secret: JWT_SECRET })(c, next);
  }
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.use(logger());

app.route("/", Auth);
app.route("/", ProductsRoutes)
app.route("/", CategoriesRoutes)

const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
