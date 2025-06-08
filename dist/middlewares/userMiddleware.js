"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = userMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function userMiddleware(req, res, next) {
    const token = req.headers.authorization;
    const decoded = jsonwebtoken_1.default.verify(token, process.env.SECRET_KEY);
    if (!decoded.id) {
        res.status(404).json({ message: "Invalid Token" });
        return;
    }
    req.userId = decoded.id;
    next();
}
