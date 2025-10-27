// server/src/models/MockSubmission.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Each saved answer:
 *  section: "Listening" | "Reading"
 *  number: question.number (Number)
 *  choice: whatever student picked
 *  correct: Boolean
 */
const AnswerSchema = new Schema(
    {
        section: { type: String, required: true },
        number: { type: Number, required: true },
        choice: { type: Schema.Types.Mixed, default: "" },
        correct: { type: Boolean, default: false },
    },
    { _id: false }
);

/**
 * Final per-section score
 */
const SectionScoreSchema = new Schema(
    {
        section: { type: String, required: true },
        correct: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
    },
    { _id: false }
);

const MockSubmissionSchema = new Schema(
    {
        test: { type: Schema.Types.ObjectId, ref: "MockTest", required: true },
        student: { type: Schema.Types.ObjectId, ref: "User", required: true },

        answers: { type: [AnswerSchema], default: [] },

        startedAt: { type: Date, default: null },
        finishedAt: { type: Date, default: null },

        sectionScores: { type: [SectionScoreSchema], default: [] },
        totalCorrect: { type: Number, default: 0 },
        totalQuestions: { type: Number, default: 0 },
    },
    { timestamps: true }
);

const MockSubmission = mongoose.model("MockSubmission", MockSubmissionSchema);
export default MockSubmission;
