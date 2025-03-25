const express = require('express');
const cors = require('cors');
require('dotenv').config();

const PORT = process.env.PORT || 7000;
const app = express();

app.use(express.json());
app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
  })
);
app.use('/api', router); //ROUTER

const strat = async () => {
  try {
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
  } catch (error) {
    console.error('Server not started');
  }
};

strat();
