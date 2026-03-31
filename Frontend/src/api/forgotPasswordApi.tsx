import getBackendUrl from './getUrl'

const ForgotPassword = async (email: string) => {
    const payload = {
        email: email
    };

    const response = await fetch(`${getBackendUrl()}:3000/api/user/forgot-password`, {
        method: 'PUT',
        headers: {"Content-Type": "application/json",},
        body: JSON.stringify(payload),
        credentials:'include'
    });
    if (!response.ok) {
        const errorData = await response.json(); 
        throw new Error(errorData.message || `${response.status}`);
    }
    return response.json();
};

export default ForgotPassword;