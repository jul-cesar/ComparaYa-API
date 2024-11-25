import { jest } from "@jest/globals";

const prisma = {
  product: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

export default prisma;
