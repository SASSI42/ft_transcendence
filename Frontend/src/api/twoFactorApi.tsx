import getBackendUrl from './getUrl'

const twoFactor = async (code: string) => {
    const payload = {
        code: code
    };
    const response = await fetch(`${getBackendUrl()}:3000/api/user/verifyCode`, {
        method: 'PUT',
        headers: {"Content-Type": "application/json",},
        body: JSON.stringify(payload),
        credentials:'include'
    });
    if (!response.ok) {
        throw new Error(`${response.status}`);
    }
    return response.json();
};

export default twoFactor;