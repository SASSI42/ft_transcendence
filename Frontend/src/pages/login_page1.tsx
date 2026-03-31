import { Link } from 'react-router-dom';
import Logo from '../assets/mobile-logo.svg';

const paths = {
  "sign_in" : ["/signin", "Sign in"],
  "sign_up" : ["/signup", "Sign up"],
  "password_lost" : ["/forgot-password", "Forgot Password"],
  "password_reset" : ["/reset-password", "Reset Password"],
  "update_password" : ["/update_password", "Update_password"],
  "update_email" : ["/update_email", "Update_email"],
  "update_username" : ["/update_username", "Update_username"],
  "not_found_page" : ["/not_found_page", "we are so Sorry!!"],
  "two_factor" : ["/two_factor", "two factor auth"],
  "user_profile" : ["/user_profile", "user profile"],
  "update_avatar" : ["/update_avatar", "update_avatar"],
} as const;

type PageKey = keyof typeof paths

interface LoginPageProps{
  children:React.ReactNode;
  page: PageKey
}

const LoginPage1:React.FC<LoginPageProps> = ( {children, page} ) => {
  return (
    <div className="flex flex-col justify-between h-screen">
      <div className="flex flex-row items-center justify-between m-5 lg:m-6 xl:m-6">
        <Link to="/signin"><img src={Logo} /></Link>
      </div>

      <div className="flex flex-col items-center self-center justify-around w-5/6 max-w-[400px] 
      px-6 text-center rounded-3xl bg-secondaryGradient 
      border-2 border-t-amber-300 border-l-amber-300 border-b-teal-300 border-r-teal-300">

        <span className="relative px-8 py-2 text-h4 bg-bgsecondary rounded-xl bottom-6 font-bebas-neue border-2 border-white-400">
          {paths[page][1]}
        </span>
        {children}
      </div>
      <div className='h-6'></div>
    </div>
  )
}

export default LoginPage1
