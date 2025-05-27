import Usermodel from '../../Models/Usermodel.js'
import userOtp from '../../Models/UserOtp.js'
import nodemailer from 'nodemailer'
import bcrypt from 'bcrypt'
import crypto from 'crypto'



const Register=async (req,res)=>{

      const {userName,email,password}=req.body

      try{
        const hashedPassword= await bcrypt.hash(password,10)
      
      const userExistEmail=await Usermodel.findOne({email})

      if(userExistEmail){
        return res.status(400).json({"msg":"User Registered already"})
      }
      if (password){
        const newUser= new Usermodel({
            userName,
            email,
            password:hashedPassword,
          
          })
          await newUser.save()
          res.status(200).json({'msg':"SignUp Successfull"})
      }
    }
    catch(error){
        console.log(error)
        res.status(500).json({"msg":"internal error"})
    }

}

const OtpGeneration= async (req,res)=>{

     const {userName,email}=req.body
     try{

      const userExist=await Usermodel.findOne({email})
      if(userExist){
        return res.status(409).json({"msg": "user already Registered"})
      }

      const Otp = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

      const newUserotp= new userOtp({
       userName,
       email,
       otp:Otp,
       expiresAt
     })
     await newUserotp.save()

     const transporter = nodemailer.createTransport({
       service: 'gmail',
       auth: {
         user: process.env.my_email,
         pass: process.env.my_password
       }
     });

     const mailOptions = {
       from: process.env.my_email,
       to: email,
       subject: 'Your OTP Code',
       text: `Your OTP is: ${Otp}. It will expire in 5 minutes.`
     };

     await transporter.sendMail(mailOptions);
     res.status(200).json({"msg":"opt sent to your email"})

 }
     catch(error){
           console.log(error)
           res.status(500).json({"msg":"internal error"})
     }

}

const OtpVerification=async (req,res)=>{

      const {userName,email,Otp}=req.body
     try{
      const otpcheck= await userOtp.findOne({email})
      const verified=otpcheck.otp=== Otp
      if (verified){
        const newUser= new Usermodel({
          userName,
          email
        })
        await newUser.save()
        res.status(200).json({'msg':" User Verified and SignUp Successfull"})
    
        

      }
      else{
        res.status(400).json({'msg':'otp not matched',Otp})
      }
     }
     catch(error){
      console.log(error)
     }

}
const ResendOtp= async (req,res)=>{
   const {userName,email}=req.body

   try{
      const userotp= await userOtp.findOneAndDelete({email})
      console.log("Userotp record",userotp)
      const Otp = crypto.randomInt(100000, 999999).toString();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

      const newUserotp= new userOtp({
       userName,
       email,
       otp:Otp,
       expiresAt
     })
     await newUserotp.save()

     const transporter = nodemailer.createTransport({
       service: 'gmail',
       auth: {
         user: process.env.my_email,
         pass: process.env.my_password
       }
     });

     const mailOptions = {
       from: process.env.my_email,
       to: email,
       subject: 'Your OTP Code',
       text: `Your OTP is: ${Otp}. It will expire in 5 minutes.`
     };

     await transporter.sendMail(mailOptions);
     res.status(200).json({"msg":"opt Resend to your email"})


   }
   catch(error){
    console.log(error)
   }

}

export {OtpGeneration,Register,OtpVerification,ResendOtp}