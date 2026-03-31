import getBackendUrl from './getUrl' 

const signUpApi = async (username: string, email: string, password: string, confirmPassword:string) =>
{
  const payload = { username, email, password };

  if (password !== confirmPassword)
    throw new Error('mismatched passwords');
  const response = await fetch(`${getBackendUrl()}:3000/api/user/signUp`, {
    method: "POST",
    headers: { "Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `${response.status}`);
  }
  return response.json();
};

export default signUpApi;