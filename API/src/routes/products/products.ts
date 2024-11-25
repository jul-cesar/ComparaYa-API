import { Hono } from "hono";
import type { Variables } from "../../types/HonoVariables.js";
import { handlePrismaError } from "../../utils/PrismaErrorCatch.js";
import { Decimal } from "@prisma/client/runtime/library";
import * as stringSimilarity from 'string-similarity';

export const ProductsRoutes = new Hono<{ Variables: Variables }>().basePath(
  "/products"
);



ProductsRoutes.get("/comparation/:productId", async (c) => {
  try {
    const prisma = c.get("prisma");

    // Obtener el ID del producto a comparar
    const id = c.req.param("productId");

    // Buscar el producto base
    const comparedProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!comparedProduct) {
      return c.json({ message: "Producto no encontrado." }, 404);
    }

    // Obtener todos los demás productos
    const allProducts = await prisma.product.findMany({
      where: { id: { not: id } }, // Excluir el producto base
    });

    // Tokenizar el nombre del producto base
    const baseTokens = comparedProduct.name.toLowerCase().split(/\s+/);

    // Comparar similitudes palabra por palabra
    const similarProducts = allProducts
      .map((product) => {
        const productTokens = product.name.toLowerCase().split(/\s+/);
        const similarities = baseTokens.map(baseToken => {
          return Math.max(
            ...productTokens.map(productToken =>
              stringSimilarity.compareTwoStrings(baseToken, productToken)
            )
          );
        });

        // Calcular un promedio de similitudes
        const averageSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;

        return {
          ...product,
          similarity: averageSimilarity,
        };
      })
      .filter((product) => product.similarity > 0.3) // Solo productos con similitud > 0.3
      .sort((a, b) => b.similarity - a.similarity); // Ordenar por similitud descendente

    // Encontrar productos relacionados (misma categoría)
    const relatedProducts = await prisma.product.findMany({
      where: {
        category_id: comparedProduct.category_id,
        id: { not: id },
      },
      take: 10, // Limitar a 10 productos relacionados
    });

    return c.json({
      baseProduct: comparedProduct,
      similarProducts,
      relatedProducts,
    });
  } catch (error) {
    console.error("Error al comparar productos:", error);
    return c.json(
      { message: "Error interno del servidor." },
      500
    );
  }
});


ProductsRoutes.get("/", async (c) => {
  try {
    const prisma = c.get("prisma");

    const page = parseInt(c.req.query("page") || "1", 10); 
    const limit = parseInt(c.req.query("limit") || "10", 10); 
    const categoryId = c.req.query("category_id"); 
    const search = c.req.query("search"); 
    const maxPrice = Number(c.req.query("price")) || 0; 
    console.log(maxPrice)
    console.log(
      `Page: ${page}, Limit: ${limit}, CategoryID: ${categoryId}, Search: ${search}`
    );

 
    const skip = (page - 1) * limit;

    
    const whereFilter: any = {};
    if (categoryId) {
      whereFilter.category_id = categoryId;
    }
    if (search) {
      whereFilter.OR = [{ name: { contains: search, mode: "insensitive" } }];
    }
   
 if (maxPrice > 0) {
  whereFilter.OR = [
    {
      AND: [
        { price_d1: { lte: maxPrice } },
        { price_d1: { not: 0 } } 
      ],
    },
    {
      AND: [
        { price_olim: { lte: maxPrice } },
        { price_olim: { not: 0 } } 
      ],
    },
    {
      AND: [
        { price_exito: { lte: maxPrice } },
        { price_exito: { not: 0 } } 
      ],
    },
  ];
}


    const AllProductsList = await prisma.product.findMany({
      where: whereFilter,
      orderBy: {
        created_at: "desc",
      },
      skip, 
      take: limit, 
    });

    const productsFormatted = AllProductsList.map((p) => ({
      ...p,
      price_d1: Number(new Decimal(p.price_d1 || 0)),
      price_exito: Number(new Decimal(p.price_exito || 0)),
      price_olim: Number(new Decimal(p.price_olim || 0)),
    }));

    const totalProducts = await prisma.product.count({
      where: whereFilter,
    });
    const totalPages = Math.ceil(totalProducts / limit);

    return c.json({
      data: productsFormatted,
      meta: {
        totalProducts,
        totalPages,
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    const prismaError = handlePrismaError(error);
    console.error("Error fetching products:", prismaError);

    return c.json(
      {
        message: "Error al obtener productos",
        error: prismaError,
      },
      500
    );
  }
});
