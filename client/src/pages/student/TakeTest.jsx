import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../utils/api";

export default function TakeTest() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [test, setTest] = useState(null);
    const [answers, setAnswers] = useState({}); // { number: "A" }
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        (async () => {
            const { data } = await api.get(`/tests/${id}`);
            setTest(data);
        })();
    }, [id]);

    const submit = async () => {
        setSubmitting(true);
        try {
            const payload = Object.entries(answers).map(([number, choice]) => ({
                number: Number(number),
                choice,
            }));
            const { data } = await api.post(`/submissions/${id}`, { answers: payload, startedAt: new Date() });
            alert(`Score: ${data.score}/${data.total} (${data.percentage}%)`);
            navigate("/study");
        } catch (e) {
            console.error(e);
            alert("Submit failed");
        } finally {
            setSubmitting(false);
        }
    };

    if (!test) return <div className="p-6">Loading...</div>;

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold">{test.title} <span className="text-sm text-gray-500">({test.section})</span></h1>
            <p className="text-gray-600">{test.description}</p>
            <div className="text-sm text-gray-500">Duration: {test.durationMinutes} minutes</div>

            <div className="space-y-4">
                {test.questions?.map(q => (
                    <div key={q.number} className="bg-white shadow rounded p-4 space-y-2">
                        <div className="font-medium">#{q.number}. {q.prompt}</div>
                        <div className="grid md:grid-cols-2 gap-2">
                            {["A", "B", "C", "D"].map((opt, i) => (
                                <label key={opt} className={`border rounded p-2 cursor-pointer ${answers[q.number] === opt ? "bg-blue-50 border-blue-400" : ""}`}>
                                    <input
                                        type="radio"
                                        name={`q-${q.number}`}
                                        className="mr-2"
                                        checked={answers[q.number] === opt}
                                        onChange={() => setAnswers(a => ({ ...a, [q.number]: opt }))}
                                    />
                                    {opt}. {q.options?.[i] || ""}
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <button disabled={submitting} onClick={submit}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                {submitting ? "Submitting..." : "Submit Test"}
            </button>
        </div>
    );
}
