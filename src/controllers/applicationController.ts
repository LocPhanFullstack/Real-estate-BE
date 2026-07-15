import { Request, Response } from "express";
import prisma from "../libs/prisma";
import { calculateNextPaymentDate } from "../utils";

// TODO: missing ownership check — getLeases/getLeasePayments leak data across users

const VALID_STATUSES = ["Pending", "Denied", "Approved"];

export const getListApplications = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, userType } = req.query;

    let whereClause = {};

    if (userId && userType) {
      if (userType === "tenant") {
        whereClause = { tenantCognitoId: userId };
      } else if (userType === "manager") {
        whereClause = { property: { managerCognitoId: userId } };
      }
    }

    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        property: {
          include: {
            location: true,
            manager: true,
          },
        },
        tenant: true,
      },
    });

    const formattedApplications = await Promise.all(
      applications.map(async (app) => {
        const lease = await prisma.lease.findFirst({
          where: {
            tenant: {
              cognitoId: app.tenantCognitoId,
            },
            propertyId: app.propertyId,
          },
          orderBy: { startDate: "desc" },
        });

        return {
          ...app,
          property: {
            ...app.property,
            address: app.property.location.address,
          },
          manager: app.property.manager,
          lease: lease
            ? { ...lease, nextPaymentDate: calculateNextPaymentDate(lease.startDate) }
            : null,
        };
      }),
    );

    res.json(formattedApplications);
  } catch (error: any) {
    console.error("getListApplications error:", error);
    res.status(500).json({ message: `Error retrieving application list: ${error.message}` });
  }
};

export const createApplication = async (req: Request, res: Response): Promise<void> => {
  try {
    const { applicationDate, propertyId, tenantCognitoId, name, email, phoneNumber, message } =
      req.body;

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { pricePerMonth: true, securityDeposit: true },
    });

    if (!property) {
      res.status(404).json({ message: "Property not found" });
      return;
    }

    const application = await prisma.application.create({
      data: {
        applicationDate: new Date(applicationDate),
        status: "Pending",
        name,
        email,
        phoneNumber,
        message,
        property: { connect: { id: propertyId } },
        tenant: { connect: { cognitoId: tenantCognitoId } },
      },
      include: { property: true, tenant: true },
    });

    res.status(201).json(application);
  } catch (error: any) {
    console.error("creatingApplication error:", error);
    res.status(500).json({ message: `Error creating application: ${error.message}` });
  }
};

export const updateApplicationStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ message: "Invalid status value" });
      return;
    }

    const application = await prisma.application.findUnique({
      where: { id: Number(id) },
      include: {
        property: true,
        tenant: true,
      },
    });

    if (!application) {
      res.status(404).json({ message: "Application not found." });
      return;
    }

    // Middleware only allow managers update if they own this property
    const { id: userId, role } = req.user!;
    if (role.toLowerCase() !== "manager" || application.property.managerCognitoId !== userId) {
      res.status(403).json({ message: "Access denied!!!" });
      return;
    }

    if (status === "Approved") {
      await prisma.$transaction(async (tx) => {
        const newLease = await tx.lease.create({
          data: {
            startDate: new Date(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            rent: application.property.pricePerMonth,
            deposit: application.property.securityDeposit,
            propertyId: application.propertyId,
            tenantCognitoId: application.tenantCognitoId,
          },
        });

        // Update the property to connect the tenant
        await tx.property.update({
          where: { id: application.propertyId },
          data: {
            tenants: {
              connect: { cognitoId: application.tenantCognitoId },
            },
          },
        });

        // Update the application with the new lease ID
        await tx.application.update({
          where: { id: Number(id) },
          data: { status, leaseId: newLease.id },
        });
      });
    } else {
      // Update the application status (for both "Denied" and other statuses)
      await prisma.application.update({
        where: { id: Number(id) },
        data: { status },
      });
    }

    // Respond with the updated application details
    const updatedApplication = await prisma.application.findUnique({
      where: { id: Number(id) },
      include: {
        property: true,
        tenant: true,
        lease: true,
      },
    });

    res.json(updatedApplication);
  } catch (error: any) {
    res.status(500).json({ message: `Error updating application status: ${error.message}` });
  }
};
