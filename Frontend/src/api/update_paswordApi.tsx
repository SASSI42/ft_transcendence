import getBackendUrl from './getUrl'

const update_passwordApi = async (oldPass: string, newPass: string, conPass:string) => {
    const url = `${getBackendUrl()}:3000/api/user/update_password`
    const payload = {
        oldPassword: oldPass,
        newPassword: newPass,
    };

    if (newPass !== conPass)
        throw new Error('mismatched passwords');

    const requestOptions:object = {
        method: 'PUT',
        headers: {"Content-Type": "application/json",},
        body: JSON.stringify(payload),
        credentials:'include'
    }

    let response = await fetch(url, requestOptions);

    if (response.status === 401)
    {
        const refreshResponse = await fetch(`${getBackendUrl()}:3000/api/user/refresh`, {
            method: 'POST',
            credentials:'include'
        });
        if (refreshResponse.ok)
            response = await fetch(url, requestOptions);
        else
            throw new Error('Session expired. Please log in again.');
    }
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.message || `${response.status}`);
    }
    return response.json();
};

export default update_passwordApi;