// import axios from "axios";
// import { PDFDocument } from "pdf-lib";
// import {Document } from "langchain/document"
// import { PDFLoader } from "langchain/document_loaders/fs/pdf";
// import { writeFile, unlink } from "fs/promises";

// async function deletePages(pdf:Buffer,pagesToDelete:number[]) :Promise<Buffer>{
//     const pdfDoc = await PDFDocument.load(pdf)
//     let offset = 1;
//     for(const pageNum of pagesToDelete){
//         pdfDoc.removePage(pageNum - offset)
//         offset++;
//     }

//     const pdfBytes = await pdfDoc.save()
//     return Buffer.from(pdfBytes)
// }

// async function loadPdfFromUrl(url:string):Promise<Buffer> {
//     const response = await axios.get(url,{
//         responseType:"arraybuffer"
//     })
//     return response.data
// }


// import e from "express";

// async function convertPdfToDocuments(pdf: Buffer): Promise<Array<Document>> {
//   const randomName = Math.random().toString(36).substring(7);
//   const filePath = `pdfs/${randomName}.pdf`;

//   try {
//     // Save the PDF to a temporary file
//     await writeFile(filePath, pdf, "binary");

//     // Load the PDF as documents
//     const loader = new PDFLoader(filePath);
//     const documents = await loader.load();

//     return documents;
//   } catch (error) {
//     throw new Error(`Error converting PDF to documents`);
//   } finally {
//     // Cleanup the temporary file
//     await unlink(filePath).catch(() => {
//       console.warn(`Failed to delete temporary file: ${filePath}`);
//     });
//   }
// }




// async function  main({paperUrl,name,pagesToDelete}:{
//     paperUrl:string,
//     name:string,
//     pagesToDelete ? : number[]
// }) {
//     if(!paperUrl.endsWith('pdf')){
//         return;
//     }


//     const pdfAsBuffer = await loadPdfFromUrl(paperUrl)

//     if(pagesToDelete && pagesToDelete.length > 0){
//         await deletePages(pdfAsBuffer,pagesToDelete)
//     }
// }