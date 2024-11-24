import { Hono } from "hono";
import type { Variables } from "../../types/HonoVariables.js";
import { handlePrismaError } from "../../utils/PrismaErrorCatch.js";

export const CategoriesRoutes = new Hono<{ Variables: Variables }>().basePath(
  "/categories"
);

CategoriesRoutes.get("/", async (c) => {
  try {
    const prisma = c.get("prisma");
    const AllCategoriesList = await prisma.category.findMany({
      orderBy: {
        created_at: "desc",
      },
    });
    c.json({
      message: "Categories found successfully",
      data: AllCategoriesList,
    });
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
