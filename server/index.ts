import express from 'express';
import crypto from 'crypto';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());
const port = 5000;

app.post('/create-session', function(req, res)  {
  const sessionId = crypto.randomBytes(16).toString('hex');
  
  res.json({ url: `/canvas/${sessionId}` });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
