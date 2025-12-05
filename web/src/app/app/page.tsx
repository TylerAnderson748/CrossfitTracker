'use client';
import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const res = await fetch('/api/generate-week', {
      method: 'POST',
      body: JSON.stringify({ gymId: 'demo }),
    });
    const data = await res.json();
    alert('Done! Here is your week:\n\n' + data.workouts);
    setLoading(false);
  };

  return (
    <div style={{ padding: '50px', textAlign: 'center' }}>
      <h1>CrossFit Tracker</h1>
      <button
        onClick={generate}
        disabled={loading}
        style={{
          padding: '20px 40px',
          fontSize: '24px',
          background: loading ? '#ccc' : '#0066ff',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? 'Generating with Grok…' : 'Generate Next Week’s Programming'}
      </button>
    </div>
  );
}
