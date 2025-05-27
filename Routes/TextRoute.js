import express from 'express';
import Text, { Uploadmiddleware } from '../medlineplus-parser/Controllers/Text.js';

const router = express.Router();

router.post('/text-Response', Uploadmiddleware, Text);

export default router;
