"use strict";
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
exports.v1Router = void 0;
const express_1 = require("express");
const zod_1 = __importDefault(require("zod"));
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
exports.v1Router = (0, express_1.Router)();
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client = new client_1.PrismaClient();
dotenv_1.default.config();
exports.v1Router.get('/', (req, res) => {
    res.json("Hey");
});
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
        yield client.user.create({
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
        foundUser = yield client.user.findFirst({
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
