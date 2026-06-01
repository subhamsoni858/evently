import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummykeyid',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummykeysecret',
});

export default razorpay;
