import { Request, Response } from "express";
import prisma from "../libs/prisma";
import { Location, Prisma } from "@prisma/client";
import { wktToGeoJSON } from "@terraformer/wkt";
import { Upload } from "@aws-sdk/lib-storage";
import { S3Client } from "@aws-sdk/client-s3";
import axios from "axios";

const region = process.env.AWS_REGION;

if (!region) {
  throw new Error("Missing AWS_REGION environment variable");
}

const s3Client = new S3Client({
  region,
});

export const getProperties = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      priceMin,
      priceMax,
      favoriteIds,
      beds,
      baths,
      propertyType,
      squareFeetMin,
      squareFeetMax,
      amenities,
      availableFrom,
      latitude,
      longitude,
    } = req.query;

    let whereConditions: Prisma.Sql[] = [];

    if (favoriteIds) {
      const favoriteIdArray = (favoriteIds as string).split(",").map(Number);
      whereConditions.push(Prisma.sql`p.id IN (${Prisma.join(favoriteIdArray)})`);
    }

    if (priceMin) {
      whereConditions.push(Prisma.sql`p."pricePerMonth" >= ${Number(priceMin)}`);
    }

    if (priceMax) {
      whereConditions.push(Prisma.sql`p."pricePerMonth" <= ${Number(priceMax)}`);
    }

    if (beds && beds !== "any") {
      whereConditions.push(Prisma.sql`p.beds >= ${Number(beds)}`);
    }

    if (baths && baths !== "any") {
      whereConditions.push(Prisma.sql`p.baths >= ${Number(baths)}`);
    }

    if (squareFeetMin) {
      whereConditions.push(Prisma.sql`p."squareFeet" >= ${Number(squareFeetMin)}`);
    }

    if (squareFeetMax) {
      whereConditions.push(Prisma.sql`p."squareFeet" <= ${Number(squareFeetMax)}`);
    }

    if (propertyType && propertyType !== "any") {
      whereConditions.push(Prisma.sql`p."propertyType" = ${propertyType}::"PropertyType"`);
    }

    if (amenities && amenities !== "any") {
      const amenitiesArray = (amenities as string).split(",");
      whereConditions.push(Prisma.sql`p.amenities @> ${amenitiesArray}::"Amenities"[]`);
    }

    if (availableFrom && availableFrom !== "any") {
      const availableFromDate = typeof availableFrom === "string" ? availableFrom : null;
      if (availableFromDate) {
        const date = new Date(availableFromDate);
        if (!isNaN(date.getTime())) {
          whereConditions.push(
            Prisma.sql`EXISTS (SELECT 1 from "Lease" l WHERE l."propertyId" = p.id AND l."startDate" <= ${date.toISOString()})`,
          );
        }
      }
    }

    if (latitude && longitude) {
      const lat = parseFloat(latitude as string);
      const lng = parseFloat(longitude as string);
      const radiusInKilometers = 1000;
      const degrees = radiusInKilometers / 111; // Convert kilometer to degree

      whereConditions.push(
        Prisma.sql`ST_DWithin(l.coordinates::geometry, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326), ${degrees})`,
      );
      //   whereConditions.push(
      //     Prisma.sql`ST_DWithin(
      //   l.coordinates,
      //   ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      //   ${radiusInKilometers * 1000}
      // )`,
      //   );
    }

    const completeQuery = Prisma.sql`
        SELECT 
            p.*,
            json_build_object(
            'id', l.id,
            'address', l.address,
            'city', l.city,
            'state', l.state,
            'country', l.country,
            'postalCode', l."postalCode",
            'coordinates', json_build_object(
                'longitude', ST_X(l."coordinates"::geometry),
                'latitude', ST_Y(l."coordinates"::geometry)
            )
            ) as location
        FROM "Property" p
        JOIN "Location" l ON p."locationId" = l.id
        ${whereConditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(whereConditions, " AND ")}` : Prisma.empty}
        `;

    const properties = await prisma.$queryRaw(completeQuery);

    res.json(properties);
  } catch (error: any) {
    console.error("getProperties error:", error);
    res.status(500).json({ message: `Error retrieving properties: ${error.message}` });
  }
};

export const getProperty = async (req: Request<{ id: number }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const property = await prisma.property.findUnique({
      where: { id: Number(id) },
      include: {
        location: true,
      },
    });

    if (!property) {
      res.status(404).json({ message: "Property not found" });
      return;
    }

    const coordinates: { coordinates: string }[] =
      await prisma.$queryRaw`SELECT ST_asText(coordinates) as coordinates 
            FROM "Location" WHERE id = ${property.location.id}`;

    const geoJSON: any = wktToGeoJSON(coordinates[0]?.coordinates || "");
    const longitude = geoJSON.coordinates[0];
    const latitude = geoJSON.coordinates[1];

    const propertyWithCoordinates = {
      ...property,
      location: {
        ...property.location,
        coordinates: {
          longitude,
          latitude,
        },
      },
    };

    res.json(propertyWithCoordinates);
  } catch (error: any) {
    console.error("getProperty error:", error);
    res.status(500).json({ message: `Error retrieving property: ${error.message}` });
  }
};

export const createProperty = async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    const { address, city, state, country, postalCode, managerCognitoId, ...propertyData } =
      req.body;

    const photoUrls = await Promise.all(
      files.map(async (file) => {
        const uploadParams = {
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: `properties/${Date.now()}-${file.originalname}`,
          Body: file.buffer,
          ContentType: file.mimetype,
        };

        const uploadResult = await new Upload({
          client: s3Client,
          params: uploadParams,
        }).done();

        return uploadResult.Location;
      }),
    );

    const geocodingUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
      street: address,
      city,
      country,
      postalcode: postalCode,
      format: "json",
      limit: "1",
    }).toString()}`;
    const geoCodingRes = await axios.get(geocodingUrl, {
      headers: {
        "User-Agent": "RealEstatApp (test@gmail.com)",
      },
    });
    const [longitude, latitude] =
      geoCodingRes.data[0]?.lon && geoCodingRes.data[0]?.lat
        ? [parseFloat(geoCodingRes.data[0].lon), parseFloat(geoCodingRes.data[0].lat)]
        : [0, 0];

    // create location
    const [location] = await prisma.$queryRaw<Location[]>`
        INSERT INTO "Location" (address, city, state, country, "postalCode", coordinates)
        VALUES (${address}, ${city}, ${state}, ${country}, ${postalCode}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))
        RETURNING id, address, city, state, country, "postalCode", ST_asText(coordinates) as coordinates 
    `;

    if (!location) {
      res.status(500).json({ message: "Failed to create location" });
      return;
    }

    // create property
    const newProperty = await prisma.property.create({
      data: {
        ...propertyData,
        photoUrls,
        locationId: location.id,
        managerCognitoId,
        amenities:
          typeof propertyData.amenities === "string" ? propertyData.amenities.split(",") : [],
        highlights:
          typeof propertyData.highlights === "string" ? propertyData.highlights.split(",") : [],
        isPetsAllowed: propertyData.isPetsAllowed === "true",
        isParkingIncluded: propertyData.isParkingIncluded === "true",
        pricePerMonth: parseFloat(propertyData.pricePerMonth),
        securityDeposit: parseFloat(propertyData.securityDeposit),
        applicationFee: parseFloat(propertyData.applicationFee),
        beds: parseInt(propertyData.beds),
        baths: parseFloat(propertyData.baths),
        squareFeet: parseInt(propertyData.squareFeet),
      },
      include: {
        location: true,
        manager: true,
      },
    });
    res.status(201).json(newProperty);
  } catch (error: any) {
    console.error("createProperty error:", error);
    res.status(500).json({ message: `Error creating property: ${error.message}` });
  }
};
