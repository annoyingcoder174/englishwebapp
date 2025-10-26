import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api"; // axios instance w/ interceptor

export default function ManageTests() {
    const [tests, setTests] = useState([]);
    const [title, setTitle] = useState("");
    const [section, setSection] = useState("Reading");
    const [description, setDescription] = useState("");
    const [duration, setDuration] = useState(30);
    const [questions, setQuestions] = useState([]);

    const loadTests = async () => {
        const { data } = await api.get("/tests");
        setTests(data);
    };

    useEffect(() => { loadTests(); }, []);

    const addQuestion = () => {
        setQuestions(qs => [
            ...qs,
            { number: qs.length + 1, type: section, prompt: "", options: ["", "", "", ""], answer: "A" }
        ]);
    };

    const updateQ = (idx, patch) => {
        setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, ...patch } : q));
    };

    const saveTest = async () => {
        if (!title || questions.length === 0) return alert("Need title and at least 1 question");
        await api.post("/tests", {
            title, section, description,
            durationMinutes: duration,
            questions
        });
        setTitle(""); setDescription(""); setDuration(30); setQuestions([]);
        await loadTests();
        alert("Test saved ✅");
    };

    const del = async (id) => {
        if (!confirm("Delete test?")) return;
        await api.delete(`/tests/${id}`);
        await loadTests();
    };

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-blue-700">🧪 Manage Tests</h1>

            {/* Builder */}
            <div className="bg-white rounded-lg shadow p-4 space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                    <input className="border p-2 rounded" placeholder="Test title"
                        value={title} onChange={(e) => setTitle(e.target.value)} />
                    <select className="border p-2 rounded" value={section} onChange={e => setSection(e.target.value)}>
                        <option>Reading</option><option>Listening</option><option>Writing</option><option>Speaking</option>
                    </select>
                    <input className="border p-2 rounded" type="number" min="5" max="180"
                        value={duration} onChange={e => setDuration(+e.target.value)} placeholder="Duration (min)" />
                    <input className="border p-2 rounded" placeholder="Description (optional)"
                        value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                <button onClick={addQuestion} className="bg-blue-600 text-white px-3 py-1 rounded">+ Add Question</button>

                {questions.map((q, idx) => (
                    <div key={idx} className="border rounded p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">#{q.number}</span>
                            <input className="flex-1 border p-2 rounded"
                                placeholder="Prompt / passage / question"
                                value={q.prompt} onChange={e => updateQ(idx, { prompt: e.target.value })} />
                        </div>
                        <div className="grid md:grid-cols-2 gap-2">
                            {["A", "B", "C", "D"].map((label, i) => (
                                <input key={label} className="border p-2 rounded"
                                    placeholder={`Option ${label}`}
                                    value={q.options[i] || ""}
                                    onChange={e => {
                                        const opts = [...(q.options || [])];
                                        opts[i] = e.target.value;
                                        updateQ(idx, { options: opts });
                                    }} />
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm">Correct:</label>
                            <select className="border p-2 rounded" value={q.answer}
                                onChange={e => updateQ(idx, { answer: e.target.value })}>
                                <option>A</option><option>B</option><option>C</option><option>D</option>
                            </select>
                        </div>
                    </div>
                ))}

                <button onClick={saveTest} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                    Save Test
                </button>
            </div>

            {/* Existing tests */}
            <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-semibold mb-2">Existing Tests</h2>
                {tests.length === 0 ? <p className="text-gray-500">No tests yet.</p> : (
                    <ul className="space-y-2">
                        {tests.map(t => (
                            <li key={t._id} className="border rounded p-3 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold">{t.title} <span className="text-sm text-gray-500">({t.section})</span></p>
                                    <p className="text-xs text-gray-500">{t.questions?.length || 0} questions</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link to={`/admin/tests/${t._id}`} className="text-blue-600 underline">View</Link>
                                    <button onClick={() => del(t._id)} className="text-red-600">Delete</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
