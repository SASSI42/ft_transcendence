const getBackendUrl = () => {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}`; 
};

export default getBackendUrl