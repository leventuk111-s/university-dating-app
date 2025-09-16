const express = require('express');
const multer = require('multer');
const path = require('path');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/photos/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Update profile
router.put('/update', auth, [
  body('firstName').optional().trim().isLength({ min: 1 }),
  body('lastName').optional().trim().isLength({ min: 1 }),
  body('age').optional().isInt({ min: 18, max: 30 }),
  body('course').optional().trim(),
  body('year').optional().isInt({ min: 1, max: 7 }),
  body('bio').optional().isLength({ max: 500 }),
  body('interestedIn').optional().isIn(['male', 'female', 'both'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updates = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update allowed fields
    const allowedUpdates = ['firstName', 'lastName', 'age', 'course', 'year', 'bio', 'interestedIn'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        user[field] = updates[field];
      }
    });

    // Update profile completion status
    user.profileCompleted = user.isProfileComplete();

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        age: user.age,
        gender: user.gender,
        interestedIn: user.interestedIn,
        university: user.university,
        course: user.course,
        year: user.year,
        bio: user.bio,
        photos: user.photos,
        profileCompleted: user.isProfileComplete()
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload photos
router.post('/upload-photos', auth, upload.array('photos', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No photos uploaded' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add new photos
    const newPhotos = req.files.map((file, index) => ({
      url: `/uploads/photos/${file.filename}`,
      isMain: user.photos.length === 0 && index === 0 // First photo is main if no photos exist
    }));

    user.photos.push(...newPhotos);

    // Limit to 6 photos max
    if (user.photos.length > 6) {
      user.photos = user.photos.slice(-6);
    }

    user.profileCompleted = user.isProfileComplete();
    await user.save();

    res.json({
      message: 'Photos uploaded successfully',
      photos: user.photos
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ message: 'Server error during photo upload' });
  }
});

// Set main photo
router.put('/set-main-photo', auth, [
  body('photoUrl').notEmpty()
], async (req, res) => {
  try {
    const { photoUrl } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Reset all photos to not main
    user.photos.forEach(photo => {
      photo.isMain = false;
    });

    // Set the selected photo as main
    const selectedPhoto = user.photos.find(photo => photo.url === photoUrl);
    if (!selectedPhoto) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    selectedPhoto.isMain = true;
    await user.save();

    res.json({
      message: 'Main photo updated successfully',
      photos: user.photos
    });
  } catch (error) {
    console.error('Set main photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete photo
router.delete('/delete-photo', auth, [
  body('photoUrl').notEmpty()
], async (req, res) => {
  try {
    const { photoUrl } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const photoIndex = user.photos.findIndex(photo => photo.url === photoUrl);
    if (photoIndex === -1) {
      return res.status(404).json({ message: 'Photo not found' });
    }

    const wasMain = user.photos[photoIndex].isMain;
    user.photos.splice(photoIndex, 1);

    // If deleted photo was main, set first remaining photo as main
    if (wasMain && user.photos.length > 0) {
      user.photos[0].isMain = true;
    }

    user.profileCompleted = user.isProfileComplete();
    await user.save();

    res.json({
      message: 'Photo deleted successfully',
      photos: user.photos
    });
  } catch (error) {
    console.error('Delete photo error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update location
router.put('/update-location', auth, [
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { latitude, longitude } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.location = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };

    await user.save();

    res.json({
      message: 'Location updated successfully',
      location: user.location
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update preferences
router.put('/update-preferences', auth, [
  body('ageRange.min').optional().isInt({ min: 18, max: 30 }),
  body('ageRange.max').optional().isInt({ min: 18, max: 30 }),
  body('maxDistance').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ageRange, maxDistance } = req.body;
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (ageRange) {
      if (ageRange.min > ageRange.max) {
        return res.status(400).json({ message: 'Minimum age cannot be greater than maximum age' });
      }
      user.preferences.ageRange = ageRange;
    }

    if (maxDistance) {
      user.preferences.maxDistance = maxDistance;
    }

    await user.save();

    res.json({
      message: 'Preferences updated successfully',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
