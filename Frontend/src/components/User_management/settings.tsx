import { Link } from "react-router-dom"
import PingoHappy from '../../assets/pingo_happy.svg';
import getBackendUrl from "../../api/getUrl";
import { useToast } from './toastContext';

export function Settings()
{
    const {showToast} = useToast() as any;

    async function endpoint() {
        const url = `${getBackendUrl()}:3000/api/user/tfa_activator`;
        const requestOption:object = {
            method: "PUT",
            credentials:'include'
        }
        let response =  await fetch(url, requestOption)
        if (response.status === 401)
        {
            const refreshResponse = await fetch(`${getBackendUrl()}:3000/api/user/refresh`, {
                method: 'POST',
                credentials:'include'
            });
            if (refreshResponse.ok)
                response = await fetch(url, requestOption);
            else
                throw new Error('Session expired. Please log in again.');
        }
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data?.message || `${response.status}`);
        }

        return data;
    }
    const handleTfaToggle = async () => {
        try{
            const response = await endpoint();
            showToast(response.message || "2FA Updated", 'success');
        }catch(err:any)
        {
            showToast(`${err.message}`, err.success ? 'success' : 'failure');

        }
    }
    return (
        <>
        <img className="w-12" src={PingoHappy} alt="Profile"/>
        <div className="m-3">
            <p className="font-bebas-neue text-h4">Account settings</p>
            <p className="text-h5body">manage your account</p>
			</div>
        <div className="grid grid-cols-1 md:grid-cols-2 overflow-auto">
            {
                [
                    {l:'/update_avatar', n:'Update_avatar'},
                    {l:'/update_username', n:'Update_username'},
                    {l:'/update_email', n:'Update_email'},
                    {l:'/update_password', n:'Update_password'},
                ].map((stat, idx)=>(
                    <Link to={stat.l} key={idx}
                    className="font-bebas-neue border-2 w-[120px] rounded-2xl m-2 p-2 
                    hover:scale-105 
                    hover:bg-cyan-300 
                    hover:text-black 
                    hover:border-black transition delay-150">{stat.n}</Link>
                ))
            }
        </div>
        <button className="font-bebas-neue border-2 rounded-2xl p-2 m-5 hover:scale-105 hover:bg-emerald-300 hover:text-black hover:border-black transition delay-150"
        onClick={handleTfaToggle}>two factor auth</button>
        </>
    )
}
