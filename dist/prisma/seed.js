"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter });
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function toPascalCase(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}
function toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}
async function insertLocationDate(locations) {
    for (const location of locations) {
        const { id, country, city, state, address, postalCode, coordinates } = location;
        try {
            await prisma.$executeRaw `INSERT INTO "Location" ("id", "country", "city", "state", "address", "postalCode", "coordinates") VALUES (${id}, ${country}, ${city}, ${state}, ${address}, ${postalCode}, ST_GeomFromText(${coordinates}, 4326))`;
            console.log(`Inserted location for ${city}`);
        }
        catch (error) {
            console.error(`Error inserting location for ${city}`, error);
        }
    }
}
async function resetSequence(modelName) {
    const quotedModelName = `"${toPascalCase(modelName)}"`;
    const maxIdResult = await prisma[modelName].findMany({
        select: { id: true },
        orderBy: { id: "desc" },
        take: 1,
    });
    if (maxIdResult.length === 0)
        return;
    const nextId = maxIdResult[0].id + 1;
    await prisma.$executeRaw(client_1.Prisma.raw(`
    SELECT setval(pg_get_serial_sequence('${quotedModelName}', 'id'), coalesce(max(id)+1, ${nextId}), false) FROM ${quotedModelName};
  `));
    console.log(`Reset sequence for ${modelName} to ${nextId}`);
}
async function deleteAllData(orderedFileNames) {
    const modelNames = orderedFileNames.map((fileName) => {
        return toPascalCase(path_1.default.basename(fileName, path_1.default.extname(fileName)));
    });
    for (const modelName of modelNames.reverse()) {
        const modelNameCamel = toCamelCase(modelName);
        const model = prisma[modelNameCamel];
        if (!model) {
            console.error(`Model ${modelName} not found in Prisma client`);
            continue;
        }
        try {
            await model.deleteMany({});
            console.log(`Cleared data from ${modelName}`);
        }
        catch (error) {
            console.error(`Error clearing data from ${modelName}: `, error);
        }
    }
}
async function main() {
    const dataDirectory = path_1.default.join(__dirname, "seedData");
    const orderedFileNames = [
        "location.json", // No dependencies
        "manager.json", // No dependencies
        "property.json", // Depends on location and manager
        "tenant.json", // No dependencies
        "lease.json", // Depends on property and tenant
        "application.json", // Depends on property and tenant
        "payment.json", // Depends on lease
    ];
    // Delete all existing data
    await deleteAllData(orderedFileNames);
    // Seed data
    for (const fileName of orderedFileNames) {
        const filePath = path_1.default.join(dataDirectory, fileName);
        const jsonData = JSON.parse(fs_1.default.readFileSync(filePath, "utf-8"));
        const modelName = toPascalCase(path_1.default.basename(fileName, path_1.default.extname(fileName)));
        const modelNameCamel = toCamelCase(modelName);
        if (modelName === "Location") {
            await insertLocationDate(jsonData);
        }
        else {
            const model = prisma[modelNameCamel];
            try {
                for (const item of jsonData) {
                    await model.create({
                        data: item,
                    });
                }
                console.log(`Seeded ${modelName} with data from ${fileName}`);
            }
            catch (error) {
                console.error(`Error seeding data for ${modelName}: `, error);
            }
        }
        // Reset the sequence after seeding each modek
        await resetSequence(modelName);
        await sleep(1000);
    }
}
main()
    .catch((e) => console.error(e))
    .finally(async () => await prisma.$disconnect());
//# sourceMappingURL=seed.js.map