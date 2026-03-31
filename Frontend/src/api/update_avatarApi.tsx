import getBackendUrl from './getUrl'

const update_avatarApi = async (avatar:string) => {
    const url = `${getBackendUrl()}:3000/api/user/update_avatar`

    const formData = new FormData();
    formData.append('file', avatar);

    const requestOptions:object = {
        method: 'POST',
        body: formData,
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
        return{
            success: false,
            message: "Only image files are allowed (JPEG, PNG, GIF, WebP)"
        }
    }
    return response.json();    
}

export default update_avatarApi;