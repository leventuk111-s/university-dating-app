const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: function(email) {
        // Validate university email format (ends with .edu or .ac.uk etc.)
        return /^[^\s@]+@[^\s@]+\.(edu|ac\.uk|edu\.au|ac\.in)$/i.test(email);
      },
      message: 'Please use a valid university email address'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  
  // Profile information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 18,
    max: 30
  },
  gender: {
    type: String,
    required: true,
    enum: ['male', 'female', 'non-binary']
  },
  interestedIn: {
    type: String,
    required: true,
    enum: ['male', 'female', 'both']
  },
  university: {
    type: String,
    required: true
  },
  course: String,
  year: {
    type: Number,
    min: 1,
    max: 7
  },
  bio: {
    type: String,
    maxlength: 500
  },
  photos: [{
    url: String,
    isMain: {
      type: Boolean,
      default: false
    }
  }],
  
  // Location
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
  
  // Preferences
  preferences: {
    ageRange: {
      min: {
        type: Number,
        default: 18
      },
      max: {
        type: Number,
        default: 30
      }
    },
    maxDistance: {
      type: Number,
      default: 50 // km
    }
  },
  
  // Activity
  lastActive: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  
  // Matching
  likedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  dislikedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  matches: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Profile completion
  profileCompleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Create geospatial index for location-based queries
userSchema.index({ location: '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Extract university from email
userSchema.methods.getUniversityFromEmail = function() {
  const domain = this.email.split('@')[1];
  return domain;
};

// Check if profile is complete
userSchema.methods.isProfileComplete = function() {
  return !!(
    this.firstName &&
    this.lastName &&
    this.age &&
    this.gender &&
    this.interestedIn &&
    this.university &&
    this.bio &&
    this.photos.length > 0
  );
};

module.exports = mongoose.model('User', userSchema);
