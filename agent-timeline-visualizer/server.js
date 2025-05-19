const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'build')));

// API endpoint to read file
app.get('/api/read-file', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Basic security check - prevent directory traversal
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(process.cwd())) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const content = await fs.readFile(filePath, 'utf8');
    res.send(content);
  } catch (error) {
    console.error('Error reading file:', error);
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Handle React routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 