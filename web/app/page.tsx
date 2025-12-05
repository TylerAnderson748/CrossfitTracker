'use client';
import { useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    fetch('/api/generate-week', {
      method: 'POST',
      body: JSON.stringify({ gymId: 'demo' }),
    })
      .then(r => r.json())
      .then(data => {
        alert('SUCCESS! Here is your week:\n\n' + data.workouts);
        setLoading(false);
      })
      .catch(err => {
        alert('Error: ' + err.message);
        setLoading(false);
      });
  };

  return (
    <div style={{ padding: '100px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '40px', marginBottom: '50px' }}>
        CrossFit Tracker
      </h1>

      <button
        onClick={generate}
        disabled={loading}
        style={{
          padding: '30px 60px',
          fontSize: '28px',
          backgroundColor: loading ? '#999' : '#0066ff',
          color: 'white',
          border: 'none',
          borderRadius: '15px',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Generating with Grok…' : 'Generate Next Week’s Programming'}
      </button>
    </div>
  );
}
