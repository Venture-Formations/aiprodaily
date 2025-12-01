"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      padding: '20px',
      gap: '20px'
    }}>
      <h1>Sentry Test Page</h1>
      <p style={{ color: '#666' }}>Click the button below to trigger a test error</p>

      <button
        onClick={() => {
          throw new Error("Sentry Test Error - This is a test!");
        }}
        style={{
          padding: '12px 24px',
          backgroundColor: '#e53e3e',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Throw Client Error
      </button>

      <button
        onClick={async () => {
          const response = await fetch('/api/sentry-example-api');
          const data = await response.json();
          console.log(data);
        }}
        style={{
          padding: '12px 24px',
          backgroundColor: '#dd6b20',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Trigger Server Error
      </button>

      <button
        onClick={() => {
          Sentry.captureMessage("Test message from Sentry example page");
          alert("Message sent to Sentry!");
        }}
        style={{
          padding: '12px 24px',
          backgroundColor: '#38a169',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '16px'
        }}
      >
        Send Test Message
      </button>
    </div>
  );
}
