import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose'
import dotenv from 'dotenv';
import TextRoute from './Routes/TextRoute.js'
import AuthRoute from './Routes/AuthRoute.js'

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// app.use(cors());
app.use(cors({
  origin: 'https://doctor-ai-frontend-av7r.vercel.app',
  credentials: true,
}));

app.use(express.json());

// Routes
app.use('/text',TextRoute );
app.use('/otp',AuthRoute);

mongoose.connect(process.env.Mongo_str)
.then(()=>{
  console.log('mongodb connected connected ')
})
.catch((error)=>{
  console.log("mongodb connection failed")
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
