import mongoose from "mongoose";

const UserOtpSchema= new mongoose.Schema({
    email:{
        type:String,
        required:true
    },
    otp:{
        type:String,
        required:true
    },
    expiresAt: { 
        type: Date, 
        required: true,
        index: { expires: '5m' } // Auto-delete after 5 minutes
      }
})

const userOtp=mongoose.model('userOtp',UserOtpSchema)
export default userOtp