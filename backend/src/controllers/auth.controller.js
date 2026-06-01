import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ErrorResponse } from '../middlewares/error.js';

// Helper to generate access tokens
const generateAccessToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
  });
};

// Helper to generate refresh tokens
const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  });
};

// Helper to send refresh token cookie
const sendRefreshCookie = (res, token) => {
  const cookieOptions = {
    httpOnly: true,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
  res.cookie('refreshToken', token, cookieOptions);
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  const { name, email, password, role } = req.body;

  try {
    // 1. Basic validation
    if (!name || !email || !password) {
      return next(new ErrorResponse('Please provide a name, email, and password', 400));
    }

    // 2. Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return next(new ErrorResponse('User already registered with this email', 400));
    }

    // 3. Create user (password is automatically hashed by User.js pre-save hook)
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'attendee',
      refreshTokens: [],
    });

    // 4. Generate Tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // 5. Save refresh token to user schema database list
    user.refreshTokens.push(refreshToken);
    await user.save();

    // 6. Set HTTP-Only Cookie
    sendRefreshCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      accessToken,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login existing user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  try {
    // 1. Validation
    if (!email || !password) {
      return next(new ErrorResponse('Please provide email and password', 400));
    }

    // 2. Check user exists
    const user = await User.findOne({ email }).select('+password'); // select explicitly
    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // 3. Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // 4. Generate Tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // 5. Append refresh token to DB list
    user.refreshTokens.push(refreshToken);
    await user.save();

    // 6. Set HTTP-Only Cookie
    sendRefreshCookie(res, refreshToken);

    res.status(200).json({
      success: true,
      accessToken,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token (Token Rotation)
// @route   POST /api/auth/refresh
// @access  Public
export const refresh = async (req, res, next) => {
  const cookies = req.cookies;
  
  if (!cookies?.refreshToken) {
    return next(new ErrorResponse('Not authorized, no refresh credentials', 401));
  }

  const oldRefreshToken = cookies.refreshToken;

  try {
    // 1. Verify Refresh Token
    const decoded = jwt.verify(oldRefreshToken, process.env.JWT_REFRESH_SECRET);

    // 2. Find user in DB containing this refresh token
    const user = await User.findOne({ _id: decoded.userId, refreshTokens: oldRefreshToken });

    // 🚨 TOKEN REUSE DETECTION / THEFT SECURITY CASE
    if (!user) {
      // If we verify the token but no user matches, the token might have been stolen or reused.
      // Revoke all active refresh sessions for this userId as a safety guard
      await User.findByIdAndUpdate(decoded.userId, { refreshTokens: [] });
      res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
      return next(new ErrorResponse('Security breach: session revoked. Please log in again.', 403));
    }

    // 3. Token Rotation: Remove the old refresh token & generate a brand new pair
    user.refreshTokens = user.refreshTokens.filter(rt => rt !== oldRefreshToken);

    const accessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    // 4. Save new refresh token to DB
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    // 5. Set Cookie with new refresh token
    sendRefreshCookie(res, newRefreshToken);

    res.status(200).json({
      success: true,
      accessToken
    });
  } catch (error) {
    // Refresh Token Expired or Invalidated
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return next(new ErrorResponse('Session expired, please log in again', 401));
  }
};

// @desc    Logout user & revoke refresh token
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  const cookies = req.cookies;
  if (!cookies?.refreshToken) {
    res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  }

  const refreshToken = cookies.refreshToken;

  try {
    // Remove the current refresh token from DB
    await User.findOneAndUpdate(
      { refreshTokens: refreshToken },
      { $pull: { refreshTokens: refreshToken } }
    );

    // Clear HTTP-Only Cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get currently logged in user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    // req.user is already fetched in protect middleware
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile (name, email, password)
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res, next) => {
  const { name, email, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // 1. If password is to be updated, verify current password first
    if (newPassword) {
      if (!currentPassword) {
        return next(new ErrorResponse('Please provide your current password to set a new password', 400));
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return next(new ErrorResponse('Invalid current password', 401));
      }
      if (newPassword.length < 6) {
        return next(new ErrorResponse('New password must be at least 6 characters long', 400));
      }
      user.password = newPassword;
    }

    // 2. If email is to be updated, check uniqueness
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return next(new ErrorResponse('Email already in use by another user', 400));
      }
      user.email = email;
    }

    // 3. Update name
    if (name) {
      user.name = name;
    }

    // 4. Save the user document (User Schema pre-save hook will automatically hash the password if updated)
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user
    });
  } catch (error) {
    next(error);
  }
};

