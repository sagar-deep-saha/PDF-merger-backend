// Simple serverless function to test Vercel deployment
module.exports = (req, res) => {
  res.status(200).json({
    message: 'PDF Merger API is working!',
    environment: process.env.VERCEL ? 'vercel' : 'local',
    timestamp: new Date().toISOString()
  });
}; 