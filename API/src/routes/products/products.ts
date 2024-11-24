import { Hono } from "hono";
import type { Variables } from "../../types/HonoVariables.js";
import { handlePrismaError } from "../../utils/PrismaErrorCatch.js";

export const ProductsRoutes = new Hono<{ Variables: Variables }>().basePath(
  "/products"
);

ProductsRoutes.get("/", async (c) => {
  try {
    const prisma = c.get("prisma");
    const AllProductsList = await prisma.product.findMany({
      orderBy: {
        created_at: "desc",
      },
    });
    c.json({ message: "pruducts found succesfully", data: AllProductsList });
  } catch (error) {
    const prismaError = handlePrismaError(error);
    console.error("Error creating service:", prismaError);

    return c.json(
      {
        message: "Error al crear el servicio",
        error: prismaError,
      },
      500
    );
  }
});
