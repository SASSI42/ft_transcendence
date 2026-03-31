import getBackendUrl from './getUrl'

const RecoverPasswordApi = async (code:string, newPassword: string, confirmPassword:string) => {
    const payload = {
        Code: code,
        newPassword: newPassword,
    };

    if (newPassword !== confirmPassword)
    {
        throw new Error('mismatched passwords');
    }
    const response = await fetch(`${getBackendUrl()}:3000/api/user/reset-password`, {
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

export default RecoverPasswordApi;