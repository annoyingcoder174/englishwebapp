import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
    number: Number,
    choice: String,           // student picked "A"|"B"|"C"|"D"
    correct: Boolean,
});

const submissionSchema = new mongoose.Schema({
    test: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    answers: [answerSchema],
    score: { type: Number, default: 0 },     // number correct
    total: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    startedAt: Date,
    completedAt: Date,
}, { timestamps: true });

export default mongoose.model("Submission", submissionSchema);
