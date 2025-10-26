import mongoose from "mongoose";
import MockTest from "../models/MockTest.js";
import MockSubmission from "../models/MockSubmission.js";

/**
 * Utility: compute scores from a test document + a submission's answer array.
 * - test.sections[].groups[].questions[].answer => correct
 * - submission.answers = [{ section:"Listening"|"Reading", number, choice }]
 * Returns { Listening:{raw}, Reading:{raw}, total }
 */
function computeScores(testDoc, submissionDoc) {
    const answerMap = {};
    (submissionDoc.answers || []).forEach(a => {
        if (!a) return;
        const key = `${a.section}:${a.number}`;
        answerMap[key] = a.choice;
    });

    let listening = 0;
    let reading = 0;

    (testDoc.sections || []).forEach(sec => {
        (sec.groups || []).forEach(g => {
            (g.questions || []).forEach(q => {
                const key = `${sec.name}:${q.number}`;
                const chosen = answerMap[key];
                const correct = q.answer;
                if (chosen && chosen === correct) {
                    if (sec.name === "Listening") listening += 1;
                    if (sec.name === "Reading") reading += 1;
                }
            });
        });
    });

    return {
        Listening: { raw: listening },
        Reading: { raw: reading },
        total: listening + reading,
    };
}

/**
 * FINISH submission: POST /api/mocktests/:id/finish
 * - Marks submission finished (idempotent)
 * - Computes & stores scores
 * - Returns { message, scores }
 */
export async function finishSubmission(req, res) {
    try {
        const testId = req.params.id;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(testId)) {
            return res.status(400).json({ error: "ID đề thi không hợp lệ." });
        }

        const testDoc = await MockTest.findById(testId).lean();
        if (!testDoc) return res.status(404).json({ error: "Không tìm thấy đề thi." });

        const submission = await MockSubmission.findOne({ testId, userId });
        if (!submission) {
            return res.status(404).json({ error: "Chưa có phiên làm bài để nộp." });
        }

        // If already finished, just recompute/return (idempotent)
        const scores = computeScores(testDoc, submission);

        submission.scores = scores;
        submission.isFinished = true;
        submission.finishedAt = submission.finishedAt || new Date();
        await submission.save();

        return res.json({
            message: "Nộp bài thành công.",
            scores,
        });
    } catch (err) {
        console.error("finishSubmission error:", err);
        return res.status(500).json({ error: "Không thể nộp bài." });
    }
}

/**
 * REVIEW: GET /api/mocktests/:id/review
 * (Keep as we added earlier – now it will find the finished submission)
 */
export async function getReviewForUser(req, res) {
    try {
        const testId = req.params.id;
        const userId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(testId)) {
            return res.status(400).json({ error: "ID đề thi không hợp lệ." });
        }

        const testDoc = await MockTest.findById(testId).lean();
        if (!testDoc) return res.status(404).json({ error: "Không tìm thấy đề thi." });

        const submissionDoc = await MockSubmission.findOne({ testId, userId }).lean();
        if (!submissionDoc) {
            return res.status(404).json({ error: "Chưa có bài làm để xem lại. Hãy hoàn thành bài thi trước." });
        }

        // (Optional) Require finished to view review; comment out if you allow preview
        if (!submissionDoc.isFinished) {
            return res.status(403).json({ error: "Bài làm chưa được nộp." });
        }

        const answersArr = Array.isArray(submissionDoc.answers) ? submissionDoc.answers : [];
        const scores = submissionDoc.scores || {};

        const answerMap = {};
        for (const a of answersArr) {
            if (a && a.section && (a.number || a.number === 0)) {
                answerMap[`${a.section}:${a.number}`] = a.choice;
            }
        }

        const reviewSections = (testDoc.sections || []).map(section => {
            const reviewGroups = (section.groups || []).map(group => {
                const questions = (group.questions || []).map(q => {
                    const key = `${section.name}:${q.number}`;
                    const chosen = answerMap[key] ?? null;
                    const correct = q.answer;
                    return {
                        number: q.number,
                        prompt: q.prompt,
                        options: q.options,
                        correctAnswer: correct,
                        chosenAnswer: chosen,
                        isCorrect: chosen === correct,
                        explanationHtml: q.explanationHtml || "",
                        tags: q.tags || []
                    };
                });

                return {
                    title: group.title || "",
                    instructions: group.instructions || "",
                    passageHtml: group.passageHtml || "",
                    imageUrl: group.imageUrl || "",
                    audioUrl: group.audioUrl || "",
                    questions
                };
            });

            return {
                name: section.name,
                part: section.part,
                groups: reviewGroups
            };
        });

        return res.json({
            testId: testDoc._id,
            title: testDoc.title,
            scores,
            sections: reviewSections
        });
    } catch (err) {
        console.error("getReviewForUser error:", err);
        return res.status(500).json({ error: "Không thể tải trang xem lại bài làm." });
    }
}
