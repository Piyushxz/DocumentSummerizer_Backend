import multer from "multer";
import path from "path";
import fs from "fs";

// Define the temp upload directory correctly
const uploadDir = path.resolve(__dirname, "../temp");  // Adjusted to resolve from the root folder

// Ensure the temp folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});

const upload = multer({ storage });

export default upload;
