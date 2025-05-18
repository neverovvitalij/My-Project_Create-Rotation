const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
require('dotenv').config();
const router = require('./routes/router');
const errorMiddleware = require('./middlewares/error-middleware');

const PORT = process.env.PORT || 7000;
const app = express();

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
  })
);
app.use('/api', router);
app.use(errorMiddleware);

const strat = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
  } catch (error) {
    console.log('Not connected to MongoDB', error);
  }
};

strat();
