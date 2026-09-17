import React, { useState } from 'react';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState('STANDARD');
  const [message, setMessage] = useState('');

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'attendant', password: 'attendant123' })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        setMessage('Logged in successfully');
      } else {
        setMessage('Login failed');
      }
    } catch (err) {
      setMessage('Error connecting to server');
    }
  };

  const checkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/sessions/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plate, vehicleType })
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Checked in ${data.plate} at spot ${data.spot.spotNumber}`);
      } else {
        setMessage(data.message || 'Check-in failed');
      }
    } catch (err) {
      setMessage('Error checking in');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Parking Garage System</h1>
        
        {message && <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">{message}</div>}

        {!token ? (
          <form onSubmit={login} className="space-y-4">
            <button type="submit" className="w-full bg-black text-white p-2 rounded">
              Login as Attendant
            </button>
          </form>
        ) : (
          <form onSubmit={checkIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">License Plate</label>
              <input 
                type="text" 
                value={plate} 
                onChange={e => setPlate(e.target.value)}
                className="w-full border p-2 rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle Type</label>
              <select 
                value={vehicleType} 
                onChange={e => setVehicleType(e.target.value)}
                className="w-full border p-2 rounded"
              >
                <option value="COMPACT">Compact</option>
                <option value="STANDARD">Standard</option>
                <option value="EV">EV</option>
              </select>
            </div>
            <button type="submit" className="w-full bg-black text-white p-2 rounded">
              Check In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
