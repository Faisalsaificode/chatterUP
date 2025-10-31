import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true, required: true },
    avatar: { type: String, required: true },
    lastSeen: { type: Date, default: Date.now },
    online: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('User', UserSchema);
