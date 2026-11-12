'use client';
import { useEffect, useState } from 'react';

type Job = { id: number; payload: string; status: string; result: string | null };

export default function Home() {
  const [text, setText] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);

  const load = async () => {
    const r = await fetch('/api/jobs');
    if (r.ok) setJobs(await r.json());
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: text }),
    });
    setText('');
    load();
  };

  return (
    <main style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Job Processor</h1>
      <form onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Enter text to process" required style={{ padding: 8, width: '70%' }} />
        <button type="submit" style={{ padding: 8, marginLeft: 8 }}>Submit job</button>
      </form>
      <table style={{ marginTop: 24, width: '100%' }}>
        <thead><tr><th>ID</th><th>Input</th><th>Status</th><th>Result</th></tr></thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}><td>{j.id}</td><td>{j.payload}</td><td>{j.status}</td><td>{j.result}</td></tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
