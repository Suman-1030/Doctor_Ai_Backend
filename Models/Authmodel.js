import mongoose from 'mongoose'

const otpSchema = new mongoose.Schema({
  // Identifier (email or phone)
  email: { 
    type: String,
    required: true,
    lowercase: true,
    validate: {
      validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: 'Invalid email format'
    }
  },

  // OTP Fields
  otp: { 
    type: String, 
    required: true 
  },
  expiresAt: { 
    type: Date, 
    required: true,
    index: { expires: '5m' } // Auto-delete after 5 minutes
  },
  attempts: { 
    type: Number, 
    default: 0,
    max: 5 // Max allowed attempts
  },
  verified: { 
    type: Boolean, 
    default: false 
  },

  // Metadata
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Prevent duplicate active OTPs
otpSchema.index({ email: 1, phone: 1 }, { 
  unique: true, 
  partialFilterExpression: { 
    expiresAt: { $gt: new Date() } // Only enforce for non-expired OTPs
  }
});

const LoginOtp = mongoose.model('Otp', otpSchema);
export default LoginOtp;