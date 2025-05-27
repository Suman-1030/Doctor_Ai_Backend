import express from 'express';
import {LoginwithPassword ,LoginOtpGeneration,LoginOtpVerify,ResendLoginOtp} from '../medlineplus-parser/Controllers/AuthController.js'
import { Register,OtpGeneration,OtpVerification,ResendOtp} from '../medlineplus-parser/Controllers/UserController.js';

const router = express.Router();

router.post('/Login-password', LoginwithPassword);
router.post('/Otp-Login',LoginOtpGeneration);
router.post('/Otp-verify',LoginOtpVerify);
router.post('/Login/Resend',ResendLoginOtp)



router.post('/Reg',Register)
router.post('/Otpgen',OtpGeneration)
router.post('/Otpver',OtpVerification)
router.post('/resend',ResendOtp)


export default router;
