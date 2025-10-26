import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    section: {
        type: String,
        enum: ['Reading', 'Listening', 'Writing', 'Speaking'],
        required: true,
    },
    description: String,
    fileUrl: String,
    originalName: String,
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export default mongoose.model('Document', documentSchema);
