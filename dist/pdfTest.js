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
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const pdf_1 = require("@langchain/community/document_loaders/fs/pdf");
const pdfPath = "./Full_Stack_Engineer_Internship_Assignment.pdf"; // Path to the single PDF file
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const loader = new pdf_1.PDFLoader(pdfPath);
            const docs = yield loader.load();
            console.log(docs); // Logs the content of the loaded PDF
        }
        catch (error) {
            console.error("Error loading the PDF:", error);
        }
    });
}
main();
