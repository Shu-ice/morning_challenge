// 🚑 Health check endpoint for Vercel
module.exports = async function handler(req, res) {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
}; 