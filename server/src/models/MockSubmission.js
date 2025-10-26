import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
    section: String,        // "Listening" | "Reading"
    number: Number,         // question number within that section
    choice: String,         // "A" / "B" / "C" / "D"
    correct: Boolean,
});

const submissionSchema = new mongoose.Schema({
    test: { type: mongoose.Schema.Types.ObjectId, ref: "MockTest", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    answers: [answerSchema],
    sectionScores: [{
        section: String,
        correct: Number,
        total: Number,
        percentage: Number,
    }],
    totalCorrect: Number,
    totalQuestions: Number,
    startedAt: Date,
    finishedAt: Date,
}, { timestamps: true });

export default mongoose.model("MockSubmission", submissionSchema);
