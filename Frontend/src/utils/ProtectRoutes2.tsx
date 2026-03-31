import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../components/User_management/authContext"; // Import hook
import logo from '../assets/mobile-logo.svg'
import PindoSad from '../assets/pingo_sad.svg'

const ProtectRoutes2 = () => {
    const { isLoggedIn, isLoading, serverError } = useAuth();

    if (isLoading) {
        return(
            <div className="min-h-screen flex flex-col bg-secodaryGredient">
                <img className="px-4 py-8 w-[200px]" src={logo} alt="logo" />
                <div className="flex-grow flex justify-center items-center">
                    <h1 className="text-5xl font-bebas-neue text-cyan-300">Loading ....</h1>
                </div>
            </div>
        )
    }

    if (serverError) {
        return (
            <div className="bg-secodaryGredient min-h-screen flex flex-col">
            <img className="px-4 py-8 w-[200px]" src={logo}/>
                <div className="flex-grow flex justify-center items-center">
                <div>
                <img className="w-[120px]" src={PindoSad}/>
                <h1 className="text-4xl font-bold flex justify-center">404</h1>
                <h1 className="text-4xl font-bebas-neue  px-5 text-amber-500 flex justify-center">Oops, something went wrong.</h1>
                <h1 className="text-4xl font-bebas-neue text-emerald-400 px-5 flex justify-center py-2">Try to refersh this page.</h1>
                </div>
                </div>
            </div>
        )
    }

    return isLoggedIn ? <Outlet /> : <Navigate to="/signin"/>;
};

export default ProtectRoutes2;