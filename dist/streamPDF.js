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
const fs_1 = __importDefault(require("fs"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
function extractTextFromPdf(pdfPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const dataBuffer = fs_1.default.readFileSync(pdfPath); // Read PDF file into a buffer
        try {
            const data = yield (0, pdf_parse_1.default)(dataBuffer); // Parse PDF buffer
            return data.text; // Extracted text from the PDF
        }
        catch (error) {
            console.error("Error extracting text from PDF:", error);
            return "";
        }
    });
}
// Example usage
const pdfPath = "./path/to/your.pdf";
extractTextFromPdf(pdfPath)
    .then((text) => {
    console.log("Extracted Text:", text);
})
    .catch((error) => {
    console.error("Error:", error);
});
