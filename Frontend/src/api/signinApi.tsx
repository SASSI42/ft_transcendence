import getBackendUrl from './getUrl'

const signInApi = async (email: string, password: string) => {
    const payload = {
        email: email,
        password: password 
    };
    const response = await fetch(`${getBackendUrl()}:3000/api/user/signIn`, {
    method: 'POST',
    headers:{"Content-Type": "application/json"},
        body: JSON.stringify(payload),
        credentials: 'include'
    });
    if (!response.ok) {
        const errorData = await response.json(); 
        throw new Error(errorData.message || `${response.status}`);
    }
    return response.json();
};

export default signInApi;