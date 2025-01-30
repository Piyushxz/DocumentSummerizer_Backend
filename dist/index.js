"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const v1_1 = require("./v1");
const dotenv_1 = __importDefault(require("dotenv"));
const pdfTest_1 = require("./pdfTest");
const app = (0, express_1.default)();
app.use(express_1.default.json());
dotenv_1.default.config();
app.use('/api/v1', v1_1.v1Router);
(0, pdfTest_1.main)();
app.listen(3003, () => {
    console.log('server running');
});
