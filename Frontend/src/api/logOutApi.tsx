import getBackendUrl from './getUrl'

const LogOutApi = async () => {
    const url = `${getBackendUrl()}:3000/api/user/logout`

    const requestOptions:object = {
        method: 'POST',
        credentials:'include'
    }
    let response = await fetch(url, requestOptions);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.message || `${response.status}`);
    }
    return data;
};

export default LogOutApi;