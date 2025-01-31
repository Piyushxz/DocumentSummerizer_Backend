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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddings = exports.v1Router = void 0;
const express_1 = require("express");
const zod_1 = __importDefault(require("zod"));
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.v1Router = (0, express_1.Router)();
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const google_vertexai_1 = require("@langchain/google-vertexai");
const google_vertexai_2 = require("@langchain/google-vertexai");
const qdrant_1 = require("@langchain/qdrant");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const pdfTest_1 = require("../pdfTest");
exports.v1Router.get('/', (req, res) => {
    res.json("Hey");
});
const serviceAccount = {
    "type": "service_account",
    "project_id": "aerobic-stream-448606-f3",
    "private_key_id": "c3e01df3b14aa65caa193132794bc2561f061eb7",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC2CEIO5EuXevlS\nOong2FK7vCfko5G1o87H5uUz6Am1GM1v+oQMlSaosY0AOYjFZJQj6UoJxMBzwTDC\n67A5nTBmFoDIvP501HlptT4rdbu038rQdxtNZAtrtJtX2RZtm0o9fyAhQDnlTHPA\nz/houcDtl/iwqSYh4JYqm1RJNjdGBJvuyoR3/HknRlxQwKcZ1LL/oDrlIO2lFoCi\nDvcl8yvlXha1dPlx0nevZx0Qs3DK7D47ouMAlSYsZMWtbDpLk1i+wPZ7Car9picj\nWqwe4YtUiiuRBMQh8t4Y5r5aQXXlChTecBIZB9tCjhTDSqm9ZnSTPtD+QtZJS8NY\nrAkv2jYrAgMBAAECggEAAUi+S+PuaJYp1huq8gF0q/W1g6u9ERP5FyNDhgHit6VX\nnewJrFg+jTdiwJEqY8r41O/+e/Gyn6D56UpWzu477/WxhN4lQc5CK1A++7Yg6F8Tl\nuwzBY41gyz9jQn5kkHINAbFjj6MoBWcXAKA292jVZJey3cQuYa93lRCyyoVtubph\nhZv7rJQ9zn2O1CXP80/w1tUfUUpRdR1L5/W3rcLbDdsnlCujjD7qV1mmTwKQ7vMp\nQFDThI2FBXRZSMkcM8M2altQkDFibdW+PfBAHlY6S4TKBXXTy3fB2R6FKor0H4aM\nwiHT1AIg/bQYXvjK7F+2kEi4MRrQg3n3Y/JjI3uzQQKBgQD3WV4naBUaUMbmSE7N\nd8AEKH0+bq0gy34zj0fTIvqEA8MnOTtziaL2PGGkqHbLCKoXqEt2T/Pyir5yC7+y\nmVfjJHNcronUpPhwF04O+rsX2nEocCrIibKqKlyqhbrDAkaQfzSDGfRHSCeSfCHw\nQ5TqlrmwzVUqar2sgppomSAqIQKBgQC8ZhP7TB7luSJCs18nc/+O2b3xWDMnyduo\neofZLgyxFbkmH3MUpO4G7oEjI6VUoYl35FNFiRxcntxdtWOhm0zlIzg8H/RTjHKc\nF2eTZyRwqgoh0Ecbi/KxUu03+KLBBFonhjjP3ytjWB1gph9ekx8X7E46rp4l5O8Q\nDh3yPasOywKBgDhI1L0A2TR4xxnlwFDO/Bm2IPHQ+4Jn69rNstlfr0PVG1ZUlquu\n2S9RBCMU1ptS6GmjuTA991PssHOBKuj4LeCZDcs8SE7kD0hqdS/BbEt8QJ2kEIg7\nlTVVmGqRLbNsVCRTXd6rTEPgLmkN6CclKcDL9Ys+3i9dxLV5rqs4lPIhAoGAPVEz\n26xQug/hWLgslhio6oNv0KcWLzMBrPoEUOkt9EzPr9q4h9WOKu9hVGB7pOnWZhEI\nES+o7XQ+4LjyrlxvUHyABwGXccHaY3cynMULFSgimBLDsfGAkbodvwPLZOrXtNl4\nkB9gbbr2BMjMmOllS1H7vBmtG0RBkoYltPvhOrUCgYBUEXWGoMvx5CrVrRrlSztj\n/XQSJme+4P8UHSt4TELwuAzqaLKuvWl+WCLZFYxQxVNPrZjGrJLzweD3H23SUvKt\nLYQVu8IQB2+VJGwEJ64vdTlg4RsMHdlCAqtr9MeIQxP8+ybTix4gikXo6mC9U2Or\nLGgt/blcPy3ZGCagLK8fnA==\n-----END PRIVATE KEY-----\n",
    "client_email": "piyush@aerobic-stream-448606-f3.iam.gserviceaccount.com",
    "client_id": "107043059670807391872",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/piyush%40aerobic-stream-448606-f3.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
};
// Initialize Google Auth
const auth = new google_auth_library_1.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    credentials: serviceAccount
});
// Correctly pass the auth object when initializing VertexAI
const llm = new google_vertexai_1.ChatVertexAI({
    model: "gemini-1.5-flash",
    temperature: 0,
});
exports.embeddings = new google_vertexai_2.VertexAIEmbeddings({
    model: "text-embedding-004",
});
// Your Qdrant client setup and other logic goes here
function vectorStore() {
    return __awaiter(this, void 0, void 0, function* () {
        yield qdrant_1.QdrantVectorStore.fromExistingCollection(exports.embeddings, {
            url: 'https://9998d475-d66e-4dfc-b5fb-4da33df563b5.us-east4-0.gcp.cloud.qdrant.io:6333',
            collectionName: "gemini_embeddings",
            apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwiZXhwIjoxNzQ2MDQyMzMxfQ.IhRRIbkJnYe6nuN6byTr9QZZIBOTnZEGlQItegeJj8M'
        });
    });
}
vectorStore();
const prismaClient = new client_1.PrismaClient();
const pdfPath = path.resolve(__dirname, '../../Full_Stack_Engineer_Internship_Assignment.pdf');
if (fs.existsSync(pdfPath)) {
    console.log("File exists:", pdfPath);
}
else {
    console.log("File does not exist:", pdfPath);
}
// async function processAndStore() {
//    try {
//         // Step 1: Load PDF
//         const loader = new PDFLoader(pdfPath);
//         const docs = await loader.load();
//         console.log("Loaded Docs:", docs);
//         // Step 2: Split Documents
//         const textSplitter = new RecursiveCharacterTextSplitter({
//             chunkSize: 1000,
//             chunkOverlap: 200,
//         });
//         const splitDocs = await textSplitter.splitDocuments(docs);
//         console.log("Split Docs:", splitDocs);
//         // Step 3: Extract Text and Metadata
//         const texts = splitDocs.map((doc) => doc.pageContent);
//         const metadata = splitDocs.map((doc) => doc.metadata);
//         // Step 4: Store Embeddings in Qdrant
//         const vectorStore = await QdrantVectorStore.fromTexts(
//             texts,
//             metadata,
//             embeddings,
//             {
//                 client: new QdrantClient({ url:'https://9998d475-d66e-4dfc-b5fb-4da33df563b5.us-east4-0.gcp.cloud.qdrant.io:6333', apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIiwiZXhwIjoxNzQ2MDQyMzMxfQ.IhRRIbkJnYe6nuN6byTr9QZZIBOTnZEGlQItegeJj8M' }),
//                 collectionName: "gemini_embeddings",
//             }
//         );
//         console.log("Embeddings successfully stored in Qdrant!");
//     } catch (error) {
//         console.error("Error processing and storing embeddings:", error);
//     }
// }
// processAndStore();
(0, pdfTest_1.main)();
exports.v1Router.post('/user/signup', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const requiredBody = zod_1.default.object({
        username: zod_1.default.string().min(5).max(10),
        email: zod_1.default.string().email(),
        password: zod_1.default.string().min(5).max(50)
    });
    const parsedBody = requiredBody.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({ message: "Invalid Format!" });
        return;
    }
    const hashedPassword = yield bcryptjs_1.default.hash(parsedBody.data.password, 5);
    try {
        yield prismaClient.user.create({
            data: {
                username: parsedBody.data.username,
                email: parsedBody.data.email,
                password: hashedPassword
            }
        });
        res.status(201).json({ message: "User created" });
    }
    catch (e) {
        res.status(500).json({ message: "Server error" });
        console.log(e);
    }
}));
exports.v1Router.post('/user/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    let foundUser = null;
    try {
        foundUser = yield prismaClient.user.findFirst({
            where: {
                username: username,
            }
        });
        if (!foundUser) {
            res.status(404).json({ message: 'User does not exist' });
            return;
        }
        const validPassword = yield bcryptjs_1.default.compare(password, foundUser.password);
        if (!validPassword) {
            res.status(401).json({ message: 'Invalid Password' });
            return;
        }
        const token = jsonwebtoken_1.default.sign({ id: foundUser.id }, process.env.SECRET_KEY);
        res.status(200).json({ message: "Signed in", token: token });
    }
    catch (e) {
        res.status(500).json({ message: "server erro" });
    }
}));
