const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Use temp directory for Vercel
const getTempDirectory = () => process.env.VERCEL ? '/tmp' : os.tmpdir();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(getTempDirectory(), 'uploads');
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Create an API handler
const apiRoute = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Create a temporary Express app for multer middleware
  const app = express();
  
  // Handle file upload using multer
  const uploadMiddleware = upload.array('pdfs');
  
  try {
    // Custom implementation to handle file uploads in serverless environment
    await new Promise((resolve, reject) => {
      uploadMiddleware(req, res, (err) => {
        if (err) {
          console.error('Upload error:', err);
          return reject(err);
        }
        resolve();
      });
    });

    console.log('Files uploaded:', req.files?.length || 0);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No PDF files uploaded' });
    }

    if (req.files.length < 2) {
      return res.status(400).json({ error: 'Please upload at least 2 PDF files' });
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
    
    // Clean up uploaded files
    for (const file of req.files) {
      try {
        await fs.remove(file.path);
        console.log(`Removed file: ${file.path}`);
      } catch (err) {
        console.error(`Error removing file ${file.path}:`, err);
      }
    }

    // Set content headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=merged.pdf');
    
    // Send the merged PDF directly
    return res.send(Buffer.from(mergedPdfBytes));
    
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
    
    return res.status(500).json({ 
      error: error.message || 'Error merging PDF files',
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
};

// Export the API handler
module.exports = apiRoute; 