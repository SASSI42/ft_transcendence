import Logo from '../../assets/mobile-logo.svg'
import { IoChevronDownOutline, IoChevronUpOutline, IoPerson, IoSettingsSharp, IoLogOut } from "react-icons/io5";
import { useState, useEffect } from 'react';
import getBackendUrl from '../../api/getUrl';
import LogOutApi from '../../api/logOutApi';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import default_avatar from '../../assets/default_avatar.png'


async function logOUT() {
   await LogOutApi();
    window.location.assign('/signin')
}

export const Header = ({classes = ""}) => {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const toggle = () => { setShow(!show) }

  const [Avatar, setAvatar] = useState('');
  const [username, setUsername] = useState('Loading...');

  useEffect(()=>{
    const fetch_data = async ()=>{
      try{
        const response = await fetch(`${getBackendUrl()}:3000/api/user/user_profile`, {
          method:'GET',
          credentials: "include"
        });
        const data = await response.json();
        if (data && data.user_data)
        {
          setUsername(data.user_data.username);
          const AVATAR = data.user_data.Avatar;
          if (AVATAR && AVATAR[0] === '/')
              setAvatar(`${getBackendUrl()}:3000${AVATAR}`);
          else
            setAvatar(AVATAR);
        }
      }catch(err)
      {
        console.error("Error fetching user data:", err);
      }
      finally{
      }
    }
    fetch_data();
  }, [])
      const fallbackImage = "https://ui-avatars.com/api/?name=User";

 return (
    <div className={classes}>
      <div className={`flex flex-row justify-between h-28 p-4 text-primary font-bebas-neue`}>
        {/* Logo */}
        <img className="p-1" src={Logo} alt='avatar'/>
        <div className='relative w-fit m-3 text-h4'>
          {/* Profile dropdown */}
          <div onClick={toggle} className="relative z-50 flex items-center gap-2 p-2 drop-shadow-xl rounded-full bg-secondaryGradient">
            <img className=" w-10 h-10 shrink-0 rounded-full"
              src={Avatar || default_avatar}
              crossOrigin='anonymous' 
              referrerPolicy='no-referrer' 
              onError={(e) => { e.currentTarget.src = fallbackImage }} alt="avatar" />

            <div className='w-full min-w-16 justify-start'>{username}</div>
            {show ? <IoChevronUpOutline className="h-10 w-10 mr-2" /> : <IoChevronDownOutline className="h-10 w-10 mr-2" />}
          </div>
          {/* Dropdown */}
          <div className={`
    flex flex-col gap-2 justify-center absolute left-0 pb-3 right-0 top-6 z-51
    rounded-b-3xl bg-bgsecondary
    transition-all duration-300 ease-out overflow-hidden
    ${show ? 'max-h-96 pt-12' : 'max-h-0 pt-0'}
  `}>
            <button className='flex item-center gap-4 ml-5 hover:text-accent' onClick={()=>{navigate("/user_profile")}}><IoPerson /> Profile</button>
            <Link to= '/settings' className='flex item-center gap-4 ml-5 hover:text-accent'><IoSettingsSharp /> Settings</Link>
            <button className='flex item-center gap-4 ml-5 hover:text-red' onClick={logOUT}><IoLogOut /> LOG OUT</button>
          </div>
        </div>
      </div>
    </div>
  );
};