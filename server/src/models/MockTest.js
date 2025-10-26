// UPDATE server/src/models/MockTest.js
import mongoose from "mongoose";

/**
 * NOTE:
 * - This schema is now aligned with TOEIC-style data.
 * - We support:
 *    - group.imageUrl (Part 1)
 *    - group.audioUrl (Listening Parts 2/3/4)
 *    - group.passageHtml (Reading Parts 6/7, also Part 7 multi-passage)
 *    - question.explanationHtml + tags (for review explanations)
 *
 * - We use question.type = "MCQ" etc. (replaces old questionType).
 * - options is an array of { key:"A", text:"..." }.
 */

const optionSchema = new mongoose.Schema(
    {
        key: { type: String, required: true }, // "A","B","C","D"
        text: { type: String, required: true },
    },
    { _id: false }
);

const questionSchema = new mongoose.Schema(
    {
        number: { type: Number, required: true }, // Global question number within section (ex: 1..100)
        prompt: { type: String, required: true },

        // TOEIC is MCQ, but we keep enum for future safety
        type: {
            type: String,
            enum: ["MCQ", "TrueFalse", "FillIn"],
            default: "MCQ",
            required: true,
        },

        // For MCQ: A/B/C/D; for TrueFalse you can still store two; for FillIn can be empty.
        options: {
            type: [optionSchema],
            validate: v => Array.isArray(v) && v.length > 0,
            required: true,
        },

        // "A","B","C","D" or "TRUE"/"FALSE" or text
        answer: { type: String, required: true },

        // NEW: explanation & tags to show in review
        explanationHtml: { type: String },
        tags: { type: [String], default: [] },

        // anchors (for Part 6 blanks etc.) - keep from your original draft
        anchors: { type: [String], default: [] },
    },
    { _id: false }
);

const groupSchema = new mongoose.Schema(
    {
        title: { type: String },
        instructions: { type: String },

        // Listening / Reading media
        imageUrl: { type: String }, // Part 1 photo
        audioUrl: { type: String }, // Part 2 / 3 / 4 audio
        passageHtml: { type: String }, // Part 6/7 text / email / article (HTML allowed)

        questions: {
            type: [questionSchema],
            validate: v => Array.isArray(v) && v.length > 0,
            required: true,
        },
    },
    { _id: false }
);

const sectionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            enum: ["Listening", "Reading"],
            required: true,
        },

        // TOEIC Part tag: 1-4 Listening, 5-7 Reading
        part: {
            type: Number,
            enum: [1, 2, 3, 4, 5, 6, 7],
            required: true,
        },

        durationMinutes: { type: Number, required: true }, // 45 Listening / 75 Reading
        linear: { type: Boolean, default: true }, // Listening forced order; Reading often free

        groups: {
            type: [groupSchema],
            validate: v => Array.isArray(v) && v.length > 0,
            required: true,
        },
    },
    { _id: false }
);

const mockTestSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String },

        sections: {
            type: [sectionSchema],
            validate: v => Array.isArray(v) && v.length > 0,
            required: true,
        },

        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

export default mongoose.model("MockTest", mockTestSchema);
