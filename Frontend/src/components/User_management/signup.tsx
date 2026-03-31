import { Link } from 'react-router-dom';
import useForm from './useFormInput';
import UsernameField from './UsernameField';
import EmailField from './EmailField';
import signUpApi from '../../api/signupApi';
import PasswordField from './PasswordField';
import validateEmail from '../../utils/FormValidation';
import { validateUsername } from '../../utils/FormValidation';
import { validatePassword } from '../../utils/FormValidation';
import Input from './input';
import { useApiSubmission } from '../../hooks/useApiSubmission';
import { useNavigate } from 'react-router-dom';
import { useToast } from './toastContext';
import PingoHappy from '../../assets/pingo_happy.svg';
import GoogleIcon from '../../assets/googleIcon.png';
import getBackendUrl from '../../api/getUrl';


function Signup() {
  const email = useForm('', validateEmail);
	const username = useForm('', validateUsername);
	const password = useForm('', validatePassword);
	const navigate = useNavigate();
  const { showToast } = useToast() as any;
	const {isSuccess, submissionError, submit } = useApiSubmission();

	const handleSubmit = async (e:any) => {
		e.preventDefault();

		const mailerror = validateEmail(email.value)
		const passworderror = validatePassword(password.value)
    const confirmPasswordError = validatePassword(password.confirmValue)
    const usernameerror = validateUsername(username.value);

		email.setError(mailerror);
		password.setError(passworderror);
    password.setError3(confirmPasswordError);
		username.setError(usernameerror);
		if (mailerror || passworderror || usernameerror || confirmPasswordError) {
			return ;
		}
		const apiCall = () => signUpApi(username.value, email.value.trim(), password.value, password.confirmValue);

		try {
			const response = await submit(apiCall);
			showToast(`${response.message}`, response.success ? 'success' : 'failure');
      response.success && navigate('/signin');
		} catch (error) {
			console.error("Submission failed, error shown to user.");
		}
	};

  return (
    <>
      <img className="w-12" src={PingoHappy} alt='Profile'/>
      <div className="mb-3">
        <p className="font-bebas-neue text-h4">Create Your Account</p>
        <p className="text-h5body">Join to play and track your progress.</p>
      </div>
      {submissionError && (<span className={isSuccess ? 'submission-success' : 'submission-error'}> {submissionError} </span>)}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-4/5">
        <div className={`flex flex-col gap-0 rounded-lg ${username.error ? "bg-red/15" : ""}`}>
          <UsernameField
            onChange={username.onChange}
            onBlur={username.onBlur}
            value={username.value}
            error={username.error}
            placeHolder='username'
            />
          {username.error && <span className='error-span' > {username.error}</span>}
        </div>
        <div className={`flex flex-col gap-0 rounded-lg ${email.error ? "bg-red/15" : ""}`}>
          <EmailField
            onChange={email.onChange}
            onBlur={email.onBlur}
            value={email.value}
            error={email.error}
            />
          {email.error && <span className='error-span max-w-[300px]' > {email.error}</span>}
        </div>
        <div className={`flex flex-col gap-0 rounded-lg ${password.error ? "bg-red/15" : ""}`}>
				  <PasswordField
				  	onChange={password.onChange}
				  	onBlur={password.onBlur}
				  	value={password.value}
				  	error={password.error}
            />
          {password.error && <span className='error-span' > {password.error}</span>}
        </div>
        <div className={`flex flex-col gap-0 rounded-lg ${password.error3 ? "bg-red/15" : ""}`}>
				  <PasswordField
            placeHolder='Re-enter Password'
				  	onBlur={password.onBlur3}
            onChange={password.onChange3}
            value={password.confirmValue}
            error={password.error3}
          />
          {password.error3 && <span className='error-span' >{password.error3}</span>}
        </div>
		<Input
			className="flex-[1.2] sm:min-w-[90px]"
		  type="submit"
		  name="submit"
		  value="create account"
      error={(username.error != email.error) || (password.error != password.error3)}
      isLoading={false}
		/>
		<div className="flex flex-row items-center justify-evenly">
			<hr className="w-1/3 border-bgsecondary" />
      <p className="text-h6body font-bebas-neue">or</p>
			<hr className="w-1/3 border-bgsecondary" />
      </div>
      <a href={`${getBackendUrl()}:3000/api/login/google`} className="inline-flex items-center gap-0 secondary-button">
      <p className=' w-5/6 font-bebas-neue'>sign up with Google</p>
      <img className="w-4" src={GoogleIcon} alt='Icon'/>
      </a>
        <div className="flex flex-row flex-wrap mb-5 justify-evenly font-bebas-neue">
          <Link to="/signin" className="w-full secondary-button">
          sign in
          </Link>
        </div>
      </form>
    </>
  )
}

export default Signup
