const express = require('express');
require('dotenv').config();

const PORT = process.env.PORT || 7000;
const app = express();

app.use(express.json());

const strat = async () => {
  try {
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
  } catch (error) {
    console.error('Server not started');
  }
};

strat();
