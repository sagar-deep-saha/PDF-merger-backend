const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Ensure the file is a PDF
    if (!file.originalname.toLowerCase().endsWith('.pdf')) {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Create uploads directory if it doesn't exist
fs.ensureDirSync('uploads');

app.post('/api/merge-pdfs', upload.array('pdfs'), async (req, res) => {
  try {
    console.log('Received merge request');
    
    if (!req.files || req.files.length === 0) {
      console.log('No files received');
      return res.status(400).json({ error: 'No PDF files uploaded' });
    }

    console.log(`Processing ${req.files.length} files`);
    const mergedPdf = await PDFDocument.create();
    
    for (const file of req.files) {
      console.log(`Processing file: ${file.originalname}`);
      try {
        const pdfBytes = await fs.readFile(file.path);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
        console.log(`Successfully processed ${file.originalname}`);
      } catch (err) {
        console.error(`Error processing file ${file.originalname}:`, err);
        throw new Error(`Error processing file ${file.originalname}: ${err.message}`);
      }
    }

    console.log('Saving merged PDF');
    const mergedPdfBytes = await mergedPdf.save();
    const outputPath = path.join('uploads', 'merged.pdf');
    await fs.writeFile(outputPath, mergedPdfBytes);

    // Clean up uploaded files
    console.log('Cleaning up uploaded files');
    for (const file of req.files) {
      await fs.remove(file.path);
    }

    console.log('Sending merged PDF to client');
    res.download(outputPath, 'merged.pdf', async (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
      // Clean up merged file after download
      try {
        await fs.remove(outputPath);
        console.log('Cleaned up merged file');
      } catch (err) {
        console.error('Error cleaning up merged file:', err);
      }
    });
  } catch (error) {
    console.error('Error in merge-pdfs endpoint:', error);
    // Clean up any remaining files
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.remove(file.path);
        } catch (err) {
          console.error('Error cleaning up file:', err);
        }
      }
    }
    res.status(500).json({ error: error.message || 'Error merging PDF files' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 