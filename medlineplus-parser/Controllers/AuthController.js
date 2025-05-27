import dotenv from 'dotenv'
import Authmodel from '../../Models/Authmodel.js'
import User from '../../Models/Usermodel.js'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import nodemailer from 'nodemailer'


const LoginwithPassword=async (req,res)=>{

      const {email,password}=req.body

    try{
       
      const user = await User.findOne({email})
      if(!user){
        return res.status(404).json({"msg":"user not Registered"})
      }
      const Authuser=  bcrypt.compare(user.password,password)

       if(!Authuser){
          return res.status(400).json({"msg":"incurrect password"})
      }
      res.status(200).json({"msg":"user login successful",user})
       

    }
    catch(error){
         console.log(error)
         res.status(500).json({"msg":"internal error"})
    }


  }

const LoginOtpGeneration=async (req,res)=>{

      const {userName,email}=req.body

      try{
        const user = await User.findOne({email})
        if(!user){
          return res.status(404).json({"msg":"user not Registered"})
        }
        const Otp=crypto.randomInt(100000,999999).toString()
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
        const verified=false
        
        const LoginOtp= new Authmodel({
          email,
          otp:Otp,
          expiresAt,
          verified
        })
        await LoginOtp.save()
        
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
        res.status(200).json({"msg":"opt send to your email",user})
      }
      catch(error){
            console.log(error)
            res.status(500).json({"msg":"internal problem"})
      }
}

const LoginOtpVerify=async(req,res)=>{
      const {email,otp}=req.body

    try{
        const verifyOtp=await Authmodel.findOne({email})
        if(!verifyOtp){
           return res.status(404).json({"msg":"user not found"})
        }
        const Otpcheck = otp===verifyOtp.otp
        if(!Otpcheck){
           return res.status(400).json({"msg":"invalid otp"})
        }
        verifyOtp.verified=true
        res.status(200).json({"msg":"Otp verified and login successful",verifyOtp})
    }
    catch(error){
      console.log(error)
    }

}

const ResendLoginOtp=async (req,res)=>{
  const {email}=req.body
  try{
    const existOtp=await Authmodel.findOne({email})
    if(!existOtp){
      const Otp=crypto.randomInt(100000,999999).toString()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
      const verified=false
      
      const LoginOtp= new Authmodel({
        email,
        otp:Otp,
        expiresAt,
        verified
      })
      await LoginOtp.save()
      
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
    const deleteRecord=await Authmodel.findByIdAndDelete(existOtp._id)
    const Otp=crypto.randomInt(100000,999999).toString()
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
      const verified=false
      
      const LoginOtp= new Authmodel({
        email,
        otp:Otp,
        expiresAt,
        verified
      })
      await LoginOtp.save()
      
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
    res.status(500).json({"msg":"internal error"})
  }

}


export {LoginwithPassword,LoginOtpGeneration,LoginOtpVerify,ResendLoginOtp}