import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            service: 'railway-reservation-system',
            status: 'healthy',
        }
    });
});

app.listen(port, () => {
    console.log(`Railway Reservation API running on PORT : ${port}`);
});