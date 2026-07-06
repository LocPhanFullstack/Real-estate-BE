import { Request, Response } from "express";
import prisma from "../libs/prisma";

export const getTernant = async (
  req: Request<{ cognitoId: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { cognitoId } = req.params;

    if (!cognitoId) {
      res.status(400).json({ message: "Missing cognitoId" });
      return;
    }

    const ternant = await prisma.tenant.findUnique({
      where: { cognitoId },
      include: {
        favorites: true,
      },
    });

    if (ternant) {
      res.json(ternant);
    } else {
      res.status(404).json({ message: "Tenant not found" });
    }
  } catch (error: any) {
    console.error("getTernant error:", error);
    res.status(500).json({ message: `Error retrieving tenant: ${error.message}` });
  }
};

export const createTernant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cognitoId, name, email, phoneNumber } = req.body;

    const ternant = await prisma.tenant.create({
      data: {
        cognitoId,
        name,
        email,
        phoneNumber,
      },
    });

    res.status(201).json(ternant);
  } catch (error: any) {
    console.error("createTernant error:", error);
    res.status(500).json({ message: `Error creating tenant: ${error.message}` });
  }
};
