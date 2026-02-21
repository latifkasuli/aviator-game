
console.log('Testing Player Settings Endpoint...');

const token = localStorage.getItem('auth_token');
const user = localStorage.getItem('user');

console.log('\nLocal Storage Contents:');
console.log('Token key "auth_token":', token ? token.substring(0, 20) + '...' : 'NOT FOUND');
console.log('User data:', user);

console.log('\n🔑 All localStorage keys:', Object.keys(localStorage));

if (!token) {
  console.error('\nNo token found! Please make sure you are logged in.');
  console.log('Looking for token in all localStorage keys...');
  Object.keys(localStorage).forEach(key => {
    if (key.toLowerCase().includes('token')) {
      console.log(`Found potential token key: ${key} = ${localStorage.getItem(key)?.substring(0, 20)}...`);
    }
  });
} else {
  console.log('\nToken found!');
  
  console.log('\nTesting PUT /api/player/settings...');
  fetch('https://aviator-game-production.up.railway.app/api/player/settings', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({ 
      autoCashoutEnabled: true, 
      autoCashoutMultiplier: 2.5,
      soundEnabled: false 
    })
  })
  .then(r => {
    console.log('Response status:', r.status);
    console.log('Response headers:', Object.fromEntries(r.headers.entries()));
    return r.json();
  })
  .then(data => {
    console.log('Response data:', data);
    
    if (data.debug && data.seenUserId) {
      console.log('\nSUCCESS! The endpoint is working!');
      console.log('User ID seen by server:', data.seenUserId);
      console.log('Request body echoed back:', data.echoed);
    } else {
      console.log('\nUnexpected response format');
    }
  })
  .catch(err => {
    console.error('Request failed:', err);
  });
  
  console.log('\nTesting GET /api/player/settings...');
  fetch('https://aviator-game-production.up.railway.app/api/player/settings', {
    headers: { 
      'Authorization': `Bearer ${token}` 
    }
  })
  .then(r => r.json())
  .then(data => {
    console.log('GET Response:', data);
  })
  .catch(err => {
    console.error('GET failed:', err);
  });
}

console.log('\nChecking for auth service in global scope:');
console.log('window.authService:', window.authService);
console.log('window.auth:', window.auth);
console.log('globalThis.authService:', globalThis.authService);

if (token) {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      console.log('\nDecoded token payload:', payload);
    }
  } catch (e) {
    console.log('Could not decode token');
  }
}
