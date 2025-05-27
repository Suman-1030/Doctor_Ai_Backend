import mongoose from 'mongoose'

const UserSchema=new mongoose.Schema({

userName:{
    type:String,
    required:true
},
email:{
    type:String
    
},
password:{
    type:String
},
otp:{
    type:String
},
otpExpiresAt: {
    type: Date
  }

})

const user=mongoose.model('user',UserSchema)
export default user