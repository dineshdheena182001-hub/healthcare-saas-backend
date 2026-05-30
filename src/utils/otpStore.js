/**
 * In-memory OTP store
 * Replace with Redis in production:
 *   await redisClient.setEx(`otp:${mobile}`, 300, otp);
 */
const otpStore = new Map();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

const generateOTP = () => {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit OTP
};

const storeOTP = (mobile, otp) => {
  otpStore.set(mobile, {
    otp,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
  });
};

const verifyOTP = (mobile, otp) => {
  const record = otpStore.get(mobile);

  if (!record) return { valid: false, reason: 'OTP not found. Please request a new one.' };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(mobile);
    return { valid: false, reason: 'OTP has expired. Please request a new one.' };
  }
  if (record.otp !== otp) return { valid: false, reason: 'Invalid OTP.' };

  otpStore.delete(mobile); // OTP used, remove it
  return { valid: true };
};

module.exports = { generateOTP, storeOTP, verifyOTP };
