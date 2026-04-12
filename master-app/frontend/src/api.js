export const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('aegissight_token');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`
  };
  
  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    // If token expired or invalid, log out the user
    localStorage.removeItem('aegissight_token');
    window.dispatchEvent(new Event('storage'));
  }
  
  return response;
};
