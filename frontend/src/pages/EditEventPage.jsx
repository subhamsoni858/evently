import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Calendar, MapPin, DollarSign, Users, Clock, Image, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const EditEventPage = () => {
  const { id } = useParams();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Tech');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [fetching, setFetching] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        const response = await api.get(`/events/${id}`);
        const event = response.data.data;
        
        setTitle(event.title);
        setDescription(event.description);
        
        // Format ISO Date (YYYY-MM-DD) for HTML5 date input
        const formattedDate = new Date(event.date).toISOString().split('T')[0];
        setDate(formattedDate);
        
        setTime(event.time);
        setLocation(event.location);
        setCapacity(event.capacity);
        setPrice(event.price);
        setCategory(event.category);
        setImagePreview(event.image.url);
      } catch (error) {
        console.error('Failed to load event details:', error);
        toast.error('Failed to retrieve event details', {
          className: 'hot-toast-custom',
        });
        navigate('/organizer/dashboard');
      } finally {
        setFetching(false);
      }
    };

    fetchEventDetails();
  }, [id, navigate]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Invalid file type. Please select an image file.', {
          className: 'hot-toast-custom',
        });
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title || !description || !date || !time || !location || !capacity || price === undefined || !category) {
      toast.error('Please fill in all required fields', { className: 'hot-toast-custom' });
      return;
    }

    setSubmitting(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('date', date);
    formData.append('time', time);
    formData.append('location', location);
    formData.append('capacity', capacity);
    formData.append('price', price);
    formData.append('category', category);
    
    // Only append image if the organizer chose a new file
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      await api.put(`/events/${id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Event updated successfully! CDN assets re-cached.', {
        className: 'hot-toast-custom',
      });
      navigate('/organizer/dashboard');
    } catch (error) {
      console.error('Failed to update event:', error);
      toast.error(error.response?.data?.message || 'Failed to update event', {
        className: 'hot-toast-custom',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
        <span className="text-gray-400 font-medium">Fetching event specifications...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-slide-up">
      {/* Back link */}
      <button 
        onClick={() => navigate('/organizer/dashboard')}
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm font-semibold mb-6 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Host Panel
      </button>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">Edit Event</h1>
        <p className="text-gray-400 text-sm mt-1">Modify details and replace poster specifications cleanly</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Image Selector */}
          <div className="lg:col-span-1 space-y-3">
            <label className="text-sm font-semibold text-gray-300 block">Event Poster / Banner</label>
            <div className="relative aspect-[16/10] lg:aspect-square w-full rounded-2xl border-2 border-dashed border-darkBorder bg-darkCard/30 overflow-hidden flex flex-col items-center justify-center text-center p-4 hover:border-primary-500/50 transition-colors cursor-pointer group">
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt="Preview" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                    Replace Poster
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-gray-500">
                  <div className="bg-darkBg p-3.5 rounded-2xl border border-darkBorder group-hover:text-primary-400 transition-colors">
                    <Image className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold">Upload Banner Image</span>
                  <span className="text-[10px] text-gray-600 block">PNG, JPG, WebP up to 5MB</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Right Column: Fields */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300">Event Title</label>
              <input
                type="text"
                required
                maxLength={100}
                placeholder="e.g. Synthetica: The AI Hackathon 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="form-input"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-300">Event Description</label>
              <textarea
                rows={5}
                required
                placeholder="Provide a comprehensive summary of what the event is..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="form-input resize-none"
              />
            </div>

            {/* Category selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="form-input bg-darkBg text-white cursor-pointer"
                >
                  {['Tech', 'Music', 'Comedy', 'Workshop', 'Sports', 'Art', 'Food', 'Business', 'Other'].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Venue Location</label>
                <div className="relative flex items-center">
                  <MapPin className="absolute left-4 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Silicon Hub, Bangalore"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="form-input pl-12"
                  />
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Event Date</label>
                <div className="relative flex items-center">
                  <Calendar className="absolute left-4 w-5 h-5 text-gray-500" />
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="form-input pl-12 cursor-pointer text-white scheme-dark"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Start Time (HH:MM)</label>
                <div className="relative flex items-center">
                  <Clock className="absolute left-4 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="18:30"
                    pattern="^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$"
                    title="Please enter time in 24-hour HH:MM format"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="form-input pl-12"
                  />
                </div>
              </div>
            </div>

            {/* Capacity & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Total Seating Capacity</label>
                <div className="relative flex items-center">
                  <Users className="absolute left-4 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="100"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="form-input pl-12"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-300">Ticket Price (₹)</label>
                <div className="relative flex items-center">
                  <DollarSign className="absolute left-4 w-5 h-5 text-gray-500" />
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="499"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="form-input pl-12"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full btn-primary flex items-center justify-center gap-2 py-4 shadow-xl mt-10"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Updating CDN & DB records...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EditEventPage;
