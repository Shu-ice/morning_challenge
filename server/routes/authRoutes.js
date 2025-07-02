import express from 'express';
import { registerUser, loginUser, updatePassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { 
  validateUserRegistration, 
  validateUserLogin, 
  validateRequestSize,
  sanitizeInput 
} from '../middleware/validationMiddleware.js';
import { 
  authApiLimiter, 
  registrationLimiter,
  generalApiLimiter 
} from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

// 全体に適用するミドルウェア
router.use(validateRequestSize);
router.use(sanitizeInput);

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', registrationLimiter, validateUserRegistration, registerUser);

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authApiLimiter, validateUserLogin, (req, res, next) => {
    console.log('[authRoutes] POST /api/auth/login hit');
    loginUser(req, res, next);
});

// @desc    Update user password
// @route   PUT /api/auth/update-password
// @access  Private
router.put('/update-password', generalApiLimiter, protect, (req, res, next) => {
    console.log('[authRoutes] PUT /api/auth/update-password hit');
    updatePassword(req, res, next);
});

export default router; 