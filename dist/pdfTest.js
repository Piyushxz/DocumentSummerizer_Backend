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
const textsplitters_1 = require("@langchain/textsplitters");
// Path to the PDF file (could be user-uploaded)
const pdfPath = "./Full_Stack_Engineer_Internship_Assignment.pdf";
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Step 1: Load the PDF
            const loader = new pdf_1.PDFLoader(pdfPath);
            const docs = yield loader.load();
            console.log("Loaded Docs:", docs);
            // Step 2: Split the loaded document into chunks
            const textSplitter = new textsplitters_1.RecursiveCharacterTextSplitter({
                chunkSize: 1000, // Customize chunk size as needed
                chunkOverlap: 200, // Customize chunk overlap as needed
            });
            const splitDocs = yield textSplitter.splitDocuments(docs);
            console.log("Split Docs:", splitDocs);
        }
        catch (error) {
            console.error("Error processing the PDF:", error);
        }
    });
}
main();
