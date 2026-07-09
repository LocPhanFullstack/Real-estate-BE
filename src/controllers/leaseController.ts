import { Request, Response } from "express";
import prisma from "../libs/prisma";

// TODO: missing ownership check — getLeases/getLeasePayments leak data across users

export const getLeases = async (req: Request, res: Response): Promise<void> => {
  try {
    const leases = await prisma.lease.findMany({
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
    const payments = await prisma.payment.findMany({
      where: { leaseId },
    });

    res.json(payments);
  } catch (error: any) {
    console.error("getLeasePayment error:", error);
    res.status(500).json({ message: `Error retrieving lease payment: ${error.message}` });
  }
};
