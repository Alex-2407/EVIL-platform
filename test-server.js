const express = require('express');
const path = require('path');

const app = express();

// Serve static files FIRST
app.use(express.static(path.join(__dirname, 'css')));
app.use(express.static(path.join(__dirname, 'js')));

// Test route
app.get('/', (req, res) => {
  res.send('Server is working!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});