import app from './app';
import dotenv from 'dotenv';

dotenv.config();
import { startWorkers } from './workers';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startWorkers();
});