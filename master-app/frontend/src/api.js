export const apiFetch = async (url, options = {}) => {
  const headers = { ...options.headers };
  
  const response = await fetch(url, { 
    ...options, 
    headers,
    credentials: 'include'
  });
  
  if (response.status === 401) {
    localStorage.removeItem('aegissight_loggedIn');
    window.dispatchEvent(new Event('storage'));
  }
  
  return response;
};
