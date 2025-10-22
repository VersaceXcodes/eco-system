import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  userSchema,
  createUserInputSchema,
  updateUserInputSchema,
  searchUserInputSchema
} from './schema.js';

dotenv.config();

// ESM workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment variables
const {
  DATABASE_URL,
  PGHOST,
  PGDATABASE,
  PGUSER,
  PGPASSWORD,
  PGPORT = 5432,
  JWT_SECRET = 'ecopulse-secret-key',
  PORT = 3000
} = process.env;

// Database connection
const pool = new Pool(
  DATABASE_URL
    ? { 
        connectionString: DATABASE_URL, 
        ssl: { require: true } 
      }
    : {
        host: PGHOST,
        database: PGDATABASE,
        user: PGUSER,
        password: PGPASSWORD,
        port: Number(PGPORT),
        ssl: { require: true },
      }
);

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('combined'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Error response utility
function createErrorResponse(message, error = null, errorCode = null) {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errorCode) {
    response.error_code = errorCode;
  }

  if (error && process.env.NODE_ENV === 'development') {
    response.details = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return response;
}

/*
  JWT Authentication middleware for protected routes
  Validates JWT token and attaches user data to request object
*/
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json(createErrorResponse('Access token required', null, 'AUTH_TOKEN_MISSING'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await pool.query(
      'SELECT id, email, full_name, created_at, updated_at FROM users WHERE id = $1',
      [decoded.user_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json(createErrorResponse('Invalid token - user not found', null, 'AUTH_USER_NOT_FOUND'));
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    return res.status(403).json(createErrorResponse('Invalid or expired token', error, 'AUTH_TOKEN_INVALID'));
  }
};

/*
  @@need:external-api: Email service API (SendGrid, Mailgun, etc.) for sending verification emails
  Mock function for sending email verification token
*/
async function sendVerificationEmail(email, token) {
  // Mock implementation - in production, this would use external email service
  console.log(`[MOCK] Verification email sent to ${email} with token: ${token}`);
  return {
    success: true,
    message_id: `mock_${Date.now()}`,
    verification_url: `http://localhost:3000/api/auth/verify-email?token=${token}`
  };
}

/*
  @@need:external-api: Email service API for sending password reset emails
  Mock function for sending password reset instructions
*/
async function sendPasswordResetEmail(email, token) {
  // Mock implementation - in production, this would use external email service
  console.log(`[MOCK] Password reset email sent to ${email} with token: ${token}`);
  return {
    success: true,
    message_id: `mock_reset_${Date.now()}`,
    reset_url: `http://localhost:3000/reset-password?token=${token}`
  };
}

/*
  Helper function to generate user profile data with default values
  Simulates user profile features like expertise level and location
*/
function generateUserProfileData(userData) {
  return {
    ...userData,
    expertise_level: 'beginner', // Default expertise level
    primary_location: null, // No default location
    interests: [], // Empty interests array
    credibility_score: 0, // Starting credibility score
    data_privacy_settings: {
      share_anonymized: true,
      private_observations_visible: false
    }
  };
}

// AUTHENTICATION ENDPOINTS

/*
  User registration endpoint with email verification
  Creates new user account and sends verification email
*/
app.post('/api/auth/signup', async (req, res) => {
  try {
    // Validate request body using Zod schema
    const validatedData = createUserInputSchema.parse({
      email: req.body.email,
      password_hash: req.body.password, // Store plain text for development
      full_name: req.body.full_name
    });

    const { email, password_hash, full_name } = validatedData;

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json(createErrorResponse('User with this email already exists', null, 'USER_ALREADY_EXISTS'));
    }

    // Generate user ID and verification token
    const userId = uuidv4();
    const verificationToken = uuidv4();

    // Create user (no password hashing - plain text for development)
    const result = await pool.query(
      'INSERT INTO users (id, email, password_hash, full_name, created_at, updated_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, email, full_name, created_at',
      [userId, email.toLowerCase().trim(), password_hash, full_name.trim()]
    );

    const user = result.rows[0];

    // Send verification email (mocked)
    await sendVerificationEmail(email, verificationToken);

    res.status(201).json({
      success: true,
      message: 'User created successfully. Please check your email for verification.',
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid input data', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  User authentication endpoint
  Validates credentials and returns JWT token with user data
*/
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(createErrorResponse('Email and password are required', null, 'MISSING_CREDENTIALS'));
    }

    // Find user with direct password comparison (no hashing for development)
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    
    if (result.rows.length === 0) {
      return res.status(401).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
    }

    const user = result.rows[0];

    // Direct password comparison for development
    if (password !== user.password_hash) {
      return res.status(401).json(createErrorResponse('Invalid email or password', null, 'INVALID_CREDENTIALS'));
    }

    // Generate JWT token
    const token = jwt.sign(
      { user_id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Generate profile data (mocked since we don't have profile tables)
    const profileData = generateUserProfileData(user);

    res.json({
      success: true,
      message: 'Login successful',
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        expertise_level: profileData.expertise_level,
        credibility_score: profileData.credibility_score
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Email verification endpoint
  Processes verification token sent via email
*/
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json(createErrorResponse('Verification token is required', null, 'MISSING_TOKEN'));
    }

    // Mock verification logic - in production, this would validate against stored tokens
    // For now, we'll accept any valid UUID format as a token
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(token)) {
      return res.status(400).json(createErrorResponse('Invalid verification token format', null, 'INVALID_TOKEN_FORMAT'));
    }

    // Mock successful verification
    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Password reset request endpoint
  Initiates password reset process by sending reset email
*/
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(createErrorResponse('Email is required', null, 'MISSING_EMAIL'));
    }

    // Check if user exists
    const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [email.toLowerCase()]);
    
    // Always return success for security (don't reveal if email exists)
    if (result.rows.length > 0) {
      const resetToken = uuidv4();
      await sendPasswordResetEmail(email, resetToken);
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, you will receive password reset instructions.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Password reset completion endpoint
  Resets user password using verification token
*/
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token } = req.query;
    const { password } = req.body;

    if (!token) {
      return res.status(400).json(createErrorResponse('Reset token is required', null, 'MISSING_TOKEN'));
    }

    if (!password || password.length < 8) {
      return res.status(400).json(createErrorResponse('Password must be at least 8 characters long', null, 'INVALID_PASSWORD'));
    }

    // Mock token validation - in production, this would validate against stored reset tokens
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(token)) {
      return res.status(400).json(createErrorResponse('Invalid or expired reset token', null, 'INVALID_TOKEN'));
    }

    // Mock successful password reset
    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// USER MANAGEMENT ENDPOINTS

/*
  Get user profile by ID endpoint
  Returns comprehensive user profile including location, expertise, and settings
*/
app.get('/api/users/:user_id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;

    // Get user data from database
    const result = await pool.query(
      'SELECT id, email, full_name, created_at, updated_at FROM users WHERE id = $1',
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
    }

    const user = result.rows[0];

    // Generate extended profile data (mocked since we don't have profile tables)
    const profileData = generateUserProfileData(user);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        expertise_level: profileData.expertise_level,
        primary_location: profileData.primary_location,
        interests: profileData.interests,
        credibility_score: profileData.credibility_score,
        data_privacy_settings: profileData.data_privacy_settings,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Update user profile endpoint
  Allows users to update their profile information including location and interests
*/
app.patch('/api/users/:user_id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;

    // Authorization check - users can only update their own profile
    if (req.user.id !== user_id) {
      return res.status(403).json(createErrorResponse('Forbidden - can only update own profile', null, 'FORBIDDEN'));
    }

    // Validate and extract updatable fields
    const allowedFields = ['full_name', 'expertise_level', 'primary_location', 'interests', 'data_privacy_settings'];
    const updateData = {};
    
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json(createErrorResponse('No valid fields to update', null, 'NO_UPDATE_FIELDS'));
    }

    // Update basic user info in database
    let updateQuery = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
    let queryParams = [];
    let paramIndex = 1;

    if (updateData.full_name) {
      updateQuery += `, full_name = $${paramIndex}`;
      queryParams.push(updateData.full_name);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex} RETURNING id, email, full_name, created_at, updated_at`;
    queryParams.push(user_id);

    const result = await pool.query(updateQuery, queryParams);
    
    if (result.rows.length === 0) {
      return res.status(404).json(createErrorResponse('User not found', null, 'USER_NOT_FOUND'));
    }

    const updatedUser = result.rows[0];

    // Generate updated profile data (mocked extended features)
    const profileData = generateUserProfileData(updatedUser);
    
    // Apply profile updates (would normally be stored in profile tables)
    if (updateData.expertise_level) {
      profileData.expertise_level = updateData.expertise_level;
    }
    if (updateData.primary_location) {
      profileData.primary_location = updateData.primary_location;
    }
    if (updateData.interests) {
      profileData.interests = updateData.interests;
    }
    if (updateData.data_privacy_settings) {
      profileData.data_privacy_settings = { ...profileData.data_privacy_settings, ...updateData.data_privacy_settings };
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        full_name: updatedUser.full_name,
        expertise_level: profileData.expertise_level,
        primary_location: profileData.primary_location,
        interests: profileData.interests,
        credibility_score: profileData.credibility_score,
        data_privacy_settings: profileData.data_privacy_settings,
        created_at: updatedUser.created_at,
        updated_at: updatedUser.updated_at
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

/*
  Search users endpoint with pagination and filtering
  Supports filtering by query, sorting, and pagination for user discovery
*/
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    // Validate query parameters using Zod schema
    const searchParams = searchUserInputSchema.parse({
      query: req.query.query,
      limit: req.query.limit ? parseInt(req.query.limit) : 10,
      offset: req.query.offset ? parseInt(req.query.offset) : 0,
      sort_by: req.query.sort_by || 'created_at',
      sort_order: req.query.sort_order || 'desc'
    });

    const { query, limit, offset, sort_by, sort_order } = searchParams;

    // Build dynamic query with search and pagination
    let baseQuery = 'SELECT id, email, full_name, created_at, updated_at FROM users';
    let countQuery = 'SELECT COUNT(*) as total FROM users';
    let whereClause = '';
    let queryParams = [];
    let paramIndex = 1;

    // Add search filter if query provided
    if (query && query.trim()) {
      whereClause = ` WHERE (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      queryParams.push(`%${query.trim()}%`);
      paramIndex++;
    }

    // Add WHERE clause to both queries
    baseQuery += whereClause;
    countQuery += whereClause;

    // Add sorting and pagination
    baseQuery += ` ORDER BY ${sort_by} ${sort_order.toUpperCase()} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    // Execute both queries
    const [usersResult, countResult] = await Promise.all([
      pool.query(baseQuery, queryParams),
      pool.query(countQuery, queryParams.slice(0, -2)) // Remove limit/offset for count
    ]);

    const users = usersResult.rows;
    const total = parseInt(countResult.rows[0].total);

    // Add mock profile data to each user
    const usersWithProfiles = users.map(user => {
      const profileData = generateUserProfileData(user);
      return {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        expertise_level: profileData.expertise_level,
        credibility_score: profileData.credibility_score,
        created_at: user.created_at,
        updated_at: user.updated_at
      };
    });

    res.json({
      success: true,
      data: {
        items: usersWithProfiles,
        total,
        limit,
        offset,
        has_more: (offset + limit) < total
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json(createErrorResponse('Invalid query parameters', error, 'VALIDATION_ERROR'));
    }
    res.status(500).json(createErrorResponse('Internal server error', error, 'INTERNAL_SERVER_ERROR'));
  }
});

// HEALTH CHECK ENDPOINT
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'EcoPulse API'
  });
});

// SPA catch-all: serve index.html for non-API routes only
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for testing
export { app, pool };

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`EcoPulse server running on port ${PORT} and listening on 0.0.0.0`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});