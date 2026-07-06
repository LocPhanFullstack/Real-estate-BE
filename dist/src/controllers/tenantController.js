"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTernant = exports.getTernant = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const getTernant = async (req, res) => {
    try {
        const { cognitoId } = req.params;
        if (!cognitoId) {
            res.status(400).json({ message: "Missing cognitoId" });
            return;
        }
        const ternant = await prisma_1.default.tenant.findUnique({
            where: { cognitoId },
            include: {
                favorites: true,
            },
        });
        if (ternant) {
            res.json(ternant);
        }
        else {
            res.status(404).json({ message: "Tenant not found" });
        }
    }
    catch (error) {
        console.error("getTernant error:", error);
        res.status(500).json({ message: `Error retrieving tenant: ${error.message}` });
    }
};
exports.getTernant = getTernant;
const createTernant = async (req, res) => {
    try {
        const { cognitoId, name, email, phoneNumber } = req.body;
        const ternant = await prisma_1.default.tenant.create({
            data: {
                cognitoId,
                name,
                email,
                phoneNumber,
            },
        });
        res.status(201).json(ternant);
    }
    catch (error) {
        console.error("createTernant error:", error);
        res.status(500).json({ message: `Error creating tenant: ${error.message}` });
    }
};
exports.createTernant = createTernant;
//# sourceMappingURL=tenantController.js.map