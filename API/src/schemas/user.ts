import { z } from "zod"
import { GenerateValidatorFromSchema } from "../validators/GeneralValidator.js"

export const UserZodSchema = z.object({
    name: z
    .string()
    .min(3, { message: "Por favor ingresa un nombre de al menos 3 caracteres." })
    .max(100, { message: "El nombre no debe exceder los 100 caracteres." }),
  
  email: z
    .string()
    .email({ message: "Por favor ingresa un correo electrónico válido." })
    .max(100, { message: "El correo electrónico no debe exceder los 100 caracteres." }),
  
  password: z
    .string()
    .min(8, { message: "Por favor ingresa una contraseña de al menos 8 caracteres." })
    .regex(/(?=.*[A-Za-z])(?=.*\d)/, { 
      message: "La contraseña debe incluir al menos una letra y un número." 
    })
    .max(255, { message: "La contraseña no debe exceder los 255 caracteres." }),
})


export const userValidator = GenerateValidatorFromSchema(UserZodSchema)
