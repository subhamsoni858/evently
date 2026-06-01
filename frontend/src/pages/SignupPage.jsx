import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Sparkles, Eye, EyeOff, Loader2, CalendarRange, Sparkle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('attendee'); // Default role
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !role) return;

    setSubmitting(true);
    const result = await register(name, email, password, role);
    setSubmitting(false);

    if (result.success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 relative overflow-hidden py-12">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-primary-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md glass-card p-8 sm:p-10 animate-slide-up relative z-10">
        {/* Header Logo & Tagline */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-primary-600 p-2.5 rounded-2xl text-white shadow-lg shadow-primary-500/20 mb-4 justify-center">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">Create Account</h2>
          <p className="text-gray-400 text-sm mt-2">Join Evently to host or book premier events</p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name input */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-300">Full Name</label>
            <div className="relative flex items-center">
              <User className="absolute left-4 w-5 h-5 text-gray-500" />
              <input
                type="text"
                required
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input pl-12"
              />
            </div>
          </div>

          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-300">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-4 w-5 h-5 text-gray-500" />
              <input
                type="email"
                required
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input pl-12"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-gray-300">Password</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Min 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input pl-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 text-gray-500 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Role selector toggles */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300">I want to...</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('attendee')}
                className={`py-3 px-4 rounded-xl border font-medium text-sm flex flex-col items-center justify-center gap-1.5 transition-all duration-200 ${
                  role === 'attendee'
                    ? 'border-primary-500 bg-primary-500/10 text-white shadow-lg shadow-primary-500/5'
                    : 'border-darkBorder bg-darkBg text-gray-400 hover:border-gray-700'
                }`}
              >
                <CalendarRange className="w-5 h-5" />
                <span>Book Events</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('organizer')}
                className={`py-3 px-4 rounded-xl border font-medium text-sm flex flex-col items-center justify-center gap-1.5 transition-all duration-200 ${
                  role === 'organizer'
                    ? 'border-primary-500 bg-primary-500/10 text-white shadow-lg shadow-primary-500/5'
                    : 'border-darkBorder bg-darkBg text-gray-400 hover:border-gray-700'
                }`}
              >
                <Sparkle className="w-5 h-5" />
                <span>Host Events</span>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full btn-primary flex items-center justify-center gap-2 py-3.5 shadow-xl mt-8"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing Up...
              </>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        {/* Login Redirect Link */}
        <div className="mt-8 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-400 hover:text-primary-300 font-semibold underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
