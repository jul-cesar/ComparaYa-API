import { describe, test, expect, afterAll } from "@jest/globals";
import { app, server } from "../src/index.js";
import { Category } from "@prisma/client";

describe("Hono App", () => {
  afterAll(() => {
    // Cierra el servidor después de las pruebas
    server.close();
  });

  test("GET /api/products", async () => {
  const res = await app.request("/api/products?page=1&limit=10", {
    headers: {
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3YzFjY2Y0Yy05N2RmLTQxNjctYTcyNi0yOTQ3MTRjOGYxYmMiLCJleHAiOjE3MzMxMzA1NDd9.5AvPbBJ2JIcE8wyMLUj68PiMEFHYtHMjSc5M0l5oAsQ",
    },
  });
  console.log(await res.json()); // Imprime la respuesta
  expect(res.status).toBe(200);
});

});

test("GET /api/products sin token (401 Unauthorized)", async () => {
  const res = await app.request("/api/products?page=1&limit=10");
  expect(res.status).toBe(401); // Verifica que el estado sea 401

  let data;
  const contentType = res.headers.get("Content-Type");
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  // Verifica que la respuesta sea un mensaje de error (en texto o JSON)
  if (typeof data === "string") {
    expect(data).toBe("Unauthorized");
  } else {
    expect(data).toHaveProperty("error");
  }
});



test("GET /api/categories (Obtener lista de categorías)", async () => {
  const res = await app.request("/api/categories", {
    headers: {
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI3YzFjY2Y0Yy05N2RmLTQxNjctYTcyNi0yOTQ3MTRjOGYxYmMiLCJleHAiOjE3MzMxMzA1NDd9.5AvPbBJ2JIcE8wyMLUj68PiMEFHYtHMjSc5M0l5oAsQ",
    },
  });
  expect(res.status).toBe(200); // Verifica que el estado sea 200
  const data = await res.json();
  // Verifica que la respuesta sea un array
  expect(Array.isArray(data)).toBe(true);
  // Verifica que cada elemento del array tenga las propiedades esperadas
  data.forEach((category: Category) => {
    expect(category).toHaveProperty("id");
    expect(category).toHaveProperty("name");
    expect(category).toHaveProperty("created_at");
  });
});

