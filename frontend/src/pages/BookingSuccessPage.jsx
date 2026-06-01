import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Ticket, Calendar, MapPin, ArrowRight, ShieldCheck } from 'lucide-react';

const BookingSuccessPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract booking details payload sent by the router navigate state
  const { booking, event } = location.state || {};

  // Safeguard: Redirect if accessed directly without transaction context
  if (!booking || !event) {
    React.useEffect(() => {
      navigate('/');
    }, [navigate]);
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 relative overflow-hidden py-12">
      {/* Background glow decors */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-primary-600/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-xl glass-card p-8 sm:p-10 border-emerald-500/10 text-center animate-slide-up relative z-10">
        
        {/* Animated Green Tick Badge */}
        <div className="inline-flex bg-emerald-500/10 p-5 rounded-full text-emerald-400 border border-emerald-500/20 mb-6 animate-pulse">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">Booking Confirmed!</h1>
        <p className="text-gray-400 text-sm max-w-sm mx-auto leading-relaxed mb-10">
          Your seat reservations are successfully locked and verified in our database. We have sent a receipt to your email inbox in the background!
        </p>

        {/* Premium Receipt Card */}
        <div className="p-6 bg-darkBg/60 rounded-3xl border border-darkBorder/40 text-left space-y-6 mb-10 relative overflow-hidden">
          {/* Subtle watermarked ticket icon */}
          <Ticket className="absolute -right-6 -bottom-6 w-32 h-32 text-darkBorder/20 pointer-events-none transform rotate-12" />

          {/* Event title capsule */}
          <div className="border-b border-darkBorder/40 pb-4">
            <span className="text-[10px] bg-primary-500/10 border border-primary-500/20 text-primary-400 font-bold uppercase tracking-wider px-2 py-0.5 rounded">
              {event.category}
            </span>
            <h3 className="text-lg font-bold text-white mt-2 leading-snug line-clamp-1">{event.title}</h3>
            
            <div className="flex flex-col gap-1.5 text-gray-400 text-xs mt-3">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary-500" />
                <span>{new Date(event.date).toLocaleDateString('en-US', { dateStyle: 'medium' })} • {event.time}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-primary-500" />
                <span className="line-clamp-1">{event.location}</span>
              </div>
            </div>
          </div>

          {/* Checkout Details Row */}
          <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs text-gray-400">
            <div>
              <span>Unique Booking Token:</span>
              <span className="block font-mono text-sm font-bold text-white mt-1 uppercase tracking-wider">{booking.bookingId}</span>
            </div>
            <div>
              <span>Receipt status:</span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-400 mt-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Paid (Confirmed)
              </span>
            </div>
            <div>
              <span>Tickets Reserved:</span>
              <span className="block text-sm font-bold text-white mt-1">{booking.ticketCount} Seat{booking.ticketCount > 1 ? 's' : ''}</span>
            </div>
            <div>
              <span>Total Paid:</span>
              <span className="block text-sm font-bold text-emerald-400 mt-1">
                {booking.totalAmount === 0 ? 'Free' : `₹${booking.totalAmount.toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
          <button
            onClick={() => navigate('/')}
            className="btn-secondary py-3.5 px-6 flex-1 text-sm font-bold w-full border border-darkBorder"
          >
            Find More Events
          </button>
          
          <button
            onClick={() => navigate('/dashboard')}
            className="btn-primary py-3.5 px-6 flex-1 text-sm font-bold w-full shadow-lg shadow-primary-500/10 flex items-center justify-center gap-2 group"
          >
            View My Bookings
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccessPage;
