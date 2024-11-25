import { Hono } from "hono";
import type { Variables } from "../../types/HonoVariables.js";
import { userValidator } from "../../schemas/user.js";
import { handlePrismaError } from "../../utils/PrismaErrorCatch.js";
import * as bcrypt from "bcrypt";
import { sign } from "hono/jwt";
import type { User } from "@prisma/client";

export const Auth = new Hono<{ Variables: Variables }>().basePath("/auth");

Auth.post("/register", userValidator, async (c) => {
  try {
    const { email, name, password } = await c.req.json<User>();
    const prisma = c.get("prisma");

    const userExist = await prisma.user.findUnique({
      where: { email },
    });

    if (userExist) {
      return c.json({ message: "Ya existe un usuario con este email" }, 409);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userRegistered = await prisma.user.create({
      data: { email, name, password: hashedPassword },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    return c.json({ message: "Registro exitoso", data: userRegistered }, 201);
  } catch (error: any) {
    const prismaError = handlePrismaError(error);
    if (prismaError) {
      console.error("Error creating user:", prismaError);
      return c.json(
        { message: "Error al registrar el usuario", error: prismaError },
        500
      );
    }
    console.error("Error creating user:", error?.message);
    return c.json(
      { message: "Error al registrar el usuario", error: error.message },
      500
    );
  }
});

Auth.post("/login", async (c) => {
  try {
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      return c.json({ message: "JWT_SECRET no configurado" }, 500);
    }

    const { email, password } = await c.req.json<{
      email: string;
      password: string;
    }>();

    if (!email || !password) {
      return c.json({ message: "Email o contraseña incorrecto" }, 401);
    }
    const prisma = c.get("prisma");
    const userExist = await prisma.user.findUnique({
      where: { email },
    });

    if (!userExist) {
      return c.json({ message: "Email o contraseña incorrecto" }, 401);
    }

    const isValidPassword = await bcrypt.compare(password, userExist.password);

    if (!isValidPassword) {
      return c.json({ message: "Email o contraseña incorrecto" }, 401);
    }

    const token = await sign(
      {
        userId: userExist.id,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      },
      JWT_SECRET,
      "HS256"
    );
    return c.json(
      {
        message: "Inicio de sesión exitoso",
        token,
        data: {
          id_usuario: userExist.id,
          nombre: userExist.name,
          email: userExist.email,
          rol: userExist.rol,
        },
      },
      200
    );
  } catch (error: any) {
    const prismaError = handlePrismaError(error);
    if (prismaError) {
      console.error("Error creating user:", prismaError);
      return c.json(
        { message: "Error al registrar el usuario", error: prismaError },
        500
      );
    }
    console.error("Error creating user:", error?.message);
    return c.json(
      { message: "Error al registrar el usuario", error: error.message },
      500
    );
  }
});
