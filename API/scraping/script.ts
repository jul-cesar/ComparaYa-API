import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import puppeteer from "puppeteer";

const prisma = new PrismaClient();

interface Product {
  name: string;
  image_url: string;
  price: string;
  category_id: string;
}

function getCategoryFromScrapingPage(url: string): string {
  const pageUrl = new URL(url);
  let path = pageUrl.pathname.split("/")[2];

  if (path.includes("-")) {
    path = path.replace(/-/g, " ");
  }
  return path;
}

function formatPrice(priceString: string | null): Decimal {
  if (!priceString) return new Decimal(0);
  return new Decimal(priceString.replace("$", "").replace(/\./g, "").trim());
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
    await page.goto(url);

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

    const scrappedProductData: Product[] = await page.evaluate(
      (
        categoryId: string,
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

          return {
            name: name?.textContent?.trim() || "N/A",
            image_url: img?.src || "N/A",
            price: price?.textContent?.trim() || "0",
            category_id: categoryId,
          };
        });
      },
      categoryId,
      cardSelector,
      nombreSelector,
      precioSelector,
      imgSelector
    );

    console.log("Scraped data:", scrappedProductData);

    for (const product of scrappedProductData) {
      await prisma.product.create({
        data: {
          name: product.name,
          image_url: product.image_url,
          price: formatPrice(product.price),
          category_id: product.category_id,
          distributor: dist,
        },
      });
    }

    console.log("Products saved successfully.");
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    await browser.close();
  }
}
