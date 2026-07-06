"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createManager = exports.getManager = void 0;
const prisma_1 = __importDefault(require("../libs/prisma"));
const getManager = async (req, res) => {
    try {
        const { cognitoId } = req.params;
        if (!cognitoId) {
            res.status(400).json({ message: "Missing cognitoId" });
            return;
        }
        const manager = await prisma_1.default.manager.findUnique({
            where: { cognitoId },
        });
        if (manager) {
            res.json(manager);
        }
        else {
            res.status(404).json({ message: "Manager not found" });
        }
    }
    catch (error) {
        console.error("getManager error:", error);
        res.status(500).json({ message: `Error retrieving manager: ${error.message}` });
    }
};
exports.getManager = getManager;
const createManager = async (req, res) => {
    try {
        const { cognitoId, name, email, phoneNumber } = req.body;
        const manager = await prisma_1.default.manager.create({
            data: {
                cognitoId,
                name,
                email,
                phoneNumber,
            },
        });
        res.status(201).json(manager);
    }
    catch (error) {
        console.error("createManager error:", error);
        res.status(500).json({ message: `Error creating manager: ${error.message}` });
    }
};
exports.createManager = createManager;
//# sourceMappingURL=managerController.js.map