import { Request, Response } from "express";
import prisma from "../libs/prisma";

export const getLeases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: userId, role } = req.user!;
    const leases = await prisma.lease.findMany({
      where:
        role.toLowerCase() === "manager"
          ? { property: { managerCognitoId: userId } }
          : { tenantCognitoId: userId },
      include: {
        tenant: true,
        property: true,
      },
    });
    res.json(leases);
  } catch (error: any) {
    console.error("getLeases error:", error);
    res.status(500).json({ message: `Error retrieving leases: ${error.message}` });
  }
};

export const getLeasePayments = async (
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const leaseId = Number(id);

    if (isNaN(leaseId)) {
      res.status(400).json({ message: "Invalid lease id" });
      return;
    }

    const { id: userId, role } = req.user!;

    const lease = await prisma.lease.findUnique({
      where: { id: leaseId },
      include: { property: true },
    });

    if (!lease) {
      res.status(404).json({ message: "Lease not found" });
      return;
    }

    const isOwner =
      role.toLowerCase() === "manager"
        ? lease.property.managerCognitoId === userId
        : lease.tenantCognitoId === userId;

    if (!isOwner) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const payments = await prisma.payment.findMany({
      where: { leaseId },
    });

    res.json(payments);
  } catch (error: any) {
    console.error("getLeasePayment error:", error);
    res.status(500).json({ message: `Error retrieving lease payment: ${error.message}` });
  }
};
