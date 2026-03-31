import Input from './input'
import useForm from './useFormInput';
import EmailField from './EmailField';
import { Link} from 'react-router-dom';
import signInApi from '../../api/signinApi';
import PasswordField from './PasswordField';
import { useNavigate } from 'react-router-dom';
import GoogleIcon from '../../assets/googleIcon.png';
import PingoHappy from '../../assets/pingo_happy.svg';
import { useApiSubmission } from '../../hooks/useApiSubmission';
import validateEmail, { validatePassword } from '../../utils/FormValidation'
import { useToast } from './toastContext';
import getBackendUrl from '../../api/getUrl'

import { useAuth } from './authContext';

function Signin() {
	const { login } = useAuth();
	const {showToast} = useToast() as any;
	const email = useForm('', validateEmail);
	const password = useForm('', validatePassword);
	const navigate = useNavigate();
	const {isSuccess, submissionError, submit } = useApiSubmission();
	
	const handleSubmit = async (e:any) => {
		e.preventDefault();
		const mailerror = validateEmail(email.value)
		const passworderror = validatePassword(password.value)

		email.setError(mailerror);
		password.setError(passworderror);

		if (mailerror || passworderror) {
			return ;
		}
		const apiCall = () => signInApi(email.value.trim(), password.value);

		try {
			const response = await submit(apiCall);
			showToast(`${response.message}`, response.success ? 'success' : 'failure');
			if (response.success && response.twoFactor)
			{
				navigate("/twoFactor")
				const payload = {email:email.value}
				let res = await fetch(`${getBackendUrl()}:3000/api/user/two_factor`, {
					method:'PUT',
					headers: {"Content-Type": "application/json",},
        			body: JSON.stringify(payload),
					credentials:'include'
				});
				const result = await res.json();
				showToast(`${result.message}`, result.success ? 'success' : 'failure');
				return ;
			}
			if (response.success)
			{
				login(response.user);
				navigate('/user_profile');
			}
		} catch (error) {
			console.error("Submission failed, error shown to user.");
		}
	};
	return (
		<>
		    <img className="w-12" src={PingoHappy} alt='Profile'/>
			<div className="m-3">
				<p className="font-bebas-neue text-h4">Sign In to Pongfinity</p>
				<p className="text-h5body">Join the game, connect with friends</p>
			</div>
			{submissionError && (<span className={isSuccess ? 'submission-success' : 'submission-error'}> {submissionError} </span>)}
			<form onSubmit={handleSubmit} className="flex flex-col gap-2 w-4/5">
				<div className={`flex flex-col gap-0 rounded-lg ${email.error ? "bg-red/15" : ""}`}>
				<EmailField
					onChange={email.onChange}
					onBlur={email.onBlur}
					value={email.value}
					error={email.error}
				/>
				{email.error && <span className='error-span' > {email.error}</span>}
				</div>
				<div className={`flex flex-row flex-wrap gap-2 ${password.error ? "bg-red/15" : ""}`}>
				<PasswordField
					className="flex-[1.8] sm:min-w-[150px]"
					onChange={password.onChange}
					onBlur={password.onBlur}
					value={password.value}
					error={password.error}
				/>
				<Input
					className="flex-[1.2] sm:min-w-[90px]"
					type="submit"
					name="submit"
					value="submit"
					error={email.error != password.error}
					isLoading={false}
				/>
				</div>
				{password.error && <span className='error-span bg-red/15 -mt-[10px] rounded-b-lg' > {password.error}</span>}
				<Link to="/forgot-password" className="self-start ml-2 link-hover-effect text-h5body text-primary">
				Forgot password ?
				</Link>
				<div className="flex flex-row items-center justify-evenly">
					<hr className="w-1/3 border-bgsecondary" />
						<p className="text-h6body font-bebas-neue">or</p>
					<hr className="w-1/3 border-bgsecondary" />
				</div>
			</form>
			<div className="flex flex-row flex-wrap mb-4 text-h6 gap-y-2 justify-evenly font-bebas-neue">
				<a href ={`${getBackendUrl()}:3000/api/login/google`} className="inline-flex items-center gap-1 secondary-button">
					<img className="w-3" src={GoogleIcon} alt='Icon'/>
					<p className='leading-none'>login with Google</p>
				</a>

				<Link to="/signup" className="ml-2 secondary-button">
					create account
				</Link>
			</div>
		</>
	);
}

export default Signin;