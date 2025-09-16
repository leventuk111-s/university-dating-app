# University Dating App - UniMatch

A comprehensive dating application designed specifically for university students, featuring location-based matching, real-time chat, and university email verification.

## Features

### 🎓 University-Only Access
- Email verification with university domains (.edu, .ac.uk, .edu.au, .ac.in)
- Only verified university students can access the platform
- Automatic university detection from email domain

### 💕 Smart Matching System
- Gender preference selection (interested in boys/girls/both)
- Age range filtering (18-30)
- Location-based matching with distance calculation
- Same university matching only
- Swipe-based interface (like/dislike)

### 📱 Modern User Interface
- Responsive design for mobile and desktop
- Card-stack swiping interface
- Real-time match notifications
- Beautiful gradient backgrounds and animations

### 🗺️ Google Maps Integration
- Location sharing for distance-based matching
- Privacy-focused location handling
- Distance calculation between users

### 💬 Real-Time Chat
- Socket.IO powered instant messaging
- Match-based chat system (only matched users can chat)
- Online status indicators
- Message timestamps and read receipts

### 👤 Comprehensive Profile System
- Photo upload (up to 6 photos)
- Bio and personal information
- Course/major and year of study
- Profile completion tracking

## Technology Stack

### Backend
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM
- **Socket.IO** for real-time communication
- **JWT** for authentication
- **Multer** for file uploads
- **Bcrypt** for password hashing
- **Nodemailer** for email verification

### Frontend
- **Vanilla JavaScript** (ES6+)
- **CSS3** with modern features (Grid, Flexbox, Animations)
- **Socket.IO Client** for real-time features
- **Google Maps API** for location services

### Security Features
- **Helmet.js** for security headers
- **Rate limiting** to prevent abuse
- **CORS** configuration
- **Input validation** and sanitization
- **University email verification**

## Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- Google Maps API key
- Email service credentials (Gmail recommended)

### 1. Clone and Install Dependencies
```bash
cd C:\Users\HP\CascadeProjects\university-dating-app
npm install
```

### 2. Environment Configuration
Update the `.env` file with your credentials:

```env
MONGODB_URI=mongodb://localhost:27017/university-dating
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
NODE_ENV=development
PORT=3000
```

### 3. Google Maps API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Maps JavaScript API and Places API
4. Create credentials (API Key)
5. Add the API key to your `.env` file
6. Update the Google Maps script tag in `public/index.html`

### 4. Email Service Setup (Gmail)
1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use this app password in the `EMAIL_PASS` environment variable

### 5. Create Required Directories
```bash
mkdir uploads
mkdir uploads/photos
```

### 6. Start the Application
```bash
# Development mode with auto-restart
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/verify-email` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Profile Management
- `PUT /api/profile/update` - Update profile information
- `POST /api/profile/upload-photos` - Upload profile photos
- `PUT /api/profile/set-main-photo` - Set main profile photo
- `DELETE /api/profile/delete-photo` - Delete a photo
- `PUT /api/profile/update-location` - Update user location
- `PUT /api/profile/update-preferences` - Update matching preferences

### Matching System
- `GET /api/match/potential` - Get potential matches
- `POST /api/match/like/:userId` - Like a user
- `POST /api/match/dislike/:userId` - Dislike a user
- `GET /api/match/matches` - Get user's matches
- `DELETE /api/match/unmatch/:userId` - Unmatch with a user

### Chat System
- `GET /api/chat` - Get all user's chats
- `GET /api/chat/with/:userId` - Get or create chat with specific user
- `GET /api/chat/:chatId/messages` - Get messages for a chat
- `POST /api/chat/:chatId/messages` - Send a message
- `PUT /api/chat/:chatId/read` - Mark messages as read
- `DELETE /api/chat/:chatId/messages/:messageId` - Delete a message

## Database Schema

### User Model
- Personal information (name, age, gender, university)
- Authentication (email, password, verification status)
- Profile data (photos, bio, course, year)
- Location (coordinates for distance calculation)
- Preferences (age range, max distance, interested in)
- Matching data (liked users, matches, dislikes)

### Chat Model
- Participants (exactly 2 users)
- Messages array with sender, content, timestamps
- Last message tracking
- Read receipts

## Usage Guide

### For Users

1. **Registration**
   - Use your university email address
   - Verify your email through the link sent
   - Complete your profile with photos and bio

2. **Discovering Matches**
   - Swipe right (❤️) to like someone
   - Swipe left (✖️) to pass
   - Get notified when you have a mutual match

3. **Chatting**
   - Only matched users can chat
   - Real-time messaging with online indicators
   - View match profiles anytime

4. **Profile Management**
   - Update photos, bio, and preferences
   - Share location for better matching
   - Set age and distance preferences

### For Developers

The application follows a modular structure:
- `/models` - Database schemas
- `/routes` - API endpoints
- `/middleware` - Authentication and validation
- `/public` - Frontend assets
- `/uploads` - User uploaded files

## Security Considerations

1. **University Email Verification** - Ensures only students can join
2. **JWT Authentication** - Secure token-based authentication
3. **Rate Limiting** - Prevents spam and abuse
4. **Input Validation** - Prevents injection attacks
5. **File Upload Security** - Validates file types and sizes
6. **Privacy Protection** - Location data is used only for matching

## Deployment

### Production Checklist
1. Set strong JWT secret
2. Configure production MongoDB instance
3. Set up proper email service
4. Configure Google Maps API with domain restrictions
5. Set up HTTPS with SSL certificates
6. Configure environment variables
7. Set up file storage (consider cloud storage for production)

### Recommended Hosting
- **Backend**: Heroku, DigitalOcean, AWS EC2
- **Database**: MongoDB Atlas
- **File Storage**: AWS S3, Cloudinary
- **Domain**: Custom domain with SSL

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for educational or commercial purposes.

## Support

For issues or questions:
1. Check the troubleshooting section below
2. Review the API documentation
3. Check browser console for errors
4. Ensure all environment variables are set correctly

## Troubleshooting

### Common Issues

1. **Email verification not working**
   - Check email service credentials
   - Verify Gmail app password is correct
   - Check spam folder

2. **Google Maps not loading**
   - Verify API key is correct
   - Check if Maps JavaScript API is enabled
   - Ensure domain is whitelisted (for production)

3. **Photos not uploading**
   - Check if uploads/photos directory exists
   - Verify file size limits
   - Check file type restrictions

4. **Real-time chat not working**
   - Ensure Socket.IO is properly connected
   - Check browser console for connection errors
   - Verify server is running

5. **Location not updating**
   - Check if user granted location permissions
   - Verify HTTPS is used (required for geolocation)
   - Check browser compatibility

---

**UniMatch** - Connecting university hearts, one swipe at a time! 💕🎓
