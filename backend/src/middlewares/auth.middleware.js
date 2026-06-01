import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { ErrorResponse } from './error.js';

// Protect routes: verify JWT access token
export const protect = async (req, res, next) => {
  let token;

  // 1. Check if token is sent in the Authorization header as Bearer token
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 2. Make sure token exists
  if (!token) {
    return next(new ErrorResponse('Not authorized to access this route', 401));
  }

  try {
    // 3. Verify access token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // 4. Attach user to request object
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new ErrorResponse('User matching this token does not exist', 401));
    }

    req.user = user;
    next();
  } catch (error) {
    return next(new ErrorResponse('Not authorized, token validation failed', 401));
  }
};

// Restrict access to specific roles (e.g. organizer, attendee)
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Auth credentials not provided', 401));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(
          `User role '${req.user.role}' is not authorized to access this resource`,
          403
        )
      );
    }
    next();
  };
};
