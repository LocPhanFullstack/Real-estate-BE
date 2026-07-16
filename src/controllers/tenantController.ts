import { Request, Response } from "express";
import prisma from "../libs/prisma";
import { wktToGeoJSON } from "@terraformer/wkt";

export const getTernant = async (
  req: Request<{ cognitoId: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id: cognitoId } = req.user!;

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
    const { id: cognitoId } = req.user!;
    const { name, email, phoneNumber } = req.body;

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

export const updateTernant = async (
  req: Request<{ cognitoId: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id: cognitoId } = req.user!;
    const { name, email, phoneNumber } = req.body;

    if (!cognitoId) {
      res.status(400).json({ message: "Missing cognitoId" });
      return;
    }

    const updateTernant = await prisma.tenant.update({
      where: { cognitoId },
      data: {
        name,
        email,
        phoneNumber,
      },
    });

    res.json(updateTernant);
  } catch (error: any) {
    console.error("updateTernant error:", error);
    res.status(500).json({ message: `Error updating tenant: ${error.message}` });
  }
};

export const getCurrentResidences = async (
  req: Request<{ cognitoId: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id: cognitoId } = req.user!;

    const residences = await prisma.property.findMany({
      where: { tenants: { some: { cognitoId } } },
      include: { location: true },
    });

    const residencesWithFormattedLocation = await Promise.all(
      residences.map(async (residence) => {
        const coordinates: { coordinates: string }[] =
          await prisma.$queryRaw`SELECT ST_asText(coordinates) as coordinates 
            FROM "Location" WHERE id = ${residence.location.id}`;

        const geoJSON: any = wktToGeoJSON(coordinates[0]?.coordinates || "");
        const longitude = geoJSON.coordinates[0];
        const latitude = geoJSON.coordinates[1];

        return {
          ...residence,
          location: {
            ...residence.location,
            coordinates: {
              longitude,
              latitude,
            },
          },
        };
      }),
    );
    res.json(residencesWithFormattedLocation);
  } catch (error: any) {
    console.error("getCurrentResidences error:", error);
    res.status(500).json({ message: `Error retrieving current residences: ${error.message}` });
  }
};

export const addFavoriteProperty = async (
  req: Request<{ cognitoId: string; propertyId: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id: cognitoId } = req.user!;
    const propertyId = Number(req.params.propertyId);

    const tenant = await prisma.tenant.findUnique({
      where: { cognitoId },
      include: { favorites: true },
    });

    if (!tenant) {
      res.status(400).json({ message: "Tenant doesn't exist" });
      return;
    }

    const existingFavorites = tenant.favorites || [];

    if (!existingFavorites.some((fav) => fav.id === propertyId)) {
      const updatedTenant = await prisma.tenant.update({
        where: { cognitoId },
        data: {
          favorites: {
            connect: { id: propertyId },
          },
        },
        include: { favorites: true },
      });
      res.json(updatedTenant);
    } else {
      res.status(409).json({ message: "Property already added as favorite" });
    }
  } catch (error: any) {
    console.error("addFavoriteProperty error:", error);
    res.status(500).json({ message: `Error adding favorite property: ${error.message}` });
  }
};

export const removeFavoriteProperty = async (
  req: Request<{ cognitoId: string; propertyId: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id: cognitoId } = req.user!;
    const propertyId = Number(req.params.propertyId);
    const updatedTenant = await prisma.tenant.update({
      where: { cognitoId },
      data: {
        favorites: {
          disconnect: { id: propertyId },
        },
      },
      include: { favorites: true },
    });

    res.json(updatedTenant);
  } catch (error: any) {
    console.error("removeFavoriteProperty error:", error);
    res.status(500).json({ message: `Error removing favorite property: ${error.message}` });
  }
};
