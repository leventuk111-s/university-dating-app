const express = require('express');
const { body, validationResult } = require('express-validator');
const Chat = require('../models/Chat');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all chats for current user
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.userId,
      isActive: true
    })
    .populate('participants', 'firstName lastName photos isOnline lastActive')
    .populate('lastMessage.sender', 'firstName lastName')
    .sort({ 'lastMessage.timestamp': -1 });

    // Format chats with other participant info
    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p._id.toString() !== req.userId);
      return {
        _id: chat._id,
        otherUser: otherParticipant,
        lastMessage: chat.lastMessage,
        updatedAt: chat.updatedAt
      };
    });

    res.json({ chats: formattedChats });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get or create chat between two users
router.get('/with/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUser = await User.findById(req.userId);
    const otherUser = await User.findById(userId);

    if (!currentUser || !otherUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if users are matched
    if (!currentUser.matches.includes(userId)) {
      return res.status(403).json({ message: 'You can only chat with matched users' });
    }

    // Find existing chat
    let chat = await Chat.findOne({
      participants: { $all: [req.userId, userId] }
    }).populate('participants', 'firstName lastName photos isOnline lastActive');

    // Create new chat if doesn't exist
    if (!chat) {
      chat = new Chat({
        participants: [req.userId, userId]
      });
      await chat.save();
      await chat.populate('participants', 'firstName lastName photos isOnline lastActive');
    }

    res.json({ chat });
  } catch (error) {
    console.error('Get/create chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages for a specific chat
router.get('/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get paginated messages
    const skip = (page - 1) * limit;
    const messages = chat.messages
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(skip, skip + parseInt(limit))
      .reverse();

    // Populate sender info
    await Chat.populate(messages, {
      path: 'sender',
      select: 'firstName lastName photos'
    });

    res.json({ 
      messages,
      hasMore: chat.messages.length > skip + parseInt(limit)
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/:chatId/messages', auth, [
  body('content').trim().isLength({ min: 1, max: 1000 }),
  body('messageType').optional().isIn(['text', 'image', 'location'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { chatId } = req.params;
    const { content, messageType = 'text' } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Create message
    const message = {
      sender: req.userId,
      content,
      messageType,
      readBy: [{
        user: req.userId,
        readAt: new Date()
      }]
    };

    chat.messages.push(message);
    
    // Update last message
    chat.lastMessage = {
      content,
      sender: req.userId,
      timestamp: new Date()
    };

    await chat.save();

    // Get the created message with sender info
    const createdMessage = chat.messages[chat.messages.length - 1];
    await Chat.populate(createdMessage, {
      path: 'sender',
      select: 'firstName lastName photos'
    });

    // Emit to other participants via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(chatId).emit('receive-message', {
        chatId,
        message: createdMessage
      });
    }

    res.status(201).json({ message: createdMessage });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.put('/:chatId/read', auth, async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark unread messages as read
    chat.messages.forEach(message => {
      const hasRead = message.readBy.some(read => read.user.toString() === req.userId);
      if (!hasRead) {
        message.readBy.push({
          user: req.userId,
          readAt: new Date()
        });
      }
    });

    await chat.save();

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a message
router.delete('/:chatId/messages/:messageId', auth, async (req, res) => {
  try {
    const { chatId, messageId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    // Check if user is participant
    if (!chat.participants.includes(req.userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const message = chat.messages.id(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.userId) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    // Remove message
    chat.messages.pull(messageId);

    // Update last message if this was the last message
    if (chat.messages.length > 0) {
      const lastMessage = chat.messages[chat.messages.length - 1];
      chat.lastMessage = {
        content: lastMessage.content,
        sender: lastMessage.sender,
        timestamp: lastMessage.createdAt
      };
    } else {
      chat.lastMessage = null;
    }

    await chat.save();

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
