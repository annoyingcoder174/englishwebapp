// server/src/models/MockTest.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * MCQ option
 */
const MCQOptionSchema = new Schema(
    {
        key: { type: String, required: true }, // "A", "B", ...
        text: { type: String, default: "" },
    },
    { _id: false }
);

/**
 * Blank in FILL_BLOCK
 */
const BlankSchema = new Schema(
    {
        slot: { type: Number, required: true }, // 1,2,3,...
        answer: { type: String, default: "" }, // teacher answer
        limit: { type: String, default: "ONE WORD ONLY" }, // hint for student
        note: { type: String, default: "" }, // teacher explanation for THIS blank
    },
    { _id: false }
);

/**
 * Pair in MATCH
 */
const MatchPairSchema = new Schema(
    {
        left: { type: String, default: "" },
        right: { type: String, default: "" },
    },
    { _id: false }
);

/**
 * Question schema
 *
 * type:
 *  - "MCQ"
 *  - "TFNG"
 *  - "FILL"
 *  - "FILL_BLOCK"
 *  - "MATCH"
 */
const QuestionSchema = new Schema(
    {
        number: { type: Number, required: true },
        type: { type: String, required: true }, // MCQ / TFNG / ...

        prompt: { type: String, default: "" },
        explanationHtml: { type: String, default: "" },

        // MCQ
        options: { type: [MCQOptionSchema], default: [] },
        answer: { type: String, default: "" }, // for MCQ, also used by FILL, TFNG, etc

        // FILL_BLOCK
        blockText: { type: String, default: "" },
        blanks: { type: [BlankSchema], default: [] },

        // MATCH
        pairs: { type: [MatchPairSchema], default: [] },
    },
    { _id: false }
);

/**
 * Group schema (one passage / audio block)
 */
const GroupSchema = new Schema(
    {
        title: { type: String, default: "" },
        instructions: { type: String, default: "" },

        passageHtml: { type: String, default: "" }, // reading passage HTML
        imageUrl: { type: String, default: "" },    // listening part 1 image
        audioUrl: { type: String, default: "" },    // listening audio

        questions: { type: [QuestionSchema], default: [] },
    },
    { _id: false }
);

/**
 * Section schema (Listening / Reading part)
 */
const SectionSchema = new Schema(
    {
        name: { type: String, required: true }, // "Listening" | "Reading"
        part: { type: Number, required: true },
        durationMinutes: { type: Number, required: true },
        linear: { type: Boolean, default: true },

        groups: { type: [GroupSchema], default: [] },
    },
    { _id: false }
);

/**
 * Full test
 */
const MockTestSchema = new Schema(
    {
        title: { type: String, required: true },
        description: { type: String, default: "" },

        sections: { type: [SectionSchema], default: [] },

        // visibility / access control
        visibility: {
            type: String,
            enum: ["all", "allow-list", "block-list"],
            default: "all",
        },
        allowedStudents: { type: [String], default: [] }, // emails or userIds you allow
        blockedStudents: { type: [String], default: [] }, // emails or userIds you block

        createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
);

const MockTest = mongoose.model("MockTest", MockTestSchema);
export default MockTest;
