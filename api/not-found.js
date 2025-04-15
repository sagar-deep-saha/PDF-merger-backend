// Handler for routes that don't match any of our API endpoints
module.exports = (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
}; 