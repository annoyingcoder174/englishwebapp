import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
    number: { type: Number, required: true },
    type: { type: String, enum: ["Reading", "Listening", "Writing", "Speaking"], required: true },
    prompt: { type: String, required: true },          // passage or question text
    options: [{ type: String }],                       // choices A/B/C/D (for MCQ)
    answer: { type: String },                          // "A" | "B" | "C" | "D"  (MCQ)
    // future: audioUrl, imageUrl, explanation, multi-correct, etc.
});

const testSchema = new mongoose.Schema({
    title: { type: String, required: true },
    section: { type: String, enum: ["Reading", "Listening", "Writing", "Speaking"], required: true },
    description: String,
    durationMinutes: { type: Number, default: 30 },
    questions: [questionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

export default mongoose.model("Test", testSchema);
