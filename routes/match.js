const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get potential matches
router.get('/potential', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!currentUser.isProfileComplete()) {
      return res.status(400).json({ message: 'Please complete your profile first' });
    }

    // Build match criteria
    const matchCriteria = {
      _id: { 
        $ne: currentUser._id,
        $nin: [...currentUser.likedUsers, ...currentUser.dislikedUsers]
      },
      university: currentUser.university, // Same university only
      isEmailVerified: true,
      profileCompleted: true,
      age: {
        $gte: currentUser.preferences.ageRange.min,
        $lte: currentUser.preferences.ageRange.max
      }
    };

    // Filter by gender preference
    if (currentUser.interestedIn !== 'both') {
      matchCriteria.gender = currentUser.interestedIn;
    }

    // Filter by mutual interest
    matchCriteria.$or = [
      { interestedIn: currentUser.gender },
      { interestedIn: 'both' }
    ];

    // Location-based filtering if user has location
    if (currentUser.location.coordinates[0] !== 0 && currentUser.location.coordinates[1] !== 0) {
      matchCriteria.location = {
        $near: {
          $geometry: currentUser.location,
          $maxDistance: currentUser.preferences.maxDistance * 1000 // Convert km to meters
        }
      };
    }

    const potentialMatches = await User.find(matchCriteria)
      .select('firstName lastName age bio photos university course year location lastActive')
      .limit(10)
      .sort({ lastActive: -1 });

    // Calculate distance for each match
    const matchesWithDistance = potentialMatches.map(match => {
      let distance = null;
      if (currentUser.location.coordinates[0] !== 0 && 
          currentUser.location.coordinates[1] !== 0 &&
          match.location.coordinates[0] !== 0 && 
          match.location.coordinates[1] !== 0) {
        distance = calculateDistance(
          currentUser.location.coordinates[1], currentUser.location.coordinates[0],
          match.location.coordinates[1], match.location.coordinates[0]
        );
      }

      return {
        ...match.toObject(),
        distance: distance ? Math.round(distance) : null
      };
    });

    res.json({ matches: matchesWithDistance });
  } catch (error) {
    console.error('Get potential matches error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Like a user
router.post('/like/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.userId);
    const targetUser = await User.findById(userId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already liked
    if (currentUser.likedUsers.includes(userId)) {
      return res.status(400).json({ message: 'User already liked' });
    }

    // Add to liked users
    currentUser.likedUsers.push(userId);

    // Check if it's a mutual like (match)
    let isMatch = false;
    if (targetUser.likedUsers.includes(req.userId)) {
      isMatch = true;
      
      // Add to matches for both users
      currentUser.matches.push(userId);
      targetUser.matches.push(req.userId);
      
      await targetUser.save();
    }

    await currentUser.save();

    res.json({
      message: isMatch ? 'It\'s a match!' : 'User liked successfully',
      isMatch,
      matchedUser: isMatch ? {
        _id: targetUser._id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        photos: targetUser.photos,
        isOnline: targetUser.isOnline,
        lastActive: targetUser.lastActive
      } : null
    });
  } catch (error) {
    console.error('Like user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dislike a user
router.post('/dislike/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.userId);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if already disliked
    if (currentUser.dislikedUsers.includes(userId)) {
      return res.status(400).json({ message: 'User already disliked' });
    }

    // Add to disliked users
    currentUser.dislikedUsers.push(userId);
    await currentUser.save();

    res.json({ message: 'User disliked successfully' });
  } catch (error) {
    console.error('Dislike user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get matches
router.get('/matches', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId)
      .populate('matches', 'firstName lastName photos bio university course lastActive isOnline');

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ matches: currentUser.matches });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Unmatch a user
router.delete('/unmatch/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.userId);
    const targetUser = await User.findById(userId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove from matches for both users
    currentUser.matches = currentUser.matches.filter(id => id.toString() !== userId);
    targetUser.matches = targetUser.matches.filter(id => id.toString() !== req.userId);

    // Remove from liked users for both users
    currentUser.likedUsers = currentUser.likedUsers.filter(id => id.toString() !== userId);
    targetUser.likedUsers = targetUser.likedUsers.filter(id => id.toString() !== req.userId);

    await currentUser.save();
    await targetUser.save();

    res.json({ message: 'Successfully unmatched' });
  } catch (error) {
    console.error('Unmatch error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c; // Distance in kilometers
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

module.exports = router;
