import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import puppeteer from "puppeteer";

const prisma = new PrismaClient();

interface Product {
  name: string;
  image_url: string;
  price_d1: number;
  price_olim: number;
  price_exito: number;
  category_id: string;
}
async function autoScroll(page: puppeteer.Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const scrollInterval = 700;
      const scrollStep = 700;

      const scrollIntervalId = setInterval(() => {
        const maxScrollHeight = document.body.scrollHeight;
        window.scrollBy(0, scrollStep);
        totalHeight += scrollStep;

        if (totalHeight >= maxScrollHeight) {
          clearInterval(scrollIntervalId);
          resolve();
        }
      }, scrollInterval);
    });
  });
}

async function updateProducts(products: Product[]) {
  try {
    const productsOnDb = await prisma.product.findMany({
      select: {
        id: true,
        category_id: true,
        image_url: true,
        name: true,
        price_d1: true,
        price_exito: true,
        price_olim: true,
      },
    });

    const productsMap = new Map(
      productsOnDb.map((p) => [`${p.name.toLowerCase()}_${p.category_id}`, p])
    );

    const updates = [];
    const newProducts = [];

    for (const product of products) {
      const key = `${product.name.toLowerCase()}_${product.category_id}`;
      const productToUpdate = productsMap.get(key);

      if (!productToUpdate) {
        newProducts.push(product);
      } else {
        const needsUpdate =
          (product.price_d1 !== 0 &&
            !new Decimal(product.price_d1).equals(
              productToUpdate.price_d1 || 0
            )) ||
          (product.price_exito !== 0 &&
            !new Decimal(product.price_exito).equals(
              productToUpdate.price_exito || 0
            )) ||
          (product.price_olim !== 0 &&
            !new Decimal(product.price_olim).equals(
              productToUpdate.price_olim || 0
            )) ||
          (product.image_url !== "N/A" &&
            product.image_url !== productToUpdate.image_url);

        if (needsUpdate) {
          updates.push({
            id: productToUpdate.id,
            ...product,
          });
        }
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(
        updates.map((u) =>
          prisma.product.update({
            where: { id: u.id },
            data: {
              price_d1: u.price_d1,
              price_olim: u.price_olim,
              price_exito: u.price_exito,
              image_url: u.image_url,
            },
          })
        )
      );
      console.log(`${updates.length} products updated.`);
    }

    return newProducts;
  } catch (error) {
    console.error("Error updating products:", error);
  }
}

function getCategoryFromScrapingPage(url: string): string {
  const pageUrl = new URL(url);
  let path = pageUrl.pathname.split("/")[2];

  if (path.includes("-")) {
    path = path.replace(/-/g, " ");
  }
  return path;
}

 

async function findOrCreateCategory(
  categoryName: string
): Promise<string | undefined> {
  try {
    let category = await prisma.category.findFirst({
      where: { name: categoryName },
      select: { id: true },
    });

    if (!category) {
      category = await prisma.category.create({
        data: { name: categoryName },
      });
      console.log(`Category created: ${category.id}`);
    }

    return category?.id;
  } catch (error) {
    console.error("Error managing category:", error);
  }
}

async function scrap(
  url: string,
  dist: string,
  cardSelector: string,
  nombreSelector: string,
  precioSelector: string,
  imgSelector: string
): Promise<void> {
  const browser = await puppeteer.launch();
  try {
    console.log(`Scraping page: ${url}`);
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    const category = getCategoryFromScrapingPage(url);
    if (!category) {
      throw new Error("Unable to extract category from URL.");
    }

    const categoryId = await findOrCreateCategory(category);
    if (!categoryId) {
      throw new Error("Category ID could not be resolved.");
    }

    console.log("Waiting for selectors...");
    await page.waitForSelector(cardSelector, { timeout: 60000 });

    if (dist === "d1" || dist === "exito") {
      console.log(`Scrolling the page for distributor: ${dist}`);
      await autoScroll(page);
    }

    const scrappedProductData: Product[] = await page.evaluate(
      (
        categoryId: string,
        dist: string,
        cardSelector: string,
        nombreSelector: string,
        precioSelector: string,
        imgSelector: string
      ): Product[] => {
        const productsCards = document.querySelectorAll(cardSelector);

        return Array.from(productsCards).map((prod) => {
          const shadowRoot = prod.shadowRoot || prod;
          const img = shadowRoot.querySelector<HTMLImageElement>(imgSelector);
          const name = shadowRoot.querySelector<HTMLElement>(nombreSelector);
          const price = shadowRoot.querySelector<HTMLElement>(precioSelector);

          

          const productData = {
            name: name?.textContent?.trim() || "N/A",
            image_url: img?.src || "N/A",
            price_d1: 0,
            price_olim: 0,
            price_exito: 0,
            category_id: categoryId,
          };

          if (dist === "olimpica") {
            productData.price_olim = price ?  parseInt(
              price.innerText.replace("$", "").replace(/\./g, ""),
              10
            ) : 0;
          } else if (dist === "d1") {
            productData.price_d1 = price ?  parseInt(
              price.innerText.replace("$", "").replace(/\./g, ""),
              10
            ) : 0;
          } else {
            productData.price_exito = price ?  parseInt(
              price.innerText.replace("$", "").replace(/\./g, ""),
              10
            ) : 0;
          }
          console.log(productData)
          return productData;
        });
      },
      categoryId,
      dist,
      cardSelector,
      nombreSelector,
      precioSelector,
      imgSelector
    );


    const updatedProducts = await updateProducts(scrappedProductData);
    console.log(scrappedProductData)

    if (updatedProducts) {
      await prisma.product.createMany({
        data: updatedProducts,
      });
    }

    console.log("Products saved successfully.");
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }
}

const config = await prisma.scraping_config.findMany({});

for (const conf of config) {
  await scrap(
    conf.base_url,
    conf.website_name,
    conf.card_selector,
    conf.name_selector,
    conf.price_selector,
    conf.img_selector
  );
}
